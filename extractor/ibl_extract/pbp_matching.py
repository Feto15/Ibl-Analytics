from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from .core import normalize_name
from .court import area_is_paint


SHOT_PATTERN = re.compile(
    r"(?P<jersey>\d+)\s+"
    r"(?P<label>[A-Z][A-Z .'-]*?)\s+"
    r"(?P<points>[23])pt FG"
)
SCORE_PATTERN = re.compile(r"\d{1,3}-\d{1,3}\s+-?\d{1,3}")


def _action_type(description: str) -> str | None:
    lowered = description.lower()
    for marker, action in (
        ("alley oop", "alley_oop"),
        ("tip in", "tip_in"),
        ("putback", "putback"),
        ("dunk", "dunk"),
        ("reverse layup", "reverse_layup"),
        ("driving layup", "driving_layup"),
        ("layup", "layup"),
        ("hook shot", "hook_shot"),
        ("fadeaway", "fadeaway"),
        ("pull up", "pull_up"),
        ("floating jump shot", "floater"),
        ("jump shot", "jump_shot"),
    ):
        if marker in lowered:
            return action
    return None


def _score_side(
    description: str,
    shot_match: re.Match[str],
    game: dict[str, Any],
) -> str | None:
    score_match = SCORE_PATTERN.search(description)
    if not score_match:
        return None
    if score_match.start() < shot_match.start():
        return game.get("away_team_code")
    return game.get("home_team_code")


def _candidate_score(label: str, normalized_name: str) -> int:
    label_tokens = normalize_name(label).split()
    full_tokens = normalized_name.split()
    long_tokens = {token for token in label_tokens if len(token) > 1}
    score = 10 * len(long_tokens.intersection(full_tokens))
    initials = {token for token in label_tokens if len(token) == 1}
    if initials and full_tokens and full_tokens[0][0] in initials:
        score += 2
    return score


