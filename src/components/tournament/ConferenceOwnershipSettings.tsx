import { useState } from 'react';
import { useAppStore } from '../../store';
import { DEFAULT_OWNERSHIP_CONFIG } from '../../models/constants';
import Tooltip from '../common/Tooltip';

interface Props {
  conferenceId: string;
}

interface ControlDef {
  key: 'temperature' | 'concentration' | 'analyticsBoostFactor' | 'analyticsPenaltyFactor';
  label: string;
  tooltip: string;
  min: number;
  max: number;
  step: number;
  defaultVal: number;
}

const CONTROLS: ControlDef[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    tooltip:
      'How sensitive the field is to rating differences. Lower = field concentrates heavily on the best-rated team (e.g., Gonzaga in WCC). Higher = field spreads picks more evenly (e.g., Big 12 with multiple contenders).',
    min: 1.0,
    max: 20.0,
    step: 0.5,
    defaultVal: DEFAULT_OWNERSHIP_CONFIG.temperature,
  },
  {
    key: 'concentration',
    label: 'Concentration',
    tooltip:
      'How much the field herds onto top options. Higher = more of the field piles onto the 1-2 best picks (casual-heavy fields). Lower = field is more dispersed across options (sharp/analytical fields).',
    min: 0.5,
    max: 3.0,
    step: 0.1,
    defaultVal: DEFAULT_OWNERSHIP_CONFIG.concentration,
  },
  {
    key: 'analyticsBoostFactor',
    label: 'Analytics Boost',
    tooltip:
      'Multiplier when a team\'s win probability exceeds its seed-based prior. Higher = field notices and flocks to analytically strong teams.',
    min: 0.5,
    max: 3.0,
    step: 0.1,
    defaultVal: DEFAULT_OWNERSHIP_CONFIG.analyticsBoostFactor,
  },
  {
    key: 'analyticsPenaltyFactor',
    label: 'Analytics Penalty',
    tooltip:
      'Multiplier when a team\'s win probability is far below its seed-based prior. Lower = field abandons weak top seeds more aggressively.',
    min: 0.1,
    max: 1.0,
    step: 0.1,
    defaultVal: DEFAULT_OWNERSHIP_CONFIG.analyticsPenaltyFactor,
  },
];

export default function ConferenceOwnershipSettings({ conferenceId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const ownershipConfig = useAppStore((s) => s.ownershipConfig);
  const overrides = useAppStore((s) => s.ownershipConfigOverrides)[conferenceId];
  const setOverride = useAppStore((s) => s.setOwnershipConfigOverride);
  const clearOverride = useAppStore((s) => s.clearOwnershipConfigOverride);

  const hasOverrides = overrides != null && Object.keys(overrides).length > 0;

  const getEffective = (key: ControlDef['key']): number => {
    if (overrides && overrides[key] != null) return overrides[key]!;
    return ownershipConfig[key];
  };

  const isOverridden = (key: ControlDef['key']): boolean => {
    return overrides != null && overrides[key] != null;
  };

  const handleChange = (key: ControlDef['key'], value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setOverride(conferenceId, { [key]: num });
  };

  const handleReset = () => {
    clearOverride(conferenceId);
  };

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
        Ownership Model Settings
        {hasOverrides && !expanded && (
          <span className="text-[10px] text-indigo-400 bg-indigo-900/30 px-1.5 py-0.5 rounded">
            custom
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 p-3 rounded-lg bg-gray-900 border border-gray-800">
          <p className="text-[10px] text-gray-600 mb-3">
            Override global ownership model parameters for this conference. Changes are reflected immediately in the results below.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CONTROLS.map((ctrl) => {
              const effective = getEffective(ctrl.key);
              const overridden = isOverridden(ctrl.key);
              const matchesGlobal = effective === ownershipConfig[ctrl.key];

              return (
                <div
                  key={ctrl.key}
                  className={`flex items-center gap-2 p-2 rounded ${
                    overridden ? 'border-l-2 border-indigo-500/60 bg-gray-800/30' : ''
                  }`}
                >
                  <span className="text-xs text-gray-400 flex items-center gap-1 min-w-[120px]">
                    {ctrl.label}
                    <Tooltip text={ctrl.tooltip}>
                      <span className="text-[10px] text-gray-500 cursor-help border-b border-dotted border-gray-600">
                        (?)
                      </span>
                    </Tooltip>
                  </span>
                  <input
                    type="number"
                    step={ctrl.step}
                    min={ctrl.min}
                    max={ctrl.max}
                    value={effective}
                    onChange={(e) => handleChange(ctrl.key, e.target.value)}
                    className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
                  />
                  {matchesGlobal && !overridden && (
                    <span className="text-[10px] text-gray-600">= global</span>
                  )}
                </div>
              );
            })}
          </div>

          {hasOverrides && (
            <button
              onClick={handleReset}
              className="mt-3 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              Reset to defaults
            </button>
          )}
        </div>
      )}
    </section>
  );
}
