import type { TeamRatings, SigmaConfig, BlendWeights } from '../models/types';

// ---------------------------------------------------------------------------
// Default calibration constants
// ---------------------------------------------------------------------------

export const DEFAULT_SIGMA: SigmaConfig = {
  kenpom: 11.0,
  torvik: 11.0,
  evanMiya: 10.0,
};

export const DEFAULT_WEIGHTS: BlendWeights = {
  kenpom: 0.30,
  torvik: 0.30,
  evanMiya: 0.40,
};

// ---------------------------------------------------------------------------
// Core logistic win-probability function
// ---------------------------------------------------------------------------

/**
 * Converts a rating differential to a win probability using the logistic model.
 *
 * P(A wins) = 1 / (1 + 10^(-(diff) / σ))
 *
 * @param ratingDiff  The rating advantage of team A over team B (positive = A is better)
 * @param sigma       Scaling factor controlling how quickly probability moves toward 0/1
 * @returns           Win probability for team A, in [0, 1]
 */
export function logisticWinProbability(ratingDiff: number, sigma: number): number {
  return 1 / (1 + Math.pow(10, -ratingDiff / sigma));
}

// ---------------------------------------------------------------------------
// Per-system win probability functions
// ---------------------------------------------------------------------------

/**
 * KenPom win probability for team A over team B at a neutral site.
 * Uses Adjusted Efficiency Margin (AdjEM) differential.
 *
 * @param adjEM_A  KenPom AdjEM for team A
 * @param adjEM_B  KenPom AdjEM for team B
 * @param sigma    Logistic scaling factor (default 11.0)
 */
export function kenpomWinProbability(
  adjEM_A: number,
  adjEM_B: number,
  sigma: number = DEFAULT_SIGMA.kenpom,
): number {
  return logisticWinProbability(adjEM_A - adjEM_B, sigma);
}

/**
 * Torvik win probability for team A over team B at a neutral site.
 * Uses Adjusted Efficiency Margin differential.
 *
 * @param adjEM_A  Torvik AdjEM for team A
 * @param adjEM_B  Torvik AdjEM for team B
 * @param sigma    Logistic scaling factor (default 11.0)
 */
export function torvikWinProbability(
  adjEM_A: number,
  adjEM_B: number,
  sigma: number = DEFAULT_SIGMA.torvik,
): number {
  return logisticWinProbability(adjEM_A - adjEM_B, sigma);
}

/**
 * Evan Miya win probability for team A over team B at a neutral site.
 * Uses Bayesian Performance Rating (BPR) differential.
 *
 * @param bpr_A  Evan Miya BPR for team A
 * @param bpr_B  Evan Miya BPR for team B
 * @param sigma  Logistic scaling factor (default 10.0)
 */
export function evanMiyaWinProbability(
  bpr_A: number,
  bpr_B: number,
  sigma: number = DEFAULT_SIGMA.evanMiya,
): number {
  return logisticWinProbability(bpr_A - bpr_B, sigma);
}

// ---------------------------------------------------------------------------
// Blended probability
// ---------------------------------------------------------------------------

/**
 * Computes a blended win probability by combining the three rating-system
 * probabilities using configurable weights.
 *
 * Each system independently produces P(A wins), then the final probability
 * is a weighted average. This avoids normalization issues that arise from
 * blending raw ratings across different scales.
 *
 * @param ratingsA  Full ratings for team A
 * @param ratingsB  Full ratings for team B
 * @param weights   Relative weights for each system (default: equal 1/3)
 * @param sigmas    Logistic σ values for each system
 * @returns         Blended P(A wins), in [0, 1]
 */
export function blendedWinProbability(
  ratingsA: TeamRatings,
  ratingsB: TeamRatings,
  weights: BlendWeights = DEFAULT_WEIGHTS,
  sigmas: SigmaConfig = DEFAULT_SIGMA,
): number {
  const pKenpom = kenpomWinProbability(
    ratingsA.kenpom.adjEM,
    ratingsB.kenpom.adjEM,
    sigmas.kenpom,
  );
  const pTorvik = torvikWinProbability(
    ratingsA.torvik.adjEM,
    ratingsB.torvik.adjEM,
    sigmas.torvik,
  );
  const pMiya = evanMiyaWinProbability(
    ratingsA.evanMiya.bpr,
    ratingsB.evanMiya.bpr,
    sigmas.evanMiya,
  );

  const totalWeight = weights.kenpom + weights.torvik + weights.evanMiya;

  return (
    (weights.kenpom * pKenpom + weights.torvik * pTorvik + weights.evanMiya * pMiya) /
    totalWeight
  );
}
