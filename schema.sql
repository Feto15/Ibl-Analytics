create table if not exists seasons (
  season_year smallint primary key,
  competition_name text not null default 'Indonesian Basketball League'
);

create table if not exists teams (
  team_id bigint generated always as identity primary key,
  code text not null unique,
  name text
);

create table if not exists players (
  player_id bigint generated always as identity primary key,
  normalized_name text not null unique,
  display_name text not null
);

create table if not exists games (
  game_id bigint generated always as identity primary key,
  season_year smallint not null references seasons(season_year),
  external_game_no text,
  source_game_key text not null unique,
  week_no smallint,
  game_date date,
  start_time time,
  venue text,
  duration_seconds integer,
  home_team_id bigint not null references teams(team_id),
  away_team_id bigint not null references teams(team_id),
  home_score smallint,
  away_score smallint,
  check (home_team_id <> away_team_id),
  unique (season_year, external_game_no)
);

create index if not exists games_date_idx on games(game_date);

create table if not exists game_periods (
  game_id bigint not null references games(game_id) on delete cascade,
  period_no smallint not null,
  period_type text not null check (period_type in ('quarter', 'overtime')),
  home_score smallint not null,
  away_score smallint not null,
  primary key (game_id, period_no)
);

create table if not exists extraction_runs (
  run_id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source_roots jsonb not null,
  extractor_version text not null,
  files_seen integer not null default 0,
  files_succeeded integer not null default 0,
  files_failed integer not null default 0
);

create table if not exists reports (
  report_id bigint generated always as identity primary key,
  run_id bigint references extraction_runs(run_id),
  game_id bigint references games(game_id) on delete cascade,
  report_type text not null,
  report_period smallint,
  report_scope text,
  source_path text not null,
  source_filename text not null,
  source_sha256 char(64) not null unique,
  page_count integer,
  text_chars integer,
  parser_version text not null,
  parse_status text not null
    check (parse_status in ('parsed', 'partial', 'raw_only', 'failed', 'duplicate')),
  raw_payload jsonb,
  error_message text,
  extracted_at timestamptz not null default now()
);

alter table reports
  drop constraint if exists reports_parse_status_check;

alter table reports
  add constraint reports_parse_status_check
  check (
    parse_status in ('parsed', 'partial', 'raw_only', 'failed', 'duplicate')
  );

create index if not exists reports_game_type_idx
  on reports(game_id, report_type);

create table if not exists team_game_stats (
  game_id bigint not null references games(game_id) on delete cascade,
  team_id bigint not null references teams(team_id),
  report_id bigint not null references reports(report_id),
  is_home boolean not null,
  minutes_seconds integer,
  fg_made smallint, fg_attempted smallint,
  two_pt_made smallint, two_pt_attempted smallint,
  three_pt_made smallint, three_pt_attempted smallint,
  ft_made smallint, ft_attempted smallint,
  offensive_rebounds smallint, defensive_rebounds smallint,
  total_rebounds smallint, assists smallint, turnovers smallint,
  steals smallint, blocks smallint, personal_fouls smallint,
  fouls_drawn smallint, plus_minus smallint, efficiency smallint,
  efg_percent numeric(9,4),
  ts_percent numeric(9,4),
  points smallint,
  primary key (game_id, team_id)
);

create table if not exists player_game_stats (
  game_id bigint not null references games(game_id) on delete cascade,
  player_id bigint not null references players(player_id),
  team_id bigint not null references teams(team_id),
  report_id bigint not null references reports(report_id),
  jersey_no text,
  is_starter boolean,
  is_captain boolean not null default false,
  did_play boolean not null default true,
  minutes_seconds integer,
  fg_made smallint, fg_attempted smallint,
  two_pt_made smallint, two_pt_attempted smallint,
  three_pt_made smallint, three_pt_attempted smallint,
  ft_made smallint, ft_attempted smallint,
  offensive_rebounds smallint, defensive_rebounds smallint,
  total_rebounds smallint, assists smallint, turnovers smallint,
  steals smallint, blocks smallint, personal_fouls smallint,
  fouls_drawn smallint, plus_minus smallint, efficiency smallint,
  efg_percent numeric(9,4),
  ts_percent numeric(9,4),
  points smallint,
  primary key (game_id, player_id)
);

create table if not exists team_game_metrics (
  game_id bigint not null references games(game_id) on delete cascade,
  team_id bigint not null references teams(team_id),
  possessions_estimate numeric(10,4),
  opponent_possessions_estimate numeric(10,4),
  pace numeric(10,4),
  offensive_rating numeric(10,4),
  defensive_rating numeric(10,4),
  net_rating numeric(10,4),
  formula_version text not null,
  primary key (game_id, team_id)
);

