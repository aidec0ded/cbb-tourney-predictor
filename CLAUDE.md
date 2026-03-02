# CLAUDE.md — Conference Tournament Pick Optimizer

## Project Overview

This is a **React + TypeScript** web application that serves as a strategic decision-support tool for a college basketball conference tournament pick contest. The contest rules:

- 31 conference tournaments, you pick the winner of each
- Scoring: the **seed number** of each correctly picked tournament winner is added to your total (picking a winning 4-seed = 4 points, picking a winning 1-seed = 1 point)
- Top 3 scores win the prize pool (60% / 30% / 10%)
- Picks are submitted the night before each tournament starts, allowing dynamic strategy adjustment
- A score of **45-50** typically contends for the win
- The field is large, so **game theory and differentiation** matter as much as raw accuracy

## Core Architecture

### Tech Stack
- **Frontend**: React 18+ with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand (lightweight, sufficient for this scope)
- **Simulation Engine**: Custom Monte Carlo simulation in TypeScript (runs client-side via Web Workers for performance)
- **Data Persistence**: Local storage + JSON export/import (no backend needed — this is a personal tool)
- **Charts/Viz**: Recharts for probability distributions and EV visualizations

### Project Structure
```
src/
├── components/
│   ├── dashboard/          # Main dashboard views
│   ├── tournament/         # Individual tournament bracket + analysis
│   ├── leaderboard/        # Score tracking and leaderboard position
│   ├── strategy/           # Strategy mode controls and recommendations
│   └── common/             # Shared UI components
├── engine/
│   ├── probability.ts      # Rating fusion and win probability calculations
│   ├── montecarlo.ts       # Monte Carlo tournament simulation
│   ├── ev.ts               # Expected value and leverage calculations
│   └── strategy.ts         # Dynamic strategy optimization based on leaderboard position
├── models/
│   ├── types.ts            # Core type definitions
│   └── constants.ts        # Conference tournament metadata, historical data
├── data/
│   └── conferences.ts      # Conference tournament bracket structures and metadata
├── hooks/                  # Custom React hooks
├── utils/                  # Helpers, formatters, data transforms
└── workers/
    └── simulation.worker.ts # Web Worker for Monte Carlo simulations
```

## Data Model

### Core Types

```typescript
// Team within a specific conference tournament
interface TournamentTeam {
  name: string;
  seed: number;
  conferenceId: string;
  ratings: {
    kenpom: { adjEM: number; adjO: number; adjD: number; adjT: number };
    torvik: { adjEM: number; barthag: number };
    evanMiya: { bpr: number; offBPR: number; defBPR: number };
  };
}

// A single conference tournament
interface ConferenceTournament {
  id: string;                          // e.g., "big_east"
  name: string;                        // e.g., "Big East Tournament"
  teams: TournamentTeam[];
  bracket: BracketStructure;           // Seeded bracket with byes, etc.
  status: 'upcoming' | 'in_progress' | 'completed';
  startDate: string;
  result?: {                           // Filled in after completion
    winnerId: string;
    winningSeed: number;
  };
}

// User's pick for a tournament
interface TournamentPick {
  conferenceId: string;
  pickedTeamName: string;
  pickedSeed: number;
  modelRecommendation: string;         // What the model suggests
  confidence: 'lock' | 'lean' | 'coin_flip' | 'chaos';
  override: boolean;                   // Did user override model recommendation?
  notes?: string;
}

// Simulation output for a tournament
interface TournamentSimulation {
  conferenceId: string;
  simulations: number;                 // e.g., 10000
  teamResults: {
    teamName: string;
    seed: number;
    winProbability: number;            // P(win tournament)
    expectedValue: number;             // P(win) × seed
    estimatedOwnership?: number;       // Optional: estimated % of field picking this team
    leverageScore?: number;            // EV / ownership (when ownership available)
  }[];
}
```

### Rating System Integration

The three analytics systems must be combined at the **probability level** (not the rating level) to avoid normalization issues:

1. **KenPom** → Convert AdjEM differential to win probability using logistic function
   - `P = 1 / (1 + 10^(-(EM_A - EM_B) / σ_kp))` where `σ_kp ≈ 11.0` for neutral-site games
2. **Torvik** → Same approach with his efficiency margins
   - `σ_torvik ≈ 11.0` (similar calibration)
3. **Evan Miya** → BPR differential converted similarly
   - `σ_miya` needs calibration — start with `≈ 10.0` and adjust

**Blended probability** for any matchup = weighted average of the three system probabilities. Default weights: equal (1/3 each). Allow user to adjust weights in settings.

