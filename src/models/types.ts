// ---------------------------------------------------------------------------
// Rating system data
// ---------------------------------------------------------------------------

export interface KenPomRatings {
  adjEM: number;   // Adjusted Efficiency Margin
  adjO: number;    // Adjusted Offensive Efficiency
  adjD: number;    // Adjusted Defensive Efficiency
  adjT: number;    // Adjusted Tempo
}

export interface TorvikRatings {
  adjEM: number;   // Adjusted Efficiency Margin
  barthag: number; // Power rating (0-1)
}

export interface EvanMiyaRatings {
  bpr: number;     // Bayesian Performance Rating
  offBPR: number;  // Offensive BPR
  defBPR: number;  // Defensive BPR
}

export interface TeamRatings {
  kenpom: KenPomRatings;
  torvik: TorvikRatings;
  evanMiya: EvanMiyaRatings;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export interface TournamentTeam {
  name: string;
  seed: number;
  conferenceId: string;
  ratings: TeamRatings;
}

// ---------------------------------------------------------------------------
// Bracket structure — flexible enough for 4-team to 16-team formats with byes
// ---------------------------------------------------------------------------

/**
 * A single game node in the bracket tree.
 *
 * - For a first-round game with known participants, `seedA` and `seedB` are set.
 * - For a game where one or both participants come from a prior game, use
 *   `sourceGameA` / `sourceGameB` (referencing another BracketGame.id).
 * - For a bye, set `seedA` to the advancing team's seed and leave `seedB`
 *   and `sourceGameB` undefined. That team advances automatically.
 */
export interface BracketGame {
  id: string;
  round: number;           // 0-indexed: 0 = play-in / first round, higher = later rounds
  seedA?: number;          // Seed of team A (if known at bracket construction)
  seedB?: number;          // Seed of team B (if known at bracket construction)
  sourceGameA?: string;    // ID of the game whose winner fills slot A
  sourceGameB?: string;    // ID of the game whose winner fills slot B
}

export interface BracketStructure {
  rounds: number;          // Total number of rounds
  games: BracketGame[];    // All games in the bracket
  finalGameId: string;     // ID of the championship game
  reseedBeforeRounds?: number[];  // Rounds where matchups are dynamically determined by surviving seeds
}

// ---------------------------------------------------------------------------
// Conference tournament
// ---------------------------------------------------------------------------

export type TournamentStatus = 'upcoming' | 'in_progress' | 'completed';

export type BracketType = 'standard' | 'stairway' | 'double_bye' | 'swac_hybrid';

export interface TournamentResult {
  winnerName: string;
  winningSeed: number;
  /** Snapshot of model state at time result was recorded */
  modelSnapshot?: {
    modelTopPick: string;
    modelTopPickEV: number;
    winnerWinProbability: number;
    winnerEV: number;
  };
}

export interface ConferenceTournament {
  id: string;
  name: string;
  teams: TournamentTeam[];
  bracket: BracketStructure;
  bracketType: BracketType;
  status: TournamentStatus;
  startDate: string;
  result?: TournamentResult;
}

// ---------------------------------------------------------------------------
// Picks
// ---------------------------------------------------------------------------

export type ConfidenceLevel = 'lock' | 'lean' | 'coin_flip' | 'chaos';

export interface TournamentPick {
  conferenceId: string;
  pickedTeamName: string;
  pickedSeed: number;
  modelRecommendation: string;
  confidence: ConfidenceLevel;
  override: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Simulation output
// ---------------------------------------------------------------------------

export interface TeamSimulationResult {
  teamName: string;
  seed: number;
  winProbability: number;
  expectedValue: number;         // P(win) × seed
  estimatedOwnership?: number;
  leverageScore?: number;        // EV / ownership
}

export interface TournamentSimulation {
  conferenceId: string;
  simulations: number;
  teamResults: TeamSimulationResult[];
}

// ---------------------------------------------------------------------------
// Probability engine configuration
// ---------------------------------------------------------------------------

export interface SigmaConfig {
  kenpom: number;   // default ≈ 11.0
  torvik: number;   // default ≈ 11.0
  evanMiya: number; // default ≈ 10.0
}

export interface BlendWeights {
  kenpom: number;   // default 1/3
  torvik: number;   // default 1/3
  evanMiya: number; // default 1/3
}

// ---------------------------------------------------------------------------
// Strategy mode
// ---------------------------------------------------------------------------

export type StrategyMode = 'balanced' | 'aggressive' | 'conservative';

// ---------------------------------------------------------------------------
// Leaderboard & competitors
// ---------------------------------------------------------------------------

export interface CompetitorEntry {
  label: string;           // e.g. "1st place", "rival"
  earnedPoints: number;
}

export interface LeaderboardContext {
  myEarnedPoints: number;
  myProjectedTotal: number;
  competitors: CompetitorEntry[];
  remainingTournaments: number;
}

// ---------------------------------------------------------------------------
// Ownership model
// ---------------------------------------------------------------------------

export interface OwnershipModelConfig {
  baseSeedOwnership: number[];  // index 0 = seed 1
  analyticsBoostFactor: number;
  analyticsPenaltyFactor: number;
}

/** conferenceId -> teamName -> manual ownership fraction (0.0–1.0) */
export type OwnershipOverrides = Record<string, Record<string, number>>;

// ---------------------------------------------------------------------------
// Strategy scoring & recommendations
// ---------------------------------------------------------------------------

export interface TeamStrategyScore {
  teamName: string;
  seed: number;
  winProbability: number;
  expectedValue: number;
  estimatedOwnership: number;
  leverageScore: number;
  strategyScore: number;
  rank: number;
  reasoning: string;
}

export interface TournamentStrategyRecommendation {
  conferenceId: string;
  conferenceName: string;
  mode: StrategyMode;
  teams: TeamStrategyScore[];
  topPick: TeamStrategyScore;
  balancedPick: string;
  confidence: ConfidenceLevel;
}

export interface StrategyOutput {
  mode: StrategyMode;
  recommendations: TournamentStrategyRecommendation[];
  portfolioProjection: import('../engine/ev').ScoreProjection;
  aggressionMultiplier: number;
}

// ---------------------------------------------------------------------------
// What-if scenario modeling
// ---------------------------------------------------------------------------

export interface WhatIfResult {
  conferenceId: string;
  oldPick: { teamName: string; seed: number; winProbability: number } | null;
  newPick: { teamName: string; seed: number; winProbability: number };
  oldProjection: import('../engine/ev').ScoreProjection;
  newProjection: import('../engine/ev').ScoreProjection;
  deltaProjected: number;
  deltaCeiling: number;
  riskAssessment: string;
}
