import unittest

from extract_advanced import append_rotation_page, describe_validation
from ibl_extract.advanced_parsers import (
    parse_lineup_page,
    parse_player_plus_minus,
    parse_rotation_page,
    parse_shot_area_totals,
    parse_start_list,
)
from ibl_extract.metrics import (
    effective_field_goal_percentage,
    efficiency,
    possessions,
    source_arithmetic,
    team_metrics,
    true_shooting_percentage,
)


class AdvancedParserTest(unittest.TestCase):
    def test_rotation_index_continues_across_pages(self):
        existing = [{"team_code": "AAA", "stint_index": 1}]
        rows = [
            {"team_code": "AAA", "stint_index": 1},
            {"team_code": "AAA", "stint_index": 2},
        ]

        append_rotation_page(existing, rows, "AAA")

        self.assertEqual(
            [row["stint_index"] for row in existing], [1, 2, 3]
        )

    def test_validation_reason_has_stable_issue_key(self):
        validation = {
            "source_game_key": "2025:w1:g1:AAA:BBB",
            "source_path": "/tmp/rotation.pdf",
            "source_sha256": "abc123",
            "report_type": "rotations",
            "team_code": "AAA",
            "status": "needs_review",
        }

        describe_validation(validation)
        first_key = validation["issue_key"]
        describe_validation(validation)

        self.assertEqual(
            validation["rule_code"], "rotation_totals_mismatch"
        )
        self.assertEqual(validation["severity"], "warning")
        self.assertEqual(validation["issue_key"], first_key)

    def test_unavailable_plus_minus_has_specific_reason(self):
        validation = {
            "source_game_key": "2025:w1:g1:AAA:BBB",
            "source_path": "/tmp/plus-minus.pdf",
            "source_sha256": "def456",
            "report_type": "plus_minus",
            "player_key": None,
            "jersey_no": "4",
            "display_name": "John Doe",
            "expected_plus_minus": None,
            "status": "needs_review",
        }

        describe_validation(validation)

        self.assertEqual(
            validation["rule_code"],
            "plus_minus_crosscheck_unavailable",
        )
        self.assertIn("tidak tersedia", validation["message"])

    def test_lineup_summary(self):
        text = (
            "1- Alpha A/ 2- Bravo B/ 3- Charlie C/ "
            "4- Delta D/ 5- Echo E/ "
            "10:16 21-18 3 2,0455 11 1 2 6"
        )

        rows = parse_lineup_page(text, "AAA")

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["duration_seconds"], 616)
        self.assertEqual(rows[0]["score_for"], 21)
        self.assertEqual(len(rows[0]["players"]), 5)

    def test_rotation_handles_player_after_numeric_line(self):
        text = "\n".join(
            (
                "1- Alpha A/ 2- Bravo B/ 3- Charlie C/ 4- Delta D/",
                "1 10:00 1 05:00 05:00 10-8 2 4 1 2 3",
                "5- Echo E/",
            )
        )

        rows = parse_rotation_page(text, "AAA")

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["start_clock"], "10:00")
        self.assertEqual(
            [player["jersey_no"] for player in rows[0]["players"]],
            ["1", "2", "3", "4", "5"],
        )

    def test_start_list_with_and_without_averages(self):
        text = "\n".join(
            (
                "Alpha Team (AAA) Assistant Coach(es): Coach",
                "1 John Doe (C) PG 1.85 25 8 12.5 3.0 50 40 80 4.0 5.0 30.0",
                "2 New Player PF 2.01 22",
            )
        )

        rows = parse_start_list(text)

        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[0]["is_captain"])
        self.assertEqual(rows[0]["height_cm"], 185)
        self.assertIsNone(rows[1]["games_played"])

    def test_plus_minus_detail(self):
        text = (
            "4 John Doe 26:06 13:54 56-45 28-26 11 2 "
            "2,15 2,01 11 4 30 16 3 3 7 3"
        )

        rows = parse_player_plus_minus(text)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["plus_minus_on"], 11)
        self.assertEqual(rows[0]["minutes_on_seconds"], 1566)

    def test_shot_area_totals(self):
        text = "\n".join(
            (
                "Field Goals 31/71 44 Field Goals 24/60 40",
                "2 Points 23/44 52 2 Points 14/32 44",
                "3 Points 8/27 30 3 Points 10/28 36",
                "Free Throws 14/20 70 Free Throws 13/19 68",
            )
        )

        rows = parse_shot_area_totals(text, "AAA", "BBB")

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["fg_attempted"], 71)
        self.assertEqual(rows[1]["three_pt_made"], 10)


class MetricTest(unittest.TestCase):
    def setUp(self):
        self.stats = {
            "points": 84,
            "fg_made": 31,
            "fg_attempted": 71,
            "two_pt_made": 23,
            "two_pt_attempted": 44,
            "three_pt_made": 8,
            "three_pt_attempted": 27,
            "ft_made": 14,
            "ft_attempted": 20,
            "offensive_rebounds": 18,
            "defensive_rebounds": 28,
            "total_rebounds": 46,
            "assists": 15,
            "turnovers": 10,
            "steals": 6,
            "blocks": 1,
            "minutes_seconds": 12000,
        }

    def test_derived_values_match_manual_sample(self):
        self.assertEqual(efficiency(self.stats), 96)
        self.assertEqual(
            effective_field_goal_percentage(self.stats),
            49.2958,
        )
        self.assertEqual(
            true_shooting_percentage(self.stats),
            52.6316,
        )
        self.assertEqual(possessions(self.stats), 71.8)

    def test_source_arithmetic(self):
        self.assertEqual(source_arithmetic(self.stats)["status"], "passed")

    def test_team_rating_uses_each_team_possessions(self):
        opponent = {
            **self.stats,
            "points": 71,
            "fg_made": 24,
            "fg_attempted": 60,
            "two_pt_made": 14,
            "two_pt_attempted": 32,
            "three_pt_made": 10,
            "three_pt_attempted": 28,
            "ft_made": 13,
            "ft_attempted": 19,
            "offensive_rebounds": 10,
            "defensive_rebounds": 32,
            "total_rebounds": 42,
            "turnovers": 12,
        }

        metrics = team_metrics(self.stats, opponent)

        self.assertEqual(metrics["pace"], 71.08)
        self.assertEqual(metrics["offensive_rating"], 116.9916)
        self.assertEqual(metrics["defensive_rating"], 100.9096)


if __name__ == "__main__":
    unittest.main()
