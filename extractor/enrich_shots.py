#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from ibl_extract.court import assign_points, count_areas
from ibl_extract.pbp_matching import (
    match_shots_to_events,
    normalize_pbp_events,
)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")


def player_identity(record: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(record.get("source_game_key")),
        str(record.get("jersey_no")),
        str(record.get("normalized_name")),
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Classify shot areas and conservatively match PBP events."
    )
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--shots", type=Path, required=True)
    parser.add_argument("--shot-validations", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    manifest = read_jsonl(args.manifest)
    source_shots = read_jsonl(args.shots)
    shot_validations = read_jsonl(args.shot_validations)

    stats_by_identity = {}
    pbp_reports = []
    for report in manifest:
        if report.get("report_type") == "player_evaluation":
            game_key = str((report.get("game") or {}).get("source_game_key"))
            for player in report.get("player_stats") or []:
                stats_by_identity[
                    (
                        game_key,
                        str(player["jersey_no"]),
                        str(player["normalized_name"]),
                    )
                ] = player
        elif report.get("report_type") == "play_by_play":
            pbp_reports.append(report)

    validation_by_player = {
        validation["player_key"]: validation
        for validation in shot_validations
        if validation.get("player_key")
    }
    roster: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for validation in validation_by_player.values():
        item = {
            "player_key": validation["player_key"],
            "normalized_name": validation["normalized_name"],
            "team_code": validation.get("team_code"),
        }
        key = (
            validation["source_game_key"],
            str(validation["jersey_no"]),
        )
        if item not in roster[key]:
            roster[key].append(item)

    shots_by_player: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for shot in source_shots:
        shots_by_player[shot["player_key"]].append(shot)

    classified_shots = []
    classification_validations = []
    for player_key, player_shots in shots_by_player.items():
        identity = player_identity(player_shots[0])
        player_stats = stats_by_identity.get(identity)
        shot_validation = validation_by_player.get(player_key)
        if not player_stats or not shot_validation:
            classification_validations.append(
                {
                    "player_key": player_key,
                    "status": "failed",
                    "rule_code": "missing_player_context",
                }
            )
            continue
        enriched, validation = assign_points(
            player_shots,
            player_stats,
            shot_validation,
        )
        classified_shots.extend(enriched)
        classification_validations.append(validation)

    pbp_events = normalize_pbp_events(pbp_reports, roster)
    enriched_shots = match_shots_to_events(classified_shots, pbp_events)
    enriched_shots.sort(
        key=lambda shot: (
            shot["source_game_key"],
            shot["team_code"],
            shot["normalized_name"],
            shot["player_shot_index"],
        )
    )
    write_jsonl(args.output / "shots_enriched.jsonl", enriched_shots)
    write_jsonl(args.output / "pbp_shot_events.jsonl", pbp_events)
    write_jsonl(
        args.output / "enrichment_validations.jsonl",
        classification_validations,
    )

    match_counts = Counter(
        shot.get("pbp_match_status") for shot in enriched_shots
    )
    resolution_counts = Counter(
        event.get("resolution_status") for event in pbp_events
    )
    classification_counts = Counter(
        shot.get("point_classification_method") for shot in enriched_shots
    )
    confidence_counts = Counter(
        shot.get("point_classification_confidence")
        for shot in enriched_shots
    )
    summary = {
        "source_shots": len(source_shots),
        "enriched_shots": len(enriched_shots),
        "two_point_shots": sum(
            shot["points"] == 2 for shot in enriched_shots
        ),
        "three_point_shots": sum(
            shot["points"] == 3 for shot in enriched_shots
        ),
        "area_counts": count_areas(enriched_shots),
        "classification_methods": dict(classification_counts),
        "classification_confidence": dict(confidence_counts),
        "classification_players_checked": len(
            classification_validations
        ),
        "classification_players_passed": sum(
            item.get("status") == "passed"
            for item in classification_validations
        ),
        "pbp_events": len(pbp_events),
        "pbp_resolution": dict(resolution_counts),
        "pbp_shot_matches": dict(match_counts),
    }
    (args.output / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
