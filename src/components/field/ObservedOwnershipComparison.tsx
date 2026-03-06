import { useMemo } from 'react';
import { useAppStore } from '../../store';
import { computeObservedOwnership } from '../../engine/field';
import { estimateOwnership, resolveOwnershipConfig } from '../../engine/strategy';
import { CONFERENCES } from '../../data/conferences';

export default function ObservedOwnershipComparison() {
  const fieldCompetitors = useAppStore((s) => s.fieldCompetitors);
  const simResults = useAppStore((s) => s.simResults);
  const tournaments = useAppStore((s) => s.tournaments);
  const picks = useAppStore((s) => s.picks);
  const ownershipConfig = useAppStore((s) => s.ownershipConfig);
  const ownershipOverrides = useAppStore((s) => s.ownershipOverrides);
  const ownershipConfigOverrides = useAppStore((s) => s.ownershipConfigOverrides);

  // Find conferences with both observed and simulated data
  const comparisons = useMemo(() => {
    const results: {
      conferenceId: string;
      conferenceName: string;
      rows: {
        teamName: string;
        seed: number;
        observed: number;
        estimated: number;
        delta: number;
        isUserPick: boolean;
      }[];
    }[] = [];

    for (const conf of CONFERENCES) {
      const observed = computeObservedOwnership(fieldCompetitors, conf.id);
      const sims = simResults[conf.id];
      if (!observed || !sims) continue;

      const effectiveConfig = resolveOwnershipConfig(ownershipConfig, ownershipConfigOverrides[conf.id]);
      const enriched = estimateOwnership(sims, effectiveConfig, ownershipOverrides[conf.id], tournaments[conf.id]?.teams);

      const userPick = picks[conf.id]?.pickedTeamName;

      // Merge observed and estimated into a unified view
      const teamSet = new Set<string>();
      for (const o of observed.teams) teamSet.add(o.teamName);
      for (const e of enriched) teamSet.add(e.teamName);

      const rows = Array.from(teamSet).map((teamName) => {
        const obs = observed.teams.find((t) => t.teamName === teamName);
        const est = enriched.find((t) => t.teamName === teamName);

        return {
          teamName,
          seed: obs?.seed ?? est?.seed ?? 0,
          observed: obs?.percentage ?? 0,
          estimated: est?.estimatedOwnership ?? 0,
          delta: (obs?.percentage ?? 0) - (est?.estimatedOwnership ?? 0),
          isUserPick: teamName === userPick,
        };
      }).sort((a, b) => b.observed - a.observed);

      results.push({
        conferenceId: conf.id,
        conferenceName: conf.name,
        rows,
      });
    }

    return results;
  }, [fieldCompetitors, simResults, tournaments, picks, ownershipConfig, ownershipOverrides, ownershipConfigOverrides]);

  if (comparisons.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Observed vs Model Ownership
      </h3>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {comparisons.map(({ conferenceId, conferenceName, rows }) => (
          <div key={conferenceId} className="rounded-lg bg-gray-900 border border-gray-800 p-3">
            <h4 className="text-xs font-medium text-gray-400 mb-2">{conferenceName}</h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-1 pr-2 font-medium">Team</th>
                  <th className="text-right py-1 pr-2 font-medium">Seed</th>
                  <th className="text-right py-1 pr-2 font-medium">Observed</th>
                  <th className="text-right py-1 pr-2 font-medium">Model</th>
                  <th className="text-right py-1 font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const absDelta = Math.abs(row.delta);
                  const deltaColor = absDelta >= 0.15
                    ? row.delta > 0 ? 'text-red-400' : 'text-green-400'
                    : absDelta >= 0.08
                      ? row.delta > 0 ? 'text-red-400/70' : 'text-green-400/70'
                      : 'text-gray-600';

                  return (
                    <tr key={row.teamName} className="border-b border-gray-800/30">
                      <td className="py-1 pr-2">
                        <span className="text-gray-200">{row.teamName}</span>
                        {row.isUserPick && (
                          <span className="ml-1 text-[9px] text-indigo-400 bg-indigo-900/40 px-1 py-0.5 rounded">
                            YOU
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-2 text-right font-mono text-gray-500">{row.seed}</td>
                      <td className="py-1 pr-2 text-right font-mono text-gray-300">
                        {(row.observed * 100).toFixed(0)}%
                      </td>
                      <td className="py-1 pr-2 text-right font-mono text-gray-400">
                        {(row.estimated * 100).toFixed(0)}%
                      </td>
                      <td className={`py-1 text-right font-mono ${deltaColor}`}>
                        {row.delta > 0 ? '+' : ''}{(row.delta * 100).toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
