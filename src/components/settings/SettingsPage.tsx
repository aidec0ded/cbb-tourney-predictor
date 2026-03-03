import { useState, useRef } from 'react';
import { useAppStore } from '../../store';
import { DEFAULT_SIGMA, DEFAULT_WEIGHTS } from '../../engine/probability';
import { DEFAULT_OWNERSHIP_CONFIG } from '../../models/constants';
import { CONFERENCES } from '../../data/conferences';
import type { SigmaConfig, BlendWeights } from '../../models/types';
import Tooltip from '../common/Tooltip';

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1">Settings</h2>
        <p className="text-sm text-gray-500 mb-6">
          Configure probability engine, ownership model, and manage data.
        </p>
      </div>

      <ProbabilityEngineSection />
      <OwnershipModelSection />
      <PerTeamOverridesSection />
      <DataManagementSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Probability Engine
// ---------------------------------------------------------------------------

function ProbabilityEngineSection() {
  const sigmas = useAppStore((s) => s.sigmas);
  const weights = useAppStore((s) => s.weights);
  const setSigmas = useAppStore((s) => s.setSigmas);
  const setWeights = useAppStore((s) => s.setWeights);

  const totalWeight = weights.kenpom + weights.torvik + weights.evanMiya;
  const normalize = (w: number) => (totalWeight > 0 ? (w / totalWeight * 100).toFixed(0) : '0');

  const handleSigmaChange = (key: keyof SigmaConfig, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      setSigmas({ ...sigmas, [key]: num });
    }
  };

  const handleWeightChange = (key: keyof BlendWeights, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setWeights({ ...weights, [key]: num });
    }
  };

  return (
    <section className="p-4 rounded-lg bg-gray-900 border border-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Probability Engine</h3>

      {/* Sigmas */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-gray-400">Sigma Values</span>
          <Tooltip text="Controls how quickly win probability moves toward 0/1 for a given rating differential. Lower sigma = more decisive outcomes, higher sigma = more uncertain.">
            <span className="text-[10px] text-gray-500 cursor-help border-b border-dotted border-gray-600">(?)</span>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ['kenpom', 'KenPom'],
              ['torvik', 'Torvik'],
              ['evanMiya', 'Evan Miya'],
            ] as [keyof SigmaConfig, string][]
          ).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20">{label}</label>
              <input
                type="number"
                step="0.5"
                value={sigmas[key]}
                onChange={(e) => handleSigmaChange(key, e.target.value)}
                className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}
        </div>
        <button
          onClick={() => setSigmas({ ...DEFAULT_SIGMA })}
          className="mt-2 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      {/* Blend Weights */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-gray-400">Blend Weights</span>
          <Tooltip text="Relative weights for combining the three rating systems. They don't need to sum to 1 — they're normalized automatically.">
            <span className="text-[10px] text-gray-500 cursor-help border-b border-dotted border-gray-600">(?)</span>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ['kenpom', 'KenPom'],
              ['torvik', 'Torvik'],
              ['evanMiya', 'Evan Miya'],
            ] as [keyof BlendWeights, string][]
          ).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20">{label}</label>
              <input
                type="number"
                step="0.05"
                value={weights[key]}
                onChange={(e) => handleWeightChange(key, e.target.value)}
                className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-gray-600">{normalize(weights[key])}%</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
          className="mt-2 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Ownership Model
// ---------------------------------------------------------------------------

