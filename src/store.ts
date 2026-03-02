import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ConferenceTournament,
  TournamentTeam,
  TeamSimulationResult,
  TournamentPick,
  TournamentStatus,
  TournamentResult,
  SigmaConfig,
  BlendWeights,
  StrategyMode,
  CompetitorEntry,
  OwnershipModelConfig,
  OwnershipOverrides,
} from './models/types';
import { CONFERENCES } from './data/conferences';
import { generateBracket } from './engine/bracket';
import { DEFAULT_SIGMA, DEFAULT_WEIGHTS } from './engine/probability';
import { DEFAULT_SIM_COUNT, DEFAULT_OWNERSHIP_CONFIG } from './models/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function blankTeam(seed: number, conferenceId: string): TournamentTeam {
  return {
    name: '',
    seed,
    conferenceId,
    ratings: {
      kenpom: { adjEM: 0, adjO: 100, adjD: 100, adjT: 68 },
      torvik: { adjEM: 0, barthag: 0.5 },
      evanMiya: { bpr: 0, offBPR: 0, defBPR: 0 },
    },
  };
}

function initTournaments(): Record<string, ConferenceTournament> {
  const tournaments: Record<string, ConferenceTournament> = {};
  for (const conf of CONFERENCES) {
    const bracketType = conf.bracketType ?? 'standard';
    tournaments[conf.id] = {
      id: conf.id,
      name: conf.name,
      teams: Array.from({ length: conf.teamCount }, (_, i) =>
        blankTeam(i + 1, conf.id),
      ),
      bracket: generateBracket(conf.teamCount, bracketType, conf.reseedBeforeRounds),
      bracketType,
      status: 'upcoming',
      startDate: conf.startDate,
    };
  }
  return tournaments;
}

/**
 * Reconcile persisted tournaments with current conference metadata.
 * If a conference's teamCount or bracketType changed, rebuild the bracket
 * and resize the team array while preserving any existing team data that
 * still fits.
 */
