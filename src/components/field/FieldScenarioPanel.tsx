import { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import { computeFieldScenario } from '../../engine/field';
import { CONFERENCES } from '../../data/conferences';

export default function FieldScenarioPanel() {
  const fieldCompetitors = useAppStore((s) => s.fieldCompetitors);
  const tournaments = useAppStore((s) => s.tournaments);
  const simResults = useAppStore((s) => s.simResults);
  const picks = useAppStore((s) => s.picks);
  const userName = useAppStore((s) => s.userName);

  const [selectedConference, setSelectedConference] = useState('');
  const [selectedWinner, setSelectedWinner] = useState('');

  // Only show conferences that are not yet completed
  const availableConferences = useMemo(
    () => CONFERENCES.filter((c) => tournaments[c.id]?.status !== 'completed'),
    [tournaments],
  );

  const tournament = selectedConference ? tournaments[selectedConference] : null;
  const namedTeams = tournament?.teams.filter((t) => t.name.trim()) ?? [];

  const scenario = useMemo(() => {
    if (!selectedConference || !selectedWinner || fieldCompetitors.length === 0) return null;

    const team = tournament?.teams.find((t) => t.name === selectedWinner);
    if (!team) return null;

    return computeFieldScenario(
      fieldCompetitors,
      tournaments,
      simResults,
      picks,
      selectedConference,
      selectedWinner,
      team.seed,
      userName,
    );
  }, [selectedConference, selectedWinner, fieldCompetitors, tournaments, simResults, picks, userName, tournament]);

  if (fieldCompetitors.length === 0) return null;

  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Scenario Analysis
        <span className="text-gray-600 font-normal ml-2">
          "If team X wins conference Y..."
        </span>
      </h3>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={selectedConference}
          onChange={(e) => { setSelectedConference(e.target.value); setSelectedWinner(''); }}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">Select conference...</option>
          {availableConferences.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {selectedConference && namedTeams.length > 0 && (
          <select
            value={selectedWinner}
            onChange={(e) => setSelectedWinner(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select winner...</option>
            {namedTeams.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} (seed {t.seed})
              </option>
            ))}
          </select>
        )}
      </div>

      {scenario && (
        <div className="rounded-lg bg-gray-900 border border-gray-800 p-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs">
            <div className="px-3 py-1.5 rounded bg-gray-800/50">
              <span className="text-gray-500">Picked by:</span>{' '}
              <span className="font-mono text-gray-200">
                {scenario.benefitCount} of {fieldCompetitors.length}
              </span>
              <span className="text-gray-500 ml-1">
                ({(scenario.benefitCount / fieldCompetitors.length * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="px-3 py-1.5 rounded bg-gray-800/50">
              <span className="text-gray-500">Points earned:</span>{' '}
              <span className="font-mono text-gray-200">{scenario.winningSeed}</span>
            </div>
            <div className="px-3 py-1.5 rounded bg-gray-800/50">
              <span className="text-gray-500">Your rank:</span>{' '}
              <span className={`font-mono font-semibold ${
                scenario.userRank <= 3 ? 'text-green-400' : scenario.userRank <= 10 ? 'text-yellow-400' : 'text-gray-200'
              }`}>
                {scenario.userRank}/{scenario.leaderboard.length}
              </span>
            </div>
          </div>

          {/* Top 10 + user leaderboard */}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-1.5 pr-2 font-medium w-8">#</th>
                <th className="text-left py-1.5 pr-3 font-medium">Name</th>
                <th className="text-right py-1.5 pr-3 font-medium">Earned</th>
                <th className="text-right py-1.5 pr-3 font-medium">Projected</th>
                <th className="text-right py-1.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {scenario.leaderboard.slice(0, 10).map((entry, idx) => {
                const isUser = entry.name === userName;
                return (
                  <tr
                    key={entry.name}
                    className={`border-b border-gray-800/30 ${
                      isUser ? 'bg-indigo-900/20' : idx < 3 ? 'bg-green-900/5' : ''
                    }`}
                  >
                    <td className="py-1.5 pr-2 font-mono text-gray-500">
                      {idx + 1 <= 3 ? (
                        <span className="text-green-400 font-semibold">{idx + 1}</span>
                      ) : idx + 1}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className={isUser ? 'font-semibold text-indigo-300' : 'text-gray-200'}>
                        {entry.name}
                      </span>
                      {isUser && (
                        <span className="ml-1 text-[9px] text-indigo-400 bg-indigo-900/40 px-1 py-0.5 rounded">YOU</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono text-gray-300">{entry.earnedPoints}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-gray-400">
                      {entry.projectedPoints > 0 ? `+${entry.projectedPoints}` : '—'}
                    </td>
                    <td className="py-1.5 text-right font-mono font-semibold text-gray-200">{entry.totalProjected}</td>
                  </tr>
                );
              })}
              {/* Show user if outside top 10 */}
              {scenario.userRank > 10 && (
                <>
                  <tr>
                    <td colSpan={5} className="py-0.5 text-center text-gray-700 text-[10px]">...</td>
                  </tr>
                  <tr className="bg-indigo-900/20 border-b border-gray-800/30">
                    <td className="py-1.5 pr-2 font-mono text-gray-500">{scenario.userRank}</td>
                    <td className="py-1.5 pr-3">
                      <span className="font-semibold text-indigo-300">{userName}</span>
                      <span className="ml-1 text-[9px] text-indigo-400 bg-indigo-900/40 px-1 py-0.5 rounded">YOU</span>
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono text-gray-300">
                      {scenario.leaderboard[scenario.userRank - 1]?.earnedPoints ?? 0}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono text-gray-400">
                      {(scenario.leaderboard[scenario.userRank - 1]?.projectedPoints ?? 0) > 0
                        ? `+${scenario.leaderboard[scenario.userRank - 1]?.projectedPoints}`
                        : '—'}
                    </td>
                    <td className="py-1.5 text-right font-mono font-semibold text-gray-200">
                      {scenario.leaderboard[scenario.userRank - 1]?.totalProjected ?? 0}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
