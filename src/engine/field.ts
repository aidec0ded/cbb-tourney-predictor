// Field analysis engine — competitor pick tracking & meta-game
// All pure functions, no side effects, suitable for useMemo.

import type {
  CompetitorPick,
  CompetitorProfile,
  CompetitorScoreProjection,
  ConferenceObservedOwnership,
  ConferenceTournament,
  FieldCompetitor,
  FieldScenarioResult,
  ObservedOwnership,
  TeamSimulationResult,
  TournamentPick,
  TournamentTeam,
} from '../models/types';

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Splits on last ` - ` to handle team names with hyphens.
 * Returns { teamName, seed } or null if unparseable.
 *
 * If `teams` is provided, also handles plain team names (no seed suffix)
 * by looking up the team in the tournament data to resolve the seed.
 */
export function parseCompetitorPick(
  raw: string,
  teams?: TournamentTeam[],
): CompetitorPick | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try "TeamName - Seed" format first
  const lastDashIdx = trimmed.lastIndexOf(' - ');
  if (lastDashIdx !== -1) {
    const teamName = trimmed.slice(0, lastDashIdx).trim();
    const seedStr = trimmed.slice(lastDashIdx + 3).trim();
    const seed = parseInt(seedStr, 10);

    if (teamName && !isNaN(seed) && seed >= 1) {
      return { teamName, seed };
    }
  }

  // Fallback: treat entire string as a team name, look up seed from tournament data
  if (teams) {
    const match = teams.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) {
      return { teamName: match.name, seed: match.seed };
    }
  }

  return null;
}

/**
 * Parses full TSV spreadsheet paste. Header row maps column names to
 * conferenceIds via the conferenceNames map. Skips metadata row (row 1
 * with dates). Skips the user's own row.
 *
 * When `tournaments` is provided, plain team names (without " - Seed"
 * suffix) are resolved by looking up the team in the tournament data.
 */
export function parseFullFieldPaste(
  text: string,
  conferenceNames: Map<string, string>,
  excludeName: string,
  tournaments?: Record<string, ConferenceTournament>,
): {
  competitors: { name: string; picks: Record<string, CompetitorPick> }[];
  errors: string[];
} {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  const errors: string[] = [];

  if (lines.length < 2) {
    errors.push('Need at least a header row and one data row.');
    return { competitors: [], errors };
  }

  // First line is the header row with conference names
  const headerCells = lines[0].split('\t');

  // Find column indices — first column is the competitor name
  // We need to map header cell text to conferenceIds
  const columnMap: { colIdx: number; conferenceId: string }[] = [];
  for (let i = 1; i < headerCells.length; i++) {
    const headerText = headerCells[i].trim();
    if (!headerText) continue;
    const confId = conferenceNames.get(headerText);
    if (confId) {
      columnMap.push({ colIdx: i, conferenceId: confId });
    }
  }

  if (columnMap.length === 0) {
    errors.push('No conference columns matched. Check header row names.');
    return { competitors: [], errors };
  }

  const competitors: { name: string; picks: Record<string, CompetitorPick> }[] = [];

  // Skip line 0 (header). If line 1 looks like a metadata/dates row
  // (no valid competitor name or contains mostly dates), skip it too.
  let startRow = 1;
  if (lines.length > 2) {
    const firstDataCells = lines[1].split('\t');
    const firstName = firstDataCells[0]?.trim() ?? '';
    // Check if this looks like a dates row (contains slashes or is empty name)
    if (!firstName || /^\d+\/\d+/.test(firstName) || /^\d{4}-/.test(firstName)) {
      startRow = 2;
    }
    // Also check if the first data column looks like a date
    if (firstDataCells[1] && /^\d+\/\d+/.test(firstDataCells[1].trim())) {
      startRow = 2;
    }
  }

  for (let row = startRow; row < lines.length; row++) {
    const line = lines[row];
    if (!line.trim()) continue;

    const cells = line.split('\t');
    const name = cells[0]?.trim();
    if (!name) continue;

    // Skip the user's own row
    if (name.toLowerCase() === excludeName.toLowerCase()) continue;

    const picks: Record<string, CompetitorPick> = {};
    for (const { colIdx, conferenceId } of columnMap) {
      const cellValue = cells[colIdx]?.trim();
      if (!cellValue) continue;
      const confTeams = tournaments?.[conferenceId]?.teams;
      const parsed = parseCompetitorPick(cellValue, confTeams);
      if (parsed) {
        picks[conferenceId] = parsed;
      } else {
        errors.push(`Row "${name}", column "${conferenceId}": could not parse "${cellValue}"`);
      }
    }

    competitors.push({ name, picks });
  }

  return { competitors, errors };
}

