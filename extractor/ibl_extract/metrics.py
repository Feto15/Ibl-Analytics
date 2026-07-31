from __future__ import annotations

from typing import Any


FREE_THROW_WEIGHT = 0.44
REGULATION_SECONDS = 40 * 60


def percentage(numerator: float, denominator: float) -> float | None:
    if not denominator:
        return None
    return round(100 * numerator / denominator, 4)


def efficiency(stats: dict[str, Any]) -> int:
    missed_field_goals = int(stats["fg_attempted"]) - int(
        stats["fg_made"]
    )
    missed_free_throws = int(stats["ft_attempted"]) - int(
        stats["ft_made"]
    )
    return (
        int(stats["points"])
        + int(stats["total_rebounds"])
        + int(stats["assists"])
        + int(stats["steals"])
        + int(stats["blocks"])
        - missed_field_goals
        - missed_free_throws
        - int(stats["turnovers"])
    )


def effective_field_goal_percentage(
    stats: dict[str, Any],
) -> float | None:
    return percentage(
        int(stats["fg_made"]) + 0.5 * int(stats["three_pt_made"]),
        int(stats["fg_attempted"]),
    )


def true_shooting_percentage(
    stats: dict[str, Any],
) -> float | None:
    denominator = 2 * (
        int(stats["fg_attempted"])
        + FREE_THROW_WEIGHT * int(stats["ft_attempted"])
    )
    return percentage(int(stats["points"]), denominator)


def possessions(stats: dict[str, Any]) -> float:
    result = (
        int(stats["fg_attempted"])
        + FREE_THROW_WEIGHT * int(stats["ft_attempted"])
        - int(stats["offensive_rebounds"])
        + int(stats["turnovers"])
    )
    return round(result, 4)


def player_metrics(stats: dict[str, Any]) -> dict[str, Any]:
    return {
        "efficiency": efficiency(stats),
        "efg_percent": effective_field_goal_percentage(stats),
        "ts_percent": true_shooting_percentage(stats),
    }


def team_metrics(
    stats: dict[str, Any],
    opponent: dict[str, Any],
) -> dict[str, Any]:
    team_possessions = possessions(stats)
    opponent_possessions = possessions(opponent)
    game_seconds = (
        float(stats.get("minutes_seconds") or 0) / 5
        or REGULATION_SECONDS
    )
    average_possessions = (
        team_possessions + opponent_possessions
    ) / 2
    pace = average_possessions * REGULATION_SECONDS / game_seconds
    offensive_rating = (
        100 * int(stats["points"]) / team_possessions
        if team_possessions
        else None
    )
    defensive_rating = (
        100 * int(opponent["points"]) / opponent_possessions
        if opponent_possessions
        else None
    )
    return {
        **player_metrics(stats),
        "possessions_estimate": team_possessions,
        "opponent_possessions_estimate": opponent_possessions,
        "pace": round(pace, 4),
        "offensive_rating": (
            round(offensive_rating, 4)
            if offensive_rating is not None
            else None
        ),
        "defensive_rating": (
            round(defensive_rating, 4)
            if defensive_rating is not None
            else None
        ),
        "net_rating": (
            round(offensive_rating - defensive_rating, 4)
            if offensive_rating is not None
            and defensive_rating is not None
            else None
        ),
    }


def source_arithmetic(stats: dict[str, Any]) -> dict[str, Any]:
    expected_points = (
        2 * int(stats["two_pt_made"])
        + 3 * int(stats["three_pt_made"])
        + int(stats["ft_made"])
    )
    checks = {
        "fg_made_matches_split": int(stats["fg_made"])
        == int(stats["two_pt_made"]) + int(stats["three_pt_made"]),
        "fg_attempted_matches_split": int(stats["fg_attempted"])
        == int(stats["two_pt_attempted"])
        + int(stats["three_pt_attempted"]),
        "rebounds_match_split": int(stats["total_rebounds"])
        == int(stats["offensive_rebounds"])
        + int(stats["defensive_rebounds"]),
        "points_match_formula": int(stats["points"]) == expected_points,
    }
    return {
        **checks,
        "expected_points": expected_points,
        "status": (
            "passed" if all(checks.values()) else "needs_review"
        ),
    }
