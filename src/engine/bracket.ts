import type { BracketStructure, BracketGame } from '../models/types';

/**
 * Generates standard bracket positions for a power-of-2 sized bracket.
 *
 * Uses the iterative doubling algorithm: start with [1], then for each
 * doubling, pair each existing seed s with its complement (newSize + 1 - s).
 *
 * For size 8: [1, 8, 4, 5, 2, 7, 3, 6]
 *   → Round 0 matchups: 1v8, 4v5, 2v7, 3v6
 *
 * For size 16: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
 *   → Round 0 matchups: 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11
 */
function standardBracketPositions(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const nextSize = seeds.length * 2;
    const expanded: number[] = [];
    for (const s of seeds) {
      expanded.push(s, nextSize + 1 - s);
    }
    seeds = expanded;
  }
  return seeds;
}

/**
 * Generates a single-elimination bracket for any team count (2–32).
 *
 * Builds a full power-of-2 bracket with standard seeding. For non-power-of-2
 * team counts, seeds beyond teamCount won't exist in the team map, so the
 * simulation's bye logic automatically advances their opponents.
 *
 * Example: 11 teams → 16-slot bracket. Seeds 12–16 don't exist, so seeds
 * 1–5 (their opponents) get automatic first-round byes.
 */
export function generateBracket(teamCount: number): BracketStructure {
  if (teamCount < 2 || teamCount > 32) {
    throw new Error(`Team count must be between 2 and 32, got ${teamCount}`);
  }

  const rounds = Math.ceil(Math.log2(teamCount));
  const fullSize = 2 ** rounds;
  const positions = standardBracketPositions(fullSize);

  const games: BracketGame[] = [];
  let gameCounter = 0;
  const nextId = () => `g${gameCounter++}`;

  // Round 0: leaf games from adjacent bracket positions
  const leafGames: BracketGame[] = [];
  for (let i = 0; i < positions.length; i += 2) {
    const game: BracketGame = {
      id: nextId(),
      round: 0,
      seedA: positions[i],
      seedB: positions[i + 1],
    };
    leafGames.push(game);
    games.push(game);
  }

  // Subsequent rounds: pair winners of consecutive games
  let prevRound = leafGames;
  for (let r = 1; r < rounds; r++) {
    const currentRound: BracketGame[] = [];
    for (let i = 0; i < prevRound.length; i += 2) {
      const game: BracketGame = {
        id: nextId(),
        round: r,
        sourceGameA: prevRound[i].id,
        sourceGameB: prevRound[i + 1].id,
      };
      currentRound.push(game);
      games.push(game);
    }
    prevRound = currentRound;
  }

  return {
    rounds,
    games,
    finalGameId: games[games.length - 1].id,
  };
}

/**
 * Returns the seeds that receive first-round byes for a given team count.
 * These are the top seeds whose round-0 opponents don't exist.
 */
export function getByeSeeds(teamCount: number): number[] {
  const rounds = Math.ceil(Math.log2(teamCount));
  const fullSize = 2 ** rounds;
  const byes = fullSize - teamCount;
  if (byes === 0) return [];

  // Compute from actual bracket positions to be precise
  const positions = standardBracketPositions(fullSize);
  const byeSeeds: number[] = [];
  for (let i = 0; i < positions.length; i += 2) {
    const a = positions[i];
    const b = positions[i + 1];
    if (a <= teamCount && b > teamCount) byeSeeds.push(a);
    if (b <= teamCount && a > teamCount) byeSeeds.push(b);
  }
  byeSeeds.sort((a, b) => a - b);
  return byeSeeds;
}
