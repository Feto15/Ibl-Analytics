#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import pdfplumber
from PIL import Image
from pypdf import PdfReader

from ibl_extract.core import normalize_name
from ibl_extract.parsers import player_evaluation
from ibl_extract.shot_detection import (
    MARKER_SIZE,
    detect_markers,
    is_marker_layer,
    load_marker_image,
    validation_record,
)


def read_player_reports(manifest: Path) -> list[dict[str, Any]]:
    reports = []
    with manifest.open(encoding="utf-8") as stream:
        for line in stream:
            if not line.strip():
                continue
            record = json.loads(line)
            if (
                record.get("report_type") == "player_evaluation"
                and record.get("parse_status") == "parsed"
            ):
                reports.append(record)
    return reports


def _image_data_by_name(page: Any) -> dict[str, bytes]:
    result = {}
    for image_object in page.images:
        name = Path(image_object.name).stem
        result[name] = image_object.data
    return result


def _marker_layers(
    plumber_page: Any,
    pypdf_page: Any,
) -> list[tuple[str, Image.Image]]:
    image_data = _image_data_by_name(pypdf_page)
    candidates = sorted(
        (
            image
            for image in plumber_page.images
            if tuple(image.get("srcsize") or ()) == MARKER_SIZE
        ),
        key=lambda image: float(image.get("top", 0)),
    )
    layers = []
    for candidate in candidates:
        name = candidate.get("name")
        data = image_data.get(name)
        if not data:
            continue
        image = load_marker_image(data)
        if is_marker_layer(image):
            layers.append((name, image))
    return layers


def _team_code_map(
    report: dict[str, Any],
    game: dict[str, Any],
) -> dict[str, str]:
    ordered_teams = []
    for player in report.get("player_stats") or []:
        normalized = normalize_name(player.get("team_name", ""))
        if normalized and normalized not in ordered_teams:
            ordered_teams.append(normalized)

    result = {}
    home_name = normalize_name(game.get("home_team_name") or "")
    away_name = normalize_name(game.get("away_team_name") or "")
    for team_name in ordered_teams:
        if home_name and (
            team_name in home_name or home_name in team_name
        ):
            result[team_name] = game.get("home_team_code")
        elif away_name and (
            team_name in away_name or away_name in team_name
        ):
            result[team_name] = game.get("away_team_code")

    fallback_codes = [
        game.get("home_team_code"),
        game.get("away_team_code"),
    ]
    for index, team_name in enumerate(ordered_teams[:2]):
        if team_name not in result and fallback_codes[index]:
            result[team_name] = fallback_codes[index]
    return result


def _team_code(
    player: dict[str, Any],
    team_codes: dict[str, str],
) -> str | None:
    player_team = normalize_name(player.get("team_name", ""))
    return team_codes.get(player_team)


