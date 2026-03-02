import { useAppStore } from '../../store';
import { computeScoreProjection } from '../../engine/ev';

export default function ScoreBar() {
  const tournaments = useAppStore((s) => s.tournaments);
  const picks = useAppStore((s) => s.picks);
  const simResults = useAppStore((s) => s.simResults);

  const proj = computeScoreProjection(tournaments, picks, simResults);
  const totalPicks = proj.completedWithPick + proj.remainingPicked;
  const totalConf = Object.keys(tournaments).length;

  const totalColor =
    proj.totalProjected >= 45
      ? 'text-green-400'
      : proj.totalProjected >= 35
        ? 'text-yellow-400'
        : 'text-gray-400';

  // Don't render if no picks at all
  if (totalPicks === 0) return null;

  return (
    <div className="shrink-0 border-b border-gray-800 bg-gray-900 px-4 py-1.5 flex items-center gap-6 text-xs text-gray-400">
      {/* Score group */}
      <div className="flex items-center gap-1.5">
        <span>Score:</span>
        <span className="font-mono text-gray-200">
          {proj.earnedPoints}
        </span>
        <span>earned</span>
        {proj.projectedPoints > 0 && (
          <>
            <span>+</span>
            <span className="font-mono text-gray-300">
              {proj.projectedPoints}
            </span>
            <span>projected</span>
            <span>=</span>
            <span className={`font-mono font-semibold ${totalColor}`}>
              {proj.totalProjected}
            </span>
            <span>total</span>
          </>
        )}
      </div>

      <span className="text-gray-700">|</span>

      {/* Picks group */}
      <div className="flex items-center gap-1.5">
        <span>Picks:</span>
        <span className="font-mono text-gray-200">
          {totalPicks}/{totalConf}
        </span>
        {proj.completedWithPick > 0 && (
          <>
            <span className="text-gray-600">·</span>
            <span>Correct:</span>
            <span className="font-mono text-gray-200">
              {proj.correctPicks}/{proj.completedWithPick}
            </span>
          </>
        )}
      </div>

      <span className="text-gray-700">|</span>

      {/* Range group */}
      <div className="flex items-center gap-1.5">
        <span>Range:</span>
        <span className="font-mono text-gray-200">
          {proj.floor}–{proj.ceiling}
        </span>
        <span className="text-gray-600">·</span>
        <span>Target:</span>
        <span className="font-mono text-yellow-400/70">45-50</span>
      </div>
    </div>
  );
}