/**
 * Parses a single column of picks (one per line, in competitor order).
 * Matches picks to competitors by index from the existing list.
 * excludeIndex skips the user's row (0-indexed in the raw data).
 */
export function parseSingleConferencePaste(
  text: string,
  existingCompetitors: FieldCompetitor[],
  conferenceId: string,
  excludeIndex: number,
  teams?: TournamentTeam[],
): {
  updated: FieldCompetitor[];
  errors: string[];
} {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, '').trim());
  const errors: string[] = [];

  // Filter out the user's row by index
  const pickLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i === excludeIndex) continue;
    pickLines.push(lines[i]);
  }

  const updated = existingCompetitors.map((comp, idx) => {
    const raw = pickLines[idx];
    if (!raw) return comp;

    const parsed = parseCompetitorPick(raw, teams);
    if (!parsed) {
      if (raw) errors.push(`Line ${idx + 1} (${comp.name}): could not parse "${raw}"`);
      return comp;
    }

    return {
      ...comp,
      picks: { ...comp.picks, [conferenceId]: parsed },
    };
  });

  return { updated, errors };
}

// ---------------------------------------------------------------------------
// Observed Ownership
// ---------------------------------------------------------------------------

/**
 * Counts actual picks per team, computes percentages.
 */
export function computeObservedOwnership(
  competitors: FieldCompetitor[],
  conferenceId: string,
): ConferenceObservedOwnership | null {
  const picks = competitors
    .map((c) => c.picks[conferenceId])
    .filter((p): p is CompetitorPick => p != null);

  if (picks.length === 0) return null;

  const counts = new Map<string, { seed: number; count: number }>();
  for (const pick of picks) {
    const existing = counts.get(pick.teamName);
    if (existing) {
      existing.count++;
    } else {
      counts.set(pick.teamName, { seed: pick.seed, count: 1 });
    }
  }

  const totalCompetitors = picks.length;
  const teams: ObservedOwnership[] = Array.from(counts.entries())
    .map(([teamName, { seed, count }]) => ({
      teamName,
      seed,
      count,
      percentage: count / totalCompetitors,
    }))
    .sort((a, b) => b.count - a.count);

  return { conferenceId, totalCompetitors, teams };
}

// ---------------------------------------------------------------------------
// Blending Observed + Estimated Ownership
// ---------------------------------------------------------------------------

/**
 * Weighted blend based on coverage ratio. At 80%+ coverage, observed
 * weight = 0.85. At <20%, observed weight = 0.25.
 * Updates estimatedOwnership and recomputes leverageScore.
 */
export function blendOwnership(
  estimated: TeamSimulationResult[],
  observed: ConferenceObservedOwnership | null,
  totalFieldSize: number,
): TeamSimulationResult[] {
  if (!observed || observed.totalCompetitors === 0 || estimated.length === 0) {
    return estimated;
  }

  const coverage = observed.totalCompetitors / totalFieldSize;
  // Linearly interpolate observed weight: 0.25 at 0% → 0.85 at 80%+
  const observedWeight = Math.min(0.85, 0.25 + (coverage / 0.8) * 0.6);

  const observedMap = new Map(
    observed.teams.map((t) => [t.teamName, t.percentage]),
  );

  return estimated.map((team) => {
    const obsOwnership = observedMap.get(team.teamName) ?? 0;
    const estOwnership = team.estimatedOwnership ?? 0;

    const blended = observedWeight * obsOwnership + (1 - observedWeight) * estOwnership;
    const leverageScore = blended > 0
      ? team.expectedValue / blended
      : team.expectedValue;

    return {
      ...team,
      estimatedOwnership: blended,
      leverageScore,
    };
  });
}

// ---------------------------------------------------------------------------
// Competitor Scoring
// ---------------------------------------------------------------------------

/**
 * For each competitor: earned points from completed tournaments where they
 * picked the winner (seed value), projected points from remaining tournaments
 * using sim win probabilities. Sorted by totalProjected descending.
 */