function reconcileTournaments(
  stored: Record<string, ConferenceTournament>,
): Record<string, ConferenceTournament> {
  const fresh = initTournaments();
  const result: Record<string, ConferenceTournament> = {};

  for (const conf of CONFERENCES) {
    const saved = stored[conf.id];
    if (!saved) {
      // New conference — use fresh default
      result[conf.id] = fresh[conf.id];
      continue;
    }

    const bracketType = conf.bracketType ?? 'standard';
    const savedBracketType = saved.bracketType ?? 'standard';
    const teamCountChanged = saved.teams.length !== conf.teamCount;
    const bracketTypeChanged = savedBracketType !== bracketType;
    const reseedChanged = JSON.stringify(saved.bracket.reseedBeforeRounds ?? []) !==
                          JSON.stringify(conf.reseedBeforeRounds ?? []);

    if (!teamCountChanged && !bracketTypeChanged && !reseedChanged) {
      // No structural changes — keep saved data, update metadata
      result[conf.id] = { ...saved, startDate: conf.startDate, name: conf.name, bracketType };
      continue;
    }

    // Structural change — rebuild bracket, resize team array
    const teams: TournamentTeam[] = Array.from({ length: conf.teamCount }, (_, i) => {
      const seed = i + 1;
      const existing = saved.teams.find((t) => t.seed === seed);
      return existing ?? blankTeam(seed, conf.id);
    });

    result[conf.id] = {
      ...saved,
      name: conf.name,
      startDate: conf.startDate,
      teams,
      bracket: generateBracket(conf.teamCount, bracketType, conf.reseedBeforeRounds),
      bracketType,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// View type
// ---------------------------------------------------------------------------

export type ActiveView = 'conference' | 'strategy' | 'settings' | 'results';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface AppState {
  // Persisted data
  tournaments: Record<string, ConferenceTournament>;
  simResults: Record<string, TeamSimulationResult[]>;
  picks: Record<string, TournamentPick>;
  sigmas: SigmaConfig;
  weights: BlendWeights;
  simCount: number;
  strategyMode: StrategyMode;
  competitors: CompetitorEntry[];
  ownershipConfig: OwnershipModelConfig;
  ownershipOverrides: OwnershipOverrides;

  // Transient UI state (not persisted)
  selectedConferenceId: string | null;
  simulatingId: string | null;
  activeView: ActiveView;

  // Actions
  selectConference: (id: string | null) => void;
  setActiveView: (view: ActiveView) => void;
  updateTeam: (conferenceId: string, index: number, team: TournamentTeam) => void;
  bulkUpdateTeams: (conferenceId: string, teams: TournamentTeam[]) => void;
  setSimResults: (conferenceId: string, results: TeamSimulationResult[]) => void;
  setSimulating: (id: string | null) => void;
  setSimCount: (count: number) => void;
  setSigmas: (sigmas: SigmaConfig) => void;
  setWeights: (weights: BlendWeights) => void;
  setTournamentStatus: (conferenceId: string, status: TournamentStatus) => void;
  setTournamentResult: (conferenceId: string, result: TournamentResult) => void;
  clearTournamentResult: (conferenceId: string) => void;
  setPick: (conferenceId: string, pick: TournamentPick) => void;
  clearPick: (conferenceId: string) => void;
  setStrategyMode: (mode: StrategyMode) => void;
  setCompetitors: (competitors: CompetitorEntry[]) => void;
  setOwnershipConfig: (config: OwnershipModelConfig) => void;
  setOwnershipOverride: (conferenceId: string, teamName: string, ownership: number) => void;
  clearOwnershipOverride: (conferenceId: string, teamName: string) => void;
  exportState: () => string;
  importState: (json: string) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- Initial state ---
      tournaments: initTournaments(),
      simResults: {},
      picks: {},
      sigmas: { ...DEFAULT_SIGMA },
      weights: { ...DEFAULT_WEIGHTS },
      simCount: DEFAULT_SIM_COUNT,
      strategyMode: 'balanced',
      competitors: [],
      ownershipConfig: { ...DEFAULT_OWNERSHIP_CONFIG },
      ownershipOverrides: {},
      selectedConferenceId: null,
      simulatingId: null,
      activeView: 'conference',

      // --- Actions ---

      selectConference: (id) => set({ selectedConferenceId: id }),

      setActiveView: (view) => set({ activeView: view }),

      updateTeam: (conferenceId, index, team) =>
        set((state) => {
          const tournament = state.tournaments[conferenceId];
          if (!tournament) return state;
          const teams = [...tournament.teams];
          teams[index] = team;
          const newSimResults = { ...state.simResults };
          delete newSimResults[conferenceId]; // clear stale results
          return {
            tournaments: {
              ...state.tournaments,
              [conferenceId]: { ...tournament, teams },
            },
            simResults: newSimResults,
          };
        }),

      bulkUpdateTeams: (conferenceId, teams) =>
        set((state) => {
          const tournament = state.tournaments[conferenceId];
          if (!tournament) return state;
          const newSimResults = { ...state.simResults };
          delete newSimResults[conferenceId];
          return {
            tournaments: {
              ...state.tournaments,
              [conferenceId]: { ...tournament, teams },
            },
            simResults: newSimResults,
          };
        }),

      setSimResults: (conferenceId, results) =>
        set((state) => ({
          simResults: { ...state.simResults, [conferenceId]: results },
        })),

      setSimulating: (id) => set({ simulatingId: id }),

      setSimCount: (count) => set({ simCount: Math.max(100, count) }),

      setSigmas: (sigmas) => set({ sigmas, simResults: {} }),

      setWeights: (weights) => set({ weights, simResults: {} }),

      setTournamentStatus: (conferenceId, status) =>
        set((state) => {
          const tournament = state.tournaments[conferenceId];
          if (!tournament) return state;
          return {
            tournaments: {
              ...state.tournaments,
              [conferenceId]: { ...tournament, status },
            },
          };
        }),

      setTournamentResult: (conferenceId, result) =>
        set((state) => {
          const tournament = state.tournaments[conferenceId];
          if (!tournament) return state;

          // Snapshot model predictions if sim results exist
          const simResults = state.simResults[conferenceId];
          let enrichedResult = result;
          if (simResults && simResults.length > 0 && !result.modelSnapshot) {
            const topByEV = simResults.reduce((best, r) =>
              r.expectedValue > best.expectedValue ? r : best,
            );
            const winnerResult = simResults.find(
              (r) => r.teamName === result.winnerName,
            );
            enrichedResult = {
              ...result,
              modelSnapshot: {
                modelTopPick: topByEV.teamName,
                modelTopPickEV: topByEV.expectedValue,
                winnerWinProbability: winnerResult?.winProbability ?? 0,
                winnerEV: winnerResult?.expectedValue ?? 0,
              },
            };
          }

          return {
            tournaments: {
              ...state.tournaments,
              [conferenceId]: { ...tournament, result: enrichedResult, status: 'completed' },
            },
          };
        }),

      clearTournamentResult: (conferenceId) =>
        set((state) => {
          const tournament = state.tournaments[conferenceId];
          if (!tournament) return state;
          const { result: _, ...rest } = tournament;
          return {
            tournaments: {
              ...state.tournaments,
              [conferenceId]: { ...rest, status: 'upcoming' },
            },
          };
        }),

      setPick: (conferenceId, pick) =>
        set((state) => ({
          picks: { ...state.picks, [conferenceId]: pick },
        })),

      clearPick: (conferenceId) =>
        set((state) => {
          const newPicks = { ...state.picks };
          delete newPicks[conferenceId];
          return { picks: newPicks };
        }),

      setStrategyMode: (mode) => set({ strategyMode: mode }),

      setCompetitors: (competitors) => set({ competitors }),

      setOwnershipConfig: (config) => set({ ownershipConfig: config }),

      setOwnershipOverride: (conferenceId, teamName, ownership) =>
        set((state) => ({
          ownershipOverrides: {
            ...state.ownershipOverrides,
            [conferenceId]: {
              ...state.ownershipOverrides[conferenceId],
              [teamName]: ownership,
            },
          },
        })),

      clearOwnershipOverride: (conferenceId, teamName) =>
        set((state) => {
          const confOverrides = { ...state.ownershipOverrides[conferenceId] };
          delete confOverrides[teamName];
          const newOverrides = { ...state.ownershipOverrides };
          if (Object.keys(confOverrides).length === 0) {
            delete newOverrides[conferenceId];
          } else {
            newOverrides[conferenceId] = confOverrides;
          }
          return { ownershipOverrides: newOverrides };
        }),

      exportState: () => {
        const {
          tournaments, simResults, picks, sigmas, weights, simCount,
          strategyMode, competitors, ownershipConfig, ownershipOverrides,
        } = get();
        return JSON.stringify(
          {
            tournaments, simResults, picks, sigmas, weights, simCount,
            strategyMode, competitors, ownershipConfig, ownershipOverrides,
          },
          null,
          2,
        );
      },

      importState: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            tournaments: data.tournaments ?? initTournaments(),
            simResults: data.simResults ?? {},
            picks: data.picks ?? {},
            sigmas: data.sigmas ?? { ...DEFAULT_SIGMA },
            weights: data.weights ?? { ...DEFAULT_WEIGHTS },
            simCount: data.simCount ?? DEFAULT_SIM_COUNT,
            strategyMode: data.strategyMode ?? 'balanced',
            competitors: data.competitors ?? [],
            ownershipConfig: data.ownershipConfig ?? { ...DEFAULT_OWNERSHIP_CONFIG },
            ownershipOverrides: data.ownershipOverrides ?? {},
          });
        } catch (e) {
          console.error('[Store] Failed to import state:', e);
        }
      },
    }),
    {
      name: 'cbb-tourney-predictor',
      version: 5,
      partialize: (state) => ({
        tournaments: state.tournaments,
        simResults: state.simResults,
        picks: state.picks,
        sigmas: state.sigmas,
        weights: state.weights,
        simCount: state.simCount,
        strategyMode: state.strategyMode,
        competitors: state.competitors,
        ownershipConfig: state.ownershipConfig,
        ownershipOverrides: state.ownershipOverrides,
      }),
      migrate: () => ({
        tournaments: initTournaments(),
        simResults: {},
        picks: {},
        sigmas: { ...DEFAULT_SIGMA },
        weights: { ...DEFAULT_WEIGHTS },
        simCount: DEFAULT_SIM_COUNT,
        ownershipConfig: { ...DEFAULT_OWNERSHIP_CONFIG },
        ownershipOverrides: {},
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object) };
        // Reconcile tournaments with current conference metadata on every hydration
        if (merged.tournaments) {
          (merged as AppState).tournaments = reconcileTournaments(
            merged.tournaments as Record<string, ConferenceTournament>,
          );
        }
        return merged as AppState;
      },
    },
  ),
);
