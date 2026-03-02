# User Guide — CBB Tournament Pick Optimizer

This guide walks you through every feature of the app. If you haven't installed it yet, see the [README](README.md) for setup instructions.

---

## Table of Contents

1. [App Layout](#1-app-layout)
2. [Entering Team Data](#2-entering-team-data)
3. [Running Simulations](#3-running-simulations)
4. [Reading the Results](#4-reading-the-results)
5. [Making Picks](#5-making-picks)
6. [What-If Modeling](#6-what-if-modeling)
7. [Per-System Comparison](#7-per-system-comparison)
8. [Strategy Dashboard](#8-strategy-dashboard)
9. [Recording Tournament Results](#9-recording-tournament-results)
10. [Results Summary](#10-results-summary)
11. [Settings](#11-settings)
12. [Backing Up Your Data](#12-backing-up-your-data)
13. [Tips & Strategy Notes](#13-tips--strategy-notes)
14. [Glossary](#14-glossary)

---

## 1. App Layout

The app has four main areas:

- **Header** — Shows the app title
- **Score Bar** — Appears once you've made at least one pick. Shows your earned points, projected total, pick count, and scoring range
- **Sidebar** (left) — Three navigation buttons at the top (Strategy Dashboard, Results Summary, Settings), followed by a list of all 31 conference tournaments
- **Main Area** (right) — Changes based on what you select

### Sidebar Conference List

Each conference shows:
- A **colored dot** indicating status: gray = upcoming, yellow = in progress, green = completed
- A **SIM** badge if you've run a simulation for that conference
- A **PICK** badge (green) if you've made a pick, or **OVR** (blue) if your pick overrides the model's recommendation

---

## 2. Entering Team Data

Click any conference in the sidebar to open its detail view.

### Option A: Bulk Paste (Recommended)

The fastest way to enter data. Click the **"Bulk Paste"** section to expand it.

**Format:** Tab-separated, one team per line, seed 1 first:

```
Team Name	KenPom AdjEM	Torvik AdjEM	Evan Miya BPR
UConn	31.5	32.1	28.7
Marquette	24.3	25.1	22.4
Creighton	20.1	21.3	19.8
...
```

- The header line is optional — the app auto-detects and skips it
- Teams are assigned seeds in order (line 1 = seed 1, line 2 = seed 2, etc.)
- The number of lines must match the conference's team count

**Where to get the ratings:**
- **KenPom AdjEM**: kenpom.com (the "AdjEM" column)
- **Torvik AdjEM**: barttorvik.com (the "AdjOE - AdjDE" column, or "Barthag" works too)
- **Evan Miya BPR**: evanmiya.com (the "BPR" column)

### Option B: Manual Entry

The team input table below bulk paste lets you edit each team individually. Enter the team name and three rating values (KenPom AdjEM, Torvik AdjEM, Evan Miya BPR).

---

## 3. Running Simulations

Once all teams have names and ratings entered:

1. Set the **simulation count** (default: 10,000 — this is fine for most purposes; use 50,000+ for high-stakes decisions)
2. Click **"Run Simulation"**
3. A progress bar shows completion percentage — the simulation runs in a background thread so the app stays responsive
4. Results appear automatically when done

**When to re-run:** Simulation results are automatically cleared if you change any team's ratings. If you change sigma values or blend weights in Settings, all cached results across all conferences are cleared.

---

## 4. Reading the Results

After a simulation runs, you'll see two panels:

### Results Table

Teams ranked by Expected Value (EV), with columns:
- **Team** — Team name. A green "REC" badge marks the model's recommended pick
- **Seed** — Tournament seed
- **Win %** — Probability of winning the tournament (based on simulation)
- **EV** — Expected Value = Win % x Seed. This is the key metric — higher EV means more expected points
- **Own%** — Estimated field ownership (what percentage of the contest field is likely to pick this team)
- **Leverage** — EV / Ownership. High leverage = underowned relative to value. These are the contrarian opportunities
- **Category** — Auto-classified confidence level:
  - **LOCK** (green) — Win probability 45%+. This team dominates
  - **LEAN** (green) — Win probability 25-45%. Clear favorite but not a lock
  - **FLIP** (yellow) — Win probability 10-25%. Competitive field, could go either way
  - **CHAOS** (red) — Win probability under 10%. Wide-open tournament

### Probability Chart

Two horizontal bar charts showing:
- Tournament Win Probability by team
- Expected Value by team

Color-coded by seed for quick visual scanning.

---

## 5. Making Picks

**To pick a team:** Click their row in the Results Table. Your pick appears in the Pick Panel above the table.

The Pick Panel shows:
- Your picked team, seed, and potential points if correct
- An **OVERRIDE** badge (blue) if your pick differs from the model
- The confidence level of your pick
- **Ownership %** — estimated field ownership for your pick
- A **notes field** — type any reasoning or reminders for this pick

**Recommendation Mode Toggle:** Above the pick panel, switch between:
- **Pure EV** — Recommends the highest expected value team
- **Strategy** — Recommends based on your active strategy mode (balanced/aggressive/conservative)

**To change your pick:** Just click a different team.

**To clear your pick:** Click "Clear pick" in the Pick Panel.

---

## 6. What-If Modeling

Below the Pick Panel, the **"What if you pick..."** section shows the top 3 alternative teams and what happens to your projected score if you switch:

- **proj** — Change in projected total score (green = higher, red = lower)
- **ceil** — Change in your scoring ceiling

This updates in real time as you make picks across conferences.

The Strategy Dashboard also has a full **What-If Panel** where you can select any conference and any team to see a detailed impact analysis including risk assessment.

---

## 7. Per-System Comparison

Below the simulation results, there's a collapsible **"Per-System Comparison"** section. Click to expand.

This shows each team's average pairwise win probability using each rating system independently:
- **KenPom** column — Based only on KenPom AdjEM
- **Torvik** column — Based only on Torvik AdjEM
- **Evan Miya** column — Based only on Evan Miya BPR
- **Blend** column — Combined probability
- **Sim Win%** — Actual tournament win probability from the Monte Carlo simulation

**Why this matters:** When the three systems disagree significantly on a team (marked **DIVERGENT** in amber), it means there's meaningful uncertainty. These are often the best spots for contrarian picks — one system might see something the field's consensus pricing doesn't reflect.

---

## 8. Strategy Dashboard

Click **"Strategy Dashboard"** in the sidebar navigation. This is where game theory meets analytics.

### Competitor Scores

Add up to 5 competitors and their current point totals. The system calculates an **Aggression Multiplier** based on your deficit/surplus:
- **> 1.0** — You're behind; recommendations lean more aggressive
- **< 1.0** — You're ahead; recommendations lean more conservative
- **1.0** — Neutral

### Strategy Modes

Choose your approach:

- **Balanced** (green) — Highest EV picks with a mild contrarian tilt. Best default choice
- **Aggressive** (red) — Maximizes variance. Favors high-seed upsets with low ownership. Use when trailing and need to make up ground
- **Conservative** (blue) — Maximizes probability. Favors the most likely winner regardless of seed value. Use when protecting a lead

### Recommendations Table

Shows the strategy's recommended pick for every conference with simulations. Columns include Win%, EV, Ownership, Confidence, comparison to balanced mode, and reasoning. Click any row to navigate to that conference's detail view.

### Portfolio Projection

Below the recommendations, see your projected total if you follow the strategy's picks for any conference where you haven't made a manual pick. Includes projected total, range, earned points, and target (45-50 is typically competitive).

---

## 9. Recording Tournament Results

As tournaments complete, record the actual winner on the conference detail page:

1. Click the conference in the sidebar
2. At the top, use the **"Record result"** dropdown to select the winning team
3. Click **Save**

The conference dot turns green, your score bar updates, and the Pick Panel shows whether your pick was correct.

**To undo:** Click **"Reset result"** on a completed tournament.

**Model snapshots:** When you record a result, the app automatically snapshots the model's prediction (top pick and the winner's pre-tournament probability). This powers the historical calibration metrics in the Results Summary.

---

## 10. Results Summary

Click **"Results Summary"** in the sidebar. This shows your overall performance.

### Stats Bar

- **Correct / Total** — How many of your picks were right
- **Accuracy %** — Correct pick percentage
- **Pts Earned** — Points from correct picks
- **Pts Possible** — Maximum points if all your picks were correct
- **Avg Seed Picked** — How aggressive your picks are on average
- **Avg Winning Seed** — What seeds are actually winning

### Model Calibration

If you recorded results after running simulations (so model snapshots exist):
- **Model Top Pick Won** — How often the model's #1 recommendation actually won
- **Model Accuracy** — Same, as a percentage
- **Avg Winner Prob** — Average probability the model assigned to the actual winner. Over time, this tells you how well-calibrated the model is

### Completed Tournaments Table

Shows every completed conference: the winner, your pick, whether you were correct, points earned, the model's top pick, the winner's pre-tournament probability, and whether you overrode the model.

Green-tinted rows = correct picks. Red-tinted rows = incorrect. Click any row to navigate to that conference.

### Pending Tournaments Table

Shows remaining conferences: status, your pick (if any), seed, win probability, and projected points.

---

## 11. Settings

Click **"Settings"** in the sidebar. Four sections:

### Probability Engine

**Sigma Values** — Controls how decisive each rating system is. Lower sigma means a given rating advantage translates to a higher win probability. Higher sigma means more uncertainty.

- KenPom default: 11.0
- Torvik default: 11.0
- Evan Miya default: 10.0

**Blend Weights** — How much each system contributes to the blended probability. Defaults to equal (1/3 each). If you trust one system more, increase its weight. The percentages are normalized automatically.

Changing either setting **clears all cached simulation results** — you'll need to re-run simulations.

### Ownership Model

- **Analytics Boost** (default 1.5) — How much the field flocks to analytically strong teams
- **Analytics Penalty** (default 0.6) — How much the field avoids analytically weak top seeds
- **Base Seed Ownership** — Default ownership percentages for seeds 1-8. Seeds 9+ use a 0.3% floor

### Per-Team Ownership Overrides

If you have specific intel on what the field is doing (e.g., you know 40% of the field is picking a certain team), set manual overrides here. Select a conference, team, and enter the ownership percentage. These overrides flow through to the Results Table, Strategy Dashboard, and all leverage calculations.

### Data Management

- **Export** — Downloads a JSON file with all your data (tournaments, picks, sim results, settings)
- **Import** — Restore from a file or paste JSON directly
- **Reset All Data** — Nuclear option. Clears everything and reloads. Requires confirmation

---

## 12. Backing Up Your Data

Your data lives in your browser's local storage. **This means clearing your browser data will erase everything.** To protect against this:

1. Go to **Settings** > **Data Management**
2. Click **"Export Data (JSON)"**
3. A file downloads to your computer — keep it safe

To restore:
1. Go to **Settings** > **Data Management**
2. Click **"Import from file"** and select your backup, or paste the JSON content

**Tip:** Export after each day of tournament play so you always have a recent backup.

---

## 13. Tips & Strategy Notes

### Getting Started Quickly

- Focus on conferences where you have an informational edge or where the tournament is starting soon
- You don't need to enter data for all 31 conferences at once — do them as the tournaments approach
- Bulk paste is dramatically faster than manual entry

### Understanding EV vs. Leverage

- **High EV** picks are the best *in a vacuum* — if nobody else existed, always pick highest EV
- **High Leverage** picks are the best *in a contest* — they exploit the gap between a team's value and how much the field picks them
- A 3-seed with 15% win probability and 8% ownership is more valuable in a contest than a 1-seed with 45% win probability and 50% ownership

### When to Override the Model

- You know something the ratings don't capture (injuries, suspensions, travel, motivation)
- The field's ownership structure creates a leverage opportunity the model doesn't fully account for
- A rivalry or stylistic matchup that ratings-based models systematically misprice

### Strategy Mode Selection

- **Start balanced.** Only go aggressive if you're trailing heading into the final weekend
- **Conservative** is underrated when you have a good score early — the field will take big swings and bust
- The aggression multiplier from competitor scores automatically adjusts within each mode

### Sigma Tuning

- Lower sigmas make the model more confident in favorites (fewer upsets in simulation)
- Higher sigmas increase parity (more upsets)
- If you feel the model is too aggressive toward favorites, try sigmas of 12-13
- If it's producing too many upsets, try 9-10

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **AdjEM** | Adjusted Efficiency Margin. Points per 100 possessions better (+) or worse (-) than average. Used by both KenPom and Torvik. |
| **BPR** | Bayesian Performance Rating. Evan Miya's team strength metric. |
| **EV** | Expected Value. Win probability multiplied by seed number. The core metric for picking in a seed-weighted contest. |
| **Sigma** | The scaling factor in the logistic win probability function. Controls how much a rating difference affects win probability. |
| **Ownership** | Estimated percentage of the contest field picking a given team. |
| **Leverage** | EV divided by Ownership. Measures how undervalued a team is relative to the field's picks. Higher = more contrarian value. |
| **Monte Carlo Simulation** | Running a tournament bracket thousands of times with random outcomes (weighted by win probabilities) to estimate the probability of each team winning. |
| **Lock** | A team with 45%+ probability of winning their tournament. Usually a dominant 1-seed. |
| **Chaos** | A tournament where no team has more than 10% win probability. Wide open. |
| **Override** | When your pick differs from the model's recommendation. Shown in blue throughout the app. |
| **Aggression Multiplier** | A number from 0.3 to 2.0 that adjusts strategy recommendations based on your leaderboard position. Above 1.0 = behind (more aggressive), below 1.0 = ahead (more conservative). |
