import {
  pgTable,
  smallint,
  bigint,
  text,
  date,
  time,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

// Schema mirrors /schema.sql. Drizzle is used here as the data-access schema
// definition; queries select explicit columns (never `select *`).

export const seasons = pgTable("seasons", {
  seasonYear: smallint("season_year").primaryKey(),
  competitionName: text("competition_name").notNull().default("Indonesian Basketball League"),
});

export const teams = pgTable("teams", {
  teamId: bigint("team_id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name"),
});

export const players = pgTable("players", {
  playerId: bigint("player_id", { mode: "number" }).primaryKey(),
  normalizedName: text("normalized_name").notNull().unique(),
  displayName: text("display_name").notNull(),
});

export const games = pgTable("games", {
  gameId: bigint("game_id", { mode: "number" }).primaryKey(),
  seasonYear: smallint("season_year").notNull(),
  externalGameNo: text("external_game_no"),
  sourceGameKey: text("source_game_key").notNull().unique(),
  weekNo: smallint("week_no"),
  gameDate: date("game_date"),
  startTime: time("start_time"),
  venue: text("venue"),
  durationSeconds: integer("duration_seconds"),
  homeTeamId: bigint("home_team_id", { mode: "number" }).notNull(),
  awayTeamId: bigint("away_team_id", { mode: "number" }).notNull(),
  homeScore: smallint("home_score"),
  awayScore: smallint("away_score"),
});

export const gamePeriods = pgTable(
  "game_periods",
  {
    gameId: bigint("game_id", { mode: "number" }).notNull(),
    periodNo: smallint("period_no").notNull(),
    periodType: text("period_type").notNull(),
    homeScore: smallint("home_score").notNull(),
    awayScore: smallint("away_score").notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.periodNo] })]
);

export const extractionRuns = pgTable("extraction_runs", {
  runId: bigint("run_id", { mode: "number" }).primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  sourceRoots: jsonb("source_roots").notNull(),
  extractorVersion: text("extractor_version").notNull(),
  filesSeen: integer("files_seen").notNull().default(0),
  filesSucceeded: integer("files_succeeded").notNull().default(0),
  filesFailed: integer("files_failed").notNull().default(0),
});

export const reports = pgTable("reports", {
  reportId: bigint("report_id", { mode: "number" }).primaryKey(),
  runId: bigint("run_id", { mode: "number" }),
  gameId: bigint("game_id", { mode: "number" }),
  reportType: text("report_type").notNull(),
  reportPeriod: smallint("report_period"),
  reportScope: text("report_scope"),
  sourcePath: text("source_path").notNull(),
  sourceFilename: text("source_filename").notNull(),
  sourceSha256: text("source_sha256").notNull().unique(),
  pageCount: integer("page_count"),
  textChars: integer("text_chars"),
  parserVersion: text("parser_version").notNull(),
  parseStatus: text("parse_status").notNull(),
  rawPayload: jsonb("raw_payload"),
  errorMessage: text("error_message"),
  extractedAt: timestamp("extracted_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const teamGameStats = pgTable(
  "team_game_stats",
  {
    gameId: bigint("game_id", { mode: "number" }).notNull(),
    teamId: bigint("team_id", { mode: "number" }).notNull(),
    reportId: bigint("report_id", { mode: "number" }).notNull(),
    isHome: boolean("is_home").notNull(),
    minutesSeconds: integer("minutes_seconds"),
    fgMade: smallint("fg_made"),
    fgAttempted: smallint("fg_attempted"),
    twoPtMade: smallint("two_pt_made"),
    twoPtAttempted: smallint("two_pt_attempted"),
    threePtMade: smallint("three_pt_made"),
    threePtAttempted: smallint("three_pt_attempted"),
    ftMade: smallint("ft_made"),
    ftAttempted: smallint("ft_attempted"),
    offensiveRebounds: smallint("offensive_rebounds"),
    defensiveRebounds: smallint("defensive_rebounds"),
    totalRebounds: smallint("total_rebounds"),
    assists: smallint("assists"),
    turnovers: smallint("turnovers"),
    steals: smallint("steals"),
    blocks: smallint("blocks"),
    personalFouls: smallint("personal_fouls"),
    foulsDrawn: smallint("fouls_drawn"),
    plusMinus: smallint("plus_minus"),
    efficiency: smallint("efficiency"),
    efgPercent: numeric("efg_percent"),
    tsPercent: numeric("ts_percent"),
    points: smallint("points"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.teamId] })]
);

