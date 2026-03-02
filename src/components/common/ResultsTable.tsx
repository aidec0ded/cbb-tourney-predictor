import { classifyConfidence } from '../../engine/ev';
import type { TeamSimulationResult } from '../../models/types';

interface Props {
  results: TeamSimulationResult[];
  onPick?: (teamName: string, seed: number) => void;
  pickedTeamName?: string;
  modelRecommendation?: string;
  showOwnership?: boolean;
}

const CONFIDENCE_BADGE: Record<string, { label: string; color: string }> = {
  lock: { label: 'LOCK', color: 'bg-green-900 text-green-300' },
  lean: { label: 'LEAN', color: 'bg-green-900/50 text-green-400' },
  coin_flip: { label: 'FLIP', color: 'bg-yellow-900/50 text-yellow-400' },
  chaos: { label: 'CHAOS', color: 'bg-red-900/50 text-red-400' },
};

export default function ResultsTable({
  results,
  onPick,
  pickedTeamName,
  modelRecommendation,
  showOwnership = false,
}: Props) {
  const interactive = !!onPick;
  const hasOwnership = showOwnership && results.some((r) => r.estimatedOwnership != null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-left border-b border-gray-700">
            {interactive && <th className="pb-2 pr-1 w-6" />}
            <th className="pb-2 pr-3">Team</th>
            <th className="pb-2 pr-3 text-right">Seed</th>
            <th className="pb-2 pr-3 text-right">Win %</th>
            <th className="pb-2 pr-3 text-right">EV</th>
            {hasOwnership && (
              <>
                <th className="pb-2 pr-3 text-right">Own%</th>
                <th className="pb-2 pr-3 text-right">Leverage</th>
              </>
            )}
            <th className="pb-2 text-center">Category</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const confidence = classifyConfidence(r.winProbability);
            const badge = CONFIDENCE_BADGE[confidence];
            const isPicked = pickedTeamName === r.teamName;
            const isRec = modelRecommendation === r.teamName;
            const isOverride = isPicked && pickedTeamName !== modelRecommendation;

            let rowClass = 'border-b border-gray-800/50';
            if (interactive) {
              rowClass += ' cursor-pointer hover:bg-gray-800/60';
            }
            if (isPicked) {
              rowClass += isOverride
                ? ' bg-blue-900/30 border-l-2 border-l-blue-400'
                : ' bg-green-900/20 border-l-2 border-l-green-400';
            }

            return (
              <tr
                key={r.teamName}
                className={rowClass}
                onClick={interactive ? () => onPick(r.teamName, r.seed) : undefined}
              >
                {interactive && (
                  <td className="py-1.5 pr-1 text-center">
                    <span
                      className={`inline-block w-3 h-3 rounded-full border-2 ${
                        isPicked
                          ? isOverride
                            ? 'border-blue-400 bg-blue-400'
                            : 'border-green-400 bg-green-400'
                          : 'border-gray-600'
                      }`}
                    />
                  </td>
                )}
                <td className="py-1.5 pr-3 font-medium">
                  <span className="flex items-center gap-1.5">
                    {r.teamName}
                    {isRec && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-900/40 px-1 py-0.5 rounded leading-none">
                        REC
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-gray-400">
                  {r.seed}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono">
                  {(r.winProbability * 100).toFixed(1)}%
                </td>
                <td className="py-1.5 pr-3 text-right font-mono font-semibold text-blue-400">
                  {r.expectedValue.toFixed(2)}
                </td>
                {hasOwnership && (
                  <>
                    <td className="py-1.5 pr-3 text-right font-mono text-gray-400">
                      {r.estimatedOwnership != null
                        ? `${(r.estimatedOwnership * 100).toFixed(0)}%`
                        : '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono text-amber-400">
                      {r.leverageScore != null
                        ? r.leverageScore.toFixed(2)
                        : '—'}
                    </td>
                  </>
                )}
                <td className="py-1.5 text-center">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
