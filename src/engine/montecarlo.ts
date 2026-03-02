import type {
  BracketStructure,
  BracketGame,
  TournamentTeam,
  TeamSimulationResult,
  SigmaConfig,
  BlendWeights,
} from '../models/types';
import { blendedWinProbability, DEFAULT_SIGMA, DEFAULT_WEIGHTS } from './probability';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimulationInput {
  teams: TournamentTeam[];
  bracket: BracketStructure;
  numSimulations?: number;    // default 10_000
  weights?: BlendWeights;
  sigmas?: SigmaConfig;
}

export interface SimulationOutput {
  teamResults: TeamSimulationResult[];
  simulations: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a lookup from seed → team for quick access during simulation. */
function buildSeedMap(teams: TournamentTeam[]): Map<number, TournamentTeam> {
  const map = new Map<number, TournamentTeam>();
  for (const t of teams) {
    map.set(t.seed, t);
  }
  return map;
}

/**
 * Determine game execution order so that every source game is resolved
 * before any game that depends on it.
 */
function topologicalGameOrder(games: BracketGame[]): BracketGame[] {
  const gameMap = new Map<string, BracketGame>();
  for (const g of games) gameMap.set(g.id, g);

  const visited = new Set<string>();
  const order: BracketGame[] = [];

  function visit(game: BracketGame) {
    if (visited.has(game.id)) return;
    if (game.sourceGameA) visit(gameMap.get(game.sourceGameA)!);
    if (game.sourceGameB) visit(gameMap.get(game.sourceGameB)!);
    visited.add(game.id);
    order.push(game);
  }

  for (const g of games) visit(g);
  return order;
}

// ---------------------------------------------------------------------------
// Reseeding support
// ---------------------------------------------------------------------------

/** Precomputed info for brackets with dynamically reseeded rounds. */
interface ReseedInfo {
  roundGames: BracketGame[][];  // Games grouped by round index
  reseedRounds: Set<number>;    // Which rounds use dynamic reseeding
}

// ---------------------------------------------------------------------------
// Single-tournament simulation
// ---------------------------------------------------------------------------

/**
 * Resolves a game's teams and simulates the matchup. Shared helper for both
 * the fast path and the round-by-round reseeded path.
 */
function resolveAndPlay(
  game: BracketGame,
  seedMap: Map<number, TournamentTeam>,
  gameWinners: Map<string, TournamentTeam>,
  weights: BlendWeights,
  sigmas: SigmaConfig,
): { winner: TournamentTeam; loser?: TournamentTeam } {
  let teamA: TournamentTeam | undefined;
  if (game.seedA != null) teamA = seedMap.get(game.seedA);
  else if (game.sourceGameA) teamA = gameWinners.get(game.sourceGameA);

  let teamB: TournamentTeam | undefined;
  if (game.seedB != null) teamB = seedMap.get(game.seedB);
  else if (game.sourceGameB) teamB = gameWinners.get(game.sourceGameB);

  // Byes: if only one team is present, they advance automatically
  if (teamA && !teamB) return { winner: teamA };
  if (teamB && !teamA) return { winner: teamB };
  if (!teamA || !teamB) throw new Error(`Game ${game.id}: could not resolve both teams`);

  const pA = blendedWinProbability(teamA.ratings, teamB.ratings, weights, sigmas);
  const winner = Math.random() < pA ? teamA : teamB;
  const loser = winner === teamA ? teamB : teamA;
  return { winner, loser };
}

/**
 * Simulates a single run of a tournament bracket and returns the winning team.
 *
 * Two code paths:
 * - **Fast path** (no reseeding): processes games in topological order.
 * - **Reseeded path**: processes round-by-round. For reseeded rounds, collects
 *   surviving teams, sorts by seed, assigns byes to top seeds if needed, and
 *   pairs remaining teams best-vs-worst.
 *
 * Pure function — no DOM or side-effect dependencies so it can run inside
 * a Web Worker without modification.
 */
function simulateOnce(
  orderedGames: BracketGame[],
  seedMap: Map<number, TournamentTeam>,
  weights: BlendWeights,
  sigmas: SigmaConfig,
  finalGameId: string,
  reseedInfo?: ReseedInfo,
): TournamentTeam {
  const gameWinners = new Map<string, TournamentTeam>();

  if (!reseedInfo) {
    // --- Fast path: no reseeding, process in topological order ---
    for (const game of orderedGames) {
      const { winner } = resolveAndPlay(game, seedMap, gameWinners, weights, sigmas);
      gameWinners.set(game.id, winner);
    }
  } else {
    // --- Round-by-round with reseeding support ---
    const eliminated = new Set<number>();

    for (let round = 0; round < reseedInfo.roundGames.length; round++) {
      const gamesInRound = reseedInfo.roundGames[round];
      if (gamesInRound.length === 0) continue;

      if (reseedInfo.reseedRounds.has(round)) {
        // Collect survivors (not yet eliminated), sorted best seed first
        const survivors: TournamentTeam[] = [];
        for (const [seed, team] of seedMap) {
          if (!eliminated.has(seed)) survivors.push(team);
        }
        survivors.sort((a, b) => a.seed - b.seed);

        const numGames = gamesInRound.length;
        const numByes = survivors.length - 2 * numGames;

        // Top seeds get byes; pair remaining best-vs-worst
        const playingTeams = survivors.slice(numByes);

        for (let g = 0; g < numGames; g++) {
          const game = gamesInRound[g];
          const teamA = playingTeams[g];
          const teamB = playingTeams[playingTeams.length - 1 - g];

          const pA = blendedWinProbability(teamA.ratings, teamB.ratings, weights, sigmas);
          const winner = Math.random() < pA ? teamA : teamB;
          const loser = winner === teamA ? teamB : teamA;

          gameWinners.set(game.id, winner);
          eliminated.add(loser.seed);
        }
      } else {
        // Normal round — resolve via source links
        for (const game of gamesInRound) {
          const { winner, loser } = resolveAndPlay(game, seedMap, gameWinners, weights, sigmas);
          gameWinners.set(game.id, winner);
          if (loser) eliminated.add(loser.seed);
        }
      }
    }
  }

  const champion = gameWinners.get(finalGameId);
  if (!champion) throw new Error('Simulation failed: no champion determined');
  return champion;
}

// ---------------------------------------------------------------------------
// Core simulation loop — used by both main thread and Web Worker
// ---------------------------------------------------------------------------

/**
 * Runs the Monte Carlo simulation and optionally reports progress.
 *
 * @param onProgress called with (completedSims, totalSims) periodically
 */
export function runSimulationCore(
  input: SimulationInput,
  onProgress?: (completed: number, total: number) => void,
): SimulationOutput {
  const {
    teams,
    bracket,
    numSimulations = 10_000,
    weights = DEFAULT_WEIGHTS,
    sigmas = DEFAULT_SIGMA,
  } = input;

  const seedMap = buildSeedMap(teams);
  const orderedGames = topologicalGameOrder(bracket.games);

  // Precompute reseeding info (if applicable)
  let reseedInfo: ReseedInfo | undefined;
  if (bracket.reseedBeforeRounds && bracket.reseedBeforeRounds.length > 0) {
    const roundGames: BracketGame[][] = [];
    for (const game of bracket.games) {
      while (roundGames.length <= game.round) roundGames.push([]);
      roundGames[game.round].push(game);
    }
    reseedInfo = { roundGames, reseedRounds: new Set(bracket.reseedBeforeRounds) };
  }

  // Win counters keyed by team name
  const winCounts = new Map<string, number>();
  for (const t of teams) winCounts.set(t.name, 0);

  const progressInterval = Math.max(100, Math.floor(numSimulations / 50));

  for (let i = 0; i < numSimulations; i++) {
    if (onProgress && i > 0 && i % progressInterval === 0) {
      onProgress(i, numSimulations);
    }
    const champion = simulateOnce(orderedGames, seedMap, weights, sigmas, bracket.finalGameId, reseedInfo);
    winCounts.set(champion.name, (winCounts.get(champion.name) ?? 0) + 1);
  }

  if (onProgress) onProgress(numSimulations, numSimulations);

  const teamResults: TeamSimulationResult[] = teams.map((t) => {
    const wins = winCounts.get(t.name) ?? 0;
    const winProbability = wins / numSimulations;
    return {
      teamName: t.name,
      seed: t.seed,
      winProbability,
      expectedValue: winProbability * t.seed,
    };
  });

  // Sort by EV descending
  teamResults.sort((a, b) => b.expectedValue - a.expectedValue);

  return { teamResults, simulations: numSimulations };
}

// ---------------------------------------------------------------------------
// Public API — synchronous (for backwards compat / simple use)
// ---------------------------------------------------------------------------

export function runSimulation(input: SimulationInput): SimulationOutput {
  return runSimulationCore(input);
}
