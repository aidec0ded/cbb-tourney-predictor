// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

import type { OwnershipModelConfig } from './types';

export const DEFAULT_SIM_COUNT = 10_000;

/** Win-probability thresholds for auto-classifying tournament confidence */
export const CONFIDENCE_THRESHOLDS = {
  lock: 0.45,
  lean: 0.25,
  coinFlip: 0.10,
} as const;

// ---------------------------------------------------------------------------
// Ownership model defaults
// ---------------------------------------------------------------------------

/** Base ownership rates by seed (index 0 = seed 1). Seeds 9+ get 0.003 floor. */
export const DEFAULT_BASE_SEED_OWNERSHIP = [
  0.48, 0.22, 0.13, 0.08, 0.04, 0.02, 0.015, 0.005,
];

export const DEFAULT_OWNERSHIP_CONFIG: OwnershipModelConfig = {
  baseSeedOwnership: DEFAULT_BASE_SEED_OWNERSHIP,
  analyticsBoostFactor: 1.5,
  analyticsPenaltyFactor: 0.6,
  temperature: 4.0,
  concentration: 1.3,
};
