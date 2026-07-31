#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from ibl_extract.core import classify, path_metadata


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("sources", nargs="+", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    pdfs = sorted(
        p for root in args.sources for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() == ".pdf"
    )
    records = [
        {"path": str(path), **path_metadata(path), **classify(path)}
        for path in pdfs
    ]
    summary = {
        "pdf_total": len(records),
        "game_folders": len({str(Path(r["path"]).parent) for r in records}),
        "by_season": dict(Counter(r["season_year"] for r in records)),
        "by_report_type": dict(Counter(r["report_type"] for r in records)),
        "unrecognized_team_paths": sum(
            not r["home_team_code"] or not r["away_team_code"] for r in records
        ),
        "unknown_report_types": sum(r["report_type"] == "unknown" for r in records),
    }
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps({"summary": summary, "files": records}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