### Monte Carlo Tournament Simulation

For each conference tournament:
1. Load the bracket structure (seeds, byes, matchups)
2. For each simulation run (default 10,000):
   - Simulate each game using blended win probability
   - Advance winners through the bracket
   - Record the tournament champion
3. Aggregate: `P(team X wins tournament) = count(team X won) / total_sims`
4. Calculate: `EV = P(win) × seed` for each team

**Critical**: Simulations must run in a Web Worker to avoid blocking the UI. The simulation engine should accept a bracket + team ratings and return results asynchronously.

## Key Features

### 1. Tournament Input & Management
- Add/edit the 31 conference tournaments
- Input bracket structure (many conferences have byes for top seeds — handle flexibly)
- Manual entry of team ratings from KenPom, Torvik, and Evan Miya
- Bulk paste support to speed up data entry (e.g., paste a tab-separated block of ratings)

### 2. Analytics Dashboard (per tournament)
- Blended tournament win probability for each team
- EV calculation (P × seed) with clear visual ranking
- Bar chart or table showing probability distribution across seeds
- Category badge: lock / lean / coin_flip / chaos (auto-classified based on probability distribution)
- Side-by-side comparison of what each rating system suggests independently vs. the blend

### 3. Pick Management
- Select your pick for each tournament
- Visual indicator when your pick differs from model recommendation
- Running score projection based on current picks
- "What-if" mode: see how your projected score changes with different pick combinations

### 4. Leaderboard & Dynamic Strategy
- Input your current score and leaderboard position after tournaments complete
- Input (or estimate) the scores of key competitors
- **Strategy mode toggle**:
  - **Balanced**: Pick highest EV option for each remaining tournament
  - **Aggressive**: Maximize variance — favor high-seed upsets with low estimated ownership, optimizing for 1st place ceiling
  - **Conservative**: Protect current position — favor higher-probability picks to minimize downside
- The strategy engine should recalculate recommendations for all remaining tournaments based on current standing

### 5. Results Tracking
- Mark tournaments as completed and enter the actual winner
- Auto-calculate your score for completed tournaments
- Track accuracy metrics: correct picks, points earned vs. points possible

## Design & UX Guidelines

- **Dark theme** — this will be used late at night before tournament deadlines
- Clean, information-dense layout — prioritize data visibility over whitespace
- Color coding:
  - Green: locks and high-confidence picks
  - Yellow: coin-flips and moderate uncertainty
  - Red: chaos tournaments and low-confidence picks
  - Blue: picks where you're overriding the model
- Responsive but **desktop-first** — primary use case is laptop/desktop analysis sessions
- All data entry should be fast — tab-through forms, paste support, smart defaults

## Important Implementation Notes

- **No backend / no API calls**: All computation is client-side. Data is entered manually and persisted in localStorage with JSON export/import for backup.
- **Performance**: Monte Carlo sims with 10K iterations across complex brackets can be expensive. Use Web Workers and show progress indicators. Cache simulation results and only re-run when ratings change.
- **Bracket flexibility**: Conference tournaments have widely varying formats — 4-team single elimination, 8-team with byes, 12-team with play-in rounds, etc. The bracket model must be generic enough to handle all of these.
- **Sigma calibration**: The logistic scaling factors (σ) for converting rating differentials to win probabilities are critical to model accuracy. Expose these as configurable parameters in a settings panel so they can be tuned. Include tooltips explaining what they do.
- **Historical context**: Where possible, note when analytics suggest a genuine vulnerability for a top seed (e.g., the 1-seed has a significantly weaker profile than the 2 or 3 seed by all three systems). These are the high-value contrarian picks.

## Development Phases

### Phase 1: Foundation
- Project scaffolding (Vite + React + TS + Tailwind)
- Core type definitions and data model
- Probability engine (rating → win probability for each system, blending logic)
- Basic Monte Carlo simulation for a single-elimination bracket

### Phase 2: Tournament Management
- Conference tournament data structures for all 31 tournaments
- Bracket input UI with flexible format support
- Team rating input forms with bulk paste
- Simulation results display (table + chart)

### Phase 3: Pick Optimization
- EV calculations and pick recommendations
- Pick selection interface with model comparison
- Score projection engine
- Tournament category auto-classification

### Phase 4: Dynamic Strategy
- Leaderboard input and tracking
- Strategy mode engine (balanced / aggressive / conservative)
- Real-time recommendation updates as tournaments complete
- What-if scenario modeling

### Phase 5: Polish
- JSON export/import for full state backup
- Historical results comparison
- Ownership estimation tools
- Mobile responsiveness improvements