export const playerGameStats = pgTable(
  "player_game_stats",
  {
    gameId: bigint("game_id", { mode: "number" }).notNull(),
    playerId: bigint("player_id", { mode: "number" }).notNull(),
    teamId: bigint("team_id", { mode: "number" }).notNull(),
    reportId: bigint("report_id", { mode: "number" }).notNull(),
    jerseyNo: text("jersey_no"),
    isStarter: boolean("is_starter"),
    isCaptain: boolean("is_captain").notNull().default(false),
    didPlay: boolean("did_play").notNull().default(true),
    minutesSeconds: integer("minutes_seconds"),
    fgMade: smallint("fg_made"),
    fgAttempted: smallint("fg_attempted"),
    twoPtMade: smallint("two_pt_made"),
    twoPtAttempted: smallint("two_pt_attempted"),
    threePtMade: smallint("three_pt_made"),
    threePtAttempted: smallint("three_pt_attempted"),
    ftMade: smallint("ft_made"),
    ftAttempted: smallint("ft_attempted"),
    offensiveRebounds: smallint("offensive_rebounds"),
    defensiveRebounds: smallint("defensive_rebounds"),
    totalRebounds: smallint("total_rebounds"),
    assists: smallint("assists"),
    turnovers: smallint("turnovers"),
    steals: smallint("steals"),
    blocks: smallint("blocks"),
    personalFouls: smallint("personal_fouls"),
    foulsDrawn: smallint("fouls_drawn"),
    plusMinus: smallint("plus_minus"),
    efficiency: smallint("efficiency"),
    efgPercent: numeric("efg_percent"),
    tsPercent: numeric("ts_percent"),
    points: smallint("points"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.playerId] })]
);

export const teamGameMetrics = pgTable(
  "team_game_metrics",
  {
    gameId: bigint("game_id", { mode: "number" }).notNull(),
    teamId: bigint("team_id", { mode: "number" }).notNull(),
    possessionsEstimate: numeric("possessions_estimate"),
    opponentPossessionsEstimate: numeric("opponent_possessions_estimate"),
    pace: numeric("pace"),
    offensiveRating: numeric("offensive_rating"),
    defensiveRating: numeric("defensive_rating"),
    netRating: numeric("net_rating"),
    formulaVersion: text("formula_version").notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.teamId] })]
);

export const gameRosters = pgTable(
  "game_rosters",
  {
    gameId: bigint("game_id", { mode: "number" }).notNull(),
    reportId: bigint("report_id", { mode: "number" }).notNull(),
    teamId: bigint("team_id", { mode: "number" }).notNull(),
    playerId: bigint("player_id", { mode: "number" }).notNull(),
    jerseyNo: text("jersey_no"),
    isCaptain: boolean("is_captain").notNull().default(false),
    isStarter: boolean("is_starter"),
    position: text("position"),
    heightCm: smallint("height_cm"),
    age: smallint("age"),
    gamesPlayed: smallint("games_played"),
    pointsPerGame: numeric("points_per_game"),
    plusMinusPerGame: numeric("plus_minus_per_game"),
    fgPercent: numeric("fg_percent"),
    threePtPercent: numeric("three_pt_percent"),
    ftPercent: numeric("ft_percent"),
    reboundsPerGame: numeric("rebounds_per_game"),
    assistsPerGame: numeric("assists_per_game"),
    minutesPerGame: numeric("minutes_per_game"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.teamId, t.playerId] })]
);

