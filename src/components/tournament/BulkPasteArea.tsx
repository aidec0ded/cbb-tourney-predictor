import { useState } from 'react';
import type { TournamentTeam } from '../../models/types';
import { useAppStore } from '../../store';
import { blankTeam } from '../../store';

// ---------------------------------------------------------------------------
// TSV parser
// ---------------------------------------------------------------------------

/**
 * Parses tab-separated text into TournamentTeam[].
 *
 * Expected columns: Team Name \t KenPom AdjEM \t Torvik AdjEM \t Evan Miya BPR
 * Seeds are assigned positionally (line 1 = seed 1).
 * Auto-detects and skips a header row if the second column is non-numeric.
 *
 * @returns parsed teams or an error string
 */
export function parseTSV(
  text: string,
  teamCount: number,
  conferenceId: string,
): TournamentTeam[] | string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return 'No data found';

  // Auto-detect header: if the second cell of the first row is not a number
  let dataLines = lines;
  const firstCells = lines[0].split('\t');
  if (firstCells.length >= 2 && isNaN(parseFloat(firstCells[1]))) {
    dataLines = lines.slice(1);
  }

  if (dataLines.length !== teamCount) {
    return `Expected ${teamCount} teams, got ${dataLines.length} data rows`;
  }

  const teams: TournamentTeam[] = [];
  for (let i = 0; i < dataLines.length; i++) {
    const cols = dataLines[i].split('\t').map((c) => c.trim());
    const name = cols[0] || '';
    if (!name) return `Row ${i + 1}: missing team name`;

    const kp = parseFloat(cols[1] ?? '');
    const tv = parseFloat(cols[2] ?? '');
    const em = parseFloat(cols[3] ?? '');

    const team = blankTeam(i + 1, conferenceId);
    team.name = name;
    if (!isNaN(kp)) team.ratings.kenpom.adjEM = kp;
    if (!isNaN(tv)) team.ratings.torvik.adjEM = tv;
    if (!isNaN(em)) team.ratings.evanMiya.bpr = em;

    teams.push(team);
  }

  return teams;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  conferenceId: string;
}

export default function BulkPasteArea({ conferenceId }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const teamCount = useAppStore(
    (s) => s.tournaments[conferenceId]?.teams.length ?? 0,
  );
  const bulkUpdateTeams = useAppStore((s) => s.bulkUpdateTeams);

  const handleApply = () => {
    const result = parseTSV(text, teamCount, conferenceId);
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    setError(null);
    bulkUpdateTeams(conferenceId, result);
    setText('');
    setOpen(false);
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        {open ? '▾ Hide bulk paste' : '▸ Bulk paste (TSV)'}
      </button>

      {open && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">
            Paste tab-separated: Team Name → KenPom AdjEM → Torvik AdjEM → Evan
            Miya BPR. Seeds assigned by row order. Header row auto-skipped.
          </p>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-blue-500"
            rows={Math.min(teamCount + 2, 12)}
            placeholder={`Duke\t28.5\t29.1\t12.3\nUNC\t22.0\t21.8\t9.7\n…`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
          {error && (
            <p className="text-xs text-red-400 mt-1">{error}</p>
          )}
          <button
            onClick={handleApply}
            disabled={!text.trim()}
            className="mt-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