def normalize_pbp_events(
    reports: list[dict[str, Any]],
    roster: dict[tuple[str, str], list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    result = []
    for report in reports:
        game = report.get("game") or {}
        game_key = game.get("source_game_key")
        for event in report.get("play_by_play_events") or []:
            if event.get("event_type") not in ("two_point", "three_point"):
                continue
            description = event.get("description") or ""
            match = SHOT_PATTERN.search(description)
            if not match:
                continue
            jersey = match.group("jersey")
            candidates = list(roster.get((game_key, jersey), []))
            side = _score_side(description, match, game)
            if side:
                side_candidates = [
                    candidate
                    for candidate in candidates
                    if candidate.get("team_code") == side
                ]
                if side_candidates:
                    candidates = side_candidates

            scored = sorted(
                (
                    (
                        _candidate_score(
                            match.group("label"),
                            candidate["normalized_name"],
                        ),
                        candidate,
                    )
                    for candidate in candidates
                ),
                key=lambda item: item[0],
                reverse=True,
            )
            resolved = None
            resolution_status = "ambiguous"
            if scored:
                best_score = scored[0][0]
                tied = [
                    candidate
                    for score, candidate in scored
                    if score == best_score
                ]
                if len(tied) == 1 and best_score > 0:
                    resolved = tied[0]
                    resolution_status = "resolved_name"
                elif len(candidates) == 1:
                    resolved = candidates[0]
                    resolution_status = "resolved_jersey"

            lowered = description.lower()
            made = (
                " made" in lowered
                or event.get("home_score") is not None
            )
            in_paint = None
            if "outside the paint" in lowered:
                in_paint = False
            elif "in the paint" in lowered:
                in_paint = True

            result.append(
                {
                    "pbp_event_key": (
                        f"{game_key}:pbp:{event.get('event_index')}"
                    ),
                    "source_game_key": game_key,
                    "external_game_no": game.get("external_game_no"),
                    "source_path": report.get("source_path"),
                    "source_sha256": report.get("source_sha256"),
                    "event_index": event.get("event_index"),
                    "period_no": event.get("period_no"),
                    "clock": event.get("clock"),
                    "jersey_no": jersey,
                    "player_label": match.group("label").strip(),
                    "player_key": (
                        resolved.get("player_key") if resolved else None
                    ),
                    "team_code": (
                        resolved.get("team_code") if resolved else side
                    ),
                    "points": int(match.group("points")),
                    "made": made,
                    "action_type": _action_type(description),
                    "in_paint": in_paint,
                    "description": description,
                    "resolution_status": resolution_status,
                    "candidate_player_keys": [
                        candidate["player_key"] for candidate in candidates
                    ],
                }
            )
    return result


def _event_matches_area(
    event: dict[str, Any],
    shot: dict[str, Any],
) -> bool:
    paint = area_is_paint(shot.get("area_name"))
    if event.get("in_paint") is True and not paint:
        return False
    if event.get("in_paint") is False and paint:
        return False
    if event.get("action_type") in {
        "alley_oop",
        "tip_in",
        "putback",
        "dunk",
        "reverse_layup",
        "driving_layup",
        "layup",
    }:
        return paint
    return True


def match_shots_to_events(
    shots: list[dict[str, Any]],
    events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    enriched = [dict(shot) for shot in shots]
    shot_groups: dict[tuple[Any, ...], list[int]] = defaultdict(list)
    event_groups: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)

    for index, shot in enumerate(enriched):
        key = (
            shot["player_key"],
            bool(shot["made"]),
            int(shot["points"]),
        )
        shot_groups[key].append(index)
    for event in events:
        if not event.get("player_key"):
            continue
        key = (
            event["player_key"],
            bool(event["made"]),
            int(event["points"]),
        )
        event_groups[key].append(event)

    for key, indexes in shot_groups.items():
        group_events = sorted(
            event_groups.get(key, []),
            key=lambda event: (
                int(event.get("period_no") or 0),
                int(event.get("event_index") or 0),
            ),
        )
        assignments: dict[int, tuple[dict[str, Any], str]] = {}
        used_event_keys: set[str] = set()

        if len(indexes) == 1 and len(group_events) == 1:
            assignments[indexes[0]] = (group_events[0], "unique")
            used_event_keys.add(group_events[0]["pbp_event_key"])
        else:
            progress = True
            while progress:
                progress = False
                remaining_indexes = [
                    index for index in indexes if index not in assignments
                ]
                remaining_events = [
                    event
                    for event in group_events
                    if event["pbp_event_key"] not in used_event_keys
                ]
                event_candidates = {
                    event["pbp_event_key"]: [
                        index
                        for index in remaining_indexes
                        if _event_matches_area(event, enriched[index])
                    ]
                    for event in remaining_events
                }
                shot_candidates = {
                    index: [
                        event
                        for event in remaining_events
                        if index
                        in event_candidates[event["pbp_event_key"]]
                    ]
                    for index in remaining_indexes
                }
                for event in remaining_events:
                    candidates = event_candidates[event["pbp_event_key"]]
                    if (
                        len(candidates) == 1
                        and len(shot_candidates[candidates[0]]) == 1
                    ):
                        index = candidates[0]
                        assignments[index] = (
                            event,
                            "area_constrained",
                        )
                        used_event_keys.add(event["pbp_event_key"])
                        progress = True
                        break

        for index in indexes:
            shot = enriched[index]
            if index in assignments:
                event, status = assignments[index]
                shot.update(
                    {
                        "pbp_match_status": status,
                        "pbp_event_key": event["pbp_event_key"],
                        "pbp_candidate_event_keys": [
                            event["pbp_event_key"]
                        ],
                        "period_no": event.get("period_no"),
                        "clock": event.get("clock"),
                        "action_type": event.get("action_type"),
                        "pbp_description": event.get("description"),
                    }
                )
            else:
                candidate_keys = [
                    event["pbp_event_key"]
                    for event in group_events
                    if (
                        event["pbp_event_key"] not in used_event_keys
                        and _event_matches_area(event, shot)
                    )
                ]
                shot.update(
                    {
                        "pbp_match_status": (
                            "ambiguous" if candidate_keys else "no_event"
                        ),
                        "pbp_event_key": None,
                        "pbp_candidate_event_keys": candidate_keys,
                        "period_no": None,
                        "clock": None,
                        "action_type": None,
                        "pbp_description": None,
                    }
                )
    return enriched
