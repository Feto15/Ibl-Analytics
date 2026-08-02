import unittest

from import_neon import (
    build_review_validations,
    prepare_advanced_rows,
    validation_report_scope,
)


class ImportNeonTest(unittest.TestCase):
    def test_prepare_advanced_rows_keeps_natural_keys(self):
        advanced = [
            {
                "source_game_key": "2026:w1:g1:AAA:BBB",
                "source_sha256": "report-sha",
                "lineup_summaries": [
                    {
                        "team_code": "AAA",
                        "lineup_index": 2,
                        "duration_seconds": 60,
                        "score_for": 4,
                        "score_against": 2,
                        "plus_minus": 2,
                        "points_per_minute": 4,
                        "rebounds": 1,
                        "steals": 0,
                        "turnovers": 0,
                        "assists": 1,
                        "players": [
                            {"normalized_name": "alpha"},
                            {"normalized_name": "unresolved"},
                        ],
                    }
                ],
                "rotation_stints": [
                    {
                        "team_code": "AAA",
                        "stint_index": 3,
                        "start_period": 1,
                        "start_clock": "08:00",
                        "end_period": 1,
                        "end_clock": "07:00",
                        "duration_seconds": 60,
                        "score_for": 2,
                        "score_against": 0,
                        "plus_minus": 2,
                        "rebounds": 1,
                        "steals": 0,
                        "turnovers": 0,
                        "assists": 1,
                        "is_starting_lineup": True,
                        "players": [{"normalized_name": "alpha"}],
                    }
                ],
            }
        ]

        rows = prepare_advanced_rows(
            advanced,
            {"2026:w1:g1:AAA:BBB": 10},
            {"report-sha": 20},
            {"AAA": 30},
            {"alpha": 40},
        )

        self.assertEqual(rows["lineups"][0][:4], (10, 20, 30, 2))
        self.assertEqual(
            rows["lineup_players"], [(20, 30, 2, 40)]
        )
        self.assertEqual(rows["rotations"][0][:4], (10, 20, 30, 3))
        self.assertEqual(
            rows["rotation_players"], [(20, 30, 3, 40)]
        )
        self.assertEqual(rows["starters"], [(10, 30, 40)])

    def test_validation_scope_only_contains_current_input(self):
        validations = [
            {"source_sha256": "2026-a"},
            {"source_sha256": "2026-a"},
            {"source_sha256": "2026-b"},
        ]

        scope = validation_report_scope(
            validations,
            {"2024-a": 1, "2026-a": 26, "2026-b": 27},
        )

        self.assertEqual(scope, [26, 27])

    def test_review_validations_include_shots_and_missing_metrics(self):
        manifest = [
            {
                "source_sha256": "game-a-report",
                "source_path": "/game-a.pdf",
                "report_type": "box_score",
                "report_period": 4,
                "team_stats": [{}, {}],
                "game": {"source_game_key": "game-a"},
            },
            {
                "source_sha256": "game-b-report",
                "source_path": "/game-b.pdf",
                "report_type": "box_score",
                "report_period": 4,
                "team_stats": [],
                "game": {"source_game_key": "game-b"},
            },
        ]
        shot_validations = [
            {
                "source_sha256": "game-a-report",
                "source_path": "/game-a.pdf",
                "source_game_key": "game-a",
                "player_key": "game-a:AAA:1:alpha",
                "status": "needs_review",
            }
        ]
        team_metrics = [
            {"source_game_key": "game-a", "team_code": "AAA"},
            {"source_game_key": "game-a", "team_code": "BBB"},
        ]

        validations = build_review_validations(
            manifest, [], shot_validations, team_metrics
        )

        shot_issue = next(
            row for row in validations
            if row["rule_code"] == "shot_marker_count_mismatch"
        )
        self.assertEqual(shot_issue["status"], "needs_review")
        metric_issues = {
            row["source_game_key"]: row
            for row in validations
            if row["rule_code"] == "team_metrics_unavailable"
        }
        self.assertEqual(metric_issues["game-a"]["status"], "passed")
        self.assertEqual(metric_issues["game-b"]["status"], "needs_review")
        self.assertEqual(
            metric_issues["game-b"]["source_sha256"], "game-b-report"
        )


if __name__ == "__main__":
    unittest.main()
