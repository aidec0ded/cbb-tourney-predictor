import type { BracketStructure, BracketGame, BracketType } from '../models/types';

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
function generateStandardBracket(teamCount: number): BracketStructure {
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
 * Generates a "stairway" bracket — two parallel ladders where higher seeds
 * enter at progressively later rounds, meeting in a final.
 *
 * Seed assignment uses a zigzag pattern (period 4):
 *   1→upper, 2→lower, 3→lower, 4→upper, 5→upper, 6→lower, …
 *
 * Within each ladder the worst two seeds play round 0, then progressively
 * better seeds step in one per round. Every team plays — no byes.
 *
 * Examples:
 *   8 teams:  Upper 5v8→4vW→1vW / Lower 6v7→3vW→2vW / Final  (7 games, 4 rounds)
 *  12 teams:  Upper 9v12→8vW→5vW→4vW→1vW / Lower 10v11→7vW→6vW→3vW→2vW / Final  (11 games, 6 rounds)
 *  14 teams:  Upper 12v13→9vW→8vW→5vW→4vW→1vW / Lower 11v14→10vW→7vW→6vW→3vW→2vW / Final  (13 games, 7 rounds)
 */
function generateStairwayBracket(teamCount: number): BracketStructure {
  if (teamCount < 4) {
    throw new Error(`Stairway bracket requires at least 4 teams, got ${teamCount}`);
  }

  // Zigzag seed assignment: U, L, L, U, U, L, L, U, …
  const upperSeeds: number[] = [];
  const lowerSeeds: number[] = [];
  for (let seed = 1; seed <= teamCount; seed++) {
    const mod = (seed - 1) % 4;
    if (mod === 0 || mod === 3) {
      upperSeeds.push(seed);
    } else {
      lowerSeeds.push(seed);
    }
  }

  // Sort descending — worst seeds play first in each ladder
  upperSeeds.sort((a, b) => b - a);
  lowerSeeds.sort((a, b) => b - a);

  const games: BracketGame[] = [];
  let gameCounter = 0;
  const nextId = () => `g${gameCounter++}`;

  // Build one ladder: first two seeds play round 0, rest step in one per round
  function buildLadder(seeds: number[]): BracketGame {
    const first: BracketGame = {
      id: nextId(),
      round: 0,
      seedA: seeds[1], // better of the opening pair
      seedB: seeds[0], // worst
    };
    games.push(first);

    let prev = first;
    for (let i = 2; i < seeds.length; i++) {
      const game: BracketGame = {
        id: nextId(),
        round: i - 1,
        seedA: seeds[i],
        sourceGameB: prev.id,
      };
      games.push(game);
      prev = game;
    }
    return prev; // last game in this ladder
  }

  const upperLast = buildLadder(upperSeeds);
  const lowerLast = buildLadder(lowerSeeds);

  const finalRound = Math.max(upperLast.round, lowerLast.round) + 1;
  const finalGame: BracketGame = {
    id: nextId(),
    round: finalRound,
    sourceGameA: upperLast.id,
    sourceGameB: lowerLast.id,
  };
  games.push(finalGame);

  return {
    rounds: finalRound + 1,
    games,
    finalGameId: finalGame.id,
  };
}

/**
 * Generates a "double bye" bracket.
 *
 * Seeds 1-4 always get double byes (enter at quarterfinals). Below the QFs,
 * the bracket is built in tiers using standard 8-team seeding at each level:
 *
 *   Tier 1 (always): seeds 5-8 vs 9-12 → pairings (5,12), (6,11), (7,10), (8,9)
 *   Tier 2 (if >16):  seeds 9-16 sub-bracket → pairings (9,16), (12,13), (10,15), (11,14)
 *   Play-ins:         extra seeds pair from the bottom of the deepest tier
 *
 *   13 teams:  1 play-in                        → 12 games, 5 rounds
 *   14 teams:  2 play-ins                       → 13 games, 5 rounds
 *   15 teams:  3 play-ins                       → 14 games, 5 rounds
 *   16 teams:  4 play-ins (all tier-1 fed)      → 15 games, 5 rounds
 *   18 teams:  tier-2 sub-bracket + 2 play-ins  → 17 games, 6 rounds
 */
function generateDoubleByeBracket(teamCount: number): BracketStructure {
  if (teamCount < 13 || teamCount > 18) {
    throw new Error(`Double-bye bracket supports 13-18 teams, got ${teamCount}`);
  }

  const games: BracketGame[] = [];
  let gameCounter = 0;
  const nextId = () => `g${gameCounter++}`;
  let roundOffset = 0;

  // Tracks feeder game IDs: seed → game ID whose winner fills that seed's slot
  const seedFeeder = new Map<number, string>();

  if (teamCount > 16) {
    // --- Tier 2: sub-bracket for seeds 9-16, with play-ins for 17+ ---
    const tier2PlayIns = teamCount - 16;
    for (let i = 0; i < tier2PlayIns; i++) {
      const better = 16 - i;
      const worse = 17 + i;
      const game: BracketGame = { id: nextId(), round: roundOffset, seedA: better, seedB: worse };
      games.push(game);
      seedFeeder.set(better, game.id);
    }
    if (tier2PlayIns > 0) roundOffset++;

    // Tier 2 games: standard 8-team pairings for seeds 9-16
    const tier2Pairings: [number, number][] = [[9, 16], [12, 13], [10, 15], [11, 14]];
    for (const [upper, lower] of tier2Pairings) {
      const feeder = seedFeeder.get(lower);
      const game: BracketGame = feeder
        ? { id: nextId(), round: roundOffset, seedA: upper, sourceGameB: feeder }
        : { id: nextId(), round: roundOffset, seedA: upper, seedB: lower };
      games.push(game);
      seedFeeder.set(upper, game.id);
    }
    roundOffset++;
  } else if (teamCount > 12) {
    // --- Simple play-ins for seeds 13-16 ---
    const numPlayIns = teamCount - 12;
    for (let i = 0; i < numPlayIns; i++) {
      const better = 12 - i;
      const worse = 13 + i;
      const game: BracketGame = { id: nextId(), round: roundOffset, seedA: better, seedB: worse };
      games.push(game);
      seedFeeder.set(better, game.id);
    }
    if (numPlayIns > 0) roundOffset++;
  }

  // --- Tier 1: seeds 5-8 vs 9-12 ---
  const tier1Pairings: [number, number][] = [[5, 12], [6, 11], [7, 10], [8, 9]];
  const tier1Games: BracketGame[] = [];
  for (const [upper, lower] of tier1Pairings) {
    const feeder = seedFeeder.get(lower);
    const game: BracketGame = feeder
      ? { id: nextId(), round: roundOffset, seedA: upper, sourceGameB: feeder }
      : { id: nextId(), round: roundOffset, seedA: upper, seedB: lower };
    tier1Games.push(game);
    games.push(game);
  }
  roundOffset++;

  // --- Quarterfinals: seeds 1-4 enter (double bye) ---
  // Bracket order: 1v(8/9 side), 4v(5/12 side), 2v(7/10 side), 3v(6/11 side)
  const qfPairs: [number, number][] = [[1, 3], [4, 0], [2, 2], [3, 1]];
  const qfGames: BracketGame[] = [];
  for (const [seed, t1Idx] of qfPairs) {
    const game: BracketGame = {
      id: nextId(),
      round: roundOffset,
      seedA: seed,
      sourceGameB: tier1Games[t1Idx].id,
    };
    qfGames.push(game);
    games.push(game);
  }
  roundOffset++;

  // --- Semifinals ---
  const semi1: BracketGame = { id: nextId(), round: roundOffset, sourceGameA: qfGames[0].id, sourceGameB: qfGames[1].id };
  games.push(semi1);
  const semi2: BracketGame = { id: nextId(), round: roundOffset, sourceGameA: qfGames[2].id, sourceGameB: qfGames[3].id };
  games.push(semi2);
  roundOffset++;

  // --- Final ---
  const finalGame: BracketGame = { id: nextId(), round: roundOffset, sourceGameA: semi1.id, sourceGameB: semi2.id };
  games.push(finalGame);

  return {
    rounds: roundOffset + 1,
    games,
    finalGameId: finalGame.id,
  };
}

/**
 * Generates the SWAC 12-team hybrid bracket.
 *
 * Seeds 1-2 get double byes. Seeds 3-6 get single byes. Seeds 7-8 enter
 * round 1 against play-in chain winners. Fixed topology, no reseeding.
 *
 *   Round 0: 10v11, 9v12
 *   Round 1: 8vW(10/11), 7vW(9/12)
 *   Round 2: 1vW(8side), 4v5, 2vW(7side), 3v6
 *   Round 3: W(1side)vW(4/5), W(2side)vW(3/6)
 *   Round 4: Final
 *
 *   11 games, 5 rounds.
 */
function generateSwacHybridBracket(teamCount: number): BracketStructure {
  if (teamCount !== 12) {
    throw new Error(`SWAC hybrid bracket requires 12 teams, got ${teamCount}`);
  }

  const games: BracketGame[] = [];
  let gameCounter = 0;
  const nextId = () => `g${gameCounter++}`;

  // Round 0: play-ins
  const pi1: BracketGame = { id: nextId(), round: 0, seedA: 10, seedB: 11 };
  const pi2: BracketGame = { id: nextId(), round: 0, seedA: 9, seedB: 12 };
  games.push(pi1, pi2);

  // Round 1: play-in chains
  const r1a: BracketGame = { id: nextId(), round: 1, seedA: 8, sourceGameB: pi1.id };
  const r1b: BracketGame = { id: nextId(), round: 1, seedA: 7, sourceGameB: pi2.id };
  games.push(r1a, r1b);

  // Round 2: quarterfinals — seeds 1-6 enter
  const qf1: BracketGame = { id: nextId(), round: 2, seedA: 1, sourceGameB: r1a.id };
  const qf2: BracketGame = { id: nextId(), round: 2, seedA: 4, seedB: 5 };
  const qf3: BracketGame = { id: nextId(), round: 2, seedA: 2, sourceGameB: r1b.id };
  const qf4: BracketGame = { id: nextId(), round: 2, seedA: 3, seedB: 6 };
  games.push(qf1, qf2, qf3, qf4);

  // Round 3: semifinals
  const semi1: BracketGame = { id: nextId(), round: 3, sourceGameA: qf1.id, sourceGameB: qf2.id };
  const semi2: BracketGame = { id: nextId(), round: 3, sourceGameA: qf3.id, sourceGameB: qf4.id };
  games.push(semi1, semi2);

  // Round 4: final
  const finalGame: BracketGame = { id: nextId(), round: 4, sourceGameA: semi1.id, sourceGameB: semi2.id };
  games.push(finalGame);

  return { rounds: 5, games, finalGameId: finalGame.id };
}

/**
 * Generates the Horizon League 11-team bracket with reseeded rounds.
 *
 * Rounds 0-1 are static:
 *   Round 0: 10v11 play-in (1 game)
 *   Round 1: 1vW(10/11), 2v9, 3v8, 4v7, 5v6 (5 games)
 *
 * Rounds 2-4 are dynamically resolved by the simulation engine:
 *   Round 2: 1 game (reduction: 5→4, top 3 get byes)
 *   Round 3: 2 games (reseeded semis)
 *   Round 4: 1 game (championship)
 *
 * Placeholder source links on rounds 2-3 are overridden at simulation time.
 * Total: 10 games, 5 rounds.
 */
function generateHorizonBracket(): BracketStructure {
  const games: BracketGame[] = [];
  let gameCounter = 0;
  const nextId = () => `g${gameCounter++}`;

  // Round 0: play-in
  const playIn: BracketGame = { id: nextId(), round: 0, seedA: 10, seedB: 11 };
  games.push(playIn);

  // Round 1: first round (all 10 remaining teams play)
  const r1a: BracketGame = { id: nextId(), round: 1, seedA: 1, sourceGameB: playIn.id };
  const r1b: BracketGame = { id: nextId(), round: 1, seedA: 2, seedB: 9 };
  const r1c: BracketGame = { id: nextId(), round: 1, seedA: 3, seedB: 8 };
  const r1d: BracketGame = { id: nextId(), round: 1, seedA: 4, seedB: 7 };
  const r1e: BracketGame = { id: nextId(), round: 1, seedA: 5, seedB: 6 };
  games.push(r1a, r1b, r1c, r1d, r1e);

  // Round 2: reseeded reduction (1 game — placeholder source links)
  const r2a: BracketGame = { id: nextId(), round: 2, sourceGameA: r1d.id, sourceGameB: r1e.id };
  games.push(r2a);

  // Round 3: reseeded semifinals (2 games — placeholder source links)
  const r3a: BracketGame = { id: nextId(), round: 3, sourceGameA: r1a.id, sourceGameB: r2a.id };
  const r3b: BracketGame = { id: nextId(), round: 3, sourceGameA: r1b.id, sourceGameB: r1c.id };
  games.push(r3a, r3b);

  // Round 4: championship
  const finalGame: BracketGame = { id: nextId(), round: 4, sourceGameA: r3a.id, sourceGameB: r3b.id };
  games.push(finalGame);

  return { rounds: 5, games, finalGameId: finalGame.id };
}

/**
 * Generates a bracket for the given team count and type.
 * Dispatches to the appropriate generator based on bracketType.
 * When reseedBeforeRounds is provided, attaches it to the bracket structure
 * and may use a specialized generator for the correct topology.
 */
export function generateBracket(
  teamCount: number,
  bracketType: BracketType = 'standard',
  reseedBeforeRounds?: number[],
): BracketStructure {
  let bracket: BracketStructure;

  switch (bracketType) {
    case 'stairway':
      bracket = generateStairwayBracket(teamCount);
      break;
    case 'double_bye':
      bracket = generateDoubleByeBracket(teamCount);
      break;
    case 'swac_hybrid':
      bracket = generateSwacHybridBracket(teamCount);
      break;
    case 'standard':
    default:
      // Horizon: 11 teams with reseeded reduction + reseeded semis
      if (teamCount === 11 && reseedBeforeRounds?.includes(2) && reseedBeforeRounds?.includes(3)) {
        bracket = generateHorizonBracket();
      } else {
        bracket = generateStandardBracket(teamCount);
      }
      break;
  }

  if (reseedBeforeRounds && reseedBeforeRounds.length > 0) {
    bracket.reseedBeforeRounds = reseedBeforeRounds;
  }

  return bracket;
}

/**
 * Returns the seeds that receive first-round byes for a given team count.
 * Non-standard bracket formats (e.g. stairway) have no byes.
 */
export function getByeSeeds(teamCount: number, bracketType: BracketType = 'standard'): number[] {
  if (bracketType !== 'standard') return [];

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
