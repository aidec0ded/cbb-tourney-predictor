import type { CompetitorProfile } from '../../models/types';

const PROFILE_STYLES: Record<CompetitorProfile, { label: string; bg: string; text: string }> = {
  chalk: { label: 'Chalk', bg: 'bg-gray-700/50', text: 'text-gray-300' },
  seed_chaser: { label: 'Seed Chaser', bg: 'bg-amber-900/40', text: 'text-amber-400' },
  contrarian: { label: 'Contrarian', bg: 'bg-purple-900/40', text: 'text-purple-400' },
  analytics: { label: 'Analytics', bg: 'bg-blue-900/40', text: 'text-blue-400' },
  unknown: { label: 'Unknown', bg: 'bg-gray-800/50', text: 'text-gray-500' },
};

interface Props {
  profile: CompetitorProfile;
  confidence: number;
}

export default function CompetitorProfileBadge({ profile, confidence }: Props) {
  const style = PROFILE_STYLES[profile];

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
      {style.label}
      {confidence >= 0.5 && (
        <span className="opacity-50">
          {confidence >= 0.9 ? '+++' : confidence >= 0.7 ? '++' : '+'}
        </span>
      )}
    </span>
  );
}