def extract_report_shots(report: dict[str, Any]) -> dict[str, Any]:
    source = Path(report["source_path"])
    if not source.exists():
        raise FileNotFoundError(source)

    shots: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []
    game = report.get("game") or {}
    team_codes = _team_code_map(report, game)
    pdf_reader = PdfReader(source)

    with pdfplumber.open(source) as plumber_pdf:
        if len(plumber_pdf.pages) != len(pdf_reader.pages):
            raise ValueError("pdfplumber and pypdf page counts differ")

        for page_number, (plumber_page, pypdf_page) in enumerate(
            zip(plumber_pdf.pages, pdf_reader.pages, strict=True),
            start=1,
        ):
            text = plumber_page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            players = player_evaluation(text)
            layers = _marker_layers(plumber_page, pypdf_page)

            if len(players) != len(layers):
                validations.append(
                    {
                        "source_path": str(source),
                        "source_sha256": report.get("source_sha256"),
                        "source_game_key": game.get("source_game_key"),
                        "page_number": page_number,
                        "status": "needs_review",
                        "rule_code": "player_layer_count_mismatch",
                        "message": (
                            f"Found {len(players)} player blocks and "
                            f"{len(layers)} marker layers."
                        ),
                    }
                )
                continue

            for player, (layer_name, image) in zip(players, layers, strict=True):
                expected_made = int(player["fg_made"])
                expected_missed = int(player["fg_attempted"]) - expected_made
                markers = detect_markers(
                    image,
                    expected_made=expected_made,
                    expected_missed=expected_missed,
                )
                validation = validation_record(player, markers)
                player_key = (
                    f"{game.get('source_game_key')}:"
                    f"{_team_code(player, team_codes) or 'UNK'}:"
                    f"{player['jersey_no']}:{player['normalized_name']}"
                )
                validations.append(
                    {
                        "source_path": str(source),
                        "source_sha256": report.get("source_sha256"),
                        "source_game_key": game.get("source_game_key"),
                        "external_game_no": game.get("external_game_no"),
                        "page_number": page_number,
                        "marker_layer": layer_name,
                        "player_key": player_key,
                        "player_name": player["display_name"],
                        "normalized_name": player["normalized_name"],
                        "jersey_no": player["jersey_no"],
                        "team_name": player["team_name"],
                        "team_code": _team_code(player, team_codes),
                        **validation,
                    }
                )

                for player_shot_index, marker in enumerate(markers, start=1):
                    shots.append(
                        {
                            "source_game_key": game.get("source_game_key"),
                            "external_game_no": game.get("external_game_no"),
                            "season_year": game.get("season_year"),
                            "game_date": game.get("game_date"),
                            "team_code": _team_code(player, team_codes),
                            "team_name": player["team_name"],
                            "player_key": player_key,
                            "player_name": player["display_name"],
                            "normalized_name": player["normalized_name"],
                            "jersey_no": player["jersey_no"],
                            "player_shot_index": player_shot_index,
                            "x": marker.x,
                            "y": marker.y,
                            "x_normalized": marker.x_normalized,
                            "y_normalized": marker.y_normalized,
                            "made": marker.made,
                            "points": None,
                            "area_name": None,
                            "period_no": None,
                            "clock": None,
                            "event_id": None,
                            "confidence": marker.confidence,
                            "detection_status": (
                                "validated"
                                if validation["status"] == "passed"
                                else "needs_review"
                            ),
                            "source_report_type": "player_evaluation",
                            "source_path": str(source),
                            "source_sha256": report.get("source_sha256"),
                            "source_page": page_number,
                            "marker_layer": layer_name,
                        }
                    )

    return {
        "source_path": str(source),
        "source_sha256": report.get("source_sha256"),
        "source_game_key": game.get("source_game_key"),
        "shots": shots,
        "validations": validations,
    }


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract per-player shot coordinates from Player Evaluation PDFs."
    )
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--season", type=int)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument(
        "--reprocess-sha",
        action="append",
        default=[],
        help="Reprocess a report SHA while keeping other resume checkpoints.",
    )
    args = parser.parse_args()

    reports = read_player_reports(args.manifest)
    if args.season is not None:
        reports = [
            report
            for report in reports
            if (report.get("game") or {}).get("season_year") == args.season
        ]
    if args.limit is not None:
        reports = reports[: args.limit]
    args.output.mkdir(parents=True, exist_ok=True)
    report_dir = args.output / "reports"
    report_dir.mkdir(exist_ok=True)

    results = []
    existing_hashes = set()
    reprocess_hashes = set(args.reprocess_sha)
    if args.resume:
        for path in report_dir.glob("*.json"):
            try:
                result = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if result.get("source_sha256") in reprocess_hashes:
                continue
            existing_hashes.add(result.get("source_sha256"))
            results.append(result)

    pending = [
        report
        for report in reports
        if report.get("source_sha256") not in existing_hashes
    ]
    failures = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        jobs = {
            executor.submit(extract_report_shots, report): report
            for report in pending
        }
        for index, future in enumerate(as_completed(jobs), start=1):
            report = jobs[future]
            try:
                result = future.result()
                results.append(result)
                report_path = report_dir / f"{result['source_sha256']}.json"
                report_path.write_text(
                    json.dumps(result, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                status = "ok"
            except Exception as error:
                failures.append(
                    {
                        "source_path": report.get("source_path"),
                        "source_sha256": report.get("source_sha256"),
                        "status": "failed",
                        "error": f"{type(error).__name__}: {error}",
                    }
                )
                status = "failed"
            print(
                f"[{index}/{len(pending)}] {status}: "
                f"{report.get('source_filename')}",
                file=sys.stderr,
            )

    results.sort(key=lambda item: item["source_path"])
    shots = [shot for result in results for shot in result["shots"]]
    validations = [
        validation
        for result in results
        for validation in result["validations"]
    ]
    validations.extend(failures)
    shots.sort(
        key=lambda shot: (
            shot.get("source_game_key") or "",
            shot.get("team_code") or "",
            shot["normalized_name"],
            shot["player_shot_index"],
        )
    )
    write_jsonl(args.output / "shots.jsonl", shots)
    write_jsonl(args.output / "shot_validations.jsonl", validations)

    player_validations = [
        validation
        for validation in validations
        if "expected_attempted" in validation
    ]
    summary = {
        "reports_selected": len(reports),
        "reports_completed": len(results),
        "reports_failed": len(failures),
        "players_checked": len(player_validations),
        "players_passed": sum(
            item["status"] == "passed" for item in player_validations
        ),
        "players_needing_review": sum(
            item["status"] == "needs_review" for item in player_validations
        ),
        "expected_shots": sum(
            item["expected_attempted"] for item in player_validations
        ),
        "coordinates_detected": len(shots),
        "unresolved_shots": sum(
            item["unresolved_attempted"] for item in player_validations
        ),
    }
    (args.output / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