function OwnershipModelSection() {
  const config = useAppStore((s) => s.ownershipConfig);
  const setOwnershipConfig = useAppStore((s) => s.setOwnershipConfig);

  const handleFactorChange = (key: 'analyticsBoostFactor' | 'analyticsPenaltyFactor' | 'temperature' | 'concentration', value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setOwnershipConfig({ ...config, [key]: num });
    }
  };

  const handleSeedOwnershipChange = (index: number, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 1) {
      const newSeeds = [...config.baseSeedOwnership];
      newSeeds[index] = num;
      setOwnershipConfig({ ...config, baseSeedOwnership: newSeeds });
    }
  };

  return (
    <section className="p-4 rounded-lg bg-gray-900 border border-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Ownership Model</h3>

      {/* Temperature & Concentration */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            Temperature
            <Tooltip text="Softmax temperature for KenPom-informed priors. Lower = field concentrates on best-rated team. Higher = field spreads picks more evenly across contenders.">
              <span className="text-[10px] text-gray-500 cursor-help border-b border-dotted border-gray-600">(?)</span>
            </Tooltip>
          </span>
          <input
            type="number"
            step="0.5"
            min="1.0"
            max="20.0"
            value={config.temperature}
            onChange={(e) => handleFactorChange('temperature', e.target.value)}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            Concentration
            <Tooltip text="Field concentration exponent. Higher = more of the field piles onto the top 1-2 picks. Lower = field is more dispersed across options.">
              <span className="text-[10px] text-gray-500 cursor-help border-b border-dotted border-gray-600">(?)</span>
            </Tooltip>
          </span>
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="3.0"
            value={config.concentration}
            onChange={(e) => handleFactorChange('concentration', e.target.value)}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Analytics Factor inputs */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            Analytics Boost
            <Tooltip text="Multiplier applied when a team's win probability exceeds its seed-based prior. Higher values = the field notices and flocks to analytically strong teams.">
              <span className="text-[10px] text-gray-500 cursor-help border-b border-dotted border-gray-600">(?)</span>
            </Tooltip>
          </span>
          <input
            type="number"
            step="0.1"
            value={config.analyticsBoostFactor}
            onChange={(e) => handleFactorChange('analyticsBoostFactor', e.target.value)}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            Analytics Penalty
            <Tooltip text="Multiplier applied when a team's win probability is much lower than its seed-based prior. Lower values = the field avoids weak top seeds more aggressively.">
              <span className="text-[10px] text-gray-500 cursor-help border-b border-dotted border-gray-600">(?)</span>
            </Tooltip>
          </span>
          <input
            type="number"
            step="0.1"
            value={config.analyticsPenaltyFactor}
            onChange={(e) => handleFactorChange('analyticsPenaltyFactor', e.target.value)}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <p className="text-[10px] text-gray-600 mb-4">
        These are global defaults. Per-conference overrides can be set on each tournament's detail page.
      </p>

      {/* Base seed ownership */}
      <div className="mb-2">
        <span className="text-xs font-medium text-gray-400 block mb-2">
          Base Seed Ownership (seeds 1–8)
        </span>
        <div className="grid grid-cols-4 gap-2">
          {config.baseSeedOwnership.map((val, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-600 w-12">Seed {i + 1}</span>
              <input
                type="number"
                step="0.01"
                value={val}
                onChange={(e) => handleSeedOwnershipChange(i, e.target.value)}
                className="w-16 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-gray-600">{(val * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-1">Seeds 9+ use a 0.3% floor.</p>
      </div>

      <button
        onClick={() => setOwnershipConfig({ ...DEFAULT_OWNERSHIP_CONFIG })}
        className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
      >
        Reset to defaults
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Per-Team Overrides
// ---------------------------------------------------------------------------

function PerTeamOverridesSection() {
  const tournaments = useAppStore((s) => s.tournaments);
  const ownershipOverrides = useAppStore((s) => s.ownershipOverrides);
  const setOwnershipOverride = useAppStore((s) => s.setOwnershipOverride);
  const clearOwnershipOverride = useAppStore((s) => s.clearOwnershipOverride);

  const [selectedConf, setSelectedConf] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [overrideValue, setOverrideValue] = useState('');

  const confTeams =
    selectedConf && tournaments[selectedConf]
      ? tournaments[selectedConf].teams.filter((t) => t.name.trim().length > 0)
      : [];

  const handleSetOverride = () => {
    if (!selectedConf || !selectedTeam) return;
    const num = parseFloat(overrideValue);
    if (isNaN(num) || num < 0 || num > 100) return;
    setOwnershipOverride(selectedConf, selectedTeam, num / 100);
    setSelectedTeam('');
    setOverrideValue('');
  };

  // Collect all active overrides for display
  const allOverrides: { conferenceId: string; confName: string; teamName: string; ownership: number }[] = [];
  for (const [confId, teams] of Object.entries(ownershipOverrides)) {
    const confName = tournaments[confId]?.name ?? confId;
    for (const [teamName, ownership] of Object.entries(teams)) {
      allOverrides.push({ conferenceId: confId, confName, teamName, ownership });
    }
  }

  const handleClearAll = () => {
    for (const override of allOverrides) {
      clearOwnershipOverride(override.conferenceId, override.teamName);
    }
  };

  return (
    <section className="p-4 rounded-lg bg-gray-900 border border-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Per-Team Ownership Overrides</h3>

      {/* Add override form */}
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div>
          <label className="text-[10px] text-gray-600 block mb-0.5">Conference</label>
          <select
            value={selectedConf}
            onChange={(e) => {
              setSelectedConf(e.target.value);
              setSelectedTeam('');
            }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select...</option>
            {CONFERENCES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-600 block mb-0.5">Team</label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            disabled={!selectedConf}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">Select...</option>
            {confTeams.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.seed})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-600 block mb-0.5">Ownership %</label>
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={overrideValue}
            onChange={(e) => setOverrideValue(e.target.value)}
            placeholder="e.g. 22"
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={handleSetOverride}
          disabled={!selectedConf || !selectedTeam || !overrideValue}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-medium transition-colors"
        >
          Set
        </button>
      </div>

      {/* Active overrides table */}
      {allOverrides.length > 0 ? (
        <>
          <table className="w-full text-xs mb-2">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-1 pr-3 font-medium">Conference</th>
                <th className="text-left py-1 pr-3 font-medium">Team</th>
                <th className="text-right py-1 pr-3 font-medium">Ownership</th>
                <th className="py-1 w-8" />
              </tr>
            </thead>
            <tbody>
              {allOverrides.map((o) => (
                <tr key={`${o.conferenceId}-${o.teamName}`} className="border-b border-gray-800/50">
                  <td className="py-1 pr-3 text-gray-400">{o.confName}</td>
                  <td className="py-1 pr-3 text-gray-300">{o.teamName}</td>
                  <td className="py-1 pr-3 text-right font-mono text-gray-200">
                    {(o.ownership * 100).toFixed(0)}%
                  </td>
                  <td className="py-1 text-center">
                    <button
                      onClick={() => clearOwnershipOverride(o.conferenceId, o.teamName)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={handleClearAll}
            className="text-[10px] text-gray-600 hover:text-red-400 transition-colors"
          >
            Clear all overrides
          </button>
        </>
      ) : (
        <p className="text-xs text-gray-600">No overrides set.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Data Management
// ---------------------------------------------------------------------------

function DataManagementSection() {
  const exportState = useAppStore((s) => s.exportState);
  const importState = useAppStore((s) => s.importState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteValue, setPasteValue] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleExport = () => {
    const json = exportState();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cbb-predictor-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Exported successfully.');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importState(reader.result as string);
        setStatusMsg('Imported successfully from file.');
      } catch {
        setStatusMsg('Import failed — invalid JSON.');
      }
      setTimeout(() => setStatusMsg(''), 3000);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePasteImport = () => {
    if (!pasteValue.trim()) return;
    try {
      importState(pasteValue);
      setPasteValue('');
      setStatusMsg('Imported successfully from paste.');
    } catch {
      setStatusMsg('Import failed — invalid JSON.');
    }
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleResetAll = () => {
    localStorage.removeItem('cbb-tourney-predictor');
    window.location.reload();
  };

  return (
    <section className="p-4 rounded-lg bg-gray-900 border border-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Data Management</h3>

      {/* Export */}
      <div className="mb-4">
        <button
          onClick={handleExport}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
        >
          Export Data (JSON)
        </button>
      </div>

      {/* Import via file */}
      <div className="mb-4">
        <span className="text-xs text-gray-400 block mb-1">Import from file:</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileImport}
          className="text-xs text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700"
        />
      </div>

      {/* Import via paste */}
      <div className="mb-4">
        <span className="text-xs text-gray-400 block mb-1">Or paste JSON:</span>
        <textarea
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-100 font-mono focus:outline-none focus:border-blue-500 resize-y"
          placeholder='{"tournaments": ...}'
        />
        <button
          onClick={handlePasteImport}
          disabled={!pasteValue.trim()}
          className="mt-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs font-medium transition-colors"
        >
          Import from Paste
        </button>
      </div>

      {/* Status */}
      {statusMsg && (
        <p className="text-xs text-green-400 mb-3">{statusMsg}</p>
      )}

      {/* Reset all data */}
      <div className="pt-3 border-t border-gray-800">
        {showResetConfirm ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-red-400">Are you sure? This cannot be undone.</span>
            <button
              onClick={handleResetAll}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-medium transition-colors"
            >
              Yes, reset everything
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-400 border border-red-800/50 rounded text-sm font-medium transition-colors"
          >
            Reset All Data
          </button>
        )}
      </div>
    </section>
  );
}
