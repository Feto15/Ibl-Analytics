#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from ibl_extract.advanced_parsers import (
    parse_lineup_page,
    parse_player_plus_minus,
    parse_rotation_page,
    parse_shot_area_totals,
    parse_start_list,
)
from ibl_extract.core import normalize_name


SUPPORTED_TYPES = {
    "start_list",
    "lineup",
    "rotations",
    "plus_minus",
    "shot_areas",
}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")


def describe_validation(validation: dict[str, Any]) -> None:
    report_type = validation["report_type"]
    if report_type == "rotations":
        rule_code = "rotation_totals_mismatch"
        message = (
            "Total durasi atau skor Rotation Summary tidak sama dengan "
            "hasil akhir pertandingan."
        )
    elif report_type == "lineup":
        rule_code = "lineup_totals_mismatch"
        message = (
            "Total durasi atau skor Line Up Analysis tidak sama dengan "
            "hasil akhir pertandingan."
        )
    elif report_type == "plus_minus":
        if validation.get("expected_plus_minus") is None:
            rule_code = "plus_minus_crosscheck_unavailable"
            message = (
                "Plus-minus tidak dapat divalidasi karena pasangan data "
                "Player Evaluation tidak tersedia."
            )
        else:
            rule_code = "plus_minus_value_mismatch"
            message = (
                "Nilai plus-minus berbeda dari data Player Evaluation."
            )
    else:
        rule_code = "shot_area_box_score_mismatch"
        fields = ", ".join(validation.get("mismatched_fields") or [])
        message = (
            "Total Shot Areas berbeda dari box score final"
            + (f" pada kolom: {fields}." if fields else ".")
        )

    identity = {
        "source_sha256": validation["source_sha256"],
        "rule_code": rule_code,
        "team_code": validation.get("team_code"),
        "player_key": validation.get("player_key"),
        "jersey_no": validation.get("jersey_no"),
        "display_name": validation.get("display_name"),
    }
    validation["severity"] = (
        "warning" if validation["status"] == "needs_review" else "info"
    )
    validation["rule_code"] = rule_code
    validation["message"] = message
    validation["issue_key"] = hashlib.sha256(
        json.dumps(identity, sort_keys=True).encode("utf-8")
    ).hexdigest()


def report_text(raw_report: dict[str, Any]) -> str:
    return "\n".join(
        page.get("text") or "" for page in raw_report.get("pages") or []
    )


def player_score(label: str, normalized_name: str) -> int:
    label_tokens = set(normalize_name(label).split())
    name_tokens = set(normalized_name.split())
    return len(label_tokens.intersection(name_tokens))


def team_code_map(
    report: dict[str, Any],
    game: dict[str, Any],
) -> dict[str, str]:
    ordered_names = []
    for player in report.get("player_stats") or []:
        team_name = normalize_name(player.get("team_name") or "")
        if team_name and team_name not in ordered_names:
            ordered_names.append(team_name)
    result = {}
    home_name = normalize_name(game.get("home_team_name") or "")
    away_name = normalize_name(game.get("away_team_name") or "")
    for team_name in ordered_names:
        if home_name and (
            team_name in home_name or home_name in team_name
        ):
            result[team_name] = game.get("home_team_code")
        elif away_name and (
            team_name in away_name or away_name in team_name
        ):
            result[team_name] = game.get("away_team_code")
    for index, team_name in enumerate(ordered_names[:2]):
        result.setdefault(
            team_name,
            game.get("home_team_code" if index == 0 else "away_team_code"),
        )
    return result


