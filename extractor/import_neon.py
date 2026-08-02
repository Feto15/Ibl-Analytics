#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
from collections import Counter
from pathlib import Path
from typing import Any

from ibl_extract.core import normalize_name


STAT_FIELDS = (
    "fg_made",
    "fg_attempted",
    "two_pt_made",
    "two_pt_attempted",
    "three_pt_made",
    "three_pt_attempted",
    "ft_made",
    "ft_attempted",
    "offensive_rebounds",
    "defensive_rebounds",
    "total_rebounds",
    "assists",
    "turnovers",
    "steals",
    "blocks",
    "personal_fouls",
    "fouls_drawn",
    "plus_minus",
    "points",
)


def read_jsonl(path: Path | None) -> list[dict[str, Any]]:
    if path is None:
        return []
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def canonical_games(
    manifest: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    result = {}
    for report in manifest:
        game = report.get("game") or {}
        key = game.get("source_game_key")
        if not key:
            continue
        rank = (
            len(game.get("period_scores") or []),
            int(game.get("home_score") or 0)
            + int(game.get("away_score") or 0),
            int(report.get("report_period") or 0),
        )
        current = result.get(key)
        if current is None or rank > current[0]:
            result[key] = (rank, game)
    return {key: item[1] for key, item in result.items()}


def player_team_codes(
    report: dict[str, Any],
) -> dict[str, str]:
    game = report.get("game") or {}
    ordered_names = []
    for player in report.get("player_stats") or []:
        name = normalize_name(player.get("team_name") or "")
        if name and name not in ordered_names:
            ordered_names.append(name)
    result = {}
    home_name = normalize_name(game.get("home_team_name") or "")
    away_name = normalize_name(game.get("away_team_name") or "")
    for name in ordered_names:
        if home_name and (name in home_name or home_name in name):
            result[name] = game.get("home_team_code")
        elif away_name and (name in away_name or away_name in name):
            result[name] = game.get("away_team_code")
    for index, name in enumerate(ordered_names[:2]):
        result.setdefault(
            name,
            game.get("home_team_code" if index == 0 else "away_team_code"),
        )
    return result


def flatten_advanced(
    advanced_reports: list[dict[str, Any]],
) -> Counter[str]:
    counts = Counter()
    for report in advanced_reports:
        for key in (
            "start_list_players",
            "lineup_summaries",
            "rotation_stints",
            "player_plus_minus",
            "shot_area_totals",
        ):
            counts[key] += len(report.get(key) or [])
    return counts


def build_review_validations(
    manifest: list[dict[str, Any]],
    advanced_validations: list[dict[str, Any]],
    shot_validations: list[dict[str, Any]],
    team_metrics: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    validations = list(advanced_validations)
    for validation in shot_validations:
        row = dict(validation)
        row.setdefault("severity", "warning")
        row["rule_code"] = "shot_marker_count_mismatch"
        row["message"] = (
            "Shot marker count does not match the player's box-score attempts."
            if row.get("status") == "needs_review"
            else "Shot marker count matches the player's box-score attempts."
        )
        validations.append(row)

    if not team_metrics:
        return validations

    metric_counts = Counter(
        row.get("source_game_key") for row in team_metrics
    )
    reports_by_game: dict[str, list[dict[str, Any]]] = {}
    for report in manifest:
        game_key = (report.get("game") or {}).get("source_game_key")
        if game_key:
            reports_by_game.setdefault(str(game_key), []).append(report)

    for game_key, reports in reports_by_game.items():
        source = max(
            reports,
            key=lambda report: (
                report.get("report_type") == "box_score",
                int(report.get("report_period") or 0),
                len(report.get("team_stats") or []),
                str(report.get("source_path") or ""),
            ),
        )
        available = metric_counts[game_key] >= 2
        validations.append(
            {
                "source_path": source.get("source_path"),
                "source_sha256": source.get("source_sha256"),
                "source_game_key": game_key,
                "status": "passed" if available else "needs_review",
                "severity": "warning",
                "rule_code": "team_metrics_unavailable",
                "message": (
                    "Team metrics are available for both teams."
                    if available
                    else "Team metrics could not be calculated for both teams."
                ),
                "team_metric_rows": metric_counts[game_key],
            }
        )
    return validations


def validate_inputs(
    manifest: list[dict[str, Any]],
    shots: list[dict[str, Any]],
    advanced: list[dict[str, Any]],
    advanced_validations: list[dict[str, Any]],
    player_metrics: list[dict[str, Any]],
    team_metrics: list[dict[str, Any]],
    shot_validations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    shot_validations = shot_validations or []
    review_validations = build_review_validations(
        manifest,
        advanced_validations,
        shot_validations,
        team_metrics,
    )
    games = canonical_games(manifest)
    known_games = set(games)
    known_reports = {
        report.get("source_sha256") for report in manifest
    }
    shot_keys = [
        (
            f"{shot['player_key']}:{shot['player_shot_index']}"
        )
        for shot in shots
    ]
    errors = {
        "shots_unknown_game": sum(
            shot.get("source_game_key") not in known_games for shot in shots
        ),
        "shots_missing_team": sum(
            not shot.get("team_code") for shot in shots
        ),
        "shots_missing_player": sum(
            not shot.get("normalized_name") for shot in shots
        ),
        "duplicate_source_shot_keys": len(shot_keys)
        - len(set(shot_keys)),
        "advanced_unknown_game": sum(
            report.get("source_game_key") not in known_games
            for report in advanced
        ),
        "advanced_validations_unknown_report": sum(
            validation.get("source_sha256") not in known_reports
            for validation in advanced_validations
        ),
        "shot_validations_unknown_report": sum(
            validation.get("source_sha256") not in known_reports
            for validation in shot_validations
        ),
        "player_metrics_unknown_game": sum(
            row.get("source_game_key") not in known_games
            for row in player_metrics
        ),
        "team_metrics_unknown_game": sum(
            row.get("source_game_key") not in known_games
            for row in team_metrics
        ),
    }
    return {
        "status": (
            "passed" if not any(errors.values()) else "failed"
        ),
        "counts": {
            "manifest_reports": len(manifest),
            "games": len(games),
            "shots": len(shots),
            "advanced_reports": len(advanced),
            **flatten_advanced(advanced),
            "advanced_validations": len(advanced_validations),
            "shot_validations": len(shot_validations),
            "metric_validations": sum(
                row.get("rule_code") == "team_metrics_unavailable"
                for row in review_validations
            ),
            "validation_issues": sum(
                row.get("status") == "needs_review"
                for row in review_validations
            ),
            "player_metrics": len(player_metrics),
            "team_metrics": len(team_metrics),
        },
        "errors": errors,
    }


def fetch_map(
    cursor: Any,
    query: str,
) -> dict[Any, Any]:
    cursor.execute(query)
    return {row[0]: row[1] for row in cursor.fetchall()}


def prepare_advanced_rows(
    advanced: list[dict[str, Any]],
    game_ids: dict[str, int],
    report_ids: dict[str, int],
    team_ids: dict[str, int],
    player_ids: dict[str, int],
) -> dict[str, list[tuple[Any, ...]]]:
    result: dict[str, list[tuple[Any, ...]]] = {
        "rosters": [],
        "lineups": [],
        "lineup_players": [],
        "rotations": [],
        "rotation_players": [],
        "starters": [],
        "plus_minus": [],
        "shot_areas": [],
    }
    for report in advanced:
        game_key = report["source_game_key"]
        game_id = game_ids[game_key]
        report_id = report_ids[report["source_sha256"]]

        for player in report.get("start_list_players") or []:
            player_id = player_ids.get(player["normalized_name"])
            team_id = team_ids.get(player["team_code"])
            if not player_id or not team_id:
                continue
            result["rosters"].append(
                (
                    game_id,
                    report_id,
                    team_id,
                    player_id,
                    player["jersey_no"],
                    player.get("is_captain", False),
                    player.get("position"),
                    player.get("height_cm"),
                    player.get("age"),
                    player.get("games_played"),
                    player.get("points_per_game"),
                    player.get("plus_minus_per_game"),
                    player.get("fg_percent"),
                    player.get("three_pt_percent"),
                    player.get("ft_percent"),
                    player.get("rebounds_per_game"),
                    player.get("assists_per_game"),
                    player.get("minutes_per_game"),
                )
            )

        for row in report.get("lineup_summaries") or []:
            team_id = team_ids[row["team_code"]]
            lineup_key = (report_id, team_id, row["lineup_index"])
            result["lineups"].append(
                (
                    game_id,
                    *lineup_key,
                    row.get("duration_seconds"),
                    row.get("score_for"),
                    row.get("score_against"),
                    row.get("plus_minus"),
                    row.get("points_per_minute"),
                    row.get("rebounds"),
                    row.get("steals"),
                    row.get("turnovers"),
                    row.get("assists"),
                )
            )
            for player in row["players"]:
                player_id = player_ids.get(
                    player.get("normalized_name")
                )
                if player_id:
                    result["lineup_players"].append(
                        (*lineup_key, player_id)
                    )

        for row in report.get("rotation_stints") or []:
            team_id = team_ids[row["team_code"]]
            stint_key = (report_id, team_id, row["stint_index"])
            result["rotations"].append(
                (
                    game_id,
                    *stint_key,
                    row.get("start_period"),
                    row.get("start_clock"),
                    row.get("end_period"),
                    row.get("end_clock"),
                    row.get("duration_seconds"),
                    row.get("score_for"),
                    row.get("score_against"),
                    row.get("plus_minus"),
                    row.get("rebounds"),
                    row.get("steals"),
                    row.get("turnovers"),
                    row.get("assists"),
                    row.get("is_starting_lineup", False),
                )
            )
            for player in row["players"]:
                player_id = player_ids.get(
                    player.get("normalized_name")
                )
                if not player_id:
                    continue
                result["rotation_players"].append(
                    (*stint_key, player_id)
                )
                if row.get("is_starting_lineup"):
                    result["starters"].append(
                        (game_id, team_id, player_id)
                    )

        for row in report.get("player_plus_minus") or []:
            player_id = player_ids.get(row.get("normalized_name"))
            team_id = team_ids.get(row.get("team_code"))
            if not player_id or not team_id:
                continue
            result["plus_minus"].append(
                (
                    game_id,
                    report_id,
                    team_id,
                    player_id,
                    row.get("minutes_on_seconds"),
                    row.get("minutes_off_seconds"),
                    row.get("score_on_for"),
                    row.get("score_on_against"),
                    row.get("score_off_for"),
                    row.get("score_off_against"),
                    row.get("plus_minus_on"),
                    row.get("plus_minus_off"),
                    row.get("points_per_minute_on"),
                    row.get("points_per_minute_off"),
                    row.get("assists_on"),
                    row.get("assists_off"),
                    row.get("rebounds_on"),
                    row.get("rebounds_off"),
                    row.get("steals_on"),
                    row.get("steals_off"),
                    row.get("turnovers_on"),
                    row.get("turnovers_off"),
                )
            )

        for row in report.get("shot_area_totals") or []:
            result["shot_areas"].append(
                (
                    report_id,
                    game_id,
                    team_ids[row["team_code"]],
                    report.get("report_scope"),
                    report.get("report_period"),
                    row.get("fg_made"),
                    row.get("fg_attempted"),
                    row.get("two_pt_made"),
                    row.get("two_pt_attempted"),
                    row.get("three_pt_made"),
                    row.get("three_pt_attempted"),
                    row.get("ft_made"),
                    row.get("ft_attempted"),
                )
            )
    return result


def import_advanced_batches(
    cursor: Any,
    rows: dict[str, list[tuple[Any, ...]]],
    advanced_report_ids: list[int],
) -> dict[str, int]:
    if advanced_report_ids:
        for table in (
            "lineup_summaries",
            "lineup_stints",
            "player_plus_minus_details",
            "shot_area_report_totals",
        ):
            cursor.execute(
                f"delete from {table} where report_id = any(%s)",
                (advanced_report_ids,),
            )

    cursor.executemany(
        """
        insert into game_rosters (
          game_id, report_id, team_id, player_id, jersey_no,
          is_captain, position, height_cm, age, games_played,
          points_per_game, plus_minus_per_game, fg_percent,
          three_pt_percent, ft_percent, rebounds_per_game,
          assists_per_game, minutes_per_game
        ) values (
          %s, %s, %s, %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        on conflict (game_id, team_id, player_id) do update set
          report_id = excluded.report_id,
          jersey_no = excluded.jersey_no,
          is_captain = excluded.is_captain,
          position = excluded.position,
          height_cm = excluded.height_cm,
          age = excluded.age,
          games_played = excluded.games_played,
          points_per_game = excluded.points_per_game,
          plus_minus_per_game = excluded.plus_minus_per_game,
          fg_percent = excluded.fg_percent,
          three_pt_percent = excluded.three_pt_percent,
          ft_percent = excluded.ft_percent,
          rebounds_per_game = excluded.rebounds_per_game,
          assists_per_game = excluded.assists_per_game,
          minutes_per_game = excluded.minutes_per_game
        """,
        rows["rosters"],
    )

    cursor.executemany(
        """
        insert into lineup_summaries (
          game_id, report_id, team_id, lineup_index,
          duration_seconds, points_for, points_against,
          plus_minus, points_per_minute, rebounds, steals,
          turnovers, assists
        ) values (
          %s, %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s
        )
        on conflict (report_id, team_id, lineup_index)
        do update set
          duration_seconds = excluded.duration_seconds,
          points_for = excluded.points_for,
          points_against = excluded.points_against,
          plus_minus = excluded.plus_minus,
          points_per_minute = excluded.points_per_minute,
          rebounds = excluded.rebounds,
          steals = excluded.steals,
          turnovers = excluded.turnovers,
          assists = excluded.assists
        """,
        rows["lineups"],
    )
    lineup_ids: dict[tuple[int, int, int], int] = {}
    if advanced_report_ids:
        cursor.execute(
            """
            select report_id, team_id, lineup_index, lineup_summary_id
            from lineup_summaries
            where report_id = any(%s)
            """,
            (advanced_report_ids,),
        )
        lineup_ids = {
            (report_id, team_id, lineup_index): lineup_id
            for report_id, team_id, lineup_index, lineup_id
            in cursor.fetchall()
        }
    lineup_player_rows = list(
        {
            (lineup_ids[key[:3]], key[3])
            for key in rows["lineup_players"]
            if key[:3] in lineup_ids
        }
    )
    cursor.executemany(
        """
        insert into lineup_summary_players (
          lineup_summary_id, player_id
        ) values (%s, %s)
        on conflict do nothing
        """,
        lineup_player_rows,
    )

    cursor.executemany(
        """
        insert into lineup_stints (
          game_id, report_id, team_id, stint_index,
          start_period, start_clock, end_period, end_clock,
          duration_seconds, points_for, points_against,
          plus_minus, rebounds, steals, turnovers, assists,
          is_starting_lineup
        ) values (
          %s, %s, %s, %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s, %s, %s
        )
        on conflict (report_id, team_id, stint_index)
        do update set
          start_period = excluded.start_period,
          start_clock = excluded.start_clock,
          end_period = excluded.end_period,
          end_clock = excluded.end_clock,
          duration_seconds = excluded.duration_seconds,
          points_for = excluded.points_for,
          points_against = excluded.points_against,
          plus_minus = excluded.plus_minus,
          rebounds = excluded.rebounds,
          steals = excluded.steals,
          turnovers = excluded.turnovers,
          assists = excluded.assists,
          is_starting_lineup = excluded.is_starting_lineup
        """,
        rows["rotations"],
    )
    stint_ids: dict[tuple[int, int, int], int] = {}
    if advanced_report_ids:
        cursor.execute(
            """
            select report_id, team_id, stint_index, stint_id
            from lineup_stints
            where report_id = any(%s)
            """,
            (advanced_report_ids,),
        )
        stint_ids = {
            (report_id, team_id, stint_index): stint_id
            for report_id, team_id, stint_index, stint_id
            in cursor.fetchall()
        }
    rotation_player_rows = list(
        {
            (stint_ids[key[:3]], key[3])
            for key in rows["rotation_players"]
            if key[:3] in stint_ids
        }
    )
    cursor.executemany(
        """
        insert into lineup_stint_players (stint_id, player_id)
        values (%s, %s) on conflict do nothing
        """,
        rotation_player_rows,
    )
    rotation_team_scopes = list(
        {(row[0], row[2]) for row in rows["rotations"]}
    )
    cursor.executemany(
        """
        update game_rosters set is_starter = false
        where game_id = %s and team_id = %s
        """,
        rotation_team_scopes,
    )
    cursor.executemany(
        """
        update game_rosters set is_starter = true
        where game_id = %s and team_id = %s and player_id = %s
        """,
        list(set(rows["starters"])),
    )

    cursor.executemany(
        """
        insert into player_plus_minus_details (
          game_id, report_id, team_id, player_id,
          minutes_on_seconds, minutes_off_seconds,
          score_on_for, score_on_against, score_off_for,
          score_off_against, plus_minus_on, plus_minus_off,
          points_per_minute_on, points_per_minute_off,
          assists_on, assists_off, rebounds_on, rebounds_off,
          steals_on, steals_off, turnovers_on, turnovers_off
        ) values (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        on conflict (game_id, player_id) do update set
          report_id = excluded.report_id,
          team_id = excluded.team_id,
          minutes_on_seconds = excluded.minutes_on_seconds,
          minutes_off_seconds = excluded.minutes_off_seconds,
          score_on_for = excluded.score_on_for,
          score_on_against = excluded.score_on_against,
          score_off_for = excluded.score_off_for,
          score_off_against = excluded.score_off_against,
          plus_minus_on = excluded.plus_minus_on,
          plus_minus_off = excluded.plus_minus_off,
          points_per_minute_on = excluded.points_per_minute_on,
          points_per_minute_off = excluded.points_per_minute_off,
          assists_on = excluded.assists_on,
          assists_off = excluded.assists_off,
          rebounds_on = excluded.rebounds_on,
          rebounds_off = excluded.rebounds_off,
          steals_on = excluded.steals_on,
          steals_off = excluded.steals_off,
          turnovers_on = excluded.turnovers_on,
          turnovers_off = excluded.turnovers_off
        """,
        rows["plus_minus"],
    )
    cursor.executemany(
        """
        insert into shot_area_report_totals (
          report_id, game_id, team_id, report_scope,
          report_period, fg_made, fg_attempted, two_pt_made,
          two_pt_attempted, three_pt_made,
          three_pt_attempted, ft_made, ft_attempted
        ) values (
          %s, %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s
        )
        on conflict (report_id, team_id) do update set
          report_scope = excluded.report_scope,
          report_period = excluded.report_period,
          fg_made = excluded.fg_made,
          fg_attempted = excluded.fg_attempted,
          two_pt_made = excluded.two_pt_made,
          two_pt_attempted = excluded.two_pt_attempted,
          three_pt_made = excluded.three_pt_made,
          three_pt_attempted = excluded.three_pt_attempted,
          ft_made = excluded.ft_made,
          ft_attempted = excluded.ft_attempted
        """,
        rows["shot_areas"],
    )
    return {
        "start_list_players": len(rows["rosters"]),
        "lineup_summaries": len(rows["lineups"]),
        "lineup_summary_players": len(lineup_player_rows),
        "rotation_stints": len(rows["rotations"]),
        "rotation_stint_players": len(rotation_player_rows),
        "player_plus_minus_details": len(rows["plus_minus"]),
        "shot_area_report_totals": len(rows["shot_areas"]),
    }


def validation_report_scope(
    advanced_validations: list[dict[str, Any]],
    report_ids: dict[str, int],
) -> list[int]:
    return sorted(
        {
            report_ids[validation["source_sha256"]]
            for validation in advanced_validations
        }
    )


def import_data(
    connection: Any,
    manifest: list[dict[str, Any]],
    shots: list[dict[str, Any]],
    advanced: list[dict[str, Any]],
    advanced_validations: list[dict[str, Any]],
    player_metrics: list[dict[str, Any]],
    team_metrics: list[dict[str, Any]],
    schema_path: Path | None,
) -> dict[str, int]:
    cursor = connection.cursor()
    if schema_path:
        cursor.execute(schema_path.read_text(encoding="utf-8"))

    games = canonical_games(manifest)
    seasons = sorted(
        {game["season_year"] for game in games.values()}
    )
    cursor.executemany(
        """
        insert into seasons (season_year)
        values (%s)
        on conflict (season_year) do nothing
        """,
        [(season,) for season in seasons],
    )

    teams = {}
    for game in games.values():
        for side in ("home", "away"):
            code = game.get(f"{side}_team_code")
            if code:
                teams.setdefault(code, game.get(f"{side}_team_name"))
    for report in manifest:
        for stats in report.get("team_stats") or []:
            teams[stats["team_code"]] = stats.get("team_name")
    cursor.executemany(
        """
        insert into teams (code, name) values (%s, %s)
        on conflict (code) do update
        set name = coalesce(excluded.name, teams.name)
        """,
        sorted(teams.items()),
    )
    team_ids = fetch_map(cursor, "select code, team_id from teams")

    players = {}
    for report in manifest:
        for player in report.get("player_stats") or []:
            players[player["normalized_name"]] = player["display_name"]
    for report in advanced:
        for player in report.get("start_list_players") or []:
            players[player["normalized_name"]] = player["display_name"]
        for player in report.get("player_plus_minus") or []:
            players[player["normalized_name"]] = player["display_name"]
    cursor.executemany(
        """
        insert into players (normalized_name, display_name)
        values (%s, %s)
        on conflict (normalized_name) do update
        set display_name = excluded.display_name
        """,
        sorted(players.items()),
    )
    player_ids = fetch_map(
        cursor, "select normalized_name, player_id from players"
    )

    game_rows = []
    for game in games.values():
        game_rows.append(
            (
                game["season_year"],
                game.get("external_game_no"),
                game["source_game_key"],
                game.get("week_no"),
                game.get("game_date"),
                game.get("start_time"),
                game.get("venue"),
                game.get("duration_seconds"),
                team_ids[game["home_team_code"]],
                team_ids[game["away_team_code"]],
                game.get("home_score"),
                game.get("away_score"),
            )
        )
    cursor.executemany(
        """
        insert into games (
          season_year, external_game_no, source_game_key, week_no,
          game_date, start_time, venue, duration_seconds,
          home_team_id, away_team_id, home_score, away_score
        ) values (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        on conflict (source_game_key) do update set
          external_game_no = excluded.external_game_no,
          week_no = excluded.week_no,
          game_date = excluded.game_date,
          start_time = excluded.start_time,
          venue = excluded.venue,
          duration_seconds = excluded.duration_seconds,
          home_team_id = excluded.home_team_id,
          away_team_id = excluded.away_team_id,
          home_score = excluded.home_score,
          away_score = excluded.away_score
        """,
        game_rows,
    )
    game_ids = fetch_map(
        cursor, "select source_game_key, game_id from games"
    )

    period_rows = []
    for key, game in games.items():
        for period in game.get("period_scores") or []:
            period_rows.append(
                (
                    game_ids[key],
                    period["period_no"],
                    period["period_type"],
                    period["home_score"],
                    period["away_score"],
                )
            )
    cursor.executemany(
        """
        insert into game_periods (
          game_id, period_no, period_type, home_score, away_score
        ) values (%s, %s, %s, %s, %s)
        on conflict (game_id, period_no) do update set
          period_type = excluded.period_type,
          home_score = excluded.home_score,
          away_score = excluded.away_score
        """,
        period_rows,
    )

    report_rows = []
    for report in manifest:
        game_key = (report.get("game") or {}).get("source_game_key")
        report_rows.append(
            (
                game_ids.get(game_key),
                report.get("report_type"),
                report.get("report_period"),
                report.get("report_scope"),
                report["source_path"],
                report.get("source_filename"),
                report.get("source_sha256"),
                report.get("page_count"),
                report.get("text_chars"),
                report.get("extractor_version") or "unknown",
                report.get("parse_status"),
                report.get("error_message"),
            )
        )
    cursor.executemany(
        """
        insert into reports (
          game_id, report_type, report_period, report_scope,
          source_path, source_filename, source_sha256, page_count,
          text_chars, parser_version, parse_status, error_message
        ) values (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        on conflict (source_sha256) do update set
          game_id = excluded.game_id,
          report_type = excluded.report_type,
          report_period = excluded.report_period,
          report_scope = excluded.report_scope,
          parse_status = excluded.parse_status,
          parser_version = excluded.parser_version,
          error_message = excluded.error_message
        """,
        report_rows,
    )
    report_ids = fetch_map(
        cursor, "select source_sha256, report_id from reports"
    )

    final_boxes = {}
    for report in manifest:
        if (
            report.get("report_type") == "box_score"
            and report.get("parse_status") == "parsed"
            and len(report.get("team_stats") or []) == 2
        ):
            key = report["game"]["source_game_key"]
            current = final_boxes.get(key)
            if current is None or int(
                report.get("report_period") or 0
            ) > int(current.get("report_period") or 0):
                final_boxes[key] = report

    team_metric_map = {
        (row["source_game_key"], row["team_code"]): row
        for row in team_metrics
    }
    team_stat_rows = []
    team_metric_rows = []
    for game_key, report in final_boxes.items():
        canonical_stats = [
            {
                **stats,
                "source_team_code": stats["team_code"],
                "team_code": team_code,
            }
            for team_code, stats in zip(
                (
                    report["game"]["home_team_code"],
                    report["game"]["away_team_code"],
                ),
                report["team_stats"],
                strict=True,
            )
        ]
        for stats in canonical_stats:
            metrics = team_metric_map.get(
                (game_key, stats["team_code"]), {}
            )
            team_stat_rows.append(
                (
                    game_ids[game_key],
                    team_ids[stats["team_code"]],
                    report_ids[report["source_sha256"]],
                    stats["team_code"]
                    == report["game"]["home_team_code"],
                    stats.get("minutes_seconds"),
                    *[stats.get(field) for field in STAT_FIELDS],
                    metrics.get("efficiency"),
                    metrics.get("efg_percent"),
                    metrics.get("ts_percent"),
                )
            )
            if metrics:
                team_metric_rows.append(
                    (
                        game_ids[game_key],
                        team_ids[stats["team_code"]],
                        metrics.get("possessions_estimate"),
                        metrics.get("opponent_possessions_estimate"),
                        metrics.get("pace"),
                        metrics.get("offensive_rating"),
                        metrics.get("defensive_rating"),
                        metrics.get("net_rating"),
                        "ibl-derived-metrics-v1",
                    )
                )
    stat_columns = ", ".join(STAT_FIELDS)
    stat_updates = ", ".join(
        f"{field} = excluded.{field}" for field in STAT_FIELDS
    )
    cursor.executemany(
        f"""
        insert into team_game_stats (
          game_id, team_id, report_id, is_home, minutes_seconds,
          {stat_columns}, efficiency, efg_percent, ts_percent
        ) values ({", ".join(["%s"] * (5 + len(STAT_FIELDS) + 3))})
        on conflict (game_id, team_id) do update set
          report_id = excluded.report_id,
          is_home = excluded.is_home,
          minutes_seconds = excluded.minutes_seconds,
          {stat_updates},
          efficiency = excluded.efficiency,
          efg_percent = excluded.efg_percent,
          ts_percent = excluded.ts_percent
        """,
        team_stat_rows,
    )
    cursor.executemany(
        """
        insert into team_game_metrics (
          game_id, team_id, possessions_estimate,
          opponent_possessions_estimate, pace, offensive_rating,
          defensive_rating, net_rating, formula_version
        ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        on conflict (game_id, team_id) do update set
          possessions_estimate = excluded.possessions_estimate,
          opponent_possessions_estimate =
            excluded.opponent_possessions_estimate,
          pace = excluded.pace,
          offensive_rating = excluded.offensive_rating,
          defensive_rating = excluded.defensive_rating,
          net_rating = excluded.net_rating,
          formula_version = excluded.formula_version
        """,
        team_metric_rows,
    )

    player_metric_map = {
        row["player_key"]: row for row in player_metrics
    }
    player_stat_rows = []
    roster_rows = []
    for report in manifest:
        if report.get("report_type") != "player_evaluation":
            continue
        game = report["game"]
        game_key = game["source_game_key"]
        team_codes = player_team_codes(report)
        for stats in report.get("player_stats") or []:
            team_code = team_codes.get(
                normalize_name(stats.get("team_name") or "")
            )
            if not team_code:
                continue
            player_key = (
                f"{game_key}:{team_code}:{stats['jersey_no']}:"
                f"{stats['normalized_name']}"
            )
            metrics = player_metric_map.get(player_key, {})
            player_stat_rows.append(
                (
                    game_ids[game_key],
                    player_ids[stats["normalized_name"]],
                    team_ids[team_code],
                    report_ids[report["source_sha256"]],
                    stats["jersey_no"],
                    stats.get("is_captain", False),
                    stats.get("did_play", True),
                    stats.get("minutes_seconds"),
                    *[stats.get(field) for field in STAT_FIELDS],
                    metrics.get("efficiency"),
                    metrics.get("efg_percent"),
                    metrics.get("ts_percent"),
                )
            )
            roster_rows.append(
                (
                    game_ids[game_key],
                    report_ids[report["source_sha256"]],
                    team_ids[team_code],
                    player_ids[stats["normalized_name"]],
                    stats["jersey_no"],
                    stats.get("is_captain", False),
                )
            )
    cursor.executemany(
        f"""
        insert into player_game_stats (
          game_id, player_id, team_id, report_id, jersey_no,
          is_captain, did_play, minutes_seconds, {stat_columns},
          efficiency, efg_percent, ts_percent
        ) values ({", ".join(["%s"] * (8 + len(STAT_FIELDS) + 3))})
        on conflict (game_id, player_id) do update set
          team_id = excluded.team_id,
          report_id = excluded.report_id,
          jersey_no = excluded.jersey_no,
          is_captain = excluded.is_captain,
          did_play = excluded.did_play,
          minutes_seconds = excluded.minutes_seconds,
          {stat_updates},
          efficiency = excluded.efficiency,
          efg_percent = excluded.efg_percent,
          ts_percent = excluded.ts_percent
        """,
        player_stat_rows,
    )
    cursor.executemany(
        """
        insert into game_rosters (
          game_id, report_id, team_id, player_id, jersey_no, is_captain
        ) values (%s, %s, %s, %s, %s, %s)
        on conflict (game_id, team_id, player_id) do update set
          jersey_no = excluded.jersey_no,
          is_captain = excluded.is_captain
        """,
        roster_rows,
    )

    event_rows = []
    for report in manifest:
        if (
            report.get("report_type") != "play_by_play"
            or report.get("parse_status") != "parsed"
        ):
            continue
        game_key = report["game"]["source_game_key"]
        for event in report.get("play_by_play_events") or []:
            event_rows.append(
                (
                    game_ids[game_key],
                    report_ids[report["source_sha256"]],
                    event["event_index"],
                    event["period_no"],
                    event.get("clock"),
                    event.get("event_type"),
                    event.get("description"),
                    event.get("home_score"),
                    event.get("away_score"),
                    event.get("score_diff"),
                    event.get("raw_line"),
                )
            )
    cursor.executemany(
        """
        insert into play_by_play_events (
          game_id, report_id, event_index, period_no, clock,
          event_type, description, home_score, away_score,
          score_diff, raw_line
        ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        on conflict (game_id, event_index) do update set
          report_id = excluded.report_id,
          period_no = excluded.period_no,
          clock = excluded.clock,
          event_type = excluded.event_type,
          description = excluded.description,
          home_score = excluded.home_score,
          away_score = excluded.away_score,
          score_diff = excluded.score_diff,
          raw_line = excluded.raw_line
        """,
        event_rows,
    )
    cursor.execute(
        """
        select g.source_game_key, e.event_index, e.event_id
        from play_by_play_events e
        join games g on g.game_id = e.game_id
        """
    )
    event_ids = {
        (game_key, event_index): event_id
        for game_key, event_index, event_id in cursor.fetchall()
    }

    advanced_rows = prepare_advanced_rows(
        advanced, game_ids, report_ids, team_ids, player_ids
    )
    advanced_report_ids = sorted(
        {
            report_ids[report["source_sha256"]]
            for report in advanced
        }
    )
    advanced_counts = import_advanced_batches(
        cursor, advanced_rows, advanced_report_ids
    )

    shot_rows = []
    for shot in shots:
        player_id = player_ids.get(shot.get("normalized_name"))
        if not player_id:
            continue
        source_shot_key = (
            f"{shot['player_key']}:{shot['player_shot_index']}"
        )
        event_index = None
        if shot.get("pbp_event_key"):
            try:
                event_index = int(
                    shot["pbp_event_key"].rsplit(":pbp:", 1)[1]
                )
            except (IndexError, ValueError):
                event_index = None
        shot_rows.append(
            (
                source_shot_key,
                game_ids[shot["source_game_key"]],
                report_ids[shot["source_sha256"]],
                event_ids.get(
                    (shot["source_game_key"], event_index)
                ),
                team_ids[shot["team_code"]],
                player_id,
                shot.get("period_no"),
                shot.get("clock"),
                shot.get("points"),
                shot.get("made"),
                shot.get("x_normalized"),
                shot.get("y_normalized"),
                shot.get("area_name"),
                shot.get("action_type"),
                shot.get("confidence"),
                shot.get("detection_status"),
                shot.get("point_classification_method"),
                shot.get("point_classification_confidence"),
                shot.get("pbp_match_status"),
                shot.get("three_point_margin_pixels"),
                shot.get("court_x_meters"),
                shot.get("court_y_meters"),
                shot.get("x"),
                shot.get("y"),
            )
        )
    cursor.executemany(
        """
        insert into shots (
          source_shot_key, game_id, report_id, event_id, team_id, player_id,
          period_no, clock, points, made, x, y, area_name,
          action_type, confidence_score, detection_status,
          point_classification_method, point_classification_confidence,
          pbp_match_status, three_point_margin_pixels,
          court_x_meters, court_y_meters, source_x, source_y
        ) values (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        on conflict (source_shot_key) do update set
          event_id = excluded.event_id,
          period_no = excluded.period_no,
          clock = excluded.clock,
          points = excluded.points,
          made = excluded.made,
          x = excluded.x,
          y = excluded.y,
          area_name = excluded.area_name,
          action_type = excluded.action_type,
          confidence_score = excluded.confidence_score,
          detection_status = excluded.detection_status,
          point_classification_method =
            excluded.point_classification_method,
          point_classification_confidence =
            excluded.point_classification_confidence,
          pbp_match_status = excluded.pbp_match_status,
          three_point_margin_pixels =
            excluded.three_point_margin_pixels,
          court_x_meters = excluded.court_x_meters,
          court_y_meters = excluded.court_y_meters,
          source_x = excluded.source_x,
          source_y = excluded.source_y
        """,
        shot_rows,
    )
    shot_ids = fetch_map(
        cursor, "select source_shot_key, shot_id from shots"
    )
    candidate_rows = []
    for shot in shots:
        source_shot_key = (
            f"{shot['player_key']}:{shot['player_shot_index']}"
        )
        shot_id = shot_ids.get(source_shot_key)
        if not shot_id:
            continue
        for candidate in shot.get("pbp_candidate_event_keys") or []:
            try:
                event_index = int(candidate.rsplit(":pbp:", 1)[1])
            except (IndexError, ValueError):
                continue
            event_id = event_ids.get(
                (shot["source_game_key"], event_index)
            )
            if event_id:
                candidate_rows.append((shot_id, event_id))
    cursor.executemany(
        """
        insert into shot_pbp_candidates (shot_id, event_id)
        values (%s, %s) on conflict do nothing
        """,
        candidate_rows,
    )

    managed_validation_rules = (
        "rotation_totals_mismatch",
        "lineup_totals_mismatch",
        "plus_minus_crosscheck_unavailable",
        "plus_minus_value_mismatch",
        "shot_area_box_score_mismatch",
        "shot_marker_count_mismatch",
        "team_metrics_unavailable",
    )
    validation_report_ids = validation_report_scope(
        advanced_validations, report_ids
    )
    if validation_report_ids:
        cursor.execute(
            """
            delete from validation_issues
            where rule_code = any(%s)
              and report_id = any(%s)
            """,
            (
                list(managed_validation_rules),
                validation_report_ids,
            ),
        )
    validation_rows = []
    metadata_fields = {
        "issue_key",
        "source_path",
        "source_sha256",
        "severity",
        "rule_code",
        "message",
        "status",
    }
    for validation in advanced_validations:
        if validation.get("status") != "needs_review":
            continue
        source_sha256 = validation["source_sha256"]
        issue_key = validation.get("issue_key")
        if not issue_key:
            identity = {
                key: validation.get(key)
                for key in (
                    "source_sha256",
                    "rule_code",
                    "team_code",
                    "player_key",
                    "jersey_no",
                    "display_name",
                )
            }
            issue_key = hashlib.sha256(
                json.dumps(identity, sort_keys=True).encode("utf-8")
            ).hexdigest()
        context = {
            key: value
            for key, value in validation.items()
            if key not in metadata_fields
        }
        validation_rows.append(
            (
                issue_key,
                report_ids[source_sha256],
                validation.get("source_path"),
                validation.get("severity") or "warning",
                validation["rule_code"],
                validation["message"],
                json.dumps(context, ensure_ascii=False),
            )
        )
    cursor.executemany(
        """
        insert into validation_issues (
          issue_key, report_id, source_path, severity,
          rule_code, message, context
        ) values (%s, %s, %s, %s, %s, %s, %s::jsonb)
        on conflict (issue_key) do update set
          report_id = excluded.report_id,
          source_path = excluded.source_path,
          severity = excluded.severity,
          rule_code = excluded.rule_code,
          message = excluded.message,
          context = excluded.context,
          created_at = now()
        """,
        validation_rows,
    )
    connection.commit()
    return {
        "seasons": len(seasons),
        "teams": len(teams),
        "games": len(games),
        "reports": len(report_rows),
        "players": len(players),
        "player_game_stats": len(player_stat_rows),
        "team_game_stats": len(team_stat_rows),
        "team_game_metrics": len(team_metric_rows),
        "play_by_play_events": len(event_rows),
        **advanced_counts,
        "shots": len(shot_rows),
        "shot_pbp_candidates": len(candidate_rows),
        "validation_issues": len(validation_rows),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Idempotently import IBL staging JSON into Neon."
    )
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--shots", type=Path)
    parser.add_argument("--advanced", type=Path)
    parser.add_argument("--advanced-validations", type=Path)
    parser.add_argument("--shot-validations", type=Path)
    parser.add_argument("--player-metrics", type=Path)
    parser.add_argument("--team-metrics", type=Path)
    parser.add_argument("--schema", type=Path)
    parser.add_argument("--database-url-env", default="DATABASE_URL")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    manifest = read_jsonl(args.manifest)
    shots = read_jsonl(args.shots)
    advanced = read_jsonl(args.advanced)
    advanced_validations = read_jsonl(args.advanced_validations)
    shot_validations = read_jsonl(args.shot_validations)
    player_metrics = read_jsonl(args.player_metrics)
    team_metrics = read_jsonl(args.team_metrics)
    validation = validate_inputs(
        manifest,
        shots,
        advanced,
        advanced_validations,
        player_metrics,
        team_metrics,
        shot_validations,
    )
    if validation["status"] != "passed" or args.dry_run:
        print(json.dumps(validation, ensure_ascii=False, indent=2))
        return 0 if validation["status"] == "passed" else 1

    database_url = os.environ.get(args.database_url_env)
    if not database_url:
        raise SystemExit(
            f"Environment variable {args.database_url_env} is not set."
        )
    try:
        import psycopg
    except ImportError as error:
        raise SystemExit(
            "Install requirements.txt before importing to Neon."
        ) from error
    with psycopg.connect(database_url) as connection:
        review_validations = build_review_validations(
            manifest,
            advanced_validations,
            shot_validations,
            team_metrics,
        )
        summary = import_data(
            connection,
            manifest,
            shots,
            advanced,
            review_validations,
            player_metrics,
            team_metrics,
            args.schema,
        )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
