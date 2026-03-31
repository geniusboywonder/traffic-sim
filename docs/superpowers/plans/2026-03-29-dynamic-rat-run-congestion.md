# Dynamic Rat-Run Congestion Routing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scale rat-run probability dynamically with real-time main-route congestion — so drivers divert to rat-runs as the main route stalls, not at a fixed 40% regardless of conditions.

**Architecture:** Add a `corridorCongestionScore()` function to `spawner.js` that measures the fraction of stalled vehicles on the main route per corridor (0.0 = free flow → 1.0 = total gridlock). Feed this score into `assignRoute()` to replace the fixed 40% rat-run probability with a smooth scaling function (`15% base → 85% at full stall`). Expose congestion scores through the stats pipeline so the HUD can display them. No signature change to `spawnTick` — congestion is computed internally from the `vehicles` array already passed in.

**Tech Stack:** Vanilla JS (ES modules), React 19 refs, existing `spawner.js` / `SimMap.jsx` / `idm.js` architecture.

---

## Background: Current Routing Logic

In `src/engine/spawner.js`, `assignRoute()` today:
```js
export function assignRoute(corridorId, scenario, corridorDensity) {
  const cfg = SCENARIO_CONFIG[scenario], crConfig = CORRIDOR_ROUTES[corridorId];
  if (corridorDensity >= cfg.ratRunThreshold && crConfig.ratRuns.length > 0) {
    if (Math.random() < 0.40) return crConfig.ratRuns[...];
  }
  return crConfig.main;
}
```
Problems:
- Fixed 40% probability — no increase as congestion worsens
- `corridorDensity` counts vehicles but ignores whether they are moving
- A fully gridlocked corridor still only diverts 40% of new vehicles

---

## Task 1: Add `corridorCongestionScore()` to `spawner.js`

**Files:**
- Modify: `src/engine/spawner.js` (after existing `corridorDensity` function, ~line 54)

**What it does:** Counts the fraction of inbound vehicles on the corridor's **main route** that are stalled (speed < 0.5 m/s). Requires at least 3 vehicles before returning a non-zero score — avoids false positives from a single slow-spawning vehicle.

**Step 1: Add the function**

```js
// Returns 0.0 (free flow) → 1.0 (fully stalled) for the corridor's main route.
// Minimum 3 vehicles required for a reliable signal.
export function corridorCongestionScore(corridorId, vehicles) {
  const mainRouteId = CORRIDOR_ROUTES[corridorId]?.main;
  if (!mainRouteId) return 0;
  const onMain = vehicles.filter(v => v.routeId === mainRouteId && v.state === 'inbound');
  if (onMain.length < 3) return 0;
  const stalled = onMain.filter(v => v.v < 0.5).length;
  return stalled / onMain.length;
}
```

**Step 2: Manual verification (no test runner available)**

Open browser console while sim is running at speed 10×, peak scenario H. After ~7:20 AM add a temporary `console.log` in `spawnTick`:
```js
console.log('congestion', cid, corridorCongestionScore(cid, vehicles).toFixed(2));
```
Expected: values should be 0.0 before 7:15 AM, rising to 0.5–0.9 during peak gridlock. Remove the log after verifying.

**Step 3: Commit**
```bash
git add src/engine/spawner.js
git commit -m "feat: add corridorCongestionScore — stall fraction on main route"
```

---

## Task 2: Update `assignRoute()` with Dynamic Probability

**Files:**
- Modify: `src/engine/spawner.js` — `assignRoute` function (~line 38)

**Design:**

| Congestion score | Rat-run probability |
|---|---|
| 0.0 (free flow, density threshold not met) | 0% (main route always) |
| 0.0 (free flow, density threshold met) | 15% |
| 0.3 (light stalling) | 36% |
| 0.5 (half stalled) | 50% |
| 0.8 (heavy stall) | 71% |
| 1.0 (full gridlock) | 85% |

Formula: `ratRunProb = 0.15 + congestionScore * 0.70` clamped to `[0.15, 0.85]`.

**Step 1: Update function signature and logic**

Replace the existing `assignRoute`:
```js
export function assignRoute(corridorId, scenario, density, congestionScore = 0) {
  const cfg = SCENARIO_CONFIG[scenario], crConfig = CORRIDOR_ROUTES[corridorId];
  if (!crConfig || crConfig.ratRuns.length === 0) return crConfig?.main ?? corridorId;
  if (density < cfg.ratRunThreshold) return crConfig.main;
  const ratRunProb = Math.min(0.15 + congestionScore * 0.70, 0.85);
  if (Math.random() < ratRunProb) {
    return crConfig.ratRuns[Math.floor(Math.random() * crConfig.ratRuns.length)];
  }
  return crConfig.main;
}
```

**Step 2: Update `spawnTick` to pass congestion score**

