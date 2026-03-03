import { useMemo } from 'react';
import { useAppStore } from '../../store';
import { computeFullStrategy } from '../../engine/strategy';
import { computeScoreProjection } from '../../engine/ev';
import type { StrategyMode, CompetitorEntry } from '../../models/types';
import WhatIfPanel from './WhatIfPanel';

const MODE_DESCRIPTIONS: Record<StrategyMode, string> = {
  balanced: 'EV-optimized with mild leverage bonus for contrarian picks.',
  aggressive: 'Maximize differentiation — high-seed upsets at low ownership for ceiling.',
  conservative: 'Match the field — minimize variance relative to other players.',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  lock: 'text-green-400 bg-green-900/40',
  lean: 'text-green-400/80 bg-green-900/30',
  coin_flip: 'text-yellow-400 bg-yellow-900/40',
  chaos: 'text-red-400 bg-red-900/40',
};

export default function StrategyDashboard() {
  const tournaments = useAppStore((s) => s.tournaments);
  const simResults = useAppStore((s) => s.simResults);
  const picks = useAppStore((s) => s.picks);
  const strategyMode = useAppStore((s) => s.strategyMode);
  const competitors = useAppStore((s) => s.competitors);
  const setStrategyMode = useAppStore((s) => s.setStrategyMode);
  const setCompetitors = useAppStore((s) => s.setCompetitors);
  const selectConference = useAppStore((s) => s.selectConference);
  const setActiveView = useAppStore((s) => s.setActiveView);

  const currentProjection = useMemo(
    () => computeScoreProjection(tournaments, picks, simResults),
    [tournaments, picks, simResults],
  );

  const ownershipConfig = useAppStore((s) => s.ownershipConfig);
  const ownershipOverrides = useAppStore((s) => s.ownershipOverrides);
  const ownershipConfigOverrides = useAppStore((s) => s.ownershipConfigOverrides);

  const strategy = useMemo(
    () =>
      computeFullStrategy(
        tournaments,
        simResults,
        picks,
        strategyMode,
        competitors.length > 0
          ? { myEarnedPoints: currentProjection.earnedPoints, competitors }
          : undefined,
        ownershipConfig,
        ownershipOverrides,
        ownershipConfigOverrides,
      ),
    [tournaments, simResults, picks, strategyMode, competitors, currentProjection.earnedPoints, ownershipConfig, ownershipOverrides, ownershipConfigOverrides],
  );

  const handleAddCompetitor = () => {
    if (competitors.length >= 5) return;
    setCompetitors([
      ...competitors,
      { label: `Rival ${competitors.length + 1}`, earnedPoints: 0 },
    ]);
  };

  const handleRemoveCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const handleUpdateCompetitor = (
    index: number,
    field: keyof CompetitorEntry,
    value: string | number,
  ) => {
    const updated = [...competitors];
    if (field === 'label') {
      updated[index] = { ...updated[index], label: value as string };
    } else {
      updated[index] = { ...updated[index], earnedPoints: value as number };
    }
    setCompetitors(updated);
  };

  const handleNavigateToConference = (conferenceId: string) => {
    setActiveView('conference');
    selectConference(conferenceId);
  };

  const aggressionColor =
    strategy.aggressionMultiplier > 1.3
      ? 'text-red-400'
      : strategy.aggressionMultiplier < 0.7
        ? 'text-blue-400'
        : 'text-gray-300';

  const simCount = Object.keys(simResults).length;

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-bold mb-1">Strategy Dashboard</h2>
      <p className="text-sm text-gray-500 mb-6">
        Game-theory-aware recommendations based on leaderboard position and field ownership.
      </p>

      {/* ---- Leaderboard Input ---- */}
      <section className="mb-6 p-4 rounded-lg bg-gray-900 border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Competitor Scores</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              Aggression:{' '}
              <span className={`font-mono font-semibold ${aggressionColor}`}>
                {strategy.aggressionMultiplier.toFixed(2)}x
              </span>
            </span>
            {competitors.length < 5 && (
              <button
                onClick={handleAddCompetitor}
                className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors"
              >
                + Add Competitor
              </button>
            )}
          </div>
        </div>

        {competitors.length === 0 ? (
          <p className="text-xs text-gray-600">
            Add competitor scores to enable position-aware strategy adjustments.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {competitors.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-gray-800/50 rounded px-2 py-1.5"
              >
                <input
                  type="text"
                  value={c.label}
                  onChange={(e) =>
                    handleUpdateCompetitor(i, 'label', e.target.value)
                  }
                  className="w-20 bg-transparent border-b border-gray-700 text-xs text-gray-300 focus:outline-none focus:border-blue-500 px-0"
                />
                <input
                  type="number"
                  value={c.earnedPoints}
                  onChange={(e) =>
                    handleUpdateCompetitor(
                      i,
                      'earnedPoints',
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className="w-14 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-gray-600">pts</span>
                <button
                  onClick={() => handleRemoveCompetitor(i)}
                  className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Strategy Mode Selector ---- */}
      <section className="mb-6">
        <div className="flex gap-2 mb-2">
          {(['balanced', 'aggressive', 'conservative'] as StrategyMode[]).map(
            (mode) => (
              <button
                key={mode}
                onClick={() => setStrategyMode(mode)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  strategyMode === mode
                    ? mode === 'aggressive'
                      ? 'bg-red-600 text-white'
                      : mode === 'conservative'
                        ? 'bg-blue-600 text-white'
                        : 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ),
          )}
        </div>
        <p className="text-xs text-gray-500">{MODE_DESCRIPTIONS[strategyMode]}</p>
      </section>

      {/* ---- Recommendations Table ---- */}
      {simCount === 0 ? (
        <div className="p-6 text-center text-gray-600 border border-gray-800 rounded-lg">
          Run simulations on conferences to see strategy recommendations.
        </div>
      ) : (
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Recommendations{' '}
            <span className="text-gray-600 font-normal">
              ({strategy.recommendations.length} tournaments)
            </span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-3 font-medium">Conference</th>
                  <th className="text-left py-2 pr-3 font-medium">Strategy Pick</th>
                  <th className="text-right py-2 pr-3 font-medium">Win %</th>
                  <th className="text-right py-2 pr-3 font-medium">EV</th>
                  <th className="text-right py-2 pr-3 font-medium">Own %</th>
                  <th className="text-center py-2 pr-3 font-medium">Conf</th>
                  <th className="text-left py-2 pr-3 font-medium">vs Balanced</th>
                  <th className="text-left py-2 font-medium">Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {strategy.recommendations.map((rec) => {
                  const pick = picks[rec.conferenceId];
                  const isPickDifferent =
                    pick && pick.pickedTeamName !== rec.topPick.teamName;
                  const confStyle =
                    CONFIDENCE_STYLES[rec.confidence] ?? CONFIDENCE_STYLES.chaos;
                  const sameAsBalanced =
                    rec.topPick.teamName === rec.balancedPick;

                  return (
                    <tr
                      key={rec.conferenceId}
                      onClick={() => handleNavigateToConference(rec.conferenceId)}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
                    >
                      <td className="py-2 pr-3">
                        <span className="text-gray-200">{rec.conferenceName}</span>
                        {isPickDifferent && (
                          <span className="ml-1.5 text-[10px] text-blue-400 bg-blue-900/40 px-1 py-0.5 rounded">
                            OVR
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="font-medium text-gray-200">
                          {rec.topPick.teamName}
                        </span>{' '}
                        <span className="text-gray-500">
                          ({rec.topPick.seed})
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-gray-300">
                        {(rec.topPick.winProbability * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-blue-400">
                        {rec.topPick.expectedValue.toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-gray-400">
                        {(rec.topPick.estimatedOwnership * 100).toFixed(0)}%
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <span
                          className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${confStyle}`}
                        >
                          {rec.confidence.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-gray-500 text-xs">
                        {sameAsBalanced ? (
                          <span className="text-gray-600">same</span>
                        ) : (
                          <span>{rec.balancedPick}</span>
                        )}
                      </td>
                      <td className="py-2 text-xs text-gray-500 max-w-xs truncate">
                        {rec.topPick.reasoning}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- Portfolio Summary ---- */}
      {strategy.recommendations.length > 0 && (
        <section className="mb-8 p-4 rounded-lg bg-gray-900 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">
            Portfolio Projection
            <span className="text-gray-600 font-normal ml-2">
              (using strategy picks where no manual pick exists)
            </span>
          </h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500">Projected Total:</span>{' '}
              <span
                className={`font-mono font-semibold ${
                  strategy.portfolioProjection.totalProjected >= 45
                    ? 'text-green-400'
                    : strategy.portfolioProjection.totalProjected >= 35
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                }`}
              >
                {strategy.portfolioProjection.totalProjected}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Range:</span>{' '}
              <span className="font-mono text-gray-300">
                {strategy.portfolioProjection.floor}–
                {strategy.portfolioProjection.ceiling}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Earned:</span>{' '}
              <span className="font-mono text-gray-300">
                {strategy.portfolioProjection.earnedPoints}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Target:</span>{' '}
              <span className="font-mono text-yellow-400/70">45-50</span>
            </div>
          </div>
        </section>
      )}

      {/* ---- What-If Panel ---- */}
      <WhatIfPanel />
    </div>
  );
}