export function computeCompetitorScores(
  competitors: FieldCompetitor[],
  tournaments: Record<string, ConferenceTournament>,
  simResults: Record<string, TeamSimulationResult[]>,
): CompetitorScoreProjection[] {
  return competitors
    .map((comp) => {
      let earnedPoints = 0;
      let projectedPoints = 0;
      let resolvedPicks = 0;
      let correctPicks = 0;
      let unresolvedPicks = 0;

      for (const [confId, pick] of Object.entries(comp.picks)) {
        const tournament = tournaments[confId];
        if (!tournament) continue;

        if (tournament.status === 'completed' && tournament.result) {
          resolvedPicks++;
          if (pick.teamName === tournament.result.winnerName) {
            earnedPoints += pick.seed;
            correctPicks++;
          }
        } else {
          unresolvedPicks++;
          // Project using sim results
          const sims = simResults[confId];
          if (sims) {
            const teamResult = sims.find((r) => r.teamName === pick.teamName);
            if (teamResult) {
              projectedPoints += teamResult.winProbability * pick.seed;
            }
          }
        }
      }

      return {
        name: comp.name,
        earnedPoints,
        projectedPoints: Math.round(projectedPoints * 10) / 10,
        totalProjected: Math.round((earnedPoints + projectedPoints) * 10) / 10,
        resolvedPicks,
        correctPicks,
        unresolvedPicks,
        profile: comp.profile,
      };
    })
    .sort((a, b) => b.totalProjected - a.totalProjected);
}

// ---------------------------------------------------------------------------
// Competitor Profiling
// ---------------------------------------------------------------------------

function computeProfileConfidence(pickCount: number): number {
  if (pickCount <= 2) return 0.2;
  if (pickCount <= 5) return 0.5;
  if (pickCount <= 10) return 0.7;
  return 0.9;
}

/**
 * Classifies a competitor's strategy archetype based on their revealed picks.
 * Needs >= 3 picks for a meaningful classification.
 */
export function classifyCompetitor(
  competitor: FieldCompetitor,
  simResults: Record<string, TeamSimulationResult[]>,
): { profile: CompetitorProfile; confidence: number } {
  const picks = Object.entries(competitor.picks);
  const pickCount = picks.length;
  const confidence = computeProfileConfidence(pickCount);

  if (pickCount < 3) {
    return { profile: 'unknown', confidence };
  }

  const seeds = picks.map(([, p]) => p.seed);
  const avgSeed = seeds.reduce((sum, s) => sum + s, 0) / seeds.length;

  // Check chalk: average seed <= 1.5
  if (avgSeed <= 1.5) {
    return { profile: 'chalk', confidence };
  }

  // Check seed_chaser: average seed >= 3.0
  if (avgSeed >= 3.0) {
    return { profile: 'seed_chaser', confidence };
  }

  // Check contrarian and analytics (need sim results)
  let lowOwnershipCount = 0;
  let topEVMatchCount = 0;
  let picksWithSims = 0;

  for (const [confId, pick] of picks) {
    const sims = simResults[confId];
    if (!sims || sims.length === 0) continue;
    picksWithSims++;

    // Check if pick is low-ownership
    const pickResult = sims.find((r) => r.teamName === pick.teamName);
    if (pickResult?.estimatedOwnership != null && pickResult.estimatedOwnership < 0.15) {
      lowOwnershipCount++;
    }

    // Check if pick matches top-EV team
    const topEV = sims.reduce((best, r) =>
      r.expectedValue > best.expectedValue ? r : best,
    );
    if (pick.teamName === topEV.teamName) {
      topEVMatchCount++;
    }
  }

  if (picksWithSims >= 3) {
    // Contrarian: majority of picks are low-ownership
    if (lowOwnershipCount / picksWithSims > 0.5) {
      return { profile: 'contrarian', confidence };
    }

    // Analytics: majority of picks match model top-EV
    if (topEVMatchCount / picksWithSims > 0.5) {
      return { profile: 'analytics', confidence };
    }
  }

  return { profile: 'unknown', confidence };
}

/**
 * Classify all competitors and return updated copies.
 */
export function classifyAllCompetitors(
  competitors: FieldCompetitor[],
  simResults: Record<string, TeamSimulationResult[]>,
): FieldCompetitor[] {
  return competitors.map((comp) => {
    const { profile, confidence } = classifyCompetitor(comp, simResults);
    return { ...comp, profile, profileConfidence: confidence };
  });
}

// ---------------------------------------------------------------------------
// Forward Projection
// ---------------------------------------------------------------------------

/**
 * Predicts what a competitor with the given profile would pick for a
 * tournament based on their archetype.
 */
