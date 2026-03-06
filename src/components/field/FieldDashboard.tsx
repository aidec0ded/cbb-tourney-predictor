import { useMemo } from 'react';
import { useAppStore } from '../../store';
import { computeObservedOwnership } from '../../engine/field';
import { CONFERENCES } from '../../data/conferences';
import FieldPickImport from './FieldPickImport';
import CompetitorTable from './CompetitorTable';
import ObservedOwnershipComparison from './ObservedOwnershipComparison';
import FieldScenarioPanel from './FieldScenarioPanel';

export default function FieldDashboard() {
  const fieldCompetitors = useAppStore((s) => s.fieldCompetitors);
  const clearFieldData = useAppStore((s) => s.clearFieldData);

  // Count conferences with observed data
  const conferencesWithData = useMemo(() => {
    let count = 0;
    for (const conf of CONFERENCES) {
      const observed = computeObservedOwnership(fieldCompetitors, conf.id);
      if (observed && observed.teams.length > 0) count++;
    }
    return count;
  }, [fieldCompetitors]);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold">Field Analysis</h2>
        {fieldCompetitors.length > 0 && (
          <button
            onClick={clearFieldData}
            className="text-xs text-gray-600 hover:text-red-400 transition-colors"
          >
            Clear all field data
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {fieldCompetitors.length > 0 ? (
          <>
            <span className="text-gray-300">{fieldCompetitors.length}</span> competitors tracked
            {conferencesWithData > 0 && (
              <>
                {' '}&middot;{' '}
                <span className="text-gray-300">{conferencesWithData}</span> conferences with observed picks
              </>
            )}
          </>
        ) : (
          'Track competitor picks, compute observed ownership, and run scenario analysis.'
        )}
      </p>

      {/* Import */}
      <FieldPickImport />

      {/* Leaderboard */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Leaderboard</h3>
        <CompetitorTable />
      </section>

      {/* Observed ownership comparison */}
      <ObservedOwnershipComparison />

      {/* Scenario analysis */}
      <FieldScenarioPanel />
    </div>
  );
}
