import type {
  ConferenceTournament,
  TeamSimulationResult,
  TournamentPick,
} from '../../models/types';
import type { ModelRecommendation } from '../../engine/ev';
import { classifyConfidence } from '../../engine/ev';

const CONFIDENCE_COLORS: Record<string, string> = {
  lock: 'text-green-400',
  lean: 'text-green-400',
  coin_flip: 'text-yellow-400',
  chaos: 'text-red-400',
};

interface Props {
  tournament: ConferenceTournament;
  results: TeamSimulationResult[] | null;
  pick: TournamentPick | undefined;
  onClearPick: () => void;
  onUpdateNotes?: (notes: string) => void;
  recommendation: ModelRecommendation | null;
  recLabel?: string;
  pickedOwnership?: number;
}

export default function PickPanel({
  tournament,
  results,
  pick,
  onClearPick,
  onUpdateNotes,
  recommendation: rec,
  recLabel,
  pickedOwnership,
}: Props) {
  // Completed tournament — read-only result display
  if (tournament.status === 'completed' && tournament.result) {
    const { winnerName, winningSeed } = tournament.result;
    const correct = pick && pick.pickedTeamName === winnerName;

    return (
      <div className="mb-6 p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-gray-400">Winner:</span>
          <span className="font-semibold">
            {winnerName}{' '}
            <span className="text-gray-500">(seed {winningSeed})</span>
          </span>
          <span className="text-gray-600">|</span>
          {pick ? (
            <>
              <span className="text-gray-400">Your pick:</span>
              <span className="font-medium">{pick.pickedTeamName}</span>
              {correct ? (
                <span className="text-xs font-semibold text-green-400 bg-green-900/40 px-1.5 py-0.5 rounded">
                  CORRECT +{pick.pickedSeed}
                </span>
              ) : (
                <span className="text-xs font-semibold text-red-400 bg-red-900/40 px-1.5 py-0.5 rounded">
                  INCORRECT +0
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-500 italic">No pick made</span>
          )}
        </div>
      </div>
    );
  }

  // No sim results yet
  if (!results) {
    return (
      <div className="mb-6 p-3 rounded-lg bg-gray-800/30 border border-gray-700/50 text-sm text-gray-500">
        Run simulation to enable pick selection.
      </div>
    );
  }

  // Sim results exist but no pick
  if (!pick) {
    return (
      <div className="mb-6 p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-sm">
        {rec && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400">
              {recLabel ? `Recommended (${recLabel}):` : 'Recommended:'}
            </span>
            <span className="font-semibold">{rec.teamName}</span>
            <span className="text-gray-500">(seed {rec.seed})</span>
            <span className="font-mono text-blue-400">
              EV {rec.ev.toFixed(2)}
            </span>
            <span
              className={`text-xs font-semibold uppercase ${CONFIDENCE_COLORS[rec.confidence]}`}
            >
              {rec.confidence.replace('_', ' ')}
            </span>
          </div>
        )}
        <p className="text-gray-500 mt-1.5">
          Click a team in the results table to make your pick.
        </p>
      </div>
    );
  }

  // Pick exists
  const pickedResult = results.find((r) => r.teamName === pick.pickedTeamName);
  const pickedConfidence = pickedResult
    ? classifyConfidence(pickedResult.winProbability)
    : pick.confidence;

  return (
    <div className="mb-6 p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-400">Your pick:</span>
        <span className="font-semibold">{pick.pickedTeamName}</span>
        <span className="text-gray-500">(seed {pick.pickedSeed})</span>
        <span className="text-gray-500">
          — If correct: +{pick.pickedSeed}
        </span>
        {pick.override && (
          <span className="text-xs font-semibold text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded">
            OVERRIDE
          </span>
        )}
        <span
          className={`text-xs font-semibold uppercase ${CONFIDENCE_COLORS[pickedConfidence]}`}
        >
          {pickedConfidence.replace('_', ' ')}
        </span>
        {pickedOwnership != null && (
          <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
            Own: {(pickedOwnership * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {rec && pick.override && (
        <p className="text-gray-500 mt-1">
          {recLabel ? `${recLabel} recommends:` : 'Model recommends:'}{' '}
          <span className="text-gray-300">{rec.teamName}</span>{' '}
          <span className="text-gray-500">
            (seed {rec.seed}, EV {rec.ev.toFixed(2)})
          </span>
        </p>
      )}

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={onClearPick}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          Clear pick
        </button>
        {onUpdateNotes && (
          <input
            type="text"
            value={pick.notes ?? ''}
            onChange={(e) => onUpdateNotes(e.target.value)}
            placeholder="Add notes..."
            className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        )}
      </div>
    </div>
  );
}
