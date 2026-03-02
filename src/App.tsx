import { useAppStore } from './store';
import Sidebar from './components/dashboard/Sidebar';
import ScoreBar from './components/dashboard/ScoreBar';
import TournamentDetail from './components/tournament/TournamentDetail';
import StrategyDashboard from './components/strategy/StrategyDashboard';
import ResultsSummary from './components/results/ResultsSummary';
import SettingsPage from './components/settings/SettingsPage';

export default function App() {
  const selectedId = useAppStore((s) => s.selectedConferenceId);
  const activeView = useAppStore((s) => s.activeView);

  let mainContent: React.ReactNode;

  switch (activeView) {
    case 'strategy':
      mainContent = <StrategyDashboard />;
      break;
    case 'results':
      mainContent = <ResultsSummary />;
      break;
    case 'settings':
      mainContent = <SettingsPage />;
      break;
    case 'conference':
    default:
      mainContent = selectedId ? (
        <TournamentDetail conferenceId={selectedId} />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>Select a conference or open Strategy Dashboard.</p>
        </div>
      );
      break;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">
          CBB Tournament Pick Optimizer
        </h1>
      </header>

      {/* Score projection bar */}
      <ScoreBar />

      {/* Body: sidebar + main content */}
      <div className="flex flex-1 min-h-0">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-6">
          {mainContent}
        </main>
      </div>
    </div>
  );
}
