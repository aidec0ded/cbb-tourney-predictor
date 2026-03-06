import { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import { CONFERENCES } from '../../data/conferences';
import { parseFullFieldPaste, parseSingleConferencePaste } from '../../engine/field';
import type { FieldCompetitor } from '../../models/types';

/**
 * Build a map from conference display name -> conference id.
 * Includes common alternate names to handle spreadsheet header variations.
 */
function buildConferenceNameMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const conf of CONFERENCES) {
    map.set(conf.name, conf.id);
    // Add common short names
    map.set(conf.name.toLowerCase(), conf.id);
  }
  // Add alternate names that might appear in spreadsheet headers
  map.set('Horizon', 'horizon');
  map.set('Patriot', 'patriot');
  map.set('Sun Belt', 'sun_belt');
  map.set('Northeast', 'nec');
  map.set('NEC', 'nec');
  map.set('Ohio Valley', 'ovc');
  map.set('OVC', 'ovc');
  map.set('Big South', 'big_south');
  map.set('Summit', 'summit');
  map.set('Summit League', 'summit');
  map.set('ASUN', 'asun');
  map.set('A-Sun', 'asun');
  map.set('MAAC', 'maac');
  map.set('Missouri Valley', 'mvc');
  map.set('MVC', 'mvc');
  map.set('WCC', 'wcc');
  map.set('Coastal Athletic', 'caa');
  map.set('CAA', 'caa');
  map.set('Southern', 'socon');
  map.set('SoCon', 'socon');
  map.set('America East', 'america_east');
  map.set('AE', 'america_east');
  map.set('Big Sky', 'big_sky');
  map.set('Southland', 'southland');
  map.set('SWAC', 'swac');
  map.set('ACC', 'acc');
  map.set('Big 12', 'big12');
  map.set('Big 10', 'big_ten');
  map.set('Big Ten', 'big_ten');
  map.set('Conference USA', 'cusa');
  map.set('C-USA', 'cusa');
  map.set('CUSA', 'cusa');
  map.set('American', 'aac');
  map.set('AAC', 'aac');
  map.set('Atlantic 10', 'a10');
  map.set('A-10', 'a10');
  map.set('A10', 'a10');
  map.set('Big East', 'big_east');
  map.set('Big West', 'big_west');
  map.set('MEAC', 'meac');
  map.set('Mountain West', 'mwc');
  map.set('MWC', 'mwc');
  map.set('SEC', 'sec');
  map.set('WAC', 'wac');
  map.set('MAC', 'mac');
  map.set('Ivy', 'ivy');
  map.set('Ivy League', 'ivy');
  return map;
}

