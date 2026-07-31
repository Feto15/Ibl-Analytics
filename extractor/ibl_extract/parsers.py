from __future__ import annotations

import re
from typing import Any

from .core import duration_seconds, normalize_name


def stats_line(line: str) -> dict[str, int] | None:
    tokens = line.replace(",", ".").split()
    if len(tokens) < 18:
        return None
    try:
        pairs = []
        for index in (0, 2, 4, 6):
            made, attempted = tokens[index].split("/")
            pairs.append((int(made), int(attempted)))
        tail = [int(value) for value in tokens[8:]]
    except (ValueError, IndexError):
        return None
    if len(tail) < 10:
        return None
    return {
        "fg_made": pairs[0][0], "fg_attempted": pairs[0][1],
        "two_pt_made": pairs[1][0], "two_pt_attempted": pairs[1][1],
        "three_pt_made": pairs[2][0], "three_pt_attempted": pairs[2][1],
        "ft_made": pairs[3][0], "ft_attempted": pairs[3][1],
        "offensive_rebounds": tail[0], "defensive_rebounds": tail[1],
        "total_rebounds": tail[2], "assists": tail[3],
        "turnovers": tail[4], "steals": tail[5], "blocks": tail[6],
        "personal_fouls": tail[7], "fouls_drawn": tail[8],
        "points": tail[-1],
    }


def player_evaluation(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(
        r"^#(?P<jersey>\S+)\s+(?P<name>.+?)\s+"
        r"\((?P<team>[^()\n]+)\)\s+Minutes Played\s+"
        r"(?P<minutes>\d{1,3}:\d{2}|DNP)$",
        re.M,
    )
    matches = list(pattern.finditer(text))
    result = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end():end]
        line = next(
            (x.strip() for x in block.splitlines() if re.match(r"^\d+/\d+\s+", x.strip())),
            None,
        )
        did_play = match.group("minutes") != "DNP"
        stats = stats_line(line) if line else None
        if not did_play:
            stats = {
                "fg_made": 0, "fg_attempted": 0,
                "two_pt_made": 0, "two_pt_attempted": 0,
                "three_pt_made": 0, "three_pt_attempted": 0,
                "ft_made": 0, "ft_attempted": 0,
                "offensive_rebounds": 0, "defensive_rebounds": 0,
                "total_rebounds": 0, "assists": 0, "turnovers": 0,
                "steals": 0, "blocks": 0, "personal_fouls": 0,
                "fouls_drawn": 0, "points": 0,
            }
        if not stats:
            continue
        plus_minus = re.search(r"Plus / Minus\s+(-?\d+)", block)
        raw_name = match.group("name").strip()
        display_name = re.sub(r"\s*\(C\)\s*", " ", raw_name, flags=re.I).strip()
        result.append(
            {
                "jersey_no": match.group("jersey"),
                "display_name": display_name,
                "normalized_name": normalize_name(display_name),
                "team_name": match.group("team").strip(),
                "is_captain": bool(re.search(r"\(C\)", raw_name, re.I)),
                "did_play": did_play,
                "minutes_seconds": duration_seconds(match.group("minutes")),
                "plus_minus": (
                    int(plus_minus.group(1))
                    if plus_minus and did_play
                    else None
                ),
                **stats,
            }
        )
    return result


def team_totals(text: str) -> list[dict[str, Any]]:
    header = re.compile(
        r"^(?P<name>[^\n]+?)\s+\((?P<code>[A-Z0-9]{2,4})\)"
        r".*?Assistant Coach",
        re.M,
    )
    headers = list(header.finditer(text))
    result = []
    for index, match in enumerate(headers):
        end = headers[index + 1].start() if index + 1 < len(headers) else len(text)
        totals = re.search(
            r"^Totals\s+(?P<minutes>\d{1,3}:\d{2})\s+(?P<stats>.+)$",
            text[match.end():end],
            re.M,
        )
        parsed = stats_line(totals.group("stats")) if totals else None
        if parsed:
            result.append(
                {
                    "team_code": match.group("code"),
                    "team_name": match.group("name").strip(),
                    "minutes_seconds": duration_seconds(totals.group("minutes")),
                    **parsed,
                }
            )
    return result


def play_by_play(text: str) -> list[dict[str, Any]]:
    events = []
    period = 1
    pending = ""
    for raw in text.splitlines():
        line = raw.strip()
        quarter = re.fullmatch(r"Quarter\s+(\d+)", line, re.I)
        if quarter:
            period = int(quarter.group(1))
            pending = ""
            continue
        if not line or line.startswith(("--- PAGE", "IBL ", "Game Time ")):
            continue
        timed = re.match(r"^(\d{1,2}:\d{2})\s+(.+)$", line)
        trailing = re.match(r"^(.+?)\s+(\d{1,2}:\d{2})$", line)
        if timed:
            clock, description = timed.group(1), f"{pending} {timed.group(2)}".strip()
            pending = ""
        elif trailing:
            clock, description = trailing.group(2), f"{pending} {trailing.group(1)}".strip()
            pending = ""
        elif re.match(r"^\d+\s+[A-Z]", line):
            pending = f"{pending} {line}".strip()
            continue
        else:
            continue
        score = re.search(r"\b(\d{1,3})-(\d{1,3})\s+(-?\d{1,3})\b", description)
        lowered = description.lower()
        event_type = next(
            (
                kind
                for marker, kind in (
                    ("substitution", "substitution"), ("free throw", "free_throw"),
                    ("3pt fg", "three_point"), ("2pt fg", "two_point"),
                    ("rebound", "rebound"), ("turnover", "turnover"),
                    ("assist", "assist"), ("steal", "steal"), ("foul", "foul"),
                )
                if marker in lowered
            ),
            "other",
        )
        events.append(
            {
                "event_index": len(events) + 1,
                "period_no": period,
                "clock": clock,
                "event_type": event_type,
                "description": description,
                "home_score": int(score.group(1)) if score else None,
                "away_score": int(score.group(2)) if score else None,
                "score_diff": int(score.group(3)) if score else None,
                "raw_line": raw,
            }
        )
    return events
