// Dynamic strategy optimization based on leaderboard position — Phase 4

import type {
  CompetitorEntry,
  ConferenceTournament,
  LeaderboardContext,
  OwnershipModelConfig,
  OwnershipOverrides,
  StrategyMode,
  StrategyOutput,
  TeamSimulationResult,
  TeamStrategyScore,
  TournamentPick,
  TournamentStrategyRecommendation,
  WhatIfResult,
} from '../models/types';
import { DEFAULT_OWNERSHIP_CONFIG } from '../models/constants';
import {
  classifyConfidence,
  computeScoreProjection,
} from './ev';

// ---------------------------------------------------------------------------
// 1. Ownership estimation
// ---------------------------------------------------------------------------

/**
 * Enriches simulation results with estimatedOwnership and leverageScore.
 *
 * Three steps:
 *  1. Seed-based priors from config
 *  2. Analytics adjustment: boost if winProb exceeds seed expectation, penalize if below
 *  3. Normalize to sum to 1.0
 */
/**
 * Enriches simulation results with estimatedOwnership and leverageScore.
 *
 * If `overrides` is provided (teamName -> ownership fraction), pinned teams
 * keep their override value and remaining teams are normalized around the
 * remaining budget.
 */
export function estimateOwnership(
  simResults: TeamSimulationResult[],
  config: OwnershipModelConfig = DEFAULT_OWNERSHIP_CONFIG,
  overrides?: Record<string, number>,
): TeamSimulationResult[] {
  if (simResults.length === 0) return [];

  const FLOOR = 0.003;

  // Step 1: seed-based priors + analytics adjustment
  const raw = simResults.map((team) => {
    // If there's a manual override for this team, use it directly
    if (overrides && overrides[team.teamName] !== undefined) {
      return { ...team, rawOwnership: overrides[team.teamName], pinned: true };
    }

    const seedIndex = team.seed - 1;
    const basePrior =
      seedIndex < config.baseSeedOwnership.length
        ? config.baseSeedOwnership[seedIndex]
        : FLOOR;

    let adjusted: number;
    if (team.winProbability > basePrior) {
      adjusted = basePrior * config.analyticsBoostFactor;
    } else if (team.winProbability < basePrior * 0.5) {
      adjusted = basePrior * config.analyticsPenaltyFactor;
    } else {
      adjusted = basePrior;
    }

    return { ...team, rawOwnership: Math.max(adjusted, FLOOR), pinned: false };
  });

  // Step 2: normalize — pinned teams keep their value, unpinned share the rest
  const pinnedTotal = raw
    .filter((t) => t.pinned)
    .reduce((sum, t) => sum + t.rawOwnership, 0);
  const unpinnedBudget = Math.max(0, 1 - pinnedTotal);
  const unpinnedRawTotal = raw
    .filter((t) => !t.pinned)
    .reduce((sum, t) => sum + t.rawOwnership, 0);

  return raw.map(({ rawOwnership, pinned, ...team }) => {
    let estimatedOwnership: number;
    if (pinned) {
      estimatedOwnership = rawOwnership;
    } else if (unpinnedRawTotal > 0) {
      estimatedOwnership = (rawOwnership / unpinnedRawTotal) * unpinnedBudget;
    } else {
      estimatedOwnership = 1 / raw.length;
    }

    const leverageScore =
      estimatedOwnership > 0
        ? team.expectedValue / estimatedOwnership
        : team.expectedValue;

    return {
      ...team,
      estimatedOwnership,
      leverageScore,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. Aggression multiplier from leaderboard context
// ---------------------------------------------------------------------------

/**
 * Returns 0.3–2.0.
 * 1.0 = neutral. >1 = behind (more aggressive). <1 = ahead (more conservative).
 */
export function computeAggressionMultiplier(
  leaderboard: LeaderboardContext,
): number {
  if (leaderboard.competitors.length === 0 || leaderboard.remainingTournaments === 0) {
    return 1.0;
  }

  const leaderTotal = Math.max(
    ...leaderboard.competitors.map((c) => c.earnedPoints),
  );
  const deficit = leaderTotal - leaderboard.myProjectedTotal;
  const perTournament = deficit / leaderboard.remainingTournaments;
  const raw = 1.0 + perTournament * 0.27;

  return Math.max(0.3, Math.min(2.0, raw));
}

// ---------------------------------------------------------------------------
// 3–5. Scoring functions per strategy mode
// ---------------------------------------------------------------------------

/**
 * Balanced: Pure EV with mild leverage tilt (15% weight toward contrarian picks).
 * Minimum 2% winProb to be scored.
 */
export function scoreBalanced(
  team: TeamSimulationResult,
  _allTeams: TeamSimulationResult[],
): number {
  if (team.winProbability < 0.02) return 0;

  const evComponent = team.expectedValue;
  const leverageComponent = team.leverageScore ?? team.expectedValue;

  return evComponent * 0.85 + leverageComponent * 0.15;
}

/**
 * Aggressive: EV x seedMultiplier x ownershipPenalty^aggressionMult.
 * Minimum 4% winProb.
 */
export function scoreAggressive(
  team: TeamSimulationResult,
  _allTeams: TeamSimulationResult[],
  aggressionMult: number = 1.0,
): number {
  if (team.winProbability < 0.04) return 0;

  const seedMultiplier = 1 + 0.3 * Math.log(team.seed);
  const ownership = team.estimatedOwnership ?? 0.1;
  const ownershipPenalty = 1 / Math.sqrt(Math.max(ownership, 0.005));

  return team.expectedValue * seedMultiplier * Math.pow(ownershipPenalty, aggressionMult);
}

/**
 * Conservative: winProbability x (1 + seed x 0.05).
 * Heavy probability focus, tiny seed bonus. No floor.
 */
export function scoreConservative(
  team: TeamSimulationResult,
  _allTeams: TeamSimulationResult[],
  _aggressionMult: number = 1.0,
): number {
  return team.winProbability * (1 + team.seed * 0.05);
}

// ---------------------------------------------------------------------------
// 6. Generate reasoning
// ---------------------------------------------------------------------------

export function generateReasoning(
  team: TeamSimulationResult,
  mode: StrategyMode,
  allTeams: TeamSimulationResult[],
): string {
  const pctStr = (team.winProbability * 100).toFixed(1);
  const ownStr = team.estimatedOwnership
    ? (team.estimatedOwnership * 100).toFixed(0)
    : '?';
  const topTeam = allTeams.reduce((best, t) =>
    t.winProbability > best.winProbability ? t : best,
  );
  const isFavorite = team.teamName === topTeam.teamName;

  if (mode === 'balanced') {
    if (isFavorite) {
      return `Favorite at ${pctStr}% with EV ${team.expectedValue.toFixed(2)} — best risk/reward balance`;
    }
    if (team.expectedValue > topTeam.expectedValue * 0.8) {
      return `Strong EV at ${team.expectedValue.toFixed(2)} despite ${pctStr}% win rate — seed ${team.seed} value offsets risk`;
    }
    return `${pctStr}% to win, EV ${team.expectedValue.toFixed(2)} — moderate option`;
  }

  if (mode === 'aggressive') {
    if (team.seed >= 3 && team.winProbability >= 0.08) {
      return `Seed ${team.seed} upset value at ${pctStr}% — ~${ownStr}% field ownership creates leverage`;
    }
    if (isFavorite) {
      return `Favorite but low seed ${team.seed} value — consider higher-seed alternatives for differentiation`;
    }
    return `${pctStr}% at seed ${team.seed} — ${ownStr}% ownership gives ${(team.leverageScore ?? 0).toFixed(2)} leverage`;
  }

  // conservative
  if (isFavorite) {
    return `Safest pick at ${pctStr}% — protects current position`;
  }
  if (team.winProbability >= 0.25) {
    return `Solid ${pctStr}% chance — reliable floor builder`;
  }
  return `Only ${pctStr}% to win — risky for a protective strategy`;
}

// ---------------------------------------------------------------------------
// 7. Per-tournament strategy recommendation
// ---------------------------------------------------------------------------

export function getStrategyRecommendation(
  conferenceId: string,
  conferenceName: string,
  simResults: TeamSimulationResult[],
  mode: StrategyMode,
  aggressionMult: number = 1.0,
  config: OwnershipModelConfig = DEFAULT_OWNERSHIP_CONFIG,
  overrides?: Record<string, number>,
): TournamentStrategyRecommendation {
  // Enrich with ownership
  const enriched = estimateOwnership(simResults, config, overrides);

  // Score all teams
  const scored: TeamStrategyScore[] = enriched
    .map((team) => {
      let strategyScore: number;
      switch (mode) {
        case 'balanced':
          strategyScore = scoreBalanced(team, enriched);
          break;
        case 'aggressive':
          strategyScore = scoreAggressive(team, enriched, aggressionMult);
          break;
        case 'conservative':
          strategyScore = scoreConservative(team, enriched, aggressionMult);
          break;
      }

      return {
        teamName: team.teamName,
        seed: team.seed,
        winProbability: team.winProbability,
        expectedValue: team.expectedValue,
        estimatedOwnership: team.estimatedOwnership ?? 0,
        leverageScore: team.leverageScore ?? 0,
        strategyScore,
        rank: 0,
        reasoning: generateReasoning(team, mode, enriched),
      };
    })
    .sort((a, b) => b.strategyScore - a.strategyScore);

  // Assign ranks
  scored.forEach((t, i) => {
    t.rank = i + 1;
  });

  // Also compute balanced pick for comparison
  const balancedScored = enriched
    .map((team) => ({
      teamName: team.teamName,
      score: scoreBalanced(team, enriched),
    }))
    .sort((a, b) => b.score - a.score);

  const topPick = scored[0];
  const topTeam = enriched.reduce((best, t) =>
    t.winProbability > best.winProbability ? t : best,
  );

  return {
    conferenceId,
    conferenceName,
    mode,
    teams: scored,
    topPick,
    balancedPick: balancedScored[0]?.teamName ?? '',
    confidence: classifyConfidence(topTeam.winProbability),
  };
}

// ---------------------------------------------------------------------------
// 8. Full portfolio strategy
// ---------------------------------------------------------------------------

export function computeFullStrategy(
  tournaments: Record<string, ConferenceTournament>,
  simResults: Record<string, TeamSimulationResult[]>,
  picks: Record<string, TournamentPick>,
  mode: StrategyMode,
  leaderboard?: {
    myEarnedPoints: number;
    competitors: CompetitorEntry[];
  },
  ownershipConfig: OwnershipModelConfig = DEFAULT_OWNERSHIP_CONFIG,
  ownershipOverrides: OwnershipOverrides = {},
): StrategyOutput {
  // Count remaining tournaments
  const remaining = Object.values(tournaments).filter(
    (t) => t.status !== 'completed',
  );
  const remainingCount = remaining.length;

  // Compute aggression from leaderboard
  const projection = computeScoreProjection(tournaments, picks, simResults);
  let aggressionMult = 1.0;

  if (leaderboard && leaderboard.competitors.length > 0) {
    aggressionMult = computeAggressionMultiplier({
      myEarnedPoints: leaderboard.myEarnedPoints,
      myProjectedTotal: projection.totalProjected,
      competitors: leaderboard.competitors,
      remainingTournaments: remainingCount,
    });
  }

  // Generate recommendations for remaining tournaments with sim results
  const recommendations: TournamentStrategyRecommendation[] = [];

  for (const t of remaining) {
    const results = simResults[t.id];
    if (!results || results.length === 0) continue;

    recommendations.push(
      getStrategyRecommendation(
        t.id,
        t.name,
        results,
        mode,
        aggressionMult,
        ownershipConfig,
        ownershipOverrides[t.id],
      ),
    );
  }

  // Sort by tournament start date
  recommendations.sort((a, b) => {
    const tA = tournaments[a.conferenceId];
    const tB = tournaments[b.conferenceId];
    return (tA?.startDate ?? '').localeCompare(tB?.startDate ?? '');
  });

  // Compute portfolio projection using strategy picks where no user pick exists
  const strategyPicks = { ...picks };
  for (const rec of recommendations) {
    if (!strategyPicks[rec.conferenceId] && rec.topPick) {
      // Create a synthetic pick for projection purposes
      const results = simResults[rec.conferenceId];
      if (results) {
        strategyPicks[rec.conferenceId] = {
          conferenceId: rec.conferenceId,
          pickedTeamName: rec.topPick.teamName,
          pickedSeed: rec.topPick.seed,
          modelRecommendation: rec.balancedPick,
          confidence: classifyConfidence(rec.topPick.winProbability),
          override: false,
        };
      }
    }
  }

  const portfolioProjection = computeScoreProjection(
    tournaments,
    strategyPicks,
    simResults,
  );

  return {
    mode,
    recommendations,
    portfolioProjection,
    aggressionMultiplier: aggressionMult,
  };
}

// ---------------------------------------------------------------------------
// 9. What-if scenario modeling
// ---------------------------------------------------------------------------

export function computeWhatIf(
  tournaments: Record<string, ConferenceTournament>,
  currentPicks: Record<string, TournamentPick>,
  simResults: Record<string, TeamSimulationResult[]>,
  conferenceId: string,
  newTeamName: string,
  newSeed: number,
): WhatIfResult {
  const results = simResults[conferenceId] ?? [];
  const oldPick = currentPicks[conferenceId] ?? null;

  // Old projection (as-is)
  const oldProjection = computeScoreProjection(tournaments, currentPicks, simResults);

  // New projection (with swap)
  const newPicks = { ...currentPicks };
  const newTeamResult = results.find((r) => r.teamName === newTeamName);
  const newWinProb = newTeamResult?.winProbability ?? 0;

  newPicks[conferenceId] = {
    conferenceId,
    pickedTeamName: newTeamName,
    pickedSeed: newSeed,
    modelRecommendation: oldPick?.modelRecommendation ?? '',
    confidence: classifyConfidence(newWinProb),
    override: oldPick?.modelRecommendation
      ? newTeamName !== oldPick.modelRecommendation
      : false,
  };

  const newProjection = computeScoreProjection(tournaments, newPicks, simResults);

  const deltaProjected =
    Math.round((newProjection.totalProjected - oldProjection.totalProjected) * 10) / 10;
  const deltaCeiling = newProjection.ceiling - oldProjection.ceiling;

  // Risk assessment
  let riskAssessment: string;
  const oldWinProb = oldPick
    ? (results.find((r) => r.teamName === oldPick.pickedTeamName)?.winProbability ?? 0)
    : 0;

  if (!oldPick) {
    riskAssessment = `New pick adds ${newSeed} ceiling points at ${(newWinProb * 100).toFixed(0)}% probability`;
  } else if (deltaProjected > 0 && newWinProb >= oldWinProb) {
    riskAssessment = 'Strictly better — higher EV and higher probability';
  } else if (deltaProjected > 0 && newWinProb < oldWinProb) {
    riskAssessment = `Higher upside (+${deltaCeiling} ceiling) but riskier (${(oldWinProb * 100).toFixed(0)}% → ${(newWinProb * 100).toFixed(0)}%)`;
  } else if (deltaProjected < 0 && newWinProb > oldWinProb) {
    riskAssessment = `Safer pick (${(newWinProb * 100).toFixed(0)}% vs ${(oldWinProb * 100).toFixed(0)}%) but lower ceiling (${deltaCeiling})`;
  } else if (deltaProjected < 0) {
    riskAssessment = 'Lower EV and higher risk — not recommended';
  } else {
    riskAssessment = 'Lateral move — similar projected value';
  }

  return {
    conferenceId,
    oldPick: oldPick
      ? {
          teamName: oldPick.pickedTeamName,
          seed: oldPick.pickedSeed,
          winProbability: oldWinProb,
        }
      : null,
    newPick: {
      teamName: newTeamName,
      seed: newSeed,
      winProbability: newWinProb,
    },
    oldProjection,
    newProjection,
    deltaProjected,
    deltaCeiling,
    riskAssessment,
  };
}
