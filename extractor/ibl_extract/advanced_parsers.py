from __future__ import annotations

import math
import re
from typing import Any

from .core import duration_seconds, normalize_name


PLAYER_REF = re.compile(r"(\d+)-\s*([^/]*?)(?=/|$)")
ROTATION_VALUES = re.compile(
    r"(?P<start_period>\d+)\s+"
    r"(?P<start_clock>\d{1,2}:\d{2})\s+"
    r"(?P<end_period>\d+)\s+"
    r"(?P<end_clock>\d{1,2}:\d{2})\s+"
    r"(?P<duration>\d{1,2}:\d{2})\s+"
    r"(?P<score_for>\d+)-(?P<score_against>\d+)\s+"
    r"(?P<plus_minus>-?\d+)\s+"
    r"(?P<rebounds>\d+)\s+(?P<steals>\d+)\s+"
    r"(?P<turnovers>\d+)\s+(?P<assists>\d+)"
)
LINEUP_VALUES = re.compile(
    r"(?P<duration>\d{1,2}:\d{2})\s+"
    r"(?P<score_for>\d+)-(?P<score_against>\d+)\s+"
    r"(?P<plus_minus>-?\d+)\s+"
    r"(?P<points_per_minute>\d+(?:[,.]\d+)?|NaN|∞)\s+"
    r"(?P<rebounds>\d+)\s+(?P<steals>\d+)\s+"
    r"(?P<turnovers>\d+)\s+(?P<assists>\d+)\s*$"
)
PLUS_MINUS_VALUES = re.compile(
    r"^(?P<jersey>\S+)\s+(?P<name>.+?)\s+"
    r"(?P<minutes_on>\d{1,3}:\d{2})\s+"
    r"(?P<minutes_off>\d{1,3}:\d{2})\s+"
    r"(?P<score_on_for>\d+)-(?P<score_on_against>\d+)\s+"
    r"(?P<score_off_for>\d+)-(?P<score_off_against>\d+)\s+"
    r"(?P<plus_minus_on>-?\d+)\s+(?P<plus_minus_off>-?\d+)\s+"
    r"(?P<points_per_minute_on>\d+(?:[,.]\d+)?)\s+"
    r"(?P<points_per_minute_off>\d+(?:[,.]\d+)?)\s+"
    r"(?P<assists_on>\d+)\s+(?P<assists_off>\d+)\s+"
    r"(?P<rebounds_on>\d+)\s+(?P<rebounds_off>\d+)\s+"
    r"(?P<steals_on>\d+)\s+(?P<steals_off>\d+)\s+"
    r"(?P<turnovers_on>\d+)\s+(?P<turnovers_off>\d+)\s*$"
)
START_LIST_PLAYER = re.compile(
    r"^(?P<jersey>\S+)\s+(?P<name>.+?)\s+"
    r"(?P<position>[A-Z]+(?:/[A-Z]+)*)\s+"
    r"(?P<height>\d+(?:[,.]\d+))\s+(?P<age>\d+)"
    r"(?:\s+(?P<games_played>\d+)\s+"
    r"(?P<points_per_game>-?\d+(?:[,.]\d+)?)\s+"
    r"(?P<plus_minus_per_game>-?\d+(?:[,.]\d+)?)\s+"
    r"(?P<fg_percent>\d+(?:[,.]\d+)?)\s+"
    r"(?P<three_pt_percent>\d+(?:[,.]\d+)?)\s+"
    r"(?P<ft_percent>\d+(?:[,.]\d+)?)\s+"
    r"(?P<rebounds_per_game>\d+(?:[,.]\d+)?)\s+"
    r"(?P<assists_per_game>\d+(?:[,.]\d+)?)\s+"
    r"(?P<minutes_per_game>\d+(?:[,.]\d+)?))?\s*$"
)


def _number(value: str | None) -> float | None:
    if value is None or value in {"NaN", "∞"}:
        return None
    parsed = float(value.replace(",", "."))
    return parsed if math.isfinite(parsed) else None


def _player_refs(value: str) -> list[dict[str, str]]:
    return [
        {
            "jersey_no": match.group(1),
            "player_label": match.group(2).strip(),
        }
        for match in PLAYER_REF.finditer(value.replace("\u200b", ""))
    ]


def parse_lineup_page(
    text: str,
    team_code: str,
) -> list[dict[str, Any]]:
    result = []
    for raw_line in text.splitlines():
        line = raw_line.replace("\u200b", "").strip()
        values = LINEUP_VALUES.search(line)
        if not values:
            continue
        players = _player_refs(line[:values.start()])
        if len(players) != 5:
            continue
        result.append(
            {
                "team_code": team_code,
                "lineup_index": len(result) + 1,
                "players": players,
                "duration_seconds": duration_seconds(values["duration"]),
                "score_for": int(values["score_for"]),
                "score_against": int(values["score_against"]),
                "plus_minus": int(values["plus_minus"]),
                "points_per_minute": _number(
                    values["points_per_minute"]
                ),
                "rebounds": int(values["rebounds"]),
                "steals": int(values["steals"]),
                "turnovers": int(values["turnovers"]),
                "assists": int(values["assists"]),
            }
        )
    return result


