from pathlib import Path
import unittest

from ibl_extract.core import classify, path_metadata
from ibl_extract.parsers import player_evaluation, stats_line
from ibl_extract.shot_detection import detect_markers, validation_record
from ibl_extract.court import (
    area_name,
    assign_points,
    geometry_points,
)
from ibl_extract.pbp_matching import match_shots_to_events

from PIL import Image, ImageDraw


class CoreTest(unittest.TestCase):
    def test_path(self):
        result = path_metadata(
            Path("/data/IBL 2025/WEEK 1/SABTU/GAME 1 RSB VS KBS/a.pdf")
        )
        self.assertEqual(result["source_game_key"], "2025:w1:g1:RSB:KBS")

    def test_classification(self):
        result = classify(Path("FIBA Box Score RSB vs KBS Q4.pdf"))
        self.assertEqual(result["report_type"], "box_score")
        self.assertEqual(result["report_period"], 4)

    def test_classification_handles_compact_q4_and_full_game(self):
        compact = classify(Path("FIBA Box Score SWS vs DUB 04 Mayq4.pdf"))
        full = classify(Path("FIBA Box Score DUB vs SWS FULL GAME.pdf"))

        self.assertEqual(compact["report_period"], 4)
        self.assertEqual(full["report_period"], 4)
        self.assertEqual(full["report_scope"], "full")

    def test_stats(self):
        result = stats_line(
            "25/66 37,9 18/39 46,2 7/27 25,9 19/25 76,0 "
            "13 34 47 19 22 10 1 18 18 -4 84 76"
        )
        self.assertEqual(result["points"], 76)
        self.assertEqual(result["total_rebounds"], 47)

    def test_detects_made_and_missed_markers(self):
        image = Image.new("RGBA", (480, 430), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.rectangle((94, 98, 106, 102), fill=(255, 0, 0, 255))
        draw.rectangle((194, 199, 206, 201), fill=(0, 128, 0, 255))
        draw.rectangle((199, 194, 201, 206), fill=(0, 128, 0, 255))

        markers = detect_markers(
            image,
            expected_made=1,
            expected_missed=1,
        )

        self.assertEqual(len(markers), 2)
        self.assertEqual(sum(marker.made for marker in markers), 1)
        self.assertEqual(
            {(marker.x, marker.y) for marker in markers},
            {(100.0, 100.0), (200.0, 200.0)},
        )

    def test_validation_keeps_unresolved_markers_explicit(self):
        player = {"fg_made": 2, "fg_attempted": 3}
        detected = detect_markers(
            Image.new("RGBA", (480, 430), (0, 0, 0, 0)),
            expected_made=2,
            expected_missed=1,
        )

        result = validation_record(player, detected)

        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["unresolved_attempted"], 3)

    def test_player_evaluation_keeps_dnp_player(self):
        text = (
            "#3 Teemo Teemo (Prawira Harum Bandung) Minutes Played DNP\n"
            "Field Goals 2 Points 3 Points Free Throws Rebounds Fouls Points 0\n"
            "M/A % M/A % M/A % M/A % OR DR TOT AS TO ST BS PF FD PTS "
            "Plus / Minus -2\n"
        )

        players = player_evaluation(text)

        self.assertEqual(len(players), 1)
        self.assertFalse(players[0]["did_play"])
        self.assertEqual(players[0]["fg_attempted"], 0)
        self.assertIsNone(players[0]["plus_minus"])

    def test_court_geometry_classifies_common_zones(self):
        self.assertEqual(geometry_points(240, 50), 2)
        self.assertEqual(geometry_points(240, 300), 3)
        self.assertEqual(area_name(240, 50, 2), "restricted_area")
        self.assertEqual(area_name(10, 50, 3), "left_corner_3")

    def test_stats_constraint_adjusts_near_boundary(self):
        shots = [
            {"player_key": "p1", "x": 240, "y": 100, "made": True},
            {"player_key": "p1", "x": 240, "y": 300, "made": False},
        ]
        player_stats = {
            "three_pt_attempted": 1,
            "three_pt_made": 0,
        }
        validation = {
            "unresolved_attempted": 0,
            "unresolved_made": 0,
            "unresolved_missed": 0,
        }

        enriched, result = assign_points(
            shots,
            player_stats,
            validation,
        )

        self.assertEqual([shot["points"] for shot in enriched], [2, 3])
        self.assertEqual(result["status"], "passed")

    def test_pbp_match_does_not_choose_one_of_multiple_events(self):
        shots = [
            {
                "player_key": "game:AAA:1:player",
                "made": False,
                "points": 2,
                "area_name": "restricted_area",
            }
        ]
        events = [
            {
                "pbp_event_key": f"game:pbp:{index}",
                "player_key": "game:AAA:1:player",
                "made": False,
                "points": 2,
                "period_no": index,
                "event_index": index,
                "in_paint": True,
            }
            for index in (1, 2)
        ]

        result = match_shots_to_events(shots, events)

        self.assertEqual(result[0]["pbp_match_status"], "ambiguous")
        self.assertEqual(
            result[0]["pbp_candidate_event_keys"],
            ["game:pbp:1", "game:pbp:2"],
        )


if __name__ == "__main__":
    unittest.main()
