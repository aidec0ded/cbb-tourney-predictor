import { useMemo, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../store';
import { getByeSeeds } from '../../engine/bracket';
import type { WorkerResponse } from '../../workers/simulation.worker';
import { buildPickFromSelection, getModelRecommendation } from '../../engine/ev';
import type { ModelRecommendation } from '../../engine/ev';
import { computeWhatIf, getStrategyRecommendation, estimateOwnership } from '../../engine/strategy';
import ResultsTable from '../common/ResultsTable';
import ProbabilityChart from '../common/ProbabilityChart';
import TeamInputTable from './TeamInputTable';
import BulkPasteArea from './BulkPasteArea';
import PickPanel from './PickPanel';
import SystemComparison from './SystemComparison';

interface Props {
  conferenceId: string;
}

export default function TournamentDetail({ conferenceId }: Props) {
  const tournaments = useAppStore((s) => s.tournaments);
  const allSimResults = useAppStore((s) => s.simResults);
  const allPicks = useAppStore((s) => s.picks);
  const tournament = tournaments[conferenceId];
  const results = allSimResults[conferenceId] ?? null;
  const pick = allPicks[conferenceId];
  const simCount = useAppStore((s) => s.simCount);
  const simulatingId = useAppStore((s) => s.simulatingId);
  const setSimCount = useAppStore((s) => s.setSimCount);
  const setSimResults = useAppStore((s) => s.setSimResults);
  const setSimulating = useAppStore((s) => s.setSimulating);
  const setPick = useAppStore((s) => s.setPick);
  const clearPick = useAppStore((s) => s.clearPick);
  const sigmas = useAppStore((s) => s.sigmas);
  const weights = useAppStore((s) => s.weights);
  const setTournamentResult = useAppStore((s) => s.setTournamentResult);
  const clearTournamentResult = useAppStore((s) => s.clearTournamentResult);
  const ownershipConfig = useAppStore((s) => s.ownershipConfig);
  const ownershipOverrides = useAppStore((s) => s.ownershipOverrides);

  // Results entry state
  const [selectedWinner, setSelectedWinner] = useState('');
  // Simulation progress
  const [simProgress, setSimProgress] = useState(0);
  const workerRef = useRef<Worker | null>(null);

  if (!tournament) return null;

  const running = simulatingId === conferenceId;
  const teamCount = tournament.teams.length;
  const bracketType = tournament.bracketType ?? 'standard';
  const byeSeeds = getByeSeeds(teamCount, bracketType);
  const isCompleted = tournament.status === 'completed';

  const strategyMode = useAppStore((s) => s.strategyMode);
  const [recMode, setRecMode] = useState<'ev' | 'strategy'>('ev');

  // Enrich results with ownership
  const confOverrides = ownershipOverrides[conferenceId];
  const enrichedResults = useMemo(() => {
    if (!results) return null;
    return estimateOwnership(results, ownershipConfig, confOverrides);
  }, [results, ownershipConfig, confOverrides]);

  const evRec = enrichedResults ? getModelRecommendation(enrichedResults) : null;

  const strategyRec: ModelRecommendation | null = useMemo(() => {
    if (!results || results.length === 0) return null;
    const strat = getStrategyRecommendation(
      conferenceId,
      tournament.name,
      results,
      strategyMode,
      1.0,
      ownershipConfig,
      confOverrides,
    );
    const top = strat.topPick;
    return {
      teamName: top.teamName,
      seed: top.seed,
      ev: top.expectedValue,
      confidence: strat.confidence,
    };
  }, [results, conferenceId, tournament.name, strategyMode, ownershipConfig, confOverrides]);

  const activeRec = recMode === 'strategy' ? strategyRec : evRec;
  const recLabel = recMode === 'strategy'
    ? `Strategy: ${strategyMode}`
    : 'Pure EV';

  // Extract picked ownership
  const pickedOwnership = useMemo(() => {
    if (!enrichedResults || !pick) return undefined;
    const found = enrichedResults.find((r) => r.teamName === pick.pickedTeamName);
    return found?.estimatedOwnership;
  }, [enrichedResults, pick]);

  const handleRun = useCallback(() => {
    const valid = tournament.teams.every((t) => t.name.trim().length > 0);
    if (!valid) {
      alert('Please enter a name for every team.');
      return;
    }

    // Terminate any previous worker
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    setSimulating(conferenceId);
    setSimProgress(0);

    const worker = new Worker(
      new URL('../../workers/simulation.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    const t0 = performance.now();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;

      if (msg.type === 'progress') {
        setSimProgress(msg.total > 0 ? msg.completed / msg.total : 0);
      } else if (msg.type === 'result') {
        const elapsed = (performance.now() - t0).toFixed(0);
        console.log(
          `[Sim] ${tournament.name}: ${simCount} sims in ${elapsed}ms (worker)`,
        );

        setSimResults(conferenceId, msg.output.teamResults);
        setSimProgress(1);

        // Rebuild existing pick with updated sim results
        const currentPick = useAppStore.getState().picks[conferenceId];
        if (currentPick) {
          const rebuilt = buildPickFromSelection(
            conferenceId,
            currentPick.pickedTeamName,
            currentPick.pickedSeed,
            msg.output.teamResults,
          );
          setPick(conferenceId, rebuilt);
        }

        setSimulating(null);
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === 'error') {
        console.error('[Sim] Worker error:', msg.message);
        alert(`Simulation error: ${msg.message}`);
        setSimulating(null);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (err) => {
      console.error('[Sim] Worker crashed:', err);
      alert('Simulation worker crashed. Check console for details.');
      setSimulating(null);
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({
      type: 'run',
      input: {
        teams: tournament.teams,
        bracket: tournament.bracket,
        numSimulations: simCount,
        weights,
        sigmas,
      },
    });
  }, [tournament, conferenceId, simCount, weights, sigmas, setSimResults, setPick, setSimulating]);

  const handlePick = (teamName: string, seed: number) => {
    if (!results) return;
    const newPick = buildPickFromSelection(conferenceId, teamName, seed, results);
    setPick(conferenceId, newPick);
  };

  const handleClearPick = () => {
    clearPick(conferenceId);
  };

  const handleUpdateNotes = (notes: string) => {
    if (!pick) return;
    setPick(conferenceId, { ...pick, notes: notes || undefined });
  };

  const handleSaveResult = () => {
    if (!selectedWinner) return;
    const team = tournament.teams.find((t) => t.name === selectedWinner);
    if (!team) return;
    setTournamentResult(conferenceId, {
      winnerName: team.name,
      winningSeed: team.seed,
    });
    setSelectedWinner('');
  };

  const handleResetResult = () => {
    clearTournamentResult(conferenceId);
  };

  const namedTeams = tournament.teams.filter((t) => t.name.trim().length > 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">{tournament.name} Tournament</h2>
        <p className="text-sm text-gray-400 mt-1">
          {teamCount} teams · Starts {tournament.startDate}
          {bracketType === 'stairway' ? (
            <> · Stairway format (seeds 1-2 enter in semis)</>
          ) : bracketType === 'double_bye' ? (
            <> · Seeds 1-4 get double byes</>
          ) : bracketType === 'swac_hybrid' ? (
            <> · Hybrid format (seeds 1-2 double byes, play-in chains)</>
          ) : byeSeeds.length > 0 ? (
            <> · Seeds {byeSeeds.join(', ')} get byes</>
          ) : null}
          {tournament.bracket.reseedBeforeRounds && tournament.bracket.reseedBeforeRounds.length > 0 && (
            <> · Reseeded after round {tournament.bracket.reseedBeforeRounds.map(r => r).join(', ')}</>
          )}
        </p>
      </div>

      {/* Results entry */}
      {isCompleted ? (
        <div className="mb-4 p-3 rounded-lg bg-green-900/20 border border-green-800/40 text-sm flex items-center gap-3">
          <span className="text-green-400 font-medium">Completed</span>
          <span className="text-gray-400">—</span>
          <span className="text-gray-200">
            Winner: {tournament.result?.winnerName} (seed {tournament.result?.winningSeed})
          </span>
          <button
            onClick={handleResetResult}
            className="ml-auto text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Reset result
          </button>
        </div>
      ) : namedTeams.length > 0 ? (
        <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-sm flex items-center gap-3">
          <span className="text-gray-400 text-xs">Record result:</span>
          <select
            value={selectedWinner}
            onChange={(e) => setSelectedWinner(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select winner...</option>
            {namedTeams.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} (seed {t.seed})
              </option>
            ))}
          </select>
          <button
            onClick={handleSaveResult}
            disabled={!selectedWinner}
            className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-medium transition-colors"
          >
            Save
          </button>
        </div>
      ) : null}

      {/* Bulk paste */}
      <BulkPasteArea conferenceId={conferenceId} />

      {/* Team input */}
      <section className="mb-6">
        <TeamInputTable conferenceId={conferenceId} />
      </section>

      {/* Simulation controls */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm text-gray-400">
          Simulations:
          <input
            type="number"
            className="ml-2 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 w-28 focus:outline-none focus:border-blue-500"
            value={simCount}
            onChange={(e) =>
              setSimCount(parseInt(e.target.value) || 10_000)
            }
          />
        </label>
        <button
          onClick={handleRun}
          disabled={running}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
        >
          {running ? 'Running...' : 'Run Simulation'}
        </button>
        {running && (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-150"
                style={{ width: `${Math.round(simProgress * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-mono w-10 text-right">
              {Math.round(simProgress * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Recommendation mode toggle + Pick panel */}
      {enrichedResults && (
        <div className="mb-2 flex items-center gap-3">
          <span className="text-xs text-gray-500">Recommendation:</span>
          <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
            <button
              onClick={() => setRecMode('ev')}
              className={`px-2.5 py-1 transition-colors ${
                recMode === 'ev'
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              Pure EV
            </button>
            <button
              onClick={() => setRecMode('strategy')}
              className={`px-2.5 py-1 border-l border-gray-700 transition-colors ${
                recMode === 'strategy'
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              Strategy
            </button>
          </div>
          {recMode === 'strategy' && (
            <span className="text-[10px] text-gray-500">
              mode: <span className="text-gray-400">{strategyMode}</span>
            </span>
          )}
        </div>
      )}
      <PickPanel
        tournament={tournament}
        results={enrichedResults}
        pick={pick}
        onClearPick={handleClearPick}
        onUpdateNotes={handleUpdateNotes}
        recommendation={activeRec}
        recLabel={recLabel}
        pickedOwnership={pickedOwnership}
      />

      {/* Inline what-if preview */}
      <InlineWhatIf
        conferenceId={conferenceId}
        results={results}
        pick={pick}
        tournaments={tournaments}
        allPicks={allPicks}
        allSimResults={allSimResults}
        isCompleted={isCompleted}
      />

      {/* Results */}
      {enrichedResults && (
        <section>
          <h3 className="text-lg font-semibold mb-3">Simulation Results</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResultsTable
              results={enrichedResults}
              onPick={!isCompleted ? handlePick : undefined}
              pickedTeamName={pick?.pickedTeamName}
              modelRecommendation={activeRec?.teamName}
              showOwnership
            />
            <ProbabilityChart results={enrichedResults} />
          </div>
        </section>
      )}

      {/* Per-system comparison */}
      <SystemComparison
        teams={tournament.teams}
        sigmas={sigmas}
        blendedResults={enrichedResults}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline what-if preview — shows top 2-3 alternatives below the pick panel
// ---------------------------------------------------------------------------

import type {
  ConferenceTournament,
  TeamSimulationResult,
  TournamentPick,
} from '../../models/types';

function InlineWhatIf({
  conferenceId,
  results,
  pick,
  tournaments,
  allPicks,
  allSimResults,
  isCompleted,
}: {
  conferenceId: string;
  results: TeamSimulationResult[] | null;
  pick: TournamentPick | undefined;
  tournaments: Record<string, ConferenceTournament>;
  allPicks: Record<string, TournamentPick>;
  allSimResults: Record<string, TeamSimulationResult[]>;
  isCompleted: boolean;
}) {
  const alternatives = useMemo(() => {
    if (!results || isCompleted) return [];

    // Get top alternatives by EV, excluding current pick
    return results
      .filter((r) => !pick || r.teamName !== pick.pickedTeamName)
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, 3);
  }, [results, pick, isCompleted]);

  const whatIfs = useMemo(() => {
    return alternatives.map((alt) =>
      computeWhatIf(
        tournaments,
        allPicks,
        allSimResults,
        conferenceId,
        alt.teamName,
        alt.seed,
      ),
    );
  }, [alternatives, tournaments, allPicks, allSimResults, conferenceId]);

  if (alternatives.length === 0) return null;

  return (
    <div className="mb-6 text-sm">
      <h4 className="text-xs font-medium text-gray-500 mb-1.5">
        What if you pick...
      </h4>
      <div className="flex flex-wrap gap-2">
        {whatIfs.map((wi) => {
          const deltaColor =
            wi.deltaProjected > 0
              ? 'text-green-400'
              : wi.deltaProjected < 0
                ? 'text-red-400'
                : 'text-gray-500';

          return (
            <div
              key={wi.newPick.teamName}
              className="px-2.5 py-1.5 rounded bg-gray-800/50 border border-gray-700/50 flex items-center gap-2"
            >
              <span className="text-gray-300">
                {wi.newPick.teamName}
              </span>
              <span className="text-gray-600">
                ({wi.newPick.seed})
              </span>
              <span className={`font-mono text-xs ${deltaColor}`}>
                {wi.deltaProjected > 0 ? '+' : ''}
                {wi.deltaProjected} proj
              </span>
              {wi.deltaCeiling !== 0 && (
                <span
                  className={`font-mono text-xs ${
                    wi.deltaCeiling > 0 ? 'text-green-400/60' : 'text-red-400/60'
                  }`}
                >
                  {wi.deltaCeiling > 0 ? '+' : ''}
                  {wi.deltaCeiling} ceil
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
