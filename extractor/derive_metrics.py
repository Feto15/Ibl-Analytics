#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from ibl_extract.core import normalize_name
from ibl_extract.metrics import (
    FREE_THROW_WEIGHT,
    player_metrics,
    source_arithmetic,
    team_metrics,
)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")


def team_code_map(
    report: dict[str, Any],
    game: dict[str, Any],
) -> dict[str, str]:
    ordered_names = []
    for player in report.get("player_stats") or []:
        name = normalize_name(player.get("team_name") or "")
        if name and name not in ordered_names:
            ordered_names.append(name)
    result = {}
    home_name = normalize_name(game.get("home_team_name") or "")
    away_name = normalize_name(game.get("away_team_name") or "")
    for name in ordered_names:
        if home_name and (name in home_name or home_name in name):
            result[name] = game.get("home_team_code")
        elif away_name and (name in away_name or away_name in name):
            result[name] = game.get("away_team_code")
    for index, name in enumerate(ordered_names[:2]):
        result.setdefault(
            name,
            game.get("home_team_code" if index == 0 else "away_team_code"),
        )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Derive auditable basketball metrics from parsed stats."
    )
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--audit-samples", type=int, default=12)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = read_jsonl(args.manifest)

    final_box_by_game = {}
    player_reports = []
    for report in manifest:
        game = report.get("game") or {}
        game_key = game.get("source_game_key")
        if report.get("report_type") == "player_evaluation":
            player_reports.append(report)
        elif (
            report.get("report_type") == "box_score"
            and report.get("parse_status") == "parsed"
            and len(report.get("team_stats") or []) == 2
        ):
            current = final_box_by_game.get(game_key)
            rank = int(report.get("report_period") or 0)
            if current is None or rank > int(
                current.get("report_period") or 0
            ):
                final_box_by_game[game_key] = report

    player_rows = []
    validations = []
    for report in player_reports:
        game = report["game"]
        game_key = game["source_game_key"]
        team_codes = team_code_map(report, game)
        for player in report.get("player_stats") or []:
            team_code = team_codes.get(
                normalize_name(player.get("team_name") or "")
            )
            player_key = (
                f"{game_key}:{team_code or 'UNK'}:"
                f"{player['jersey_no']}:{player['normalized_name']}"
            )
            arithmetic = source_arithmetic(player)
            validations.append(
                {
                    "entity_type": "player",
                    "entity_key": player_key,
                    **arithmetic,
                }
            )
            player_rows.append(
                {
                    "source_game_key": game_key,
                    "season_year": game.get("season_year"),
                    "team_code": team_code,
                    "player_key": player_key,
                    "jersey_no": player["jersey_no"],
                    "display_name": player["display_name"],
                    "normalized_name": player["normalized_name"],
                    **player_metrics(player),
                }
            )

    team_rows = []
    for game_key, report in final_box_by_game.items():
        game = report["game"]
        stats_rows = []
        for team_code, source in zip(
            (
                game["home_team_code"],
                game["away_team_code"],
            ),
            report["team_stats"],
            strict=True,
        ):
            stats_rows.append(
                {
                    **source,
                    "source_team_code": source["team_code"],
                    "team_code": team_code,
                }
            )
        by_code = {row["team_code"]: row for row in stats_rows}
        for stats in stats_rows:
            opponents = [
                row
                for code, row in by_code.items()
                if code != stats["team_code"]
            ]
            if len(opponents) != 1:
                continue
            arithmetic = source_arithmetic(stats)
            entity_key = f"{game_key}:{stats['team_code']}"
            validations.append(
                {
                    "entity_type": "team",
                    "entity_key": entity_key,
                    **arithmetic,
                }
            )
            team_rows.append(
                {
                    "source_game_key": game_key,
                    "season_year": game.get("season_year"),
                    "team_code": stats["team_code"],
                    "opponent_team_code": opponents[0]["team_code"],
                    **team_metrics(stats, opponents[0]),
                }
            )

    player_rows.sort(
        key=lambda row: (
            row["source_game_key"],
            row["team_code"] or "",
            row["jersey_no"],
        )
    )
    team_rows.sort(
        key=lambda row: (row["source_game_key"], row["team_code"])
    )
    write_jsonl(args.output / "player_metrics.jsonl", player_rows)
    write_jsonl(args.output / "team_metrics.jsonl", team_rows)
    write_jsonl(args.output / "metric_validations.jsonl", validations)

    samples = []
    seasons_seen = Counter()
    for row in team_rows:
        season = row["season_year"]
        if seasons_seen[season] >= max(1, args.audit_samples // 2):
            continue
        source = next(
            stats
            for team_code, stats in zip(
                (
                    final_box_by_game[row["source_game_key"]]["game"][
                        "home_team_code"
                    ],
                    final_box_by_game[row["source_game_key"]]["game"][
                        "away_team_code"
                    ],
                ),
                final_box_by_game[row["source_game_key"]]["team_stats"],
                strict=True,
            )
            if team_code == row["team_code"]
        )
        samples.append(
            {
                "source_game_key": row["source_game_key"],
                "team_code": row["team_code"],
                "source": {
                    key: source[key]
                    for key in (
                        "points",
                        "fg_made",
                        "fg_attempted",
                        "three_pt_made",
                        "ft_attempted",
                        "offensive_rebounds",
                        "turnovers",
                    )
                },
                "derived": row,
                "formulas": {
                    "efg_percent": (
                        "100 * (FGM + 0.5 * 3PM) / FGA"
                    ),
                    "ts_percent": (
                        "100 * PTS / (2 * (FGA + 0.44 * FTA))"
                    ),
                    "possessions_estimate": (
                        "FGA + 0.44 * FTA - ORB + TOV"
                    ),
                    "free_throw_weight": FREE_THROW_WEIGHT,
                },
            }
        )
        seasons_seen[season] += 1
        if len(samples) >= args.audit_samples:
            break
    (args.output / "audit_samples.json").write_text(
        json.dumps(samples, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    status_counts = Counter(
        validation["status"] for validation in validations
    )
    summary = {
        "player_metric_rows": len(player_rows),
        "team_metric_rows": len(team_rows),
        "games_with_team_metrics": len(final_box_by_game),
        "audit_sample_rows": len(samples),
        "source_arithmetic_validations": dict(status_counts),
        "formula_version": "ibl-derived-metrics-v1",
        "free_throw_weight": FREE_THROW_WEIGHT,
    }
    (args.output / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