create table if not exists game_rosters (
  game_id bigint not null references games(game_id) on delete cascade,
  report_id bigint not null references reports(report_id),
  team_id bigint not null references teams(team_id),
  player_id bigint not null references players(player_id),
  jersey_no text,
  is_captain boolean not null default false,
  is_starter boolean,
  position text,
  height_cm smallint,
  age smallint,
  games_played smallint,
  points_per_game numeric(8,3),
  plus_minus_per_game numeric(8,3),
  fg_percent numeric(8,3),
  three_pt_percent numeric(8,3),
  ft_percent numeric(8,3),
  rebounds_per_game numeric(8,3),
  assists_per_game numeric(8,3),
  minutes_per_game numeric(8,3),
  primary key (game_id, team_id, player_id)
);

create table if not exists play_by_play_events (
  event_id bigint generated always as identity primary key,
  game_id bigint not null references games(game_id) on delete cascade,
  report_id bigint not null references reports(report_id),
  event_index integer not null,
  period_no smallint not null,
  clock text,
  team_id bigint references teams(team_id),
  jersey_no text,
  player_name_raw text,
  event_type text,
  description text not null,
  home_score smallint,
  away_score smallint,
  score_diff smallint,
  raw_line text,
  unique (game_id, event_index)
);

create table if not exists shots (
  shot_id bigint generated always as identity primary key,
  source_shot_key text not null unique,
  game_id bigint not null references games(game_id) on delete cascade,
  report_id bigint not null references reports(report_id),
  event_id bigint references play_by_play_events(event_id),
  team_id bigint not null references teams(team_id),
  player_id bigint references players(player_id),
  period_no smallint,
  clock text,
  points smallint check (points in (1, 2, 3)),
  made boolean,
  x numeric(8,4),
  y numeric(8,4),
  area_name text,
  action_type text,
  confidence_score numeric(5,4),
  detection_status text,
  point_classification_method text
    check (point_classification_method in ('geometry', 'stats_adjusted')),
  point_classification_confidence text
    check (point_classification_confidence in ('high', 'medium', 'low')),
  pbp_match_status text
    check (pbp_match_status in (
      'unique', 'area_constrained', 'ambiguous', 'no_event'
    )),
  three_point_margin_pixels numeric(10,4),
  court_x_meters numeric(10,4),
  court_y_meters numeric(10,4),
  source_x numeric(10,4),
  source_y numeric(10,4)
);

create table if not exists shot_pbp_candidates (
  shot_id bigint not null references shots(shot_id) on delete cascade,
  event_id bigint not null
    references play_by_play_events(event_id) on delete cascade,
  primary key (shot_id, event_id)
);

create table if not exists lineup_stints (
  stint_id bigint generated always as identity primary key,
  game_id bigint not null references games(game_id) on delete cascade,
  report_id bigint not null references reports(report_id),
  team_id bigint not null references teams(team_id),
  stint_index smallint not null,
  start_period smallint,
  start_clock text,
  end_period smallint,
  end_clock text,
  duration_seconds integer,
  points_for smallint,
  points_against smallint,
  plus_minus smallint,
  rebounds smallint,
  steals smallint,
  turnovers smallint,
  assists smallint,
  is_starting_lineup boolean not null default false,
  unique (report_id, team_id, stint_index)
);

create table if not exists lineup_stint_players (
  stint_id bigint not null references lineup_stints(stint_id) on delete cascade,
  player_id bigint not null references players(player_id),
  primary key (stint_id, player_id)
);

create table if not exists lineup_summaries (
  lineup_summary_id bigint generated always as identity primary key,
  game_id bigint not null references games(game_id) on delete cascade,
  report_id bigint not null references reports(report_id),
  team_id bigint not null references teams(team_id),
  lineup_index smallint not null,
  duration_seconds integer,
  points_for smallint,
  points_against smallint,
  plus_minus smallint,
  points_per_minute numeric(10,4),
  rebounds smallint,
  steals smallint,
  turnovers smallint,
  assists smallint,
  unique (report_id, team_id, lineup_index)
);

create table if not exists lineup_summary_players (
  lineup_summary_id bigint not null
    references lineup_summaries(lineup_summary_id) on delete cascade,
  player_id bigint not null references players(player_id),
  primary key (lineup_summary_id, player_id)
);

