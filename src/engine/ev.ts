// Expected value and leverage calculations — Phase 3

import type {
  ConfidenceLevel,
  ConferenceTournament,
  TeamSimulationResult,
  TournamentPick,
} from '../models/types';
import { CONFIDENCE_THRESHOLDS } from '../models/constants';

// ---------------------------------------------------------------------------
// Confidence classification
// ---------------------------------------------------------------------------

export function classifyConfidence(winProbability: number): ConfidenceLevel {
  if (winProbability >= CONFIDENCE_THRESHOLDS.lock) return 'lock';
  if (winProbability >= CONFIDENCE_THRESHOLDS.lean) return 'lean';
  if (winProbability >= CONFIDENCE_THRESHOLDS.coinFlip) return 'coin_flip';
  return 'chaos';
}

// ---------------------------------------------------------------------------
// Model recommendation — top-EV team from simulation results
// ---------------------------------------------------------------------------

export interface ModelRecommendation {
  teamName: string;
  seed: number;
  ev: number;
  confidence: ConfidenceLevel;
}

export function getModelRecommendation(
  results: TeamSimulationResult[],
): ModelRecommendation | null {
  if (results.length === 0) return null;

  // Results are expected sorted by EV desc, but be safe
  const top = results.reduce((best, r) =>
    r.expectedValue > best.expectedValue ? r : best,
  );

  return {
    teamName: top.teamName,
    seed: top.seed,
    ev: top.expectedValue,
    confidence: classifyConfidence(top.winProbability),
  };
}

// ---------------------------------------------------------------------------
// Build a TournamentPick from a user's selection + sim results
// ---------------------------------------------------------------------------

export function buildPickFromSelection(
  conferenceId: string,
  teamName: string,
  seed: number,
  results: TeamSimulationResult[],
): TournamentPick {
  const rec = getModelRecommendation(results);
  const pickedResult = results.find((r) => r.teamName === teamName);

  return {
    conferenceId,
    pickedTeamName: teamName,
    pickedSeed: seed,
    modelRecommendation: rec?.teamName ?? '',
    confidence: pickedResult
      ? classifyConfidence(pickedResult.winProbability)
      : 'chaos',
    override: rec ? teamName !== rec.teamName : false,
  };
}

// ---------------------------------------------------------------------------
// Score projection
// ---------------------------------------------------------------------------

export interface ScoreProjection {
  earnedPoints: number;
  correctPicks: number;
  incorrectPicks: number;
  completedWithPick: number;
  projectedPoints: number;
  totalProjected: number;
  ceiling: number;
  floor: number;
  remainingPicked: number;
  remainingUnpicked: number;
}

export function computeScoreProjection(
  tournaments: Record<string, ConferenceTournament>,
  picks: Record<string, TournamentPick>,
  simResults: Record<string, TeamSimulationResult[]>,
): ScoreProjection {
  let earnedPoints = 0;
  let correctPicks = 0;
  let incorrectPicks = 0;
  let completedWithPick = 0;
  let projectedPoints = 0;
  let remainingPickedSeeds = 0;
  let remainingPicked = 0;
  let remainingUnpicked = 0;

  for (const t of Object.values(tournaments)) {
    const pick = picks[t.id];

    if (t.status === 'completed') {
      if (pick) {
        completedWithPick++;
        if (t.result && pick.pickedTeamName === t.result.winnerName) {
          earnedPoints += pick.pickedSeed;
          correctPicks++;
        } else {
          incorrectPicks++;
        }
      }
    } else {
      // Upcoming or in-progress
      if (pick) {
        remainingPicked++;
        remainingPickedSeeds += pick.pickedSeed;

        // Use sim results for projection if available
        const results = simResults[t.id];
        if (results) {
          const pickedResult = results.find(
            (r) => r.teamName === pick.pickedTeamName,
          );
          if (pickedResult) {
            projectedPoints += pickedResult.winProbability * pick.pickedSeed;
          }
        }
      } else {
        remainingUnpicked++;
      }
    }
  }

  return {
    earnedPoints,
    correctPicks,
    incorrectPicks,
    completedWithPick,
    projectedPoints: Math.round(projectedPoints * 10) / 10,
    totalProjected:
      Math.round((earnedPoints + projectedPoints) * 10) / 10,
    ceiling: earnedPoints + remainingPickedSeeds,
    floor: earnedPoints,
    remainingPicked,
    remainingUnpicked,
  };
}
