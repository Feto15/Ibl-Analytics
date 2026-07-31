CREATE TABLE "extraction_runs" (
	"run_id" bigint PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"source_roots" jsonb NOT NULL,
	"extractor_version" text NOT NULL,
	"files_seen" integer DEFAULT 0 NOT NULL,
	"files_succeeded" integer DEFAULT 0 NOT NULL,
	"files_failed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_periods" (
	"game_id" bigint NOT NULL,
	"period_no" smallint NOT NULL,
	"period_type" text NOT NULL,
	"home_score" smallint NOT NULL,
	"away_score" smallint NOT NULL,
	CONSTRAINT "game_periods_game_id_period_no_pk" PRIMARY KEY("game_id","period_no")
);
--> statement-breakpoint
CREATE TABLE "game_rosters" (
	"game_id" bigint NOT NULL,
	"report_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"jersey_no" text,
	"is_captain" boolean DEFAULT false NOT NULL,
	"is_starter" boolean,
	"position" text,
	"height_cm" smallint,
	"age" smallint,
	"games_played" smallint,
	"points_per_game" numeric,
	"plus_minus_per_game" numeric,
	"fg_percent" numeric,
	"three_pt_percent" numeric,
	"ft_percent" numeric,
	"rebounds_per_game" numeric,
	"assists_per_game" numeric,
	"minutes_per_game" numeric,
	CONSTRAINT "game_rosters_game_id_team_id_player_id_pk" PRIMARY KEY("game_id","team_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"game_id" bigint PRIMARY KEY NOT NULL,
	"season_year" smallint NOT NULL,
	"external_game_no" text,
	"source_game_key" text NOT NULL,
	"week_no" smallint,
	"game_date" date,
	"start_time" time,
	"venue" text,
	"duration_seconds" integer,
	"home_team_id" bigint NOT NULL,
	"away_team_id" bigint NOT NULL,
	"home_score" smallint,
	"away_score" smallint,
	CONSTRAINT "games_source_game_key_unique" UNIQUE("source_game_key")
);
--> statement-breakpoint
CREATE TABLE "lineup_stint_players" (
	"stint_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	CONSTRAINT "lineup_stint_players_stint_id_player_id_pk" PRIMARY KEY("stint_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "lineup_stints" (
	"stint_id" bigint PRIMARY KEY NOT NULL,
	"game_id" bigint NOT NULL,
	"report_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"stint_index" smallint NOT NULL,
	"start_period" smallint,
	"start_clock" text,
	"end_period" smallint,
	"end_clock" text,
	"duration_seconds" integer,
	"points_for" smallint,
	"points_against" smallint,
	"plus_minus" smallint,
	"rebounds" smallint,
	"steals" smallint,
	"turnovers" smallint,
	"assists" smallint,
	"is_starting_lineup" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineup_summaries" (
	"lineup_summary_id" bigint PRIMARY KEY NOT NULL,
	"game_id" bigint NOT NULL,
	"report_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"lineup_index" smallint NOT NULL,
	"duration_seconds" integer,
	"points_for" smallint,
	"points_against" smallint,
	"plus_minus" smallint,
	"points_per_minute" numeric,
	"rebounds" smallint,
	"steals" smallint,
	"turnovers" smallint,
	"assists" smallint
);
--> statement-breakpoint
CREATE TABLE "lineup_summary_players" (
	"lineup_summary_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	CONSTRAINT "lineup_summary_players_lineup_summary_id_player_id_pk" PRIMARY KEY("lineup_summary_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "play_by_play_events" (
	"event_id" bigint PRIMARY KEY NOT NULL,
	"game_id" bigint NOT NULL,
	"report_id" bigint NOT NULL,
	"event_index" integer NOT NULL,
	"period_no" smallint NOT NULL,
	"clock" text,
	"team_id" bigint,
	"jersey_no" text,
	"player_name_raw" text,
	"event_type" text,
	"description" text NOT NULL,
	"home_score" smallint,
	"away_score" smallint,
	"score_diff" smallint,
	"raw_line" text
);
--> statement-breakpoint
CREATE TABLE "player_game_stats" (
	"game_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"report_id" bigint NOT NULL,
	"jersey_no" text,
	"is_starter" boolean,
	"is_captain" boolean DEFAULT false NOT NULL,
	"did_play" boolean DEFAULT true NOT NULL,
	"minutes_seconds" integer,
	"fg_made" smallint,
	"fg_attempted" smallint,
	"two_pt_made" smallint,
	"two_pt_attempted" smallint,
	"three_pt_made" smallint,
	"three_pt_attempted" smallint,
	"ft_made" smallint,
	"ft_attempted" smallint,
	"offensive_rebounds" smallint,
	"defensive_rebounds" smallint,
	"total_rebounds" smallint,
	"assists" smallint,
	"turnovers" smallint,
	"steals" smallint,
	"blocks" smallint,
	"personal_fouls" smallint,
	"fouls_drawn" smallint,
	"plus_minus" smallint,
	"efficiency" smallint,
	"efg_percent" numeric,
	"ts_percent" numeric,
	"points" smallint,
	CONSTRAINT "player_game_stats_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "player_plus_minus_details" (
	"game_id" bigint NOT NULL,
	"report_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"minutes_on_seconds" integer,
	"minutes_off_seconds" integer,
	"score_on_for" smallint,
	"score_on_against" smallint,
	"score_off_for" smallint,
	"score_off_against" smallint,
	"plus_minus_on" smallint,
	"plus_minus_off" smallint,
	"points_per_minute_on" numeric,
	"points_per_minute_off" numeric,
	"assists_on" smallint,
	"assists_off" smallint,
	"rebounds_on" smallint,
	"rebounds_off" smallint,
	"steals_on" smallint,
	"steals_off" smallint,
	"turnovers_on" smallint,
	"turnovers_off" smallint,
	CONSTRAINT "player_plus_minus_details_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"player_id" bigint PRIMARY KEY NOT NULL,
	"normalized_name" text NOT NULL,
	"display_name" text NOT NULL,
	CONSTRAINT "players_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"report_id" bigint PRIMARY KEY NOT NULL,
	"run_id" bigint,
	"game_id" bigint,
	"report_type" text NOT NULL,
	"report_period" smallint,
	"report_scope" text,
	"source_path" text NOT NULL,
	"source_filename" text NOT NULL,
	"source_sha256" text NOT NULL,
	"page_count" integer,
	"text_chars" integer,
	"parser_version" text NOT NULL,
	"parse_status" text NOT NULL,
	"raw_payload" jsonb,
	"error_message" text,
	"extracted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reports_source_sha256_unique" UNIQUE("source_sha256")
);
--> statement-breakpoint
CREATE TABLE "rotation_segments" (
	"segment_id" bigint PRIMARY KEY NOT NULL,
	"game_id" bigint NOT NULL,
	"report_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"period_no" smallint,
	"start_clock" text,
	"end_clock" text,
	"duration_seconds" integer
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"season_year" smallint PRIMARY KEY NOT NULL,
	"competition_name" text DEFAULT 'Indonesian Basketball League' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shot_area_report_totals" (
	"report_id" bigint NOT NULL,
	"game_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"report_scope" text,
	"report_period" smallint,
	"fg_made" smallint,
	"fg_attempted" smallint,
	"two_pt_made" smallint,
	"two_pt_attempted" smallint,
	"three_pt_made" smallint,
	"three_pt_attempted" smallint,
	"ft_made" smallint,
	"ft_attempted" smallint,
	CONSTRAINT "shot_area_report_totals_report_id_team_id_pk" PRIMARY KEY("report_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "shot_pbp_candidates" (
	"shot_id" bigint NOT NULL,
	"event_id" bigint NOT NULL,
	CONSTRAINT "shot_pbp_candidates_shot_id_event_id_pk" PRIMARY KEY("shot_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "shots" (
	"shot_id" bigint PRIMARY KEY NOT NULL,
	"source_shot_key" text NOT NULL,
	"game_id" bigint NOT NULL,
	"report_id" bigint NOT NULL,
	"event_id" bigint,
	"team_id" bigint NOT NULL,
	"player_id" bigint,
	"period_no" smallint,
	"clock" text,
	"points" smallint,
	"made" boolean,
	"x" numeric,
	"y" numeric,
	"area_name" text,
	"action_type" text,
	"confidence_score" numeric,
	"detection_status" text,
	"point_classification_method" text,
	"point_classification_confidence" text,
	"pbp_match_status" text,
	"three_point_margin_pixels" numeric,
	"court_x_meters" numeric,
	"court_y_meters" numeric,
	"source_x" numeric,
	"source_y" numeric,
	CONSTRAINT "shots_source_shot_key_unique" UNIQUE("source_shot_key")
);
--> statement-breakpoint
CREATE TABLE "team_game_metrics" (
	"game_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"possessions_estimate" numeric,
	"opponent_possessions_estimate" numeric,
	"pace" numeric,
	"offensive_rating" numeric,
	"defensive_rating" numeric,
	"net_rating" numeric,
	"formula_version" text NOT NULL,
	CONSTRAINT "team_game_metrics_game_id_team_id_pk" PRIMARY KEY("game_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "team_game_stats" (
	"game_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"report_id" bigint NOT NULL,
	"is_home" boolean NOT NULL,
	"minutes_seconds" integer,
	"fg_made" smallint,
	"fg_attempted" smallint,
	"two_pt_made" smallint,
	"two_pt_attempted" smallint,
	"three_pt_made" smallint,
	"three_pt_attempted" smallint,
	"ft_made" smallint,
	"ft_attempted" smallint,
	"offensive_rebounds" smallint,
	"defensive_rebounds" smallint,
	"total_rebounds" smallint,
	"assists" smallint,
	"turnovers" smallint,
	"steals" smallint,
	"blocks" smallint,
	"personal_fouls" smallint,
	"fouls_drawn" smallint,
	"plus_minus" smallint,
	"efficiency" smallint,
	"efg_percent" numeric,
	"ts_percent" numeric,
	"points" smallint,
	CONSTRAINT "team_game_stats_game_id_team_id_pk" PRIMARY KEY("game_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"team_id" bigint PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text,
	CONSTRAINT "teams_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "validation_issues" (
	"issue_id" bigint PRIMARY KEY NOT NULL,
	"issue_key" text,
	"run_id" bigint,
	"report_id" bigint,
	"source_path" text,
	"severity" text NOT NULL,
	"rule_code" text NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;