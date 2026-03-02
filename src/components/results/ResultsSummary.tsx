import { useMemo } from 'react';
import { useAppStore } from '../../store';
import { computeScoreProjection } from '../../engine/ev';
import type {
  ConferenceTournament,
  TournamentPick,
  TeamSimulationResult,
} from '../../models/types';

export default function ResultsSummary() {
  const tournaments = useAppStore((s) => s.tournaments);
  const picks = useAppStore((s) => s.picks);
  const simResults = useAppStore((s) => s.simResults);
  const selectConference = useAppStore((s) => s.selectConference);
  const setActiveView = useAppStore((s) => s.setActiveView);

  const projection = useMemo(
    () => computeScoreProjection(tournaments, picks, simResults),
    [tournaments, picks, simResults],
  );

  const allTournaments = useMemo(
    () =>
      Object.values(tournaments).sort((a, b) =>
        a.startDate.localeCompare(b.startDate),
      ),
    [tournaments],
  );

  const completed = allTournaments.filter((t) => t.status === 'completed');
  const pending = allTournaments.filter((t) => t.status !== 'completed');

  const handleNavigate = (conferenceId: string) => {
    setActiveView('conference');
    selectConference(conferenceId);
  };

  // Accuracy metrics
  const totalCompleted = completed.length;
  const correctCount = completed.filter((t) => {
    const p = picks[t.id];
    return p && t.result && p.pickedTeamName === t.result.winnerName;
  }).length;
  const accuracy = totalCompleted > 0 ? (correctCount / totalCompleted * 100).toFixed(0) : '—';

  const pointsEarned = projection.earnedPoints;
  const pointsPossible = completed.reduce((sum, t) => {
    const p = picks[t.id];
    return sum + (p ? p.pickedSeed : 0);
  }, 0);

  const avgSeedPicked = (() => {
    const pickedSeeds = Object.values(picks).map((p) => p.pickedSeed);
    return pickedSeeds.length > 0
      ? (pickedSeeds.reduce((a, b) => a + b, 0) / pickedSeeds.length).toFixed(1)
      : '—';
  })();

  const avgWinningSeed = (() => {
    const seeds = completed
      .filter((t) => t.result)
      .map((t) => t.result!.winningSeed);
    return seeds.length > 0
      ? (seeds.reduce((a, b) => a + b, 0) / seeds.length).toFixed(1)
      : '—';
  })();

  // Model accuracy metrics (from snapshots)
  const withSnapshots = completed.filter((t) => t.result?.modelSnapshot);
  const modelCorrectCount = withSnapshots.filter(
    (t) => t.result!.modelSnapshot!.modelTopPick === t.result!.winnerName,
  ).length;
  const avgWinnerProb = (() => {
    if (withSnapshots.length === 0) return null;
    const sum = withSnapshots.reduce(
      (s, t) => s + t.result!.modelSnapshot!.winnerWinProbability,
      0,
    );
    return sum / withSnapshots.length;
  })();

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-bold mb-1">Results Summary</h2>
      <p className="text-sm text-gray-500 mb-6">
        Track accuracy and points across all tournaments.
      </p>

      {/* Accuracy stats bar */}
      <div className="mb-6 p-4 rounded-lg bg-gray-900 border border-gray-800 flex flex-wrap gap-6 text-sm">
        <Stat label="Correct" value={`${correctCount}/${totalCompleted}`} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
        <Stat label="Pts Earned" value={String(pointsEarned)} color="text-green-400" />
        <Stat label="Pts Possible" value={String(pointsPossible)} />
        <Stat label="Avg Seed Picked" value={avgSeedPicked} />
        <Stat label="Avg Winning Seed" value={avgWinningSeed} />
      </div>

      {/* Model accuracy bar */}
      {withSnapshots.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-gray-900 border border-gray-800">
          <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
            Model Calibration
          </h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <Stat
              label="Model Top Pick Won"
              value={`${modelCorrectCount}/${withSnapshots.length}`}
            />
            <Stat
              label="Model Accuracy"
              value={`${(modelCorrectCount / withSnapshots.length * 100).toFixed(0)}%`}
            />
            {avgWinnerProb !== null && (
              <Stat
                label="Avg Winner Prob"
                value={`${(avgWinnerProb * 100).toFixed(1)}%`}
                color={avgWinnerProb >= 0.3 ? 'text-green-400' : 'text-yellow-400'}
              />
            )}
          </div>
        </div>
      )}

      {/* Completed tournaments table */}
      {completed.length > 0 && (
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Completed Tournaments{' '}
            <span className="text-gray-600 font-normal">({completed.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-3 font-medium">Conference</th>
                  <th className="text-left py-2 pr-3 font-medium">Winner</th>
                  <th className="text-right py-2 pr-3 font-medium">Seed</th>
                  <th className="text-left py-2 pr-3 font-medium">Your Pick</th>
                  <th className="text-center py-2 pr-3 font-medium">Correct?</th>
                  <th className="text-right py-2 pr-3 font-medium">Points</th>
                  <th className="text-left py-2 pr-3 font-medium">Model Rec</th>
                  <th className="text-right py-2 pr-3 font-medium">Win Prob</th>
                  <th className="text-center py-2 font-medium">Override?</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((t) => (
                  <CompletedRow
                    key={t.id}
                    tournament={t}
                    pick={picks[t.id]}
                    onNavigate={handleNavigate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pending tournaments table */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Pending Tournaments{' '}
            <span className="text-gray-600 font-normal">({pending.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-3 font-medium">Conference</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="text-left py-2 pr-3 font-medium">Your Pick</th>
                  <th className="text-right py-2 pr-3 font-medium">Seed</th>
                  <th className="text-right py-2 pr-3 font-medium">Win%</th>
                  <th className="text-right py-2 font-medium">Proj Pts</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((t) => (
                  <PendingRow
                    key={t.id}
                    tournament={t}
                    pick={picks[t.id]}
                    simResults={simResults[t.id] ?? null}
                    onNavigate={handleNavigate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {allTournaments.length === 0 && (
        <div className="p-6 text-center text-gray-600 border border-gray-800 rounded-lg">
          No tournaments configured yet.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>{' '}
      <span className={`font-mono font-semibold ${color ?? 'text-gray-200'}`}>
        {value}
      </span>
    </div>
  );
}

function CompletedRow({
  tournament,
  pick,
  onNavigate,
}: {
  tournament: ConferenceTournament;
  pick: TournamentPick | undefined;
  onNavigate: (id: string) => void;
}) {
  const correct = pick && tournament.result && pick.pickedTeamName === tournament.result.winnerName;
  const points = correct ? pick!.pickedSeed : 0;
  const rowBg = correct ? 'bg-green-900/10' : pick ? 'bg-red-900/10' : '';

  return (
    <tr
      className={`border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors ${rowBg}`}
      onClick={() => onNavigate(tournament.id)}
    >
      <td className="py-2 pr-3 text-gray-200">{tournament.name}</td>
      <td className="py-2 pr-3 font-medium text-gray-200">
        {tournament.result?.winnerName ?? '—'}
      </td>
      <td className="py-2 pr-3 text-right font-mono text-gray-400">
        {tournament.result?.winningSeed ?? '—'}
      </td>
      <td className="py-2 pr-3 text-gray-300">
        {pick ? pick.pickedTeamName : <span className="text-gray-600 italic">None</span>}
      </td>
      <td className="py-2 pr-3 text-center">
        {pick ? (
          correct ? (
            <span className="text-xs font-semibold text-green-400 bg-green-900/40 px-1.5 py-0.5 rounded">
              YES
            </span>
          ) : (
            <span className="text-xs font-semibold text-red-400 bg-red-900/40 px-1.5 py-0.5 rounded">
              NO
            </span>
          )
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="py-2 pr-3 text-right font-mono">
        {pick ? (
          <span className={correct ? 'text-green-400' : 'text-gray-500'}>
            +{points}
          </span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="py-2 pr-3 text-gray-500 text-xs">
        {tournament.result?.modelSnapshot ? (
          <span>
            {tournament.result.modelSnapshot.modelTopPick}
            {tournament.result.modelSnapshot.modelTopPick === tournament.result.winnerName && (
              <span className="ml-1 text-green-400">*</span>
            )}
          </span>
        ) : (
          pick?.modelRecommendation || '—'
        )}
      </td>
      <td className="py-2 pr-3 text-right font-mono text-xs text-gray-500">
        {tournament.result?.modelSnapshot
          ? `${(tournament.result.modelSnapshot.winnerWinProbability * 100).toFixed(0)}%`
          : '—'}
      </td>
      <td className="py-2 text-center">
        {pick?.override ? (
          <span className="text-xs font-semibold text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded">
            YES
          </span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
    </tr>
  );
}

function PendingRow({
  tournament,
  pick,
  simResults,
  onNavigate,
}: {
  tournament: ConferenceTournament;
  pick: TournamentPick | undefined;
  simResults: TeamSimulationResult[] | null;
  onNavigate: (id: string) => void;
}) {
  const winProb = (() => {
    if (!pick || !simResults) return null;
    const found = simResults.find((r) => r.teamName === pick.pickedTeamName);
    return found?.winProbability ?? null;
  })();

  const projPts = winProb != null && pick ? winProb * pick.pickedSeed : null;

  return (
    <tr
      className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
      onClick={() => onNavigate(tournament.id)}
    >
      <td className="py-2 pr-3 text-gray-200">{tournament.name}</td>
      <td className="py-2 pr-3">
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
            tournament.status === 'in_progress'
              ? 'text-yellow-400 bg-yellow-900/40'
              : 'text-gray-500 bg-gray-800'
          }`}
        >
          {tournament.status === 'in_progress' ? 'In Progress' : 'Upcoming'}
        </span>
      </td>
      <td className="py-2 pr-3 text-gray-300">
        {pick ? pick.pickedTeamName : <span className="text-gray-600 italic">None</span>}
      </td>
      <td className="py-2 pr-3 text-right font-mono text-gray-400">
        {pick ? pick.pickedSeed : '—'}
      </td>
      <td className="py-2 pr-3 text-right font-mono text-gray-400">
        {winProb != null ? `${(winProb * 100).toFixed(1)}%` : '—'}
      </td>
      <td className="py-2 text-right font-mono text-blue-400">
        {projPts != null ? projPts.toFixed(2) : '—'}
      </td>
    </tr>
  );
}