create table if not exists rotation_segments (
  segment_id bigint generated always as identity primary key,
  game_id bigint not null references games(game_id) on delete cascade,
  report_id bigint not null references reports(report_id),
  team_id bigint not null references teams(team_id),
  player_id bigint not null references players(player_id),
  period_no smallint,
  start_clock text,
  end_clock text,
  duration_seconds integer
);

create table if not exists player_plus_minus_details (
  game_id bigint not null references games(game_id) on delete cascade,
  report_id bigint not null references reports(report_id),
  team_id bigint not null references teams(team_id),
  player_id bigint not null references players(player_id),
  minutes_on_seconds integer,
  minutes_off_seconds integer,
  score_on_for smallint,
  score_on_against smallint,
  score_off_for smallint,
  score_off_against smallint,
  plus_minus_on smallint,
  plus_minus_off smallint,
  points_per_minute_on numeric(10,4),
  points_per_minute_off numeric(10,4),
  assists_on smallint,
  assists_off smallint,
  rebounds_on smallint,
  rebounds_off smallint,
  steals_on smallint,
  steals_off smallint,
  turnovers_on smallint,
  turnovers_off smallint,
  primary key (game_id, player_id)
);

create table if not exists shot_area_report_totals (
  report_id bigint not null references reports(report_id) on delete cascade,
  game_id bigint not null references games(game_id) on delete cascade,
  team_id bigint not null references teams(team_id),
  report_scope text,
  report_period smallint,
  fg_made smallint,
  fg_attempted smallint,
  two_pt_made smallint,
  two_pt_attempted smallint,
  three_pt_made smallint,
  three_pt_attempted smallint,
  ft_made smallint,
  ft_attempted smallint,
  primary key (report_id, team_id)
);

-- Keep databases created by earlier schema versions compatible.
alter table team_game_stats
  add column if not exists efficiency smallint,
  add column if not exists efg_percent numeric(9,4),
  add column if not exists ts_percent numeric(9,4);

alter table player_game_stats
  add column if not exists is_captain boolean not null default false,
  add column if not exists did_play boolean not null default true,
  add column if not exists efficiency smallint,
  add column if not exists efg_percent numeric(9,4),
  add column if not exists ts_percent numeric(9,4);

alter table game_rosters
  add column if not exists is_starter boolean,
  add column if not exists position text,
  add column if not exists height_cm smallint,
  add column if not exists age smallint,
  add column if not exists games_played smallint,
  add column if not exists points_per_game numeric(8,3),
  add column if not exists plus_minus_per_game numeric(8,3),
  add column if not exists fg_percent numeric(8,3),
  add column if not exists three_pt_percent numeric(8,3),
  add column if not exists ft_percent numeric(8,3),
  add column if not exists rebounds_per_game numeric(8,3),
  add column if not exists assists_per_game numeric(8,3),
  add column if not exists minutes_per_game numeric(8,3);

alter table shots
  add column if not exists source_shot_key text,
  add column if not exists confidence_score numeric(5,4),
  add column if not exists detection_status text,
  add column if not exists point_classification_method text,
  add column if not exists point_classification_confidence text,
  add column if not exists pbp_match_status text,
  add column if not exists three_point_margin_pixels numeric(10,4),
  add column if not exists court_x_meters numeric(10,4),
  add column if not exists court_y_meters numeric(10,4),
  add column if not exists source_x numeric(10,4),
  add column if not exists source_y numeric(10,4);

create unique index if not exists shots_source_shot_key_uidx
  on shots (source_shot_key);

alter table lineup_stints
  add column if not exists stint_index smallint,
  add column if not exists start_period smallint,
  add column if not exists end_period smallint,
  add column if not exists rebounds smallint,
  add column if not exists steals smallint,
  add column if not exists turnovers smallint,
  add column if not exists assists smallint,
  add column if not exists is_starting_lineup boolean
    not null default false;

create unique index if not exists lineup_stints_report_team_index_uidx
  on lineup_stints (report_id, team_id, stint_index);

create table if not exists validation_issues (
  issue_id bigint generated always as identity primary key,
  issue_key text,
  run_id bigint references extraction_runs(run_id),
  report_id bigint references reports(report_id),
  source_path text,
  severity text not null check (severity in ('info', 'warning', 'error')),
  rule_code text not null,
  message text not null,
  context jsonb,
  created_at timestamptz not null default now()
);

alter table validation_issues
  add column if not exists issue_key text;

create unique index if not exists validation_issues_issue_key_uidx
  on validation_issues (issue_key);