export function predictCompetitorPick(
  profile: CompetitorProfile,
  simResults: TeamSimulationResult[],
  teams: TournamentTeam[],
): CompetitorPick | null {
  if (teams.length === 0 || simResults.length === 0) return null;

  switch (profile) {
    case 'chalk':
    case 'unknown': {
      // Pick seed 1
      const seed1 = teams.find((t) => t.seed === 1);
      return seed1 ? { teamName: seed1.name, seed: 1 } : null;
    }

    case 'seed_chaser': {
      // Pick highest seed with >= 5% win probability
      const viable = simResults
        .filter((r) => r.winProbability >= 0.05)
        .sort((a, b) => b.seed - a.seed);
      if (viable.length === 0) return null;
      return { teamName: viable[0].teamName, seed: viable[0].seed };
    }

    case 'contrarian': {
      // Pick lowest-ownership team with >= 8% win probability
      const viable = simResults
        .filter((r) => r.winProbability >= 0.08 && r.estimatedOwnership != null)
        .sort((a, b) => (a.estimatedOwnership ?? 1) - (b.estimatedOwnership ?? 1));
      if (viable.length === 0) {
        // Fallback: just pick lowest ownership with any chance
        const fallback = simResults
          .filter((r) => r.winProbability >= 0.05)
          .sort((a, b) => (a.estimatedOwnership ?? 1) - (b.estimatedOwnership ?? 1));
        return fallback.length > 0
          ? { teamName: fallback[0].teamName, seed: fallback[0].seed }
          : null;
      }
      return { teamName: viable[0].teamName, seed: viable[0].seed };
    }

    case 'analytics': {
      // Pick top-EV team
      const topEV = simResults.reduce((best, r) =>
        r.expectedValue > best.expectedValue ? r : best,
      );
      return { teamName: topEV.teamName, seed: topEV.seed };
    }
  }
}

// ---------------------------------------------------------------------------
// Scenario Analysis
// ---------------------------------------------------------------------------

/**
 * Hypothetically applies a result, computes full leaderboard including user,
 * returns sorted projections and user rank.
 */
export function computeFieldScenario(
  competitors: FieldCompetitor[],
  tournaments: Record<string, ConferenceTournament>,
  simResults: Record<string, TeamSimulationResult[]>,
  userPicks: Record<string, TournamentPick>,
  conferenceId: string,
  winnerName: string,
  winningSeed: number,
  userName: string,
): FieldScenarioResult {
  // Create hypothetical tournaments with this result applied
  const hypotheticalTournaments = { ...tournaments };
  const tournament = tournaments[conferenceId];
  if (tournament) {
    hypotheticalTournaments[conferenceId] = {
      ...tournament,
      status: 'completed',
      result: { winnerName, winningSeed },
    };
  }

  // Score all competitors in the hypothetical scenario
  const leaderboard = computeCompetitorScores(
    competitors,
    hypotheticalTournaments,
    simResults,
  );

  // Compute user score in this scenario
  let userEarned = 0;
  let userProjected = 0;
  let userResolved = 0;
  let userCorrect = 0;
  let userUnresolved = 0;

  for (const t of Object.values(hypotheticalTournaments)) {
    const pick = userPicks[t.id];
    if (!pick) continue;

    if (t.status === 'completed' && t.result) {
      userResolved++;
      if (pick.pickedTeamName === t.result.winnerName) {
        userEarned += pick.pickedSeed;
        userCorrect++;
      }
    } else {
      userUnresolved++;
      const sims = simResults[t.id];
      if (sims) {
        const teamResult = sims.find((r) => r.teamName === pick.pickedTeamName);
        if (teamResult) {
          userProjected += teamResult.winProbability * pick.pickedSeed;
        }
      }
    }
  }

  const userTotal = Math.round((userEarned + userProjected) * 10) / 10;

  // Insert user into leaderboard
  const userEntry: CompetitorScoreProjection = {
    name: userName,
    earnedPoints: userEarned,
    projectedPoints: Math.round(userProjected * 10) / 10,
    totalProjected: userTotal,
    resolvedPicks: userResolved,
    correctPicks: userCorrect,
    unresolvedPicks: userUnresolved,
    profile: 'analytics',
  };

  const fullLeaderboard = [...leaderboard, userEntry].sort(
    (a, b) => b.totalProjected - a.totalProjected,
  );

  const userRank = fullLeaderboard.findIndex((e) => e.name === userName) + 1;

  // Count how many competitors benefit from this outcome
  const benefitCount = competitors.filter((c) => {
    const pick = c.picks[conferenceId];
    return pick && pick.teamName === winnerName;
  }).length;

  return {
    conferenceId,
    winnerName,
    winningSeed,
    leaderboard: fullLeaderboard,
    userRank,
    benefitCount,
  };
}