In `spawnTick`, replace the `assignRoute` call:
```js
// Before:
const rid = assignRoute(cid, scenario, corridorDensity(cid, vehicles));

// After:
const density  = corridorDensity(cid, vehicles);
const congestion = corridorCongestionScore(cid, vehicles);
const rid = assignRoute(cid, scenario, density, congestion);
```

**Step 3: Verify in browser**

Run scenario H at 10×. By 7:30 AM, rat-run vehicles (light corridor colour) should visibly outnumber main-route vehicles during peak gridlock. Check the LOG CSV — `RAT_RUN` event count should rise sharply from ~7:20 AM onward.

**Step 4: Commit**
```bash
git add src/engine/spawner.js
git commit -m "feat: dynamic rat-run probability scales with congestion (15%→85%)"
```

---

## Task 3: Add Congestion Score to `spawnTick` Return / Stats Pipeline

**Files:**
- Modify: `src/engine/spawner.js` — `spawnTick` return value
- Modify: `src/components/SimMap.jsx` — `spawnTick` call + `computeStats`

**Why:** The StatsPanel should show per-corridor congestion score so the user can see the routing adaptation in real-time.

**Step 1: Export congestion scores from `spawnTick`**

Change `spawnTick` to return an object instead of a plain array:
```js
export function spawnTick(state, simTimeSec, dt, scenario, vehicles) {
  const newVehicles = [], rate = spawnRate(simTimeSec, scenario);
  const congestionScores = {};
  for (const cid of Object.keys(CORRIDOR_SPLITS)) {
    state.accumulators[cid] = (state.accumulators[cid] ?? 0) + rate * CORRIDOR_SPLITS[cid] * dt;
    const density    = corridorDensity(cid, vehicles);
    const congestion = corridorCongestionScore(cid, vehicles);
    congestionScores[cid] = congestion;
    while (state.accumulators[cid] >= 1) {
      state.accumulators[cid] -= 1;
      const rid = assignRoute(cid, scenario, density, congestion);
      newVehicles.push({
        id: _nextId++, routeId: rid, corridorId: cid, pos: 0, v: 0, state: 'inbound',
        roadClass: CORRIDOR_ROAD_CLASS[cid] ?? 'local',
        routeLen: estimateRouteLength(ROUTE_CONFIG[rid]?.geometry),
        spawnTime: simTimeSec, dwellStart: null, lastJunctionIdx: 0, allJunctions: null, holdUntil: null
      });
    }
  }
  return { newVehicles, congestionScores };
}
```

**Step 2: Update `SimMap.jsx` spawnTick call**

In `SimMap.jsx` loop (~line 144), destructure the new return:
```js
// Before:
const newV = spawnTick(spawnerStateRef.current, t, dt, scenarioRef.current, vehiclesRef.current);
newV.forEach(v => { ... });
vehiclesRef.current.push(...newV);

// After:
const { newVehicles: newV, congestionScores } = spawnTick(
  spawnerStateRef.current, t, dt, scenarioRef.current, vehiclesRef.current
);
newV.forEach(v => { ... });
vehiclesRef.current.push(...newV);
```

**Step 3: Add congestion scores to `congestionRef`**

Add a ref to track latest scores (add near other refs at top of SimMap):
```js
const congestionScoresRef = useRef({ '1A': 0, '2A': 0, '2B': 0, '3A': 0 });
```

Update it each frame after spawnTick:
```js
Object.assign(congestionScoresRef.current, congestionScores);
```

**Step 4: Expose in `computeStats`**

In `computeStats`, add `congestion` to each corridor result:
```js
// Pass congestionScores as a new parameter:
const computeStats = useCallback((vehicles, totals, exits, inDelays, outDelays, congScores) => {
  ...
  res.corridors[cid] = {
    ...,
    congestion: congScores?.[cid] ?? 0,   // 0.0–1.0
  };
  ...
```

Update the `onStatsUpdate` call to pass `congestionScoresRef.current`:
```js
onStatsUpdate(computeStats(
  vehiclesRef.current,
  corridorTotalsRef.current,
  corridorExitsRef.current,
  inboundDelayRef.current,
  outboundDelayRef.current,
  congestionScoresRef.current,   // ← new
));
```

**Step 5: Commit**
```bash
git add src/engine/spawner.js src/components/SimMap.jsx
git commit -m "feat: expose per-corridor congestion score through stats pipeline"
```

---

## Task 4: Display Congestion Score in StatsPanel

**Files:**
- Modify: `src/components/StatsPanel.jsx`

**Step 1: Read current StatsPanel corridor card structure**

Read `src/components/StatsPanel.jsx` to find where corridor stats are rendered (look for `avgInDelay`, `current`, `total`).

**Step 2: Add congestion bar to each corridor card**

