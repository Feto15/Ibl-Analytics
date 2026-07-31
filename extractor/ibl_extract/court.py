from __future__ import annotations

from collections.abc import Iterable
from typing import Any


COURT_WIDTH_PIXELS = 480.0
COURT_HEIGHT_PIXELS = 430.0
BASKET_X = 239.5
BASKET_Y = 44.0
PIXELS_PER_METER = 31.9
BASELINE_Y = -6.2
THREE_POINT_RADIUS = 215.0
CORNER_THREE_LEFT_X = 29.5
CORNER_THREE_RIGHT_X = 450.5
CORNER_THREE_END_Y = 90.0
RESTRICTED_RADIUS = 40.0
PAINT_LEFT_X = 162.0
PAINT_RIGHT_X = 318.0
FREE_THROW_LINE_Y = 170.0


def three_point_margin(x: float, y: float) -> float:
    if y <= CORNER_THREE_END_Y:
        if x < BASKET_X:
            return CORNER_THREE_LEFT_X - x
        return x - CORNER_THREE_RIGHT_X
    distance = ((x - BASKET_X) ** 2 + (y - BASKET_Y) ** 2) ** 0.5
    return distance - THREE_POINT_RADIUS


def geometry_points(x: float, y: float) -> int:
    return 3 if three_point_margin(x, y) >= 0 else 2


def court_coordinates(x: float, y: float) -> tuple[float, float]:
    return (
        round((x - BASKET_X) / PIXELS_PER_METER, 4),
        round((y - BASELINE_Y) / PIXELS_PER_METER, 4),
    )


def area_name(x: float, y: float, points: int) -> str:
    dx = x - BASKET_X
    distance = (dx * dx + (y - BASKET_Y) ** 2) ** 0.5
    if points == 3:
        if y <= CORNER_THREE_END_Y and x <= CORNER_THREE_LEFT_X:
            return "left_corner_3"
        if y <= CORNER_THREE_END_Y and x >= CORNER_THREE_RIGHT_X:
            return "right_corner_3"
        if x < 165:
            return "left_wing_3"
        if x > 314:
            return "right_wing_3"
        return "top_3"

    if distance <= RESTRICTED_RADIUS:
        return "restricted_area"
    if (
        PAINT_LEFT_X <= x <= PAINT_RIGHT_X
        and y <= FREE_THROW_LINE_Y
    ):
        return "paint_non_restricted"
    if y <= 105 and x < PAINT_LEFT_X:
        return "left_short_corner"
    if y <= 105 and x > PAINT_RIGHT_X:
        return "right_short_corner"
    if x < 175:
        return "left_mid_range"
    if x > 304:
        return "right_mid_range"
    return "center_mid_range"


def _bounded_target(geometry_count: int, lower: int, upper: int) -> int:
    return min(max(geometry_count, lower), upper)


def assign_points(
    shots: list[dict[str, Any]],
    player_stats: dict[str, Any],
    shot_validation: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    enriched = [dict(shot) for shot in shots]
    adjustments = 0

    expected_by_outcome = {
        True: int(player_stats["three_pt_made"]),
        False: int(player_stats["three_pt_attempted"])
        - int(player_stats["three_pt_made"]),
    }
    unresolved_by_outcome = {
        True: int(shot_validation["unresolved_made"]),
        False: int(shot_validation["unresolved_missed"]),
    }

    for made in (True, False):
        indexes = [
            index
            for index, shot in enumerate(enriched)
            if bool(shot["made"]) is made
        ]
        margins = {
            index: three_point_margin(
                float(enriched[index]["x"]),
                float(enriched[index]["y"]),
            )
            for index in indexes
        }
        geometry_three = sum(margins[index] >= 0 for index in indexes)
        expected_three = expected_by_outcome[made]
        unresolved = unresolved_by_outcome[made]
        lower = max(0, expected_three - unresolved)
        upper = min(expected_three, len(indexes))
        target_three = _bounded_target(geometry_three, lower, upper)
        three_indexes = set(
            sorted(indexes, key=lambda index: margins[index], reverse=True)[
                :target_three
            ]
        )

        for index in indexes:
            shot = enriched[index]
            geometry_value = 3 if margins[index] >= 0 else 2
            final_value = 3 if index in three_indexes else 2
            adjusted = geometry_value != final_value
            adjustments += adjusted
            x = float(shot["x"])
            y = float(shot["y"])
            court_x, court_y = court_coordinates(x, y)
            distance_from_line = abs(margins[index])
            shot.update(
                {
                    "points": final_value,
                    "area_name": area_name(x, y, final_value),
                    "court_x_meters": court_x,
                    "court_y_meters": court_y,
                    "three_point_margin_pixels": round(margins[index], 4),
                    "point_classification_method": (
                        "stats_adjusted" if adjusted else "geometry"
                    ),
                    "point_classification_confidence": (
                        "low"
                        if adjusted
                        else "medium"
                        if distance_from_line < 8
                        else "high"
                    ),
                }
            )

    detected_three = sum(shot["points"] == 3 for shot in enriched)
    detected_three_made = sum(
        shot["points"] == 3 and shot["made"] for shot in enriched
    )
    unresolved_attempted = int(shot_validation["unresolved_attempted"])
    unresolved_made = int(shot_validation["unresolved_made"])
    expected_three = int(player_stats["three_pt_attempted"])
    expected_three_made = int(player_stats["three_pt_made"])
    feasible = (
        max(0, expected_three - unresolved_attempted)
        <= detected_three
        <= expected_three
        and max(0, expected_three_made - unresolved_made)
        <= detected_three_made
        <= expected_three_made
    )
    validation = {
        "player_key": shots[0]["player_key"] if shots else None,
        "expected_three_attempted": expected_three,
        "expected_three_made": expected_three_made,
        "detected_three_attempted": detected_three,
        "detected_three_made": detected_three_made,
        "unresolved_attempted": unresolved_attempted,
        "unresolved_made": unresolved_made,
        "classification_adjustments": adjustments,
        "status": "passed" if feasible else "needs_review",
    }
    return enriched, validation


def area_is_paint(area: str | None) -> bool:
    return area in {"restricted_area", "paint_non_restricted"}


def count_areas(shots: Iterable[dict[str, Any]]) -> dict[str, int]:
    result: dict[str, int] = {}
    for shot in shots:
        area = str(shot["area_name"])
        result[area] = result.get(area, 0) + 1
    return result
