# CBB Tournament Pick Optimizer

A strategic decision-support tool for college basketball conference tournament pick contests. Uses Monte Carlo simulation, three rating systems, and game-theory-based ownership modeling to help you find the highest-value picks across all 31 conference tournaments.

## What This Tool Does

In many CBB pick contests, you pick the winner of each conference tournament. If your pick wins, you earn points equal to the team's **seed number** (picking a winning 4-seed = 4 points, a winning 1-seed = 1 point). The top scores win the prize pool.

This tool helps you:

- **Simulate tournament outcomes** using KenPom, Torvik, and Evan Miya ratings
- **Calculate expected value** (win probability x seed) for every team
- **Estimate field ownership** to find contrarian picks the rest of the field is overlooking
- **Model different strategies** (balanced, aggressive, conservative) based on your leaderboard position
- **Track results** as tournaments complete and compare your picks against the model

## Features

- **Monte Carlo Simulation Engine** — Runs 10,000+ tournament simulations per conference using blended win probabilities from three analytics systems. Runs in a Web Worker so the UI stays responsive.
- **Expected Value Rankings** — Every team ranked by EV (win probability x seed), with confidence categories: Lock, Lean, Coin Flip, Chaos.
- **Ownership Estimation** — Models what the field is likely to pick based on seed-based priors and analytics adjustments. Calculates leverage scores (EV / ownership) to find high-value contrarian picks.
- **Strategy Dashboard** — Three modes (Balanced, Aggressive, Conservative) with recommendations that account for your leaderboard position. Includes competitor score tracking and an aggression multiplier.
- **What-If Modeling** — See how swapping any pick affects your projected score, ceiling, and floor in real time.
- **Per-System Comparison** — Collapsible view showing where KenPom, Torvik, and Evan Miya disagree — these divergences often reveal the best contrarian opportunities.
- **Results Tracking** — Record tournament winners, track accuracy, and see model calibration metrics.
- **Pick Notes** — Jot down reasoning for each pick directly in the app.
- **Full Data Export/Import** — Back up your entire state to a JSON file and restore it anytime.
- **Dark Theme** — Designed for late-night analysis sessions before tournament deadlines.
- **All 31 Conference Tournaments** — Pre-configured brackets for every conference, from the Ivy League to the Big Ten.

## How It Works (The Short Version)

1. **Enter team ratings** — Paste KenPom AdjEM, Torvik AdjEM, and Evan Miya BPR for each conference
2. **Run simulations** — The engine simulates the bracket thousands of times to estimate each team's probability of winning the tournament
3. **Review recommendations** — See which picks offer the best expected value and leverage
4. **Make your picks** — Select your pick for each conference, with the model's recommendation for comparison
5. **Adjust strategy** — As tournaments complete, update results and let the strategy engine recalibrate recommendations for remaining tournaments

For a detailed walkthrough of every feature, see the **[User Guide](USER_GUIDE.md)**.

---

## Installation & Setup

This is a web application that runs entirely in your browser — no accounts, no servers, no internet required after setup. All your data stays on your computer.

### What You'll Need

- **Node.js** (version 18 or newer) — this is the runtime that powers the app
- **npm** — comes bundled with Node.js, used to install dependencies
- A **terminal** (Mac: Terminal app; Windows: Command Prompt or PowerShell)
- A **web browser** (Chrome, Firefox, Safari, Edge — any modern browser works)

### Mac Setup

#### Step 1: Install Node.js

**Option A — Download the installer (easiest):**
1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the big green button on the left)
3. Open the downloaded `.pkg` file and follow the installer prompts
4. When it's done, open **Terminal** (search for "Terminal" in Spotlight) and verify:
   ```
   node --version
   ```
   You should see something like `v20.x.x` or `v22.x.x`.

**Option B — Using Homebrew (if you have it):**
```bash
brew install node
```

#### Step 2: Download the project

```bash
cd ~/Desktop
git clone https://github.com/aidec0ded/cbb-tourney-predictor.git
cd cbb-tourney-predictor
```

If you don't have `git`, you can also download the ZIP from GitHub:
1. Go to [https://github.com/aidec0ded/cbb-tourney-predictor](https://github.com/aidec0ded/cbb-tourney-predictor)
2. Click the green **Code** button, then **Download ZIP**
3. Unzip it and open Terminal in that folder

#### Step 3: Install dependencies

```bash
npm install
```

This downloads all the libraries the app needs. It may take a minute.

#### Step 4: Run the app

```bash
npm run dev
```

You'll see output like:
```
  VITE v6.x.x  ready in 300ms

  ➜  Local:   http://localhost:5173/
```

**Open that URL in your browser.** The app is now running!

To stop the app, press `Ctrl + C` in the terminal.

---

### Windows Setup

#### Step 1: Install Node.js

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the big green button on the left)
3. Run the `.msi` installer — accept all the default options
4. **Restart your computer** (Windows sometimes needs this for the PATH to update)
5. Open **Command Prompt** (search for "cmd" in the Start menu) and verify:
   ```
   node --version
   ```
   You should see something like `v20.x.x` or `v22.x.x`.

#### Step 2: Download the project

```cmd
cd %USERPROFILE%\Desktop
git clone https://github.com/aidec0ded/cbb-tourney-predictor.git
cd cbb-tourney-predictor
```

If you don't have `git`:
1. Go to [https://github.com/aidec0ded/cbb-tourney-predictor](https://github.com/aidec0ded/cbb-tourney-predictor)
2. Click the green **Code** button, then **Download ZIP**
3. Extract the ZIP to your Desktop
4. Open Command Prompt and navigate to the folder:
   ```cmd
   cd %USERPROFILE%\Desktop\cbb-tourney-predictor-main
   ```

#### Step 3: Install dependencies

```cmd
npm install
```

#### Step 4: Run the app

```cmd
npm run dev
```

Open the URL shown (usually `http://localhost:5173/`) in your browser.

To stop the app, press `Ctrl + C` in the terminal.

---

### Running it again later

You only need to do Steps 1-3 once. After that, just:

```bash
cd path/to/cbb-tourney-predictor
npm run dev
```

And open `http://localhost:5173/` in your browser.

---

## Quick Start

Once the app is running:

1. **Click a conference** in the sidebar (e.g., "Big East")
2. **Paste team ratings** using the bulk paste area — format is tab-separated: `Team Name`, `KenPom AdjEM`, `Torvik AdjEM`, `Evan Miya BPR` (one team per line, seed 1 first)
3. **Click "Run Simulation"** — watch the progress bar as the engine runs 10,000 simulations
4. **Review the results** — teams are ranked by Expected Value with confidence badges
5. **Click a team to pick them** — your pick appears in the pick panel
6. **Check the Strategy Dashboard** — see recommendations across all conferences

For the full walkthrough, see the **[User Guide](USER_GUIDE.md)**.

## Tech Stack

- **React 18** + **TypeScript** — UI framework
- **Tailwind CSS** — Styling
- **Zustand** — State management
- **Recharts** — Charts and visualizations
- **Vite** — Build tool and dev server
- **Web Workers** — Off-thread Monte Carlo simulation

All computation runs client-side. No backend, no API calls, no data leaves your machine.

## Data Persistence

Your data is saved automatically in your browser's local storage. This means:

- Your data persists between sessions (just refresh and it's all there)
- **Clearing your browser data will erase your picks** — use the Export feature in Settings to back up!
- Data is per-browser — if you switch browsers, you'll need to export/import

## License

MIT