export const playByPlayEvents = pgTable("play_by_play_events", {
  eventId: bigint("event_id", { mode: "number" }).primaryKey(),
  gameId: bigint("game_id", { mode: "number" }).notNull(),
  reportId: bigint("report_id", { mode: "number" }).notNull(),
  eventIndex: integer("event_index").notNull(),
  periodNo: smallint("period_no").notNull(),
  clock: text("clock"),
  teamId: bigint("team_id", { mode: "number" }),
  jerseyNo: text("jersey_no"),
  playerNameRaw: text("player_name_raw"),
  eventType: text("event_type"),
  description: text("description").notNull(),
  homeScore: smallint("home_score"),
  awayScore: smallint("away_score"),
  scoreDiff: smallint("score_diff"),
  rawLine: text("raw_line"),
});

export const shots = pgTable("shots", {
  shotId: bigint("shot_id", { mode: "number" }).primaryKey(),
  sourceShotKey: text("source_shot_key").notNull().unique(),
  gameId: bigint("game_id", { mode: "number" }).notNull(),
  reportId: bigint("report_id", { mode: "number" }).notNull(),
  eventId: bigint("event_id", { mode: "number" }),
  teamId: bigint("team_id", { mode: "number" }).notNull(),
  playerId: bigint("player_id", { mode: "number" }),
  periodNo: smallint("period_no"),
  clock: text("clock"),
  points: smallint("points"),
  made: boolean("made"),
  x: numeric("x"),
  y: numeric("y"),
  areaName: text("area_name"),
  actionType: text("action_type"),
  confidenceScore: numeric("confidence_score"),
  detectionStatus: text("detection_status"),
  pointClassificationMethod: text("point_classification_method"),
  pointClassificationConfidence: text("point_classification_confidence"),
  pbpMatchStatus: text("pbp_match_status"),
  threePointMarginPixels: numeric("three_point_margin_pixels"),
  courtXMeters: numeric("court_x_meters"),
  courtYMeters: numeric("court_y_meters"),
  sourceX: numeric("source_x"),
  sourceY: numeric("source_y"),
});

export const shotPbpCandidates = pgTable(
  "shot_pbp_candidates",
  {
    shotId: bigint("shot_id", { mode: "number" }).notNull(),
    eventId: bigint("event_id", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.shotId, t.eventId] })]
);

export const lineupStints = pgTable("lineup_stints", {
  stintId: bigint("stint_id", { mode: "number" }).primaryKey(),
  gameId: bigint("game_id", { mode: "number" }).notNull(),
  reportId: bigint("report_id", { mode: "number" }).notNull(),
  teamId: bigint("team_id", { mode: "number" }).notNull(),
  stintIndex: smallint("stint_index").notNull(),
  startPeriod: smallint("start_period"),
  startClock: text("start_clock"),
  endPeriod: smallint("end_period"),
  endClock: text("end_clock"),
  durationSeconds: integer("duration_seconds"),
  pointsFor: smallint("points_for"),
  pointsAgainst: smallint("points_against"),
  plusMinus: smallint("plus_minus"),
  rebounds: smallint("rebounds"),
  steals: smallint("steals"),
  turnovers: smallint("turnovers"),
  assists: smallint("assists"),
  isStartingLineup: boolean("is_starting_lineup").notNull().default(false),
});

export const lineupStintPlayers = pgTable(
  "lineup_stint_players",
  {
    stintId: bigint("stint_id", { mode: "number" }).notNull(),
    playerId: bigint("player_id", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.stintId, t.playerId] })]
);

export const lineupSummaries = pgTable("lineup_summaries", {
  lineupSummaryId: bigint("lineup_summary_id", { mode: "number" }).primaryKey(),
  gameId: bigint("game_id", { mode: "number" }).notNull(),
  reportId: bigint("report_id", { mode: "number" }).notNull(),
  teamId: bigint("team_id", { mode: "number" }).notNull(),
  lineupIndex: smallint("lineup_index").notNull(),
  durationSeconds: integer("duration_seconds"),
  pointsFor: smallint("points_for"),
  pointsAgainst: smallint("points_against"),
  plusMinus: smallint("plus_minus"),
  pointsPerMinute: numeric("points_per_minute"),
  rebounds: smallint("rebounds"),
  steals: smallint("steals"),
  turnovers: smallint("turnovers"),
  assists: smallint("assists"),
});