def resolve_players(
    players: list[dict[str, Any]],
    roster: dict[tuple[str, str, str], list[dict[str, Any]]],
    game_key: str,
    team_code: str,
) -> int:
    unresolved = 0
    for player in players:
        candidates = roster.get(
            (game_key, team_code, str(player["jersey_no"])),
            [],
        )
        if len(candidates) == 1:
            resolved = candidates[0]
        else:
            ranked = sorted(
                (
                    (
                        player_score(
                            player.get("player_label")
                            or player.get("display_name")
                            or "",
                            candidate["normalized_name"],
                        ),
                        candidate,
                    )
                    for candidate in candidates
                ),
                key=lambda item: item[0],
                reverse=True,
            )
            resolved = (
                ranked[0][1]
                if ranked
                and ranked[0][0] > 0
                and (
                    len(ranked) == 1
                    or ranked[0][0] > ranked[1][0]
                )
                else None
            )
        player["player_key"] = (
            resolved.get("player_key") if resolved else None
        )
        player["normalized_name"] = (
            resolved.get("normalized_name")
            if resolved
            else player.get("normalized_name")
        )
        unresolved += resolved is None
    return unresolved


def append_rotation_page(
    existing: list[dict[str, Any]],
    rows: list[dict[str, Any]],
    team_code: str,
) -> None:
    next_index = (
        sum(row["team_code"] == team_code for row in existing) + 1
    )
    for row in rows:
        row["stint_index"] = next_index
        next_index += 1
    existing.extend(rows)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Parse roster, lineup, rotation, and validation reports."
    )
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--raw-reports", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    manifest = read_jsonl(args.manifest)
    roster: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    player_stats_by_key = {}
    final_box_by_game = {}
    for report in manifest:
        game = report.get("game") or {}
        game_key = game.get("source_game_key")
        if report.get("report_type") == "player_evaluation":
            team_codes = team_code_map(report, game)
            for player in report.get("player_stats") or []:
                team_code = team_codes.get(
                    normalize_name(player.get("team_name") or "")
                )
                if not team_code:
                    continue
                player_key = (
                    f"{game_key}:{team_code}:{player['jersey_no']}:"
                    f"{player['normalized_name']}"
                )
                item = {
                    "player_key": player_key,
                    "normalized_name": player["normalized_name"],
                    "plus_minus": player.get("plus_minus"),
                }
                roster[
                    (game_key, team_code, str(player["jersey_no"]))
                ].append(item)
                player_stats_by_key[player_key] = player
        elif (
            report.get("report_type") == "box_score"
            and report.get("parse_status") == "parsed"
        ):
            current = final_box_by_game.get(game_key)
            if current is None or int(
                report.get("report_period") or 0
            ) > int(current.get("report_period") or 0):
                final_box_by_game[game_key] = report

    outputs = []
    validations = []
    report_counts = Counter()
    unresolved_players = 0
    payload_signatures = {}
    for report in manifest:
        report_type = report.get("report_type")
        if report_type not in SUPPORTED_TYPES:
            continue
        raw_path = args.raw_reports / f"{report['source_sha256']}.json"
        raw = json.loads(raw_path.read_text(encoding="utf-8"))
        pages = raw.get("pages") or []
        text = report_text(raw)
        game = report.get("game") or {}
        game_key = game["source_game_key"]
        home = game["home_team_code"]
        away = game["away_team_code"]
        payload: dict[str, Any] = {}
        report_unresolved_players = 0

        if report_type == "start_list":
            payload["start_list_players"] = parse_start_list(text)
            for player in payload["start_list_players"]:
                report_unresolved_players += resolve_players(
                    [player],
                    roster,
                    game_key,
                    player["team_code"],
                )
        elif report_type == "lineup":
            payload["lineup_summaries"] = []
            for index, page in enumerate(pages):
                team_code = away if index == 0 else home
                rows = parse_lineup_page(page.get("text") or "", team_code)
                for row in rows:
                    report_unresolved_players += resolve_players(
                        row["players"], roster, game_key, team_code
                    )
                payload["lineup_summaries"].extend(rows)
        elif report_type == "rotations":
            payload["rotation_stints"] = []
            for index, page in enumerate(pages):
                team_code = away if index == 0 else home
                rows = parse_rotation_page(
                    page.get("text") or "", team_code
                )
                for row in rows:
                    report_unresolved_players += resolve_players(
                        row["players"], roster, game_key, team_code
                    )
                    row["is_starting_lineup"] = (
                        row["start_period"] == 1
                        and row["start_clock"] == "10:00"
                    )
                append_rotation_page(
                    payload["rotation_stints"], rows, team_code
                )
        elif report_type == "plus_minus":
            rows = parse_player_plus_minus(text)
            for player in rows:
                candidates = []
                for team_code in (home, away):
                    candidates.extend(
                        (
                            team_code,
                            candidate,
                        )
                        for candidate in roster.get(
                            (
                                game_key,
                                team_code,
                                str(player["jersey_no"]),
                            ),
                            [],
                        )
                    )
                ranked = sorted(
                    (
                        (
                            player_score(
                                player["display_name"],
                                candidate["normalized_name"],
                            ),
                            team_code,
                            candidate,
                        )
                        for team_code, candidate in candidates
                    ),
                    reverse=True,
                    key=lambda item: item[0],
                )
                if ranked and ranked[0][0] > 0:
                    player["team_code"] = ranked[0][1]
                    player["player_key"] = ranked[0][2]["player_key"]
                    player["normalized_name"] = ranked[0][2][
                        "normalized_name"
                    ]
                else:
                    player["team_code"] = None
                    player["player_key"] = None
                    report_unresolved_players += 1
            payload["player_plus_minus"] = rows
        elif report_type == "shot_areas":
            payload["shot_area_totals"] = parse_shot_area_totals(
                text, home, away
            )

        signature = json.dumps(payload, ensure_ascii=False, sort_keys=True)
        signature_key = (game_key, report_type, signature)
        duplicate_of = payload_signatures.get(signature_key)
        if duplicate_of:
            payload = {
                key: [] for key in payload
            }
        else:
            payload_signatures[signature_key] = report["source_sha256"]
            unresolved_players += report_unresolved_players

        record_count = sum(
            len(value)
            for value in payload.values()
            if isinstance(value, list)
        )
        status = (
            "duplicate"
            if duplicate_of
            else "parsed"
            if record_count
            else "raw_only"
        )
        report_counts[(report_type, status)] += 1
        output = {
            "source_game_key": game_key,
            "season_year": game.get("season_year"),
            "source_path": report["source_path"],
            "source_sha256": report["source_sha256"],
            "report_type": report_type,
            "report_period": report.get("report_period"),
            "report_scope": report.get("report_scope"),
            "parse_status": status,
            "duplicate_of_source_sha256": duplicate_of,
            **payload,
        }
        outputs.append(output)

        if duplicate_of:
            continue
        if report_type in {"lineup", "rotations"}:
            rows = payload[
                "lineup_summaries"
                if report_type == "lineup"
                else "rotation_stints"
            ]
            for team_code in (home, away):
                team_rows = [
                    row for row in rows if row["team_code"] == team_code
                ]
                validations.append(
                    {
                        "source_game_key": game_key,
                        "source_path": report["source_path"],
                        "source_sha256": report["source_sha256"],
                        "report_type": report_type,
                        "team_code": team_code,
                        "rows": len(team_rows),
                        "duration_seconds": sum(
                            row["duration_seconds"] or 0
                            for row in team_rows
                        ),
                        "score_for": sum(
                            row["score_for"] for row in team_rows
                        ),
                        "score_against": sum(
                            row["score_against"] for row in team_rows
                        ),
                        "status": "pending",
                    }
                )
        elif report_type == "plus_minus":
            for player in payload["player_plus_minus"]:
                expected = (
                    player_stats_by_key.get(player.get("player_key"), {})
                    .get("plus_minus")
                )
                validations.append(
                    {
                        "source_game_key": game_key,
                        "source_path": report["source_path"],
                        "source_sha256": report["source_sha256"],
                        "report_type": report_type,
                        "player_key": player.get("player_key"),
                        "jersey_no": player.get("jersey_no"),
                        "display_name": player.get("display_name"),
                        "expected_plus_minus": expected,
                        "parsed_plus_minus": player["plus_minus_on"],
                        "status": (
                            "passed"
                            if expected == player["plus_minus_on"]
                            else "needs_review"
                        ),
                    }
                )
        elif (
            report_type == "shot_areas"
            and report.get("report_scope") == "full"
        ):
            final_box_rows = (
                final_box_by_game.get(game_key, {}).get("team_stats")
                or []
            )
            expected_rows = {
                team_code: row
                for team_code, row in zip(
                    (home, away), final_box_rows, strict=False
                )
            }
            for row in payload["shot_area_totals"]:
                expected = expected_rows.get(row["team_code"])
                fields = (
                    "fg_made",
                    "fg_attempted",
                    "two_pt_made",
                    "two_pt_attempted",
                    "three_pt_made",
                    "three_pt_attempted",
                    "ft_made",
                    "ft_attempted",
                )
                mismatches = [
                    field
                    for field in fields
                    if expected is None
                    or row.get(field) != expected.get(field)
                ]
                validations.append(
                    {
                        "source_game_key": game_key,
                        "source_path": report["source_path"],
                        "source_sha256": report["source_sha256"],
                        "report_type": report_type,
                        "team_code": row["team_code"],
                        "mismatched_fields": mismatches,
                        "status": (
                            "passed"
                            if not mismatches
                            else "needs_review"
                        ),
                    }
                )

    game_by_key = {}
    for report in manifest:
        game = report.get("game") or {}
        game_key = game.get("source_game_key")
        if not game_key:
            continue
        current = game_by_key.get(game_key)
        candidate_rank = (
            len(game.get("period_scores") or []),
            int(game.get("home_score") or 0)
            + int(game.get("away_score") or 0),
        )
        current_rank = (
            len(current.get("period_scores") or []),
            int(current.get("home_score") or 0)
            + int(current.get("away_score") or 0),
        ) if current else (-1, -1)
        if candidate_rank > current_rank:
            game_by_key[game_key] = game
    for validation in validations:
        if validation["status"] != "pending":
            continue
        game = game_by_key[validation["source_game_key"]]
        team_code = validation["team_code"]
        is_home = team_code == game["home_team_code"]
        expected_for = (
            game["home_score"] if is_home else game["away_score"]
        )
        expected_against = (
            game["away_score"] if is_home else game["home_score"]
        )
        periods = len(game.get("period_scores") or [])
        expected_duration = 2400 + max(0, periods - 4) * 300
        validation["expected_duration_seconds"] = expected_duration
        validation["expected_score_for"] = expected_for
        validation["expected_score_against"] = expected_against
        validation["status"] = (
            "passed"
            if abs(
                validation["duration_seconds"] - expected_duration
            ) <= max(5, validation["rows"])
            and validation["score_for"] == expected_for
            and validation["score_against"] == expected_against
            else "needs_review"
        )

    for validation in validations:
        describe_validation(validation)

    write_jsonl(args.output / "advanced_reports.jsonl", outputs)
    write_jsonl(args.output / "advanced_validations.jsonl", validations)
    summary = {
        "reports": len(outputs),
        "report_status": {
            f"{kind}:{status}": count
            for (kind, status), count in sorted(report_counts.items())
        },
        "records": {
            key: sum(len(report.get(key) or []) for report in outputs)
            for key in (
                "start_list_players",
                "lineup_summaries",
                "rotation_stints",
                "player_plus_minus",
                "shot_area_totals",
            )
        },
        "unresolved_player_references": unresolved_players,
        "validations": dict(
            Counter(item["status"] for item in validations)
        ),
    }
    (args.output / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
