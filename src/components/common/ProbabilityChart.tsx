import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TeamSimulationResult } from '../../models/types';

interface Props {
  results: TeamSimulationResult[];
}

const SEED_COLORS: Record<number, string> = {
  1: '#6366f1', // indigo
  2: '#3b82f6', // blue
  3: '#06b6d4', // cyan
  4: '#10b981', // emerald
  5: '#84cc16', // lime
  6: '#eab308', // yellow
  7: '#f97316', // orange
  8: '#ef4444', // red
};

function getColor(seed: number): string {
  return SEED_COLORS[seed] ?? '#9ca3af';
}

export default function ProbabilityChart({ results }: Props) {
  // Sort by seed for the chart (natural bracket order)
  const sorted = [...results].sort((a, b) => a.seed - b.seed);

  const data = sorted.map((r) => ({
    name: `${r.seed}. ${r.teamName}`,
    winPct: parseFloat((r.winProbability * 100).toFixed(1)),
    ev: parseFloat(r.expectedValue.toFixed(2)),
    seed: r.seed,
  }));

  // Scale chart height with team count so every bar has room for its label
  const chartHeight = Math.max(250, data.length * 30);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-400 mb-2">
        Tournament Win Probability by Seed
      </h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis
            type="number"
            domain={[0, 'auto']}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={{ stroke: '#374151' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            interval={0}
            tick={{ fill: '#d1d5db', fontSize: 12 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              fontSize: 13,
            }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(value: number, name: string) => {
              if (name === 'winPct') return [`${value}%`, 'Win %'];
              return [value, 'EV'];
            }}
          />
          <Bar dataKey="winPct" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={getColor(entry.seed)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <h3 className="text-sm font-medium text-gray-400 mb-2 mt-4">
        Expected Value (Win % × Seed)
      </h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis
            type="number"
            domain={[0, 'auto']}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={{ stroke: '#374151' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            interval={0}
            tick={{ fill: '#d1d5db', fontSize: 12 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              fontSize: 13,
            }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(value: number) => [value.toFixed(2), 'EV']}
          />
          <Bar dataKey="ev" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={getColor(entry.seed)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