export const lineupSummaryPlayers = pgTable(
  "lineup_summary_players",
  {
    lineupSummaryId: bigint("lineup_summary_id", { mode: "number" }).notNull(),
    playerId: bigint("player_id", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.lineupSummaryId, t.playerId] })]
);

export const rotationSegments = pgTable("rotation_segments", {
  segmentId: bigint("segment_id", { mode: "number" }).primaryKey(),
  gameId: bigint("game_id", { mode: "number" }).notNull(),
  reportId: bigint("report_id", { mode: "number" }).notNull(),
  teamId: bigint("team_id", { mode: "number" }).notNull(),
  playerId: bigint("player_id", { mode: "number" }).notNull(),
  periodNo: smallint("period_no"),
  startClock: text("start_clock"),
  endClock: text("end_clock"),
  durationSeconds: integer("duration_seconds"),
});

export const playerPlusMinusDetails = pgTable(
  "player_plus_minus_details",
  {
    gameId: bigint("game_id", { mode: "number" }).notNull(),
    reportId: bigint("report_id", { mode: "number" }).notNull(),
    teamId: bigint("team_id", { mode: "number" }).notNull(),
    playerId: bigint("player_id", { mode: "number" }).notNull(),
    minutesOnSeconds: integer("minutes_on_seconds"),
    minutesOffSeconds: integer("minutes_off_seconds"),
    scoreOnFor: smallint("score_on_for"),
    scoreOnAgainst: smallint("score_on_against"),
    scoreOffFor: smallint("score_off_for"),
    scoreOffAgainst: smallint("score_off_against"),
    plusMinusOn: smallint("plus_minus_on"),
    plusMinusOff: smallint("plus_minus_off"),
    pointsPerMinuteOn: numeric("points_per_minute_on"),
    pointsPerMinuteOff: numeric("points_per_minute_off"),
    assistsOn: smallint("assists_on"),
    assistsOff: smallint("assists_off"),
    reboundsOn: smallint("rebounds_on"),
    reboundsOff: smallint("rebounds_off"),
    stealsOn: smallint("steals_on"),
    stealsOff: smallint("steals_off"),
    turnoversOn: smallint("turnovers_on"),
    turnoversOff: smallint("turnovers_off"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.playerId] })]
);

export const shotAreaReportTotals = pgTable(
  "shot_area_report_totals",
  {
    reportId: bigint("report_id", { mode: "number" }).notNull(),
    gameId: bigint("game_id", { mode: "number" }).notNull(),
    teamId: bigint("team_id", { mode: "number" }).notNull(),
    reportScope: text("report_scope"),
    reportPeriod: smallint("report_period"),
    fgMade: smallint("fg_made"),
    fgAttempted: smallint("fg_attempted"),
    twoPtMade: smallint("two_pt_made"),
    twoPtAttempted: smallint("two_pt_attempted"),
    threePtMade: smallint("three_pt_made"),
    threePtAttempted: smallint("three_pt_attempted"),
    ftMade: smallint("ft_made"),
    ftAttempted: smallint("ft_attempted"),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.teamId] })]
);

export const validationIssues = pgTable("validation_issues", {
  issueId: bigint("issue_id", { mode: "number" }).primaryKey(),
  issueKey: text("issue_key"),
  runId: bigint("run_id", { mode: "number" }),
  reportId: bigint("report_id", { mode: "number" }),
  sourcePath: text("source_path"),
  severity: text("severity").notNull(),
  ruleCode: text("rule_code").notNull(),
  message: text("message").notNull(),
  context: jsonb("context"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export type Season = typeof seasons.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Game = typeof games.$inferSelect;