export default function FieldPickImport() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'full' | 'conference'>('full');
  const [pasteText, setPasteText] = useState('');
  const [selectedConference, setSelectedConference] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const fieldCompetitors = useAppStore((s) => s.fieldCompetitors);
  const tournaments = useAppStore((s) => s.tournaments);
  const userName = useAppStore((s) => s.userName);
  const setFieldCompetitors = useAppStore((s) => s.setFieldCompetitors);

  const conferenceNameMap = useMemo(() => buildConferenceNameMap(), []);

  const handleFullParse = () => {
    if (!pasteText.trim()) return;

    const result = parseFullFieldPaste(pasteText, conferenceNameMap, userName, tournaments);
    setErrors(result.errors);

    if (result.competitors.length === 0) {
      setPreview('No competitors parsed. Check the format.');
      return;
    }

    // Count conferences with data
    const confsWithData = new Set<string>();
    for (const comp of result.competitors) {
      for (const confId of Object.keys(comp.picks)) {
        confsWithData.add(confId);
      }
    }

    setPreview(
      `Parsed ${result.competitors.length} competitors across ${confsWithData.size} conferences.` +
      (result.errors.length > 0 ? ` ${result.errors.length} parse warnings.` : ''),
    );
  };

  const handleFullApply = () => {
    if (!pasteText.trim()) return;

    const result = parseFullFieldPaste(pasteText, conferenceNameMap, userName, tournaments);

    const competitors: FieldCompetitor[] = result.competitors.map((c) => ({
      name: c.name,
      picks: c.picks,
      profile: 'unknown',
      profileConfidence: 0,
    }));

    setFieldCompetitors(competitors);
    setPasteText('');
    setPreview(null);
    setErrors([]);
  };

  const handleConferenceParse = () => {
    if (!pasteText.trim() || !selectedConference) return;

    if (fieldCompetitors.length === 0) {
      setPreview('Import full spreadsheet first to establish competitor list.');
      return;
    }

    // Guess user row index — find in existing competitors or default to 44 (0-indexed)
    const excludeIndex = 44; // Robert Ray is typically row 45 (0-indexed: 44)
    const confTeams = tournaments[selectedConference]?.teams;
    const result = parseSingleConferencePaste(
      pasteText,
      fieldCompetitors,
      selectedConference,
      excludeIndex,
      confTeams,
    );
    setErrors(result.errors);

    const updatedCount = result.updated.filter(
      (comp, i) => comp.picks[selectedConference] && !fieldCompetitors[i]?.picks[selectedConference],
    ).length;

    const confName = CONFERENCES.find((c) => c.id === selectedConference)?.name ?? selectedConference;
    setPreview(`Parsed picks for ${confName}: ${updatedCount} new picks added.`);
  };

  const handleConferenceApply = () => {
    if (!pasteText.trim() || !selectedConference || fieldCompetitors.length === 0) return;

    const excludeIndex = 44;
    const confTeams = tournaments[selectedConference]?.teams;
    const result = parseSingleConferencePaste(
      pasteText,
      fieldCompetitors,
      selectedConference,
      excludeIndex,
      confTeams,
    );

    setFieldCompetitors(result.updated);
    setPasteText('');
    setPreview(null);
    setErrors([]);
  };

  return (
    <section className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
        Import Picks
      </button>

      {isOpen && (
        <div className="mt-3 p-4 rounded-lg bg-gray-900 border border-gray-800">
          {/* Mode toggle */}
          <div className="flex rounded overflow-hidden border border-gray-700 text-xs mb-4 w-fit">
            <button
              onClick={() => { setMode('full'); setPasteText(''); setPreview(null); setErrors([]); }}
              className={`px-3 py-1.5 transition-colors ${
                mode === 'full'
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              Full Spreadsheet
            </button>
            <button
              onClick={() => { setMode('conference'); setPasteText(''); setPreview(null); setErrors([]); }}
              className={`px-3 py-1.5 border-l border-gray-700 transition-colors ${
                mode === 'conference'
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              Per Conference
            </button>
          </div>

          {mode === 'full' ? (
            <>
              <p className="text-xs text-gray-500 mb-2">
                Paste the full TSV spreadsheet (header row + all competitor rows).
                Robert Ray's row will be skipped automatically.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste TSV data here..."
                className="w-full h-32 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500 resize-y"
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={handleFullParse}
                  disabled={!pasteText.trim()}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded text-xs font-medium transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={handleFullApply}
                  disabled={!pasteText.trim()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded text-xs font-medium transition-colors"
                >
                  Apply
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <select
                  value={selectedConference}
                  onChange={(e) => setSelectedConference(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select conference...</option>
                  {CONFERENCES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Paste one pick per line, in competitor order.
                </p>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="TeamA - 1&#10;TeamB - 3&#10;TeamC - 2&#10;..."
                className="w-full h-32 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500 resize-y"
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={handleConferenceParse}
                  disabled={!pasteText.trim() || !selectedConference}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded text-xs font-medium transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={handleConferenceApply}
                  disabled={!pasteText.trim() || !selectedConference}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded text-xs font-medium transition-colors"
                >
                  Apply
                </button>
              </div>
            </>
          )}

          {/* Preview / errors */}
          {preview && (
            <div className="mt-3 px-3 py-2 rounded bg-gray-800/50 border border-gray-700/50 text-xs text-gray-300">
              {preview}
            </div>
          )}
          {errors.length > 0 && (
            <div className="mt-2 px-3 py-2 rounded bg-red-900/20 border border-red-800/30 text-xs text-red-400 max-h-24 overflow-y-auto">
              {errors.slice(0, 10).map((e, i) => (
                <div key={i}>{e}</div>
              ))}
              {errors.length > 10 && (
                <div className="text-red-500">...and {errors.length - 10} more</div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
