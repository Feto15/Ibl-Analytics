// Data Transfer Object types sent to the client. These are explicit, stable
// contracts — never raw database rows. Numeric values are coerced to JS
// numbers in the query layer; nullish metrics stay null (rendered as "-").

import type { GamePhase } from "@/lib/game-phase";

export interface SeasonOption {
  seasonYear: number;
  competitionName: string;
}

export interface TeamOption {
  teamId: number;
  code: string;
  name: string | null;
}

export interface GameRow {
  gameId: number;
  seasonYear: number;
  phase: Exclude<GamePhase, "all">;
  weekNo: number | null;
  gameDate: string | null;
  venue: string | null;
  homeTeamId: number;
  awayTeamId: number;
  homeCode: string;
  awayCode: string;
  homeName: string | null;
  awayName: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface GamePeriod {
  periodNo: number;
  periodType: string;
  homeScore: number;
  awayScore: number;
}

export interface TeamBoxScore {
  teamId: number;
  code: string;
  name: string | null;
  isHome: boolean;
  points: number | null;
  fgMade: number | null;
  fgAttempted: number | null;
  twoPtMade: number | null;
  twoPtAttempted: number | null;
  threePtMade: number | null;
  threePtAttempted: number | null;
  ftMade: number | null;
  ftAttempted: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  totalRebounds: number | null;
  assists: number | null;
  turnovers: number | null;
  steals: number | null;
  blocks: number | null;
  personalFouls: number | null;
  plusMinus: number | null;
  efficiency: number | null;
  efgPercent: number | null;
  tsPercent: number | null;
}

export interface PlayerBoxScore {
  gameId: number;
  playerId: number;
  teamId: number;
  teamCode: string;
  displayName: string;
  jerseyNo: string | null;
  isStarter: boolean | null;
  isCaptain: boolean;
  didPlay: boolean;
  minutesSeconds: number | null;
  points: number | null;
  fgMade: number | null;
  fgAttempted: number | null;
  twoPtMade: number | null;
  twoPtAttempted: number | null;
  threePtMade: number | null;
  threePtAttempted: number | null;
  ftMade: number | null;
  ftAttempted: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  totalRebounds: number | null;
  assists: number | null;
  turnovers: number | null;
  steals: number | null;
  blocks: number | null;
  plusMinus: number | null;
  efficiency: number | null;
  efgPercent: number | null;
  tsPercent: number | null;
}

export interface TeamMetricRow {
  teamId: number;
  code: string;
  name: string | null;
  possessions: number | null;
  opponentPossessions: number | null;
  pace: number | null;
  offensiveRating: number | null;
  defensiveRating: number | null;
  netRating: number | null;
}

export interface PbpEvent {
  eventId: number;
  eventIndex: number;
  periodNo: number;
  clock: string | null;
  teamId: number | null;
  teamCode: string | null;
  jerseyNo: string | null;
  eventType: string | null;
  description: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface ShotPoint {
  shotId: number;
  gameId: number;
  teamId: number;
  teamCode: string;
  playerId: number | null;
  playerName: string | null;
  made: boolean | null;
  points: number | null;
  courtX: number;
  courtY: number;
  areaName: string | null;
  confidence: number | null;
  pbpMatchStatus: string | null;
  periodNo: number | null;
  clock: string | null;
}

export interface LineupSummaryRow {
  lineupSummaryId: number;
  gameId: number;
  teamId: number;
  teamCode: string;
  teamName: string | null;
  gameDate: string | null;
  lineupIndex: number;
  durationSeconds: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  plusMinus: number | null;
  pointsPerMinute: number | null;
  rebounds: number | null;
  steals: number | null;
  turnovers: number | null;
  assists: number | null;
  players: LineupPlayer[];
  hasIssue: boolean;
}

export interface LineupPlayer {
  playerId: number;
  displayName: string;
  jerseyNo: string | null;
}

export interface LineupStintRow {
  stintId: number;
  gameId: number;
  teamId: number;
  teamCode: string;
  stintIndex: number;
  startPeriod: number | null;
  startClock: string | null;
  endPeriod: number | null;
  endClock: string | null;
  durationSeconds: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  plusMinus: number | null;
  isStartingLineup: boolean;
  players: LineupPlayer[];
  hasIssue: boolean;
}

export interface PlusMinusDetailRow {
  gameId: number;
  playerId: number;
  teamId: number;
  minutesOnSeconds: number | null;
  minutesOffSeconds: number | null;
  scoreOnFor: number | null;
  scoreOnAgainst: number | null;
  scoreOffFor: number | null;
  scoreOffAgainst: number | null;
  plusMinusOn: number | null;
  plusMinusOff: number | null;
  pointsPerMinuteOn: number | null;
  pointsPerMinuteOff: number | null;
  hasIssue: boolean;
}

export interface ValidationIssueRow {
  issueId: number;
  ruleCode: string;
  severity: "info" | "warning" | "error";
  message: string;
  sourcePath: string | null;
  sourceFilename: string | null;
  reportType: string | null;
  sourceGameKey: string | null;
  teamCode: string | null;
  createdAt: string;
  context: Record<string, unknown> | null;
}

export interface StandingRow {
  teamId: number;
  code: string;
  name: string | null;
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pace: number | null;
  offensiveRating: number | null;
  defensiveRating: number | null;
  netRating: number | null;
  efgPercent: number | null;
  tsPercent: number | null;
}

export interface PlayerLeaderRow {
  playerId: number;
  displayName: string;
  teamId: number;
  teamCode: string;
  teamName: string | null;
  gamesPlayed: number;
  minutesPerGame: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  efficiencyPerGame: number | null;
  efgPercent: number | null;
  tsPercent: number | null;
  plusMinusPerGame: number | null;
  category?: "import" | "local";
}

export interface OverviewKpis {
  seasonYear: number;
  games: number;
  avgScore: number | null;
  pace: number | null;
  efgPercent: number | null;
  offensiveRating: number | null;
  defensiveRating: number | null;
  netRating: number | null;
}

export interface TrendPoint {
  label: string;
  value: number | null;
  gameDate: string | null;
}

export interface GameTrendPoint {
  label: string;
  value: number | null;
  pace: number | null;
}

export interface TeamTrendPoint {
  gameId: number;
  gameDate: string | null;
  opponentCode: string;
  isHome: boolean;
  points: number | null;
  pace: number | null;
  offensiveRating: number | null;
  defensiveRating: number | null;
  netRating: number | null;
  efgPercent: number | null;
  result: "W" | "L";
}

export interface PlayerGameStatRow {
  gameId: number;
  gameDate: string | null;
  opponentCode: string;
  isHome: boolean;
  result: "W" | "L";
  minutesSeconds: number | null;
  points: number | null;
  totalRebounds: number | null;
  assists: number | null;
  steals: number | null;
  turnovers: number | null;
  plusMinus: number | null;
  efficiency: number | null;
  efgPercent: number | null;
  tsPercent: number | null;
}

export interface PlayerProfile {
  playerId: number;
  displayName: string;
  normalizedName: string;
  category?: "import" | "local";
  teamId: number | null;
  teamCode: string | null;
  teamName: string | null;
  jerseyNo: string | null;
  position: string | null;
  heightCm: number | null;
  age: number | null;
  gamesPlayed: number;
  seasons: SeasonOption[];
}

export interface PlayerSplit {
  label: string;
  games: number;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  plusMinusPerGame: number | null;
  efgPercent: number | null;
}

export interface TeamProfile {
  teamId: number;
  code: string;
  name: string | null;
  seasons: SeasonOption[];
  games: number;
  wins: number;
  losses: number;
}

export interface TeamShotProfile {
  areaName: string;
  attempts: number;
  made: number;
  points: number;
  fgPercent: number | null;
}

export interface TeamRosterRow {
  playerId: number;
  displayName: string;
  category?: "import" | "local";
  jerseyNo: string | null;
  isStarter: boolean | null;
  isCaptain: boolean;
  position: string | null;
  heightCm: number | null;
  age: number | null;
  pointsPerGame: number | null;
  minutesPerGame: number | null;
}

export interface TeamSeasonSummary {
  pointsFor: number;
  pointsAgainst: number;
  pace: number | null;
  offensiveRating: number | null;
  defensiveRating: number | null;
  netRating: number | null;
  efgPercent: number | null;
  tsPercent: number | null;
}

export interface GameDetail {
  game: {
    gameId: number;
    seasonYear: number;
    weekNo: number | null;
    gameDate: string | null;
    venue: string | null;
    homeTeamId: number;
    awayTeamId: number;
    homeCode: string;
    awayCode: string;
    homeName: string | null;
    awayName: string | null;
    homeScore: number | null;
    awayScore: number | null;
  };
  periods: GamePeriod[];
  hasReview: boolean;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageResult<T> {
  rows: T[];
  pagination: Pagination;
}
