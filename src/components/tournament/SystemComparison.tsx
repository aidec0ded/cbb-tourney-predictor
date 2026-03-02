import { useMemo, useState } from 'react';
import type { TournamentTeam, SigmaConfig, TeamSimulationResult } from '../../models/types';
import {
  kenpomWinProbability,
  torvikWinProbability,
  evanMiyaWinProbability,
  blendedWinProbability,
} from '../../engine/probability';

interface Props {
  teams: TournamentTeam[];
  sigmas: SigmaConfig;
  blendedResults: TeamSimulationResult[] | null;
}

interface SystemRow {
  teamName: string;
  seed: number;
  kenpom: number;
  torvik: number;
  evanMiya: number;
  blended: number;
  maxDivergence: number;
}

/**
 * For each team, compute their average pairwise win probability against all
 * other teams using each rating system independently. This is O(n^2) per team
 * but fast for <=18 teams.
 */
function computeSystemStrengths(
  teams: TournamentTeam[],
  sigmas: SigmaConfig,
): SystemRow[] {
  if (teams.length < 2) return [];

  return teams.map((team) => {
    let kpSum = 0;
    let tvSum = 0;
    let emSum = 0;
    let blSum = 0;
    let count = 0;

    for (const opp of teams) {
      if (opp.name === team.name) continue;
      kpSum += kenpomWinProbability(
        team.ratings.kenpom.adjEM,
        opp.ratings.kenpom.adjEM,
        sigmas.kenpom,
      );
      tvSum += torvikWinProbability(
        team.ratings.torvik.adjEM,
        opp.ratings.torvik.adjEM,
        sigmas.torvik,
      );
      emSum += evanMiyaWinProbability(
        team.ratings.evanMiya.bpr,
        opp.ratings.evanMiya.bpr,
        sigmas.evanMiya,
      );
      blSum += blendedWinProbability(team.ratings, opp.ratings);
      count++;
    }

    const kenpom = count > 0 ? kpSum / count : 0.5;
    const torvik = count > 0 ? tvSum / count : 0.5;
    const evanMiya = count > 0 ? emSum / count : 0.5;
    const blended = count > 0 ? blSum / count : 0.5;

    const values = [kenpom, torvik, evanMiya];
    const maxDivergence = Math.max(...values) - Math.min(...values);

    return {
      teamName: team.name,
      seed: team.seed,
      kenpom,
      torvik,
      evanMiya,
      blended,
      maxDivergence,
    };
  });
}

export default function SystemComparison({ teams, sigmas, blendedResults }: Props) {
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(
    () => computeSystemStrengths(teams, sigmas).sort((a, b) => b.blended - a.blended),
    [teams, sigmas],
  );

  if (teams.length < 2 || teams.some((t) => !t.name.trim())) return null;

  // Highlight divergences: teams where systems disagree significantly
  const highDivergence = rows.filter((r) => r.maxDivergence >= 0.08);

  return (
    <section className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
        Per-System Comparison
        {highDivergence.length > 0 && !expanded && (
          <span className="text-[10px] text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">
            {highDivergence.length} divergence{highDivergence.length > 1 ? 's' : ''}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 overflow-x-auto">
          <p className="text-[10px] text-gray-600 mb-2">
            Average pairwise win probability vs. all other teams, by system. Highlights where systems disagree.
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-1.5 pr-3 font-medium">Team</th>
                <th className="text-right py-1.5 pr-3 font-medium">Seed</th>
                <th className="text-right py-1.5 pr-3 font-medium">KenPom</th>
                <th className="text-right py-1.5 pr-3 font-medium">Torvik</th>
                <th className="text-right py-1.5 pr-3 font-medium">Evan Miya</th>
                <th className="text-right py-1.5 pr-3 font-medium">Blend</th>
                {blendedResults && (
                  <th className="text-right py-1.5 font-medium">Sim Win%</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isDivergent = r.maxDivergence >= 0.08;
                const simResult = blendedResults?.find((s) => s.teamName === r.teamName);

                return (
                  <tr
                    key={r.teamName}
                    className={`border-b border-gray-800/50 ${
                      isDivergent ? 'bg-amber-900/10' : ''
                    }`}
                  >
                    <td className="py-1.5 pr-3 text-gray-300 font-medium">
                      {r.teamName}
                      {isDivergent && (
                        <span className="ml-1 text-[9px] text-amber-400">DIVERGENT</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono text-gray-500">
                      {r.seed}
                    </td>
                    <SystemCell value={r.kenpom} best={r.kenpom === Math.max(r.kenpom, r.torvik, r.evanMiya)} />
                    <SystemCell value={r.torvik} best={r.torvik === Math.max(r.kenpom, r.torvik, r.evanMiya)} />
                    <SystemCell value={r.evanMiya} best={r.evanMiya === Math.max(r.kenpom, r.torvik, r.evanMiya)} />
                    <td className="py-1.5 pr-3 text-right font-mono text-blue-400">
                      {(r.blended * 100).toFixed(1)}%
                    </td>
                    {blendedResults && (
                      <td className="py-1.5 text-right font-mono text-gray-400">
                        {simResult ? `${(simResult.winProbability * 100).toFixed(1)}%` : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SystemCell({ value, best }: { value: number; best: boolean }) {
  return (
    <td className={`py-1.5 pr-3 text-right font-mono ${best ? 'text-green-400' : 'text-gray-400'}`}>
      {(value * 100).toFixed(1)}%
    </td>
  );
}
