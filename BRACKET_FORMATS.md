# Non-Standard Bracket Formats

Working document capturing all non-standard conference tournament formats.
We'll review for conflicts/consolidation after cataloging everything, then implement in one pass.

---

## Already Implemented

### Stairway (bracketType: 'stairway')
Two parallel ladders, higher seeds enter progressively later. No byes.

| Conference | Teams | Notes |
|---|---|---|
| Sun Belt | 14 | |
| Ohio Valley | 8 | |
| WCC | 12 | |
| Southland | 8 | |
| Big West | 8 | |
| American | 9 | Upper ladder one round deeper |
| WAC | 7 | Lower ladder one round deeper |

### Double Bye (bracketType: 'double_bye')
Seeds 1-4 get double byes (enter at quarterfinals). Play-in games for seeds beyond 12.

| Conference | Teams | Play-ins | Notes |
|---|---|---|---|
| ACC | 15 | 3 (12v13, 11v14, 10v15) | |
| Atlantic 10 | 14 | 2 (12v13, 11v14) | |
| Coastal Athletic | 13 | 1 (12v13) | |
| Big 12 | 16 | 4 (12v13, 11v14, 10v15, 9v16) | Seeds 5-8 get single byes. Generator needs extending to support 16. |
| SEC | 16 | 4 (12v13, 11v14, 10v15, 9v16) | Same as Big 12 |
| Big Ten | 18 | 2 (16v17, 15v18) + extra round | Seeds 5-8 get single byes. Extra tier: R0 play-ins → R1 (9-14 range) → R2 (5-8 enter) → R3 QFs (1-4 enter). Generator needs generalization for >16 teams. |

---

## Needs Implementation

### America East & Northeast — Reseeded Semis
- **Teams:** 8 each
- **Base format:** Standard 8-team single elimination (1v8, 4v5, 2v7, 3v6)
- **Deviation:** Semifinals reseed based on surviving seed numbers. Highest remaining seed plays lowest remaining seed; 2nd highest plays 2nd lowest.
- **Example:** If seeds 1, 5, 7, 3 survive QFs → SF1: 1v7, SF2: 3v5 (instead of standard 1v5, 3v7)
- **Impact:** Protects top seeds, reduces upset probability in semis
- **Changes needed:**
  - Add `reseedBeforeRounds?: number[]` to `BracketStructure`
  - Modify `simulateOnce()` in `montecarlo.ts` — when entering a reseeded round, collect advancing teams, sort by seed, re-pair (best vs worst, 2nd vs 3rd)
  - New `BracketType` value (e.g. `'reseeded'`) or flag on standard bracket
  - `bracket.ts`: generate standard 8-team bracket with `reseedBeforeRounds: [1]`

### Horizon League — Reseeded Rounds with Reduction
- **Teams:** 11
- **Structure:**
  - Round 0: 10v11 play-in (1 game)
  - Round 1: 1vW(10/11), 2v9, 3v8, 4v7, 5v6 (5 games → 5 survivors)
  - Round 2: **RESEEDED** — bottom 2 survivors play, top 3 get byes (1 game → 4 remain)
  - Round 3: **RESEEDED** — best vs worst, 2nd vs 3rd (2 games)
  - Round 4: Championship (1 game)
- **Total:** 10 games, 5 rounds
- **Key difference from America East:** Two reseeded rounds (not one), plus a "reduction round" where 5→4 with byes for the top 3. The reseeding mechanism must handle rounds where some teams get byes (more advancing teams than 2× games).
- **Changes needed (beyond America East):**
  - Reseeding logic must support partial rounds: N survivors → only bottom teams play, rest get byes
  - `reseedBeforeRounds: [2, 3]` (both rounds dynamically paired)
  - Round 0 + Round 1 are static (standard play-in + first round), Rounds 2-4 are dynamic

