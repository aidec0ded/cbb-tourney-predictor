import { useCallback } from 'react';
import type { TournamentTeam } from '../../models/types';
import { useAppStore } from '../../store';

// ---------------------------------------------------------------------------
// Single team row
// ---------------------------------------------------------------------------

interface TeamRowProps {
  team: TournamentTeam;
  onChange: (updated: TournamentTeam) => void;
}

function TeamRow({ team, onChange }: TeamRowProps) {
  const set = (path: string, value: string) => {
    const num = parseFloat(value);
    const v = isNaN(num) ? 0 : num;
    const next = structuredClone(team);

    switch (path) {
      case 'name':
        next.name = value;
        break;
      case 'kp':
        next.ratings.kenpom.adjEM = v;
        break;
      case 'tv':
        next.ratings.torvik.adjEM = v;
        break;
      case 'em':
        next.ratings.evanMiya.bpr = v;
        break;
    }
    onChange(next);
  };

  const inputClass =
    'bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 w-full focus:outline-none focus:border-blue-500';

  return (
    <tr className="border-b border-gray-800">
      <td className="py-1 pr-2 text-center font-mono text-gray-400 w-10">
        {team.seed}
      </td>
      <td className="py-1 pr-2">
        <input
          className={inputClass}
          placeholder="Team name"
          value={team.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </td>
      <td className="py-1 pr-2">
        <input
          className={inputClass}
          type="number"
          step="0.1"
          placeholder="AdjEM"
          value={team.ratings.kenpom.adjEM || ''}
          onChange={(e) => set('kp', e.target.value)}
        />
      </td>
      <td className="py-1 pr-2">
        <input
          className={inputClass}
          type="number"
          step="0.1"
          placeholder="AdjEM"
          value={team.ratings.torvik.adjEM || ''}
          onChange={(e) => set('tv', e.target.value)}
        />
      </td>
      <td className="py-1">
        <input
          className={inputClass}
          type="number"
          step="0.1"
          placeholder="BPR"
          value={team.ratings.evanMiya.bpr || ''}
          onChange={(e) => set('em', e.target.value)}
        />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

interface Props {
  conferenceId: string;
}

export default function TeamInputTable({ conferenceId }: Props) {
  const teams = useAppStore(
    (s) => s.tournaments[conferenceId]?.teams ?? [],
  );
  const updateTeam = useAppStore((s) => s.updateTeam);

  const handleChange = useCallback(
    (index: number, updated: TournamentTeam) => {
      updateTeam(conferenceId, index, updated);
    },
    [conferenceId, updateTeam],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-left border-b border-gray-700">
            <th className="pb-2 pr-2 w-10">Seed</th>
            <th className="pb-2 pr-2">Team</th>
            <th className="pb-2 pr-2">KenPom AdjEM</th>
            <th className="pb-2 pr-2">Torvik AdjEM</th>
            <th className="pb-2">Evan Miya BPR</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => (
            <TeamRow
              key={t.seed}
              team={t}
              onChange={(updated) => handleChange(i, updated)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