In the corridor card JSX, below the existing stats, add:
```jsx
{/* Congestion indicator */}
<div style={{ marginTop: 4 }}>
  <div style={{ fontSize: 8, color: '#94a3b8', marginBottom: 2 }}>MAIN ROUTE CONGESTION</div>
  <div style={{ height: 4, background: '#1e3a5f', borderRadius: 2, overflow: 'hidden' }}>
    <div style={{
      height: '100%',
      width: `${Math.round((corridor.congestion ?? 0) * 100)}%`,
      background: corridor.congestion > 0.7 ? '#ef4444' : corridor.congestion > 0.4 ? '#f59e0b' : '#10b981',
      transition: 'width 0.3s ease',
    }} />
  </div>
  <div style={{ fontSize: 8, color: '#64748b', marginTop: 1 }}>
    {Math.round((corridor.congestion ?? 0) * 100)}% stalled
    {' · '}rat-run prob: {Math.round(Math.min(0.15 + (corridor.congestion ?? 0) * 0.70, 0.85) * 100)}%
  </div>
</div>
```

Colours: green (<40% stalled) → amber (40–70%) → red (>70%).

**Step 3: Verify visually**

Run scenario H at 10×. Each corridor card should show a filling red bar from ~7:20 AM onward with the live rat-run probability increasing.

**Step 4: Commit**
```bash
git add src/components/StatsPanel.jsx
git commit -m "feat: congestion bar + rat-run probability in StatsPanel corridor cards"
```

---

## Task 5: Add Congestion Score to RAT_RUN Log Events

**Files:**
- Modify: `src/components/SimMap.jsx` — RAT_RUN log call (~line where `logEvent('RAT_RUN', ...)` is)

**Step 1: Pass congestion score into the RAT_RUN log**

In the spawn loop where `RAT_RUN` is logged, the congestion score is now available via `congestionScoresRef.current`:

```js
// Before:
if (ROUTE_CONFIG[v.routeId]?.type === 'ratrun') {
  logEvent('RAT_RUN', v, { simTime: t, detail: `corridor=${v.corridorId} route=${v.routeId}` });
}

// After:
if (ROUTE_CONFIG[v.routeId]?.type === 'ratrun') {
  const cScore = congestionScores[v.corridorId] ?? 0;
  const prob   = Math.min(0.15 + cScore * 0.70, 0.85);
  logEvent('RAT_RUN', v, { simTime: t, detail: `corridor=${v.corridorId} route=${v.routeId} congestion=${cScore.toFixed(2)} prob=${prob.toFixed(2)}` });
}
```

**Step 2: Commit**
```bash
git add src/components/SimMap.jsx
git commit -m "feat: log congestion score and effective probability on RAT_RUN events"
```

---

## Task 6: Update CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

Add under `## [Unreleased]`:
```markdown
### Added — Dynamic Rat-Run Congestion Routing
- `corridorCongestionScore(corridorId, vehicles)` in `spawner.js`: measures fraction of inbound vehicles on the main route that are stalled (v < 0.5 m/s). Requires ≥3 vehicles for a valid signal.
- `assignRoute()` updated: rat-run probability now scales dynamically with congestion score — `ratRunProb = 0.15 + congestionScore × 0.70` (clamped 15%–85%). Replaces fixed 40%.
- `spawnTick()` now returns `{ newVehicles, congestionScores }` with per-corridor scores.
- `congestionScoresRef` in SimMap tracks latest scores each frame.
- `computeStats` exposes `congestion` (0–1) per corridor.
- StatsPanel corridor cards show a live congestion bar (green/amber/red) and the current effective rat-run probability.
- `RAT_RUN` log events now include `congestion=X.XX prob=X.XX` in detail field.
```

**Commit:**
```bash
git add CHANGELOG.md
git commit -m "docs: changelog for dynamic rat-run congestion routing"
```

---

## Verification Checklist

After all tasks complete, run scenario H at 10× speed and confirm:

- [ ] Before 7:15 AM: congestion bars are green (< 20%), rat-run probability ~15%
- [ ] 7:20–7:30 AM: bars turn amber, probability climbs to 40–60%
- [ ] 7:30–7:45 AM (peak): bars turn red on congested corridors, probability 70–85%
- [ ] RAT_RUN events in CSV log increase in frequency from 7:20 AM onward
- [ ] RAT_RUN log detail shows increasing `congestion=` values
- [ ] Main routes still receive some vehicles even at 85% rat-run probability (never 100%)
- [ ] Network clears faster post-8AM because rat-runs relieved main route load during peak

---

## Notes for Implementer

- `CORRIDOR_ROUTES` is imported in `spawner.js` from `./routes` — it maps corridor IDs to `{ main, ratRuns[] }`.
- `v.v` is in m/s. `0.5 m/s` = ~1.8 km/h — effectively stopped.
- Do NOT change the `ratRunThreshold` values in `SCENARIO_CONFIG` — they remain the density gate before dynamic scaling activates.
- The `congestionScores` object from `spawnTick` is computed once per frame for all corridors — reuse it for both the routing decision and the log/stats, don't call `corridorCongestionScore` twice.
- `StatsPanel.jsx` receives stats via `onStatsUpdate` prop in `SimMap.jsx` → passed down from `App.jsx` as a callback.