### SWAC — Hybrid Play-in Chains + Standard Bracket
- **Teams:** 12
- **Structure:**
  - Round 0: 10v11, 9v12 (2 play-in games)
  - Round 1: 8 vs W(10/11), 7 vs W(9/12) (2 games — play-in chains)
  - Round 2: 1 vs W(8 side), 4v5, 2 vs W(7 side), 3v6 (4 games — quarterfinals)
  - Round 3: W(1 side) vs W(4/5), W(2 side) vs W(3/6) (2 games — semis)
  - Round 4: Championship (1 game)
- **Total:** 11 games, 5 rounds
- **No reseeding** — all matchups are fixed/static topology
- **Key traits:** Seeds 1-2 get double byes (enter round 2), seeds 3-6 get single byes (enter round 2), seeds 7-8 enter round 1, seeds 9-12 enter round 0. Essentially a standard 8-team QF bracket where the 7 and 8 slots are fed by 2-round play-in chains.
- **Doesn't fit existing types:** Not stairway (no parallel ladders), not double_bye (only seeds 1-2 get double byes, not 1-4). Could be a hard-coded custom bracket or a new parameterized type.

---

## Confirmed Standard

| Conference | Teams | Notes |
|---|---|---|
| Patriot League | 10 | Top 6 get byes, standard pairings |
| Big South | 9 | 8v9 winner plays 1-seed |
| Summit League | 9 | 8v9 winner plays 1-seed |
| ASUN | 12 | Top 4 get byes |
| MAAC | 10 | Standard, 8v9→1, 7v10→2 |
| Big Sky | 10 | Standard, 8v9→1, 7v10→2 |
| Southern | 10 | Standard 10-team (**was 9 — needs teamCount fix**) |
| Missouri Valley | 11 | Standard, 8v9→1, 7v10→2, 6v11→3 |
| Conference USA | 10 | Standard |
| Big East | 11 | Standard |
| MEAC | 7 | Standard |
| Mountain West | 12 | Standard |
| MAC | 8 | Standard |
| Ivy League | 4 | Standard |

---

## Implementation Plan

Three groups of work, ordered by dependency. Groups 1-2 are static topology changes (no sim engine modifications). Group 3 touches the simulation engine.

### Group 1: Extend double_bye generator (13 → 18 teams)

**Problem:** Current `generateDoubleByeBracket` only handles 13-15 teams. Need 16 (Big 12, SEC) and 18 (Big Ten).

**Approach:** Rewrite with a layered algorithm using `roundOffset`:
- **Tier 2 (if teamCount > 16):** Sub-bracket for seeds 9-16 with standard 8-team pairings (9v16, 12v13, 10v15, 11v14). Play-ins for seeds 17+ feed in (e.g. 16v17, 15v18).
- **Tier 1 (always):** Seeds 5-8 vs 9-12 pairings (5v12, 6v11, 7v10, 8v9). If tier 2 exists, lower seeds come from tier 2 winners. Otherwise, play-ins for seeds > 12.
- **QFs/SFs/Final:** Same as current — seeds 1-4 enter at QFs with standard bracket seeding (1v8side, 4v5side, 2v7side, 3v6side).

**Files:**
- `bracket.ts` — rewrite `generateDoubleByeBracket`, extend range to 13-18
- `conferences.ts` — tag Big 12, SEC, Big Ten as `double_bye`
- `store.ts` — bump persist version to 5

**Verification:** 16 teams → 15 games (5 rounds), 18 teams → 17 games (6 rounds). `tsc --noEmit` passes.

---

### Group 2: SWAC hybrid bracket

**Problem:** SWAC (12 teams) has a unique topology — seeds 1-2 get double byes with 2-round play-in chains for the 7/8 slots, while seeds 3-6 play standard quarterfinals. Doesn't fit stairway or double_bye.

**Approach:** Hard-coded generator. Static topology, no reseeding.
```
Round 0: 10v11, 9v12
Round 1: 8vW(10/11), 7vW(9/12)
Round 2: 1vW(8side), 4v5, 2vW(7side), 3v6
Round 3: W(1side)vW(4/5), W(2side)vW(3/6)
Round 4: Final
```
11 games, 5 rounds.

