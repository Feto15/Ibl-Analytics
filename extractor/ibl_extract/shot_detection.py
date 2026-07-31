from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image


MARKER_SIZE = (480, 430)
RED_TEMPLATE_PIXELS = 65
GREEN_TEMPLATE_PIXELS = 69


@dataclass(frozen=True)
class Marker:
    x: float
    y: float
    x_normalized: float
    y_normalized: float
    made: bool
    confidence: float


def load_marker_image(data: bytes) -> Image.Image:
    return Image.open(BytesIO(data)).convert("RGBA")


def is_marker_layer(image: Image.Image) -> bool:
    return image.mode == "RGBA" and image.size == MARKER_SIZE


def _window_sum(mask: np.ndarray, height: int, width: int) -> np.ndarray:
    integral = np.pad(mask.astype(np.int32), ((1, 0), (1, 0)))
    integral = integral.cumsum(axis=0).cumsum(axis=1)
    windows = (
        integral[height:, width:]
        - integral[:-height, width:]
        - integral[height:, :-width]
        + integral[:-height, :-width]
    )
    result = np.zeros(mask.shape, dtype=np.float32)
    y_margin = height // 2
    x_margin = width // 2
    result[
        y_margin : mask.shape[0] - y_margin,
        x_margin : mask.shape[1] - x_margin,
    ] = windows
    return result


def _template_scores(mask: np.ndarray, made: bool) -> np.ndarray:
    if made:
        horizontal = _window_sum(mask, 3, 13)
        vertical = _window_sum(mask, 13, 3)
        center = _window_sum(mask, 3, 3)
        return (horizontal + vertical - center) / GREEN_TEMPLATE_PIXELS
    return _window_sum(mask, 5, 13) / RED_TEMPLATE_PIXELS


def _select_centers(
    scores: np.ndarray,
    expected: int,
    minimum_score: float,
    minimum_distance: float = 9.0,
) -> list[tuple[int, int, float]]:
    if expected <= 0:
        return []
    candidate_y, candidate_x = np.where(scores >= minimum_score)
    candidates = sorted(
        (
            (int(y), int(x), float(scores[y, x]))
            for y, x in zip(candidate_y, candidate_x, strict=True)
        ),
        key=lambda item: item[2],
        reverse=True,
    )
    selected: list[tuple[int, int, float]] = []
    minimum_distance_squared = minimum_distance * minimum_distance
    for y, x, score in candidates:
        if all(
            (x - other_x) ** 2 + (y - other_y) ** 2
            >= minimum_distance_squared
            for other_y, other_x, _ in selected
        ):
            selected.append((y, x, score))
            if len(selected) == expected:
                break
    return selected


def detect_markers(
    image: Image.Image,
    expected_made: int,
    expected_missed: int,
) -> list[Marker]:
    rgba = np.asarray(image.convert("RGBA"))
    alpha = rgba[:, :, 3]
    red = (
        (alpha > 0)
        & (rgba[:, :, 0] >= 180)
        & (rgba[:, :, 1] <= 90)
        & (rgba[:, :, 2] <= 90)
    )
    green = (
        (alpha > 0)
        & (rgba[:, :, 1] >= 75)
        & (rgba[:, :, 0] <= 100)
        & (rgba[:, :, 2] <= 100)
    )

    made_centers = _select_centers(
        _template_scores(green, made=True),
        expected=expected_made,
        minimum_score=0.45,
    )
    missed_centers = _select_centers(
        _template_scores(red, made=False),
        expected=expected_missed,
        minimum_score=0.55,
    )

    width, height = image.size
    markers = [
        Marker(
            x=float(x),
            y=float(y),
            x_normalized=round(x / (width - 1), 6),
            y_normalized=round(y / (height - 1), 6),
            made=made,
            confidence=round(min(score, 1.0), 4),
        )
        for made, centers in ((True, made_centers), (False, missed_centers))
        for y, x, score in centers
    ]
    return sorted(markers, key=lambda marker: (marker.y, marker.x, not marker.made))


def validation_record(
    player: dict[str, Any],
    detected: list[Marker],
) -> dict[str, Any]:
    expected_made = int(player["fg_made"])
    expected_attempted = int(player["fg_attempted"])
    detected_made = sum(marker.made for marker in detected)
    detected_attempted = len(detected)
    expected_missed = expected_attempted - expected_made
    detected_missed = detected_attempted - detected_made
    passed = (
        detected_made == expected_made
        and detected_missed == expected_missed
    )
    return {
        "expected_made": expected_made,
        "expected_missed": expected_missed,
        "expected_attempted": expected_attempted,
        "detected_made": detected_made,
        "detected_missed": detected_missed,
        "detected_attempted": detected_attempted,
        "unresolved_made": max(expected_made - detected_made, 0),
        "unresolved_missed": max(expected_missed - detected_missed, 0),
        "unresolved_attempted": max(expected_attempted - detected_attempted, 0),
        "status": "passed" if passed else "needs_review",
    }
