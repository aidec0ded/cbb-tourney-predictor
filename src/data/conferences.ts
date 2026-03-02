// ---------------------------------------------------------------------------
// Conference tournament metadata — 2025-26 season
// Source: hoopshd.com/conference-tourney-info + bloggingthebracket.com
// ---------------------------------------------------------------------------

import type { BracketType } from '../models/types';

export interface ConferenceMeta {
  id: string;
  name: string;
  teamCount: number;            // Teams in the conference tournament
  startDate: string;            // First day of tournament play (ISO, for sort order)
  bracketType?: BracketType;    // Defaults to 'standard' if omitted
  reseedBeforeRounds?: number[]; // Rounds with dynamic reseeding (e.g. [1] for reseeded semis)
}

/**
 * All 31 D1 conference tournaments for the 2025-26 season, sorted by start
 * date. Team counts and dates sourced from hoopshd.com bracket data and
 * cross-referenced with ESPN/Blogging the Bracket schedules.
 */
export const CONFERENCES: ConferenceMeta[] = [
  // --- Early window ---
  { id: 'horizon', name: 'Horizon League', teamCount: 11, startDate: '2026-03-02', reseedBeforeRounds: [2, 3] },
  { id: 'patriot', name: 'Patriot League', teamCount: 10, startDate: '2026-03-03' },
  { id: 'sun_belt', name: 'Sun Belt', teamCount: 14, startDate: '2026-03-03', bracketType: 'stairway' },
  { id: 'nec', name: 'Northeast', teamCount: 8, startDate: '2026-03-04', reseedBeforeRounds: [1] },
  { id: 'ovc', name: 'Ohio Valley', teamCount: 8, startDate: '2026-03-04', bracketType: 'stairway' },
  { id: 'big_south', name: 'Big South', teamCount: 9, startDate: '2026-03-04' },
  { id: 'summit', name: 'Summit League', teamCount: 9, startDate: '2026-03-04' },
  { id: 'asun', name: 'ASUN', teamCount: 12, startDate: '2026-03-04' },
  { id: 'maac', name: 'MAAC', teamCount: 10, startDate: '2026-03-05' },
  { id: 'mvc', name: 'Missouri Valley', teamCount: 11, startDate: '2026-03-05' },
  { id: 'wcc', name: 'WCC', teamCount: 12, startDate: '2026-03-05', bracketType: 'stairway' },

  // --- Mid window ---
  { id: 'caa', name: 'Coastal Athletic', teamCount: 13, startDate: '2026-03-06', bracketType: 'double_bye' },
  { id: 'socon', name: 'Southern', teamCount: 10, startDate: '2026-03-06' },
  { id: 'america_east', name: 'America East', teamCount: 8, startDate: '2026-03-07', reseedBeforeRounds: [1] },
  { id: 'big_sky', name: 'Big Sky', teamCount: 10, startDate: '2026-03-07' },
  { id: 'southland', name: 'Southland', teamCount: 8, startDate: '2026-03-08', bracketType: 'stairway' },
  { id: 'swac', name: 'SWAC', teamCount: 12, startDate: '2026-03-09', bracketType: 'swac_hybrid' },

  // --- Championship window ---
  { id: 'acc', name: 'ACC', teamCount: 15, startDate: '2026-03-10', bracketType: 'double_bye' },
  { id: 'big12', name: 'Big 12', teamCount: 16, startDate: '2026-03-10', bracketType: 'double_bye' },
  { id: 'big_ten', name: 'Big Ten', teamCount: 18, startDate: '2026-03-10', bracketType: 'double_bye' },
  { id: 'cusa', name: 'Conference USA', teamCount: 10, startDate: '2026-03-10' },
  { id: 'aac', name: 'American', teamCount: 9, startDate: '2026-03-11', bracketType: 'stairway' },
  { id: 'a10', name: 'Atlantic 10', teamCount: 14, startDate: '2026-03-11', bracketType: 'double_bye' },
  { id: 'big_east', name: 'Big East', teamCount: 11, startDate: '2026-03-11' },
  { id: 'big_west', name: 'Big West', teamCount: 8, startDate: '2026-03-11', bracketType: 'stairway' },
  { id: 'meac', name: 'MEAC', teamCount: 7, startDate: '2026-03-11' },
  { id: 'mwc', name: 'Mountain West', teamCount: 12, startDate: '2026-03-11' },
  { id: 'sec', name: 'SEC', teamCount: 16, startDate: '2026-03-11', bracketType: 'double_bye' },
  { id: 'wac', name: 'WAC', teamCount: 7, startDate: '2026-03-11', bracketType: 'stairway' },
  { id: 'mac', name: 'MAC', teamCount: 8, startDate: '2026-03-12' },
  { id: 'ivy', name: 'Ivy League', teamCount: 4, startDate: '2026-03-14' },
];