**Files:**
- `types.ts` — add `'swac_hybrid'` to `BracketType`
- `bracket.ts` — add `generateSwacHybridBracket`, add dispatch case
- `conferences.ts` — tag SWAC
- `TournamentDetail.tsx` — add UI label

---

### Group 3: Reseeding support (simulation engine change)

**Problem:** America East, Northeast (8 teams) reseed in semifinals. Horizon League (11 teams) reseeds in rounds 2 and 3 (including a reduction round where 5→4 teams). These require runtime matchup decisions that can't be expressed as static bracket topology.

**Approach — two orthogonal changes:**

#### 3a. Data model: `reseedBeforeRounds` on BracketStructure

Add `reseedBeforeRounds?: number[]` to `BracketStructure`. This is set by the bracket generator and consumed by the simulation engine. The bracket still has game nodes for reseeded rounds (needed for round counting and final game ID), but their `sourceGameA`/`sourceGameB` links serve as the "default" path — the simulation overrides matchups at runtime.

Add `reseedBeforeRounds?: number[]` to `ConferenceMeta` so it flows through `initTournaments` / `reconcileTournaments`.

#### 3b. Simulation engine: reseeded round handling

Modify `simulateOnce()` in `montecarlo.ts`. When the bracket has `reseedBeforeRounds`, switch from the current linear topological-order loop to a round-by-round approach:

1. Group games by round (precompute once outside the sim loop)
2. Process rounds in order
3. For non-reseeded rounds: process games normally (existing logic)
4. For reseeded rounds:
   - Collect all teams advancing into this round (from previous round's game winners + any seeds entering directly)
   - Sort by seed (ascending — best first)
   - Count games in this round (N)
   - If fewer games than teams/2: top seeds get byes (advance without playing)
   - Pair remaining: best-of-remaining vs worst, 2nd vs 2nd-worst, etc.
   - Simulate each pairing, record winners in the game slots

**Key insight:** The `reseedBeforeRounds` fast path only activates when the field is set. All existing brackets (no reseeding) keep the current fast topological-order loop — zero performance impact on the common case.

#### Conferences using reseeding:

| Conference | Teams | bracketType | reseedBeforeRounds | Notes |
|---|---|---|---|---|
| America East | 8 | standard | [1] | Standard QFs, reseeded SFs |
| Northeast | 8 | standard | [1] | Same as America East |
| Horizon | 11 | standard | [2, 3] | Standard play-in + R1, then reseeded reduction (5→4) + reseeded SFs |

For Horizon, the bracket generator produces a standard 11-team bracket (play-in + first round = rounds 0-1), plus placeholder game nodes for rounds 2-4 (1 game, 2 games, 1 game). The placeholder games have "best guess" source links that get overridden at simulation time.

**Files:**
- `types.ts` — add `reseedBeforeRounds?: number[]` to `BracketStructure`
- `conferences.ts` — add `reseedBeforeRounds?: number[]` to `ConferenceMeta`, tag America East `[1]`, Northeast `[1]`, Horizon `[2, 3]`
- `bracket.ts` — when generating standard brackets with reseed rounds, append placeholder games for rounds beyond the static portion. For Horizon: standard 11-team rounds 0-1, then 1+2+1 placeholder games for rounds 2-4.
- `montecarlo.ts` — add round-by-round simulation path with reseeding logic
- `store.ts` — flow `reseedBeforeRounds` through init/reconcile, include in bracket structure
- `TournamentDetail.tsx` — show "Reseeded after round N" label

---

### File change summary

| File | Group 1 | Group 2 | Group 3 |
|---|---|---|---|
| `types.ts` | | BracketType | BracketStructure |
| `bracket.ts` | rewrite double_bye | add SWAC gen | placeholder games for reseed |
| `montecarlo.ts` | | | reseeding in simulateOnce |
| `conferences.ts` | tag 3 | tag 1 | tag 3 + add reseed field |
| `store.ts` | bump version | | flow reseedBeforeRounds |
| `TournamentDetail.tsx` | | SWAC label | reseed label |
| `simulation.worker.ts` | | | no changes (passes through) |

---

## All Conferences Reviewed
