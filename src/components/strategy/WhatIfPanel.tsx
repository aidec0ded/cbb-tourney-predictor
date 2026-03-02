import { useMemo, useState } from 'react';
import { useAppStore } from '../../store';
import { computeWhatIf } from '../../engine/strategy';

export default function WhatIfPanel() {
  const tournaments = useAppStore((s) => s.tournaments);
  const simResults = useAppStore((s) => s.simResults);
  const picks = useAppStore((s) => s.picks);

  // Only conferences that have sim results and are not completed
  const eligibleConferences = useMemo(() => {
    return Object.values(tournaments)
      .filter((t) => t.status !== 'completed' && simResults[t.id]?.length)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [tournaments, simResults]);

  const [selectedConf, setSelectedConf] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  const confResults = selectedConf ? simResults[selectedConf] : null;
  const currentPick = selectedConf ? picks[selectedConf] : undefined;

  // Available teams (exclude current pick)
  const alternativeTeams = useMemo(() => {
    if (!confResults) return [];
    return confResults
      .filter((r) => !currentPick || r.teamName !== currentPick.pickedTeamName)
      .sort((a, b) => b.expectedValue - a.expectedValue);
  }, [confResults, currentPick]);

  const whatIfResult = useMemo(() => {
    if (!selectedConf || !selectedTeam) return null;
    const team = confResults?.find((r) => r.teamName === selectedTeam);
    if (!team) return null;
    return computeWhatIf(
      tournaments,
      picks,
      simResults,
      selectedConf,
      team.teamName,
      team.seed,
    );
  }, [selectedConf, selectedTeam, tournaments, picks, simResults, confResults]);

  const handleConfChange = (confId: string) => {
    setSelectedConf(confId);
    setSelectedTeam('');
  };

  if (eligibleConferences.length === 0) {
    return null;
  }

  return (
    <section className="p-4 rounded-lg bg-gray-900 border border-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">What-If Scenarios</h3>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        {/* Conference selector */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Conference</label>
          <select
            value={selectedConf}
            onChange={(e) => handleConfChange(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select...</option>
            {eligibleConferences.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Current pick display */}
        {selectedConf && (
          <div className="text-sm">
            <span className="text-xs text-gray-500 block mb-1">Current Pick</span>
            {currentPick ? (
              <span className="text-gray-300">
                {currentPick.pickedTeamName}{' '}
                <span className="text-gray-500">(seed {currentPick.pickedSeed})</span>
              </span>
            ) : (
              <span className="text-gray-600 italic">None</span>
            )}
          </div>
        )}

        {/* Team selector */}
        {selectedConf && alternativeTeams.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Switch to
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">Select team...</option>
              {alternativeTeams.map((t) => (
                <option key={t.teamName} value={t.teamName}>
                  {t.teamName} (seed {t.seed}, {(t.winProbability * 100).toFixed(1)}%)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* What-if result */}
      {whatIfResult && (
        <div className="p-3 rounded bg-gray-800/50 border border-gray-700/50">
          <div className="flex flex-wrap gap-6 text-sm mb-2">
            <div>
              <span className="text-gray-500">Projected delta:</span>{' '}
              <span
                className={`font-mono font-semibold ${
                  whatIfResult.deltaProjected > 0
                    ? 'text-green-400'
                    : whatIfResult.deltaProjected < 0
                      ? 'text-red-400'
                      : 'text-gray-400'
                }`}
              >
                {whatIfResult.deltaProjected > 0 ? '+' : ''}
                {whatIfResult.deltaProjected}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Ceiling delta:</span>{' '}
              <span
                className={`font-mono font-semibold ${
                  whatIfResult.deltaCeiling > 0
                    ? 'text-green-400'
                    : whatIfResult.deltaCeiling < 0
                      ? 'text-red-400'
                      : 'text-gray-400'
                }`}
              >
                {whatIfResult.deltaCeiling > 0 ? '+' : ''}
                {whatIfResult.deltaCeiling}
              </span>
            </div>
            <div>
              <span className="text-gray-500">New projected total:</span>{' '}
              <span className="font-mono text-gray-200">
                {whatIfResult.newProjection.totalProjected}
              </span>
            </div>
          </div>
          <p
            className={`text-xs ${
              whatIfResult.deltaProjected > 0
                ? 'text-green-400/80'
                : whatIfResult.deltaProjected < 0
                  ? 'text-red-400/80'
                  : 'text-yellow-400/80'
            }`}
          >
            {whatIfResult.riskAssessment}
          </p>
        </div>
      )}
    </section>
  );
}
