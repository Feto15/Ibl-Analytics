#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import pdfplumber

from ibl_extract import __version__
from ibl_extract.core import (
    canonicalize_play_by_play_reports,
    classify,
    header_metadata,
    path_metadata,
)
from ibl_extract.parsers import play_by_play, player_evaluation, team_totals


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract(path: Path) -> dict[str, Any]:
    pages = []
    with pdfplumber.open(path) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            pages.append(
                {
                    "page": number,
                    "text": page.extract_text(x_tolerance=2, y_tolerance=3) or "",
                }
            )
    text = "\n\n".join(page["text"] for page in pages)
    kind = classify(path)
    report_type = kind["report_type"]
    players = player_evaluation(text) if report_type == "player_evaluation" else []
    totals = (
        team_totals(text)
        if report_type == "box_score" and kind["report_period"] in (4, 5)
        else []
    )
    events = play_by_play(text) if report_type == "play_by_play" else []
    parsed = len(players) + len(totals) + len(events)
    return {
        "extractor_version": __version__,
        "source_path": str(path),
        "source_filename": path.name,
        "source_sha256": sha256(path),
        **kind,
        "page_count": len(pages),
        "text_chars": len(text),
        "parse_status": "parsed" if parsed else "raw_only",
        "game": {**path_metadata(path), **header_metadata(text)},
        "player_stats": players,
        "team_stats": totals,
        "play_by_play_events": events,
        "pages": pages,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("sources", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument(
        "--reprocess-sha",
        action="append",
        default=[],
        help="Reprocess one report SHA while resuming all other reports.",
    )
    args = parser.parse_args()
    pdfs = sorted(
        p for root in args.sources for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() == ".pdf"
    )
    if args.limit:
        pdfs = pdfs[:args.limit]
    args.output.mkdir(parents=True, exist_ok=True)
    raw_dir = args.output / "raw_reports"
    raw_dir.mkdir(exist_ok=True)

    records = []
    existing_paths = set()
    reprocess_hashes = set(args.reprocess_sha)
    if args.resume:
        for raw_path in raw_dir.glob("*.json"):
            try:
                record = json.loads(raw_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            source_path = record.get("source_path")
            if not source_path:
                continue
            if record.get("source_sha256") in reprocess_hashes:
                continue
            existing_paths.add(source_path)
            records.append({key: value for key, value in record.items() if key != "pages"})
        if existing_paths:
            print(f"resume: using {len(existing_paths)} existing raw reports", file=sys.stderr)

    pending_pdfs = [path for path in pdfs if str(path) not in existing_paths]
    failures = sum(r["parse_status"] == "failed" for r in records)
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        jobs = {executor.submit(extract, path): path for path in pending_pdfs}
        for index, future in enumerate(as_completed(jobs), 1):
            try:
                record = future.result()
            except Exception as error:
                failures += 1
                record = {
                    "source_path": str(jobs[future]),
                    "source_filename": jobs[future].name,
                    "parse_status": "failed",
                    "error_message": f"{type(error).__name__}: {error}",
                }
            compact = {key: value for key, value in record.items() if key != "pages"}
            records.append(compact)
            key = record.get("source_sha256") or hashlib.sha256(
                record["source_path"].encode()
            ).hexdigest()
            (raw_dir / f"{key}.json").write_text(
                json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f"[{index}/{len(pending_pdfs)}] {record['parse_status']}: {record['source_filename']}", file=sys.stderr)

    pbp_duplicates = canonicalize_play_by_play_reports(records)
    for record in records:
        if record.get("parse_status") != "duplicate":
            continue
        raw_path = raw_dir / f"{record['source_sha256']}.json"
        if not raw_path.exists():
            continue
        raw_record = json.loads(raw_path.read_text(encoding="utf-8"))
        raw_record["parse_status"] = "duplicate"
        raw_record["duplicate_of_source_sha256"] = record.get(
            "duplicate_of_source_sha256"
        )
        raw_record["play_by_play_events"] = []
        raw_path.write_text(
            json.dumps(raw_record, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    records.sort(key=lambda item: item["source_path"])
    with (args.output / "manifest.jsonl").open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    summary = {
        "extractor_version": __version__,
        "files_seen": len(records),
        "files_succeeded": len(records) - failures,
        "files_failed": failures,
        "parsed": sum(r["parse_status"] == "parsed" for r in records),
        "raw_only": sum(r["parse_status"] == "raw_only" for r in records),
        "duplicate": sum(r["parse_status"] == "duplicate" for r in records),
        "play_by_play_duplicates": pbp_duplicates,
    }
    (args.output / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
