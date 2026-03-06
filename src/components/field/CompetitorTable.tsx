import { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import { computeCompetitorScores, classifyAllCompetitors } from '../../engine/field';
import { computeScoreProjection } from '../../engine/ev';
import CompetitorProfileBadge from './CompetitorProfileBadge';
import type { CompetitorScoreProjection } from '../../models/types';
import { CONFERENCES } from '../../data/conferences';

export default function CompetitorTable() {
  const fieldCompetitors = useAppStore((s) => s.fieldCompetitors);
  const tournaments = useAppStore((s) => s.tournaments);
  const simResults = useAppStore((s) => s.simResults);
  const picks = useAppStore((s) => s.picks);
  const userName = useAppStore((s) => s.userName);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Classify competitors with updated profiles
  const classifiedCompetitors = useMemo(
    () => classifyAllCompetitors(fieldCompetitors, simResults),
    [fieldCompetitors, simResults],
  );

  // Compute competitor scores
  const scores = useMemo(
    () => computeCompetitorScores(classifiedCompetitors, tournaments, simResults),
    [classifiedCompetitors, tournaments, simResults],
  );

  // Compute user score for insertion
  const userProjection = useMemo(
    () => computeScoreProjection(tournaments, picks, simResults),
    [tournaments, picks, simResults],
  );

  // Build full leaderboard with user
  const leaderboard = useMemo(() => {
    const userEntry: CompetitorScoreProjection = {
      name: userName,
      earnedPoints: userProjection.earnedPoints,
      projectedPoints: userProjection.projectedPoints,
      totalProjected: userProjection.totalProjected,
      resolvedPicks: userProjection.completedWithPick,
      correctPicks: userProjection.correctPicks,
      unresolvedPicks: userProjection.remainingPicked,
      profile: 'analytics',
    };
    return [...scores, userEntry].sort((a, b) => b.totalProjected - a.totalProjected);
  }, [scores, userName, userProjection]);

  if (fieldCompetitors.length === 0) {
    return (
      <div className="p-6 text-center text-gray-600 border border-gray-800 rounded-lg text-sm">
        Import competitor picks to see the leaderboard.
      </div>
    );
  }

  // Build conference name lookup
  const confNames = new Map(CONFERENCES.map((c) => [c.id, c.name]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800">
            <th className="text-left py-2 pr-2 font-medium w-10">#</th>
            <th className="text-left py-2 pr-3 font-medium">Name</th>
            <th className="text-right py-2 pr-3 font-medium">Earned</th>
            <th className="text-right py-2 pr-3 font-medium">Projected</th>
            <th className="text-right py-2 pr-3 font-medium">Total</th>
            <th className="text-center py-2 pr-3 font-medium">Profile</th>
            <th className="text-right py-2 font-medium">Record</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.flatMap((entry, idx) => {
            const rank = idx + 1;
            const isUser = entry.name === userName;
            const isExpanded = expandedRow === entry.name;
            const competitor = classifiedCompetitors.find((c) => c.name === entry.name);

            let rowClass = 'border-b border-gray-800/50 transition-colors';
            if (isUser) {
              rowClass += ' bg-indigo-900/20 border-l-2 border-l-indigo-400';
            } else if (rank <= 3) {
              rowClass += ' bg-green-900/10';
            }
            if (!isUser) {
              rowClass += ' cursor-pointer hover:bg-gray-800/30';
            }

            const rows = [
              <tr
                key={entry.name}
                className={rowClass}
                onClick={!isUser && competitor ? () => setExpandedRow(isExpanded ? null : entry.name) : undefined}
              >
                <td className="py-2 pr-2 font-mono text-gray-500">
                  {rank <= 3 ? (
                    <span className="text-green-400 font-semibold">{rank}</span>
                  ) : (
                    rank
                  )}
                </td>
                <td className="py-2 pr-3">
                  <span className={isUser ? 'font-semibold text-indigo-300' : 'text-gray-200'}>
                    {entry.name}
                  </span>
                  {isUser && (
                    <span className="ml-1.5 text-[10px] text-indigo-400 bg-indigo-900/40 px-1 py-0.5 rounded">
                      YOU
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-gray-300">
                  {entry.earnedPoints}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-gray-400">
                  {entry.projectedPoints > 0 ? `+${entry.projectedPoints}` : '—'}
                </td>
                <td className="py-2 pr-3 text-right font-mono font-semibold">
                  <span className={entry.totalProjected >= 45 ? 'text-green-400' : entry.totalProjected >= 35 ? 'text-yellow-400' : 'text-gray-300'}>
                    {entry.totalProjected}
                  </span>
                </td>
                <td className="py-2 pr-3 text-center">
                  <CompetitorProfileBadge
                    profile={entry.profile}
                    confidence={competitor?.profileConfidence ?? 0.5}
                  />
                </td>
                <td className="py-2 text-right font-mono text-gray-400 text-xs">
                  {entry.correctPicks}/{entry.resolvedPicks + entry.unresolvedPicks}
                </td>
              </tr>,
            ];

            if (isExpanded && competitor) {
              rows.push(
                <tr key={`${entry.name}-detail`}>
                  <td colSpan={7} className="py-2 px-4 bg-gray-900/50">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(competitor.picks)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([confId, pick]) => {
                          const tournament = tournaments[confId];
                          const isCorrect = tournament?.status === 'completed' &&
                            tournament.result?.winnerName === pick.teamName;
                          const isIncorrect = tournament?.status === 'completed' &&
                            tournament.result?.winnerName !== pick.teamName;

                          return (
                            <div
                              key={confId}
                              className={`px-2 py-1 rounded text-xs border ${
                                isCorrect
                                  ? 'border-green-800/50 bg-green-900/20 text-green-400'
                                  : isIncorrect
                                    ? 'border-red-800/50 bg-red-900/20 text-red-400 line-through'
                                    : 'border-gray-700/50 bg-gray-800/30 text-gray-300'
                              }`}
                            >
                              <span className="text-gray-500">{confNames.get(confId) ?? confId}:</span>{' '}
                              {pick.teamName} ({pick.seed})
                            </div>
                          );
                        })}
                    </div>
                  </td>
                </tr>,
              );
            }

            return rows;
          })}
        </tbody>
      </table>
    </div>
  );
}