def parse_rotation_page(
    text: str,
    team_code: str,
) -> list[dict[str, Any]]:
    result = []
    lineup_text = ""
    pending_values: re.Match[str] | None = None

    def finalize() -> None:
        nonlocal lineup_text, pending_values
        if pending_values is None:
            return
        players = _player_refs(lineup_text)
        values = pending_values
        lineup_text = ""
        pending_values = None
        if len(players) != 5:
            return
        result.append(
            {
                "team_code": team_code,
                "stint_index": len(result) + 1,
                "players": players,
                "start_period": int(values["start_period"]),
                "start_clock": values["start_clock"],
                "end_period": int(values["end_period"]),
                "end_clock": values["end_clock"],
                "duration_seconds": duration_seconds(values["duration"]),
                "score_for": int(values["score_for"]),
                "score_against": int(values["score_against"]),
                "plus_minus": int(values["plus_minus"]),
                "rebounds": int(values["rebounds"]),
                "steals": int(values["steals"]),
                "turnovers": int(values["turnovers"]),
                "assists": int(values["assists"]),
            }
        )

    for raw_line in text.splitlines():
        line = raw_line.replace("\u200b", "").strip()
        values = ROTATION_VALUES.search(line)
        player_part = line[:values.start()] if values else line
        starts_new_lineup = bool(
            re.match(r"^\d+-\s*", player_part)
        )
        if (
            pending_values is not None
            and starts_new_lineup
            and len(_player_refs(lineup_text)) >= 5
        ):
            finalize()
        if "/" in player_part:
            lineup_text = f"{lineup_text} {player_part}".strip()
        if values:
            if pending_values is not None:
                finalize()
            pending_values = values
    finalize()
    return result


def parse_start_list(text: str) -> list[dict[str, Any]]:
    result = []
    current_team = None
    team_header = re.compile(
        r"^(.+?)\s+\(([A-Z0-9]{2,4})\).*Assistant Coach",
        re.I,
    )
    for raw_line in text.splitlines():
        line = raw_line.replace("\u200b", "").strip()
        header = team_header.match(line)
        if header:
            current_team = {
                "team_name": header.group(1).strip(),
                "team_code": header.group(2).upper(),
            }
            continue
        if not current_team or line.startswith("Team "):
            continue
        player = START_LIST_PLAYER.match(line)
        if not player:
            continue
        height_meters = _number(player["height"])
        item: dict[str, Any] = {
            **current_team,
            "jersey_no": player["jersey"],
            "display_name": re.sub(
                r"\s*\(C\)\s*", " ", player["name"], flags=re.I
            ).strip(),
            "normalized_name": normalize_name(player["name"]),
            "is_captain": bool(re.search(r"\(C\)", player["name"], re.I)),
            "position": player["position"],
            "height_cm": (
                round(height_meters * 100)
                if height_meters and height_meters > 0
                else None
            ),
            "age": int(player["age"]),
        }
        for field in (
            "games_played",
            "points_per_game",
            "plus_minus_per_game",
            "fg_percent",
            "three_pt_percent",
            "ft_percent",
            "rebounds_per_game",
            "assists_per_game",
            "minutes_per_game",
        ):
            value = player[field]
            item[field] = (
                int(value)
                if field == "games_played" and value is not None
                else _number(value)
            )
        result.append(item)
    return result


def parse_player_plus_minus(text: str) -> list[dict[str, Any]]:
    result = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        values = PLUS_MINUS_VALUES.match(line)
        if not values:
            continue
        result.append(
            {
                "jersey_no": values["jersey"],
                "display_name": values["name"].strip(),
                "normalized_name": normalize_name(values["name"]),
                "minutes_on_seconds": duration_seconds(
                    values["minutes_on"]
                ),
                "minutes_off_seconds": duration_seconds(
                    values["minutes_off"]
                ),
                "score_on_for": int(values["score_on_for"]),
                "score_on_against": int(values["score_on_against"]),
                "score_off_for": int(values["score_off_for"]),
                "score_off_against": int(values["score_off_against"]),
                "plus_minus_on": int(values["plus_minus_on"]),
                "plus_minus_off": int(values["plus_minus_off"]),
                "points_per_minute_on": _number(
                    values["points_per_minute_on"]
                ),
                "points_per_minute_off": _number(
                    values["points_per_minute_off"]
                ),
                "assists_on": int(values["assists_on"]),
                "assists_off": int(values["assists_off"]),
                "rebounds_on": int(values["rebounds_on"]),
                "rebounds_off": int(values["rebounds_off"]),
                "steals_on": int(values["steals_on"]),
                "steals_off": int(values["steals_off"]),
                "turnovers_on": int(values["turnovers_on"]),
                "turnovers_off": int(values["turnovers_off"]),
            }
        )
    return result


def parse_shot_area_totals(
    text: str,
    home_team_code: str,
    away_team_code: str,
) -> list[dict[str, Any]]:
    rows = {}
    for label, key in (
        ("Field Goals", "field_goals"),
        ("2 Points", "two_points"),
        ("3 Points", "three_points"),
        ("Free Throws", "free_throws"),
    ):
        pairs = re.findall(
            rf"{re.escape(label)}\s+(\d+)/(\d+)\s+\d+(?:[,.]\d+)?",
            text,
            re.I,
        )
        if len(pairs) >= 2:
            rows[key] = pairs[:2]
    if len(rows) != 4:
        return []
    result = []
    for index, team_code in enumerate(
        (home_team_code, away_team_code)
    ):
        result.append(
            {
                "team_code": team_code,
                "fg_made": int(rows["field_goals"][index][0]),
                "fg_attempted": int(rows["field_goals"][index][1]),
                "two_pt_made": int(rows["two_points"][index][0]),
                "two_pt_attempted": int(rows["two_points"][index][1]),
                "three_pt_made": int(rows["three_points"][index][0]),
                "three_pt_attempted": int(rows["three_points"][index][1]),
                "ft_made": int(rows["free_throws"][index][0]),
                "ft_attempted": int(rows["free_throws"][index][1]),
            }
        )
    return result
