from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any


REPORT_PATTERNS = (
    ("fiba box score", "box_score"),
    ("play by play", "play_by_play"),
    ("player evaluation", "player_evaluation"),
    ("player plusminus", "plus_minus"),
    ("rotations summary", "rotations"),
    ("line up analysis", "lineup"),
    ("shot areas", "shot_areas"),
    ("shot chart", "shot_chart"),
    ("start list", "start_list"),
    ("quarter", "quarter_summary"),
)


def classify(path: Path) -> dict[str, Any]:
    name = " ".join(path.stem.lower().split())
    report_type = next(
        (kind for marker, kind in REPORT_PATTERNS if marker in name), "unknown"
    )
    period_match = re.search(r"q\s*([1-4])\b", name)
    period = int(period_match.group(1)) if period_match else None
    if re.search(r"\bot\b", name):
        period = 5
    scope = None
    if re.search(r"\b(half|ht|halftime)\b", name):
        scope = "half"
    elif re.search(r"\b(full|ft|fulltime|full time)\b", name):
        scope = "full"
    if report_type == "box_score" and period is None and scope == "full":
        period = 4
    return {
        "report_type": report_type,
        "report_period": period,
        "report_scope": scope,
    }


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"\(c\)", "", value, flags=re.I)
    return " ".join(re.sub(r"[^a-zA-Z0-9]+", " ", value).lower().split())


def duration_seconds(value: str | None) -> int | None:
    if not value or not re.fullmatch(r"\d{1,3}:\d{2}", value):
        return None
    minutes, seconds = value.split(":")
    return int(minutes) * 60 + int(seconds)


def path_metadata(path: Path) -> dict[str, Any]:
    joined = str(path)
    season_match = re.search(r"IBL\s+(20\d{2})", joined, re.I)
    week_match = re.search(r"(?:^|/)WEEK\s+(\d+)", joined, re.I)
    game_match = re.search(
        r"(?:^|/)GAME\s*(\d+)[\s_-]+([A-Z0-9]+)\s+VS\s+"
        r"([A-Z0-9]+)\s*(?:/|$)",
        joined,
        re.I,
    )
    reverse_match = re.search(
        r"(?:^|/)([A-Z0-9]+)\s+VS\s+([A-Z0-9]+)\s+GAME\s*(\d+)",
        joined,
        re.I,
    )
    teams = re.search(r"\b([A-Z]{2,4})\s+VS\s+([A-Z]{2,4})\b", joined, re.I)
    season = int(season_match.group(1)) if season_match else None
    week = int(week_match.group(1)) if week_match else None
    if game_match:
        game_index = int(game_match.group(1))
        home, away = game_match.group(2).upper(), game_match.group(3).upper()
    elif reverse_match:
        game_index = int(reverse_match.group(3))
        home, away = reverse_match.group(1).upper(), reverse_match.group(2).upper()
    else:
        number = re.search(r"\bGAME\s*(\d+)\b", joined, re.I)
        game_index = int(number.group(1)) if number else None
        home = teams.group(1).upper() if teams else None
        away = teams.group(2).upper() if teams else None
    if season and week and game_index and home and away:
        key = f"{season}:w{week}:g{game_index}:{home}:{away}"
    elif season:
        marker = re.search(rf"IBL\s+{season}/(.+)$", str(path.parent), re.I)
        relative = marker.group(1) if marker else str(path.parent)
        slug = re.sub(r"[^a-z0-9]+", "-", relative.lower()).strip("-")
        key = f"{season}:{slug or hashlib.sha1(relative.encode()).hexdigest()[:16]}"
    else:
        key = None
    return {
        "season_year": season,
        "week_no": week,
        "game_index": game_index,
        "home_team_code": home,
        "away_team_code": away,
        "source_game_key": key,
    }


def header_metadata(text: str) -> dict[str, Any]:
    result: dict[str, Any] = {
        "external_game_no": None,
        "game_date": None,
        "start_time": None,
        "venue": None,
        "duration_seconds": None,
        "home_team_name": None,
        "away_team_name": None,
        "home_score": None,
        "away_score": None,
        "period_scores": [],
    }
    game_no = re.search(r"Game No\.?:\s*([^\s]+)", text)
    if game_no:
        result["external_game_no"] = game_no.group(1)
    duration = re.search(r"Game Duration:\s*(\d{1,2}:\d{2})", text)
    if duration:
        result["duration_seconds"] = duration_seconds(duration.group(1))
    venue = re.search(
        r"^(.*?),\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+"
        r"(\d{1,2}\s+[A-Za-z]+\s+20\d{2})\s+Start time:\s*(\d{1,2}:\d{2})",
        text,
        re.M,
    )
    if venue:
        result["venue"] = venue.group(1).strip()
        result["start_time"] = venue.group(3)
        try:
            result["game_date"] = datetime.strptime(
                venue.group(2), "%d %b %Y"
            ).date().isoformat()
        except ValueError:
            try:
                result["game_date"] = datetime.strptime(
                    venue.group(2), "%d %B %Y"
                ).date().isoformat()
            except ValueError:
                pass
    score = re.search(
        r"^(.+?)\s+(\d{1,3})\s+[–—-]\s+(\d{1,3})\s+(.+?)$", text, re.M
    )
    if score:
        result.update(
            home_team_name=score.group(1).strip(),
            home_score=int(score.group(2)),
            away_score=int(score.group(3)),
            away_team_name=score.group(4).strip(),
        )
    periods = re.search(
        r"^\((\d+\s*-\s*\d+(?:\s*,\s*\d+\s*-\s*\d+)*)\)$", text, re.M
    )
    if periods:
        for index, pair in enumerate(periods.group(1).split(","), 1):
            home, away = re.split(r"\s*-\s*", pair.strip())
            result["period_scores"].append(
                {
                    "period_no": index,
                    "period_type": "quarter" if index <= 4 else "overtime",
                    "home_score": int(home),
                    "away_score": int(away),
                }
            )
    return result
