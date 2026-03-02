import { useAppStore } from '../../store';
import type { ActiveView } from '../../store';
import { CONFERENCES } from '../../data/conferences';

const STATUS_DOT: Record<string, string> = {
  upcoming: 'bg-gray-500',
  in_progress: 'bg-yellow-400',
  completed: 'bg-green-400',
};

export default function Sidebar() {
  const tournaments = useAppStore((s) => s.tournaments);
  const simResults = useAppStore((s) => s.simResults);
  const picks = useAppStore((s) => s.picks);
  const selectedId = useAppStore((s) => s.selectedConferenceId);
  const activeView = useAppStore((s) => s.activeView);
  const selectConference = useAppStore((s) => s.selectConference);
  const setActiveView = useAppStore((s) => s.setActiveView);

  // Sort conferences by start date (already sorted in CONFERENCES, but be explicit)
  const sorted = [...CONFERENCES].sort(
    (a, b) => a.startDate.localeCompare(b.startDate),
  );

  const handleNavClick = (view: ActiveView) => {
    setActiveView(view);
    selectConference(null);
  };

  const handleConferenceClick = (id: string) => {
    setActiveView('conference');
    selectConference(id);
  };

  const navItems: { view: ActiveView; label: string; icon: React.ReactNode }[] = [
    {
      view: 'strategy',
      label: 'Strategy Dashboard',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      view: 'results',
      label: 'Results Summary',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      view: 'settings',
      label: 'Settings',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="w-60 shrink-0 border-r border-gray-800 overflow-y-auto">
      {/* Navigation buttons */}
      <div className="px-2 pt-2 pb-1 space-y-1">
        {navItems.map(({ view, label, icon }) => (
          <button
            key={view}
            onClick={() => handleNavClick(view)}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded transition-colors flex items-center gap-2 ${
              activeView === view
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-indigo-400 hover:bg-gray-800/50 hover:text-indigo-300 border border-transparent'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <h2 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Conferences
      </h2>
      <ul>
        {sorted.map((conf) => {
          const t = tournaments[conf.id];
          const status = t?.status ?? 'upcoming';
          const hasSim = !!simResults[conf.id];
          const pick = picks[conf.id];
          const isSelected = activeView === 'conference' && selectedId === conf.id;

          return (
            <li key={conf.id}>
              <button
                onClick={() => handleConferenceClick(conf.id)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isSelected
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                }`}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`}
                />
                <span className="truncate flex-1">{conf.name}</span>
                {hasSim && (
                  <span className="text-[10px] font-semibold text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded">
                    SIM
                  </span>
                )}
                {pick && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      pick.override
                        ? 'text-blue-400 bg-blue-900/40'
                        : 'text-green-400 bg-green-900/40'
                    }`}
                  >
                    {pick.override ? 'OVR' : 'PICK'}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
