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
// Single-tournament simulation
// ---------------------------------------------------------------------------

/**
 * Simulates a single run of a tournament bracket and returns the winning team.
 *
 * Pure function — no DOM or side-effect dependencies so it can run inside
 * a Web Worker without modification.
 */
function simulateOnce(
  orderedGames: BracketGame[],
  seedMap: Map<number, TournamentTeam>,
  weights: BlendWeights,
  sigmas: SigmaConfig,
): TournamentTeam {
  // Maps game ID → the team that won that game
  const gameWinners = new Map<string, TournamentTeam>();

  for (const game of orderedGames) {
    // Resolve team A
    let teamA: TournamentTeam | undefined;
    if (game.seedA != null) {
      teamA = seedMap.get(game.seedA);
    } else if (game.sourceGameA) {
      teamA = gameWinners.get(game.sourceGameA);
    }

    // Resolve team B
    let teamB: TournamentTeam | undefined;
    if (game.seedB != null) {
      teamB = seedMap.get(game.seedB);
    } else if (game.sourceGameB) {
      teamB = gameWinners.get(game.sourceGameB);
    }

    // Handle byes: if only one team is present, they advance automatically
    if (teamA && !teamB) {
      gameWinners.set(game.id, teamA);
      continue;
    }
    if (teamB && !teamA) {
      gameWinners.set(game.id, teamB);
      continue;
    }
    if (!teamA || !teamB) {
      throw new Error(`Game ${game.id}: could not resolve both teams`);
    }

    // Simulate the game
    const pA = blendedWinProbability(teamA.ratings, teamB.ratings, weights, sigmas);
    const winner = Math.random() < pA ? teamA : teamB;
    gameWinners.set(game.id, winner);
  }

  // The winner of the final game is the tournament champion
  const champion = gameWinners.get(orderedGames[orderedGames.length - 1].id);
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

  // Win counters keyed by team name
  const winCounts = new Map<string, number>();
  for (const t of teams) winCounts.set(t.name, 0);

  const progressInterval = Math.max(100, Math.floor(numSimulations / 50));

  for (let i = 0; i < numSimulations; i++) {
    if (onProgress && i > 0 && i % progressInterval === 0) {
      onProgress(i, numSimulations);
    }
    const champion = simulateOnce(orderedGames, seedMap, weights, sigmas);
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
