# Model Accuracy Audit — Live & SUMO vs TIA
**Date:** 2026-04-04 (updated)
**Reference:** TIA ITS 4839 (July 2025 Draft), docs/TIA_ITS4839_Tokai_High_School.md

---

## 1. The Fundamental Counting Question

From TIA Annexure B, Table 1 (COTO TMH17 Code 530):

| Rate | Students | Split | Trips In | Trips Out | Total |
|------|----------|-------|----------|-----------|-------|
| 0.75 | 1,120 | 50/50 | **420** | **420** | **840** |

The 840 is unambiguously **total two-way AM peak trips = 420 unique vehicles**, each making one inbound trip and one outbound trip. No reduction factors applied (middle to high-income area).

Both Live and SUMO spawn vehicles as **inbound only** — each spawned vehicle makes one inbound trip, dwells 45s, then makes one outbound trip. So spawned count = inbound vehicle count. **TIA M target = 420 inbound spawns.**

### Current model volumes vs TIA

| Model | Spawned | TIA inbound | Error |
|-------|---------|-------------|-------|
| Live L | 500 | 336 | +49% |
| Live M | 650 | 420 | **+55%** |
| Live H | 840 | 504 | +67% |
| SUMO L | 433 | 336 | +29% |
| SUMO M | 658 | 420 | **+57%** |
| SUMO H | 850 | 504 | +69% |

---

## 2. Agreed Scenario Definitions

| Scenario | Inbound spawns | Rate implied | Basis |
|----------|---------------|-------------|-------|
| L | **336** | 0.60/student | TIA × 0.80 — modest modal shift, some walking/cycling |
| M | **420** | 0.75/student | TIA exact (COTO530, no reductions) |
| H | **504** | 0.90/student | TIA × 1.20 — higher car dependency + Dreyersdal diversion |

Standard ±20% sensitivity band around TIA baseline.

### H scenario routing behaviour (Sweet Valley / Dreyersdal back-pressure)

H does not just increase volume — it changes **routing behaviour** for the 1A corridor. Sweet Valley Primary (~200m away on Firgrove Way) runs concurrently. We do not model Sweet Valley volumes (unknown), but we model the consequence: Dreyersdal Rd is already congested when Tokai High vehicles arrive from the north, so they divert earlier onto Firgrove Service Rd or Starke rat-runs.

Editorial framing: *"M is what the TIA predicts. H is what happens when car dependency is slightly higher and Dreyersdal is already congested from Sweet Valley Primary next door."*

---

## 3. Dreyersdal Road — Corrected Entry Point Analysis

### Geography

Dreyersdal Road runs **east-west** (not north-south). It has two entry/exit points:

| Junction | Location | lng | TIA label |
|----------|----------|-----|-----------|
| **J13** — Firgrove Way / Dreyersdal Rd | West end | 18.4487 | "North along Dreyersdal" = 11% |
| **J1** — Main Rd / Dreyersdal Rd | East end | 18.4609 | "South along Dreyersdal" = 13% |

The TIA's "North" and "South" refer to the **catchment direction** relative to the school, not the road's orientation:
- "North along Dreyersdal" = traffic arriving from the north, entering at the Firgrove/Dreyersdal junction (J13), then travelling **east** along Dreyersdal to the school
- "South along Dreyersdal" = traffic arriving from the south, entering at Main Rd/Dreyersdal (J1), then travelling **west** along Dreyersdal to the school

### Current model mapping (incorrect)

| Corridor | Entry | Route | Maps to TIA |
|----------|-------|-------|-------------|
| 1A | J1 (Main Rd) | J1→J2→J15→J18→J4→J5→J6→J7 | ✅ "South along Dreyersdal" = 13% |
| 3A | J13 (Firgrove Way) | J13→J12→J10→J24→J4→J5→J6→J7 | ❌ This is Firgrove→**Starke Rd**, NOT Dreyersdal |

**The 3A route goes south on Starke Rd, not east on Dreyersdal.** The "North along Dreyersdal" (11%) traffic is entirely missing — it should enter at J13 and travel east along Dreyersdal (J13→J15→J18→J4...).

### Correct corridor mapping

| TIA route | % | Entry | Correct route |
|-----------|---|-------|---------------|
| Dreyersdal South (from Main Rd) | 13% | J1 | 1A: J1→J2→J15→J18→J4→J5→J6→J7 ✅ |
| Dreyersdal North (from Firgrove/Dreyersdal) | 11% | J13 | **NEW 1A-NORTH: J13→J15→J18→J4→J5→J6→J7** |
| Homestead Av external | 21% | J9 | 2A ✅ |
| Homestead Av local (Christopher) | 4% | J9 | absorbed into 2A ✅ |
| Children's Way external | 25% | J8 | 2B ✅ |
| Starke N+S local | 22% | J8 | absorbed into 2B (nearest external entry) |
| Firgrove Way → Starke Rd local | 3% | J13 | 3A ✅ (correct route, just tiny volume) |
| Ruskin Rd local | 1% | J1 | absorbed into 1A |

Note: J13 serves **two** corridors — 1A-NORTH (east on Dreyersdal) and 3A (south on Starke). This is geographically correct: Firgrove/Dreyersdal is a real junction where traffic splits.

### Resulting corridor splits

```javascript
// TIA-aligned corridor splits
// 1A (J1, Dreyersdal South): 13% + 1% local = 14%
// 1A-NORTH (J13, Dreyersdal North): 11%
// 2A (J9, Homestead): 21% + 4% = 25%
// 2B (J8, Children's Way): 25% + 22% = 47%
// 3A (J13, Firgrove→Starke): 3%
// Total: 14+11+25+47+3 = 100% ✅

// For spawner RAW (normalised weights):
const RAW = { '1A': 14, '1A-NORTH': 11, '2A': 25, '2B': 47, '3A': 3 };
```

---

## 4. Internal vs External Traffic

### The problem

The TIA's 30% local traffic (Starke, Christopher, Leyden, Ruskin residents) originates **inside** the network — they don't pass through any external entry junction. The current model spawns all vehicles at external junctions, so local residents are routed the long way around.

**Effect:** Internal roads (Starke, Christopher, Vineyard) get ~30% less traffic than reality. The TIA's 310 vehicles at Starke/Christopher (Int 5) includes both external pass-through AND local residents joining from side streets — our model only produces the external component.

### Modelling approach

Rather than adding mid-network spawn points (complex), local traffic is **absorbed into the nearest external corridor** with adjusted routing behaviour:

- Starke N+S (22%) → absorbed into 2B (Children's Way is nearest external entry)
- Christopher (4%) → absorbed into 2A (Homestead is nearest)
- Leyden/Ruskin (1%) → absorbed into 1A
- Firgrove/Starke local (3%) → 3A as-is

Local vehicles are tagged `isLocal: true` at spawn and given:
1. **Higher habitual rat-run probability** (3× base rate) — locals know the area
2. **Biased egress routing** — exit via nearest perimeter point, not random

---

## 5. Egress Routing

### Current behaviour

`pickEgressRoute()` is completely random — all vehicles use the same fixed weights regardless of origin or scenario:

| Route | Exit | Current weight |
|-------|------|---------------|
| EG-A | Children's Way J8 | 30% |
| EG-B | Main Rd J1 | 20% |
| EG-C | Main Rd J1 | 15% |
| EG-D | Firgrove J13 | 15% |
| EG-E | Homestead J9 | 20% |

### Sweet Valley egress impact (H scenario)

Sweet Valley Primary runs concurrently. Homestead (J9) and Firgrove/Dreyersdal (J13) are congested by Sweet Valley traffic during egress. Children's Way (J8) has traffic lights which self-regulate flow. Main Rd (J1) is the overflow.

**H scenario egress weights:**

| Route | Exit | M weight | H weight | Reason |
|-------|------|----------|----------|--------|
| EG-A | Children's Way J8 | 30% | **40%** | Signal handles it, preferred |
| EG-B | Main Rd J1 | 20% | **25%** | Overflow |
| EG-C | Main Rd J1 | 15% | **15%** | Unchanged |
| EG-D | Firgrove J13 | 15% | **10%** | Sweet Valley blocking |
| EG-E | Homestead J9 | 20% | **10%** | Sweet Valley blocking |

### Local vehicle egress bias

Local residents exit via nearest perimeter point (applied on top of scenario weights):

| Origin | Preferred exit | Reason |
|--------|---------------|--------|
| Starke Rd (2B local) | J13 Firgrove or J9 Homestead | Heading north/east to work |
| Christopher Rd (2A local) | J9 Homestead | Already near Homestead |
| Leyden/Ruskin (1A local) | J13 Firgrove | Closest perimeter point |

In H scenario, local vehicles from Starke/Christopher shift toward J8/J1 due to Sweet Valley back-pressure on J9/J13.

---

## 6. Rat-Run Thresholds

### Agreed values

```javascript
L: { ratRunThreshold: 0.15, habitualRatRunProb: 0.005 }  // Low congestion
M: { ratRunThreshold: 0.10, habitualRatRunProb: 0.01  }  // TIA baseline
H: { ratRunThreshold: 0.06, habitualRatRunProb: 0.03  }  // Higher sensitivity
// H corridor-specific: 1A habitualRatRunProb = 0.08 (Dreyersdal back-pressure)
// Local vehicles: habitualRatRunProb × 3 (know the area)
```

---

## 7. Outbound Completion Rate

| Model | Scenario | Spawned | Completed | % |
|-------|----------|---------|-----------|---|
| SUMO | L | 433 | 285 | 65.8% |
| SUMO | M | 658 | 323 | 49.1% |
| SUMO | H | 850 | 349 | 41.1% |
| Live (log) | M | 671 | 670 | 99.9% |
| Live (log) | H | 848 | 656 | 77.4% |

Low SUMO completion rates reflect genuine congestion — vehicles still queued at sim end. Not a bug. After recalibration to correct volumes, rates will improve but the congestion finding remains valid.

---

## 8. UXSim — Does It Need Updating?

**Short answer: Yes, volumes only. Route structure does not apply.**

UXSim is mesoscopic — it models traffic as **flow**, not individual vehicles with routes. It has no concept of rat-runs, route choice, or individual vehicle origins. It uses 4 corridor nodes (N1–N4) with fixed demand shares and a single school-gate destination.

**What needs changing in `uxsim_runner.py`:**

| Parameter | Current | Required |
|-----------|---------|----------|
| L demand | 420 | **336** |
| M demand | 650 | **420** |
| H demand | 840 | **504** |
| N1 share (1A) | 24% | **14%** (Dreyersdal South only) |
| N2 share (2A) | 20% | **25%** |
| N3 share (2B) | 35% | **47%** |
| N4 share (3A) | 21% | **3%** |
| Dreyersdal North | — | **+11%** via N1 or new N5 node |

The Dreyersdal North (11%) is the tricky one. UXSim's N1 node currently represents Main Rd (Dreyersdal South). Dreyersdal North enters from the opposite end (J13/Firgrove). Options:
- **Simple:** Add 11% to N1 (both Dreyersdal ends treated as same corridor) — acceptable for mesoscopic flow model since UXSim doesn't track individual routes
- **Accurate:** Add a new N5 node at the Firgrove/Dreyersdal junction with 11% share

Recommend the simple approach for UXSim — the mesoscopic model doesn't benefit from the geometric distinction.

**UXSim does NOT need:**
- Rat-run logic (mesoscopic, no route choice)
- Local/external vehicle tagging
- Egress route biasing
- Per-corridor rat-run overrides

---

## 9. Implementation Plan

### Live Engine (`src/engine/`)

#### Step 1 — `routes.js`: Add 1A-NORTH route

```javascript
// Add to RAW_ROUTES:
'1A-NORTH': {
  name: 'Route 1A-NORTH — Dreyersdal North (Firgrove entry)',
  corridor: '1A',
  type: 'main',
  junctions: [13, 15, 18, 4, 5, 6, 7],  // J13→J15→J18→J4→J5→J6→J7
  maxVehicles: 40
},
// Add rat-runs for 1A-NORTH (same rat-runs as 1A, different entry):
'1A-NORTH-RR1': { corridor: '1A', type: 'ratrun', junctions: [13,15,22,19,16,5,6,7], maxVehicles: 20 },
'1A-NORTH-RR2': { corridor: '1A', type: 'ratrun', junctions: [13,15,22,19,16,17,7],  maxVehicles: 15 },
```

Update `CORRIDOR_ROUTES`:
```javascript
'1A': { main: '1A', north: '1A-NORTH', ratRuns: ['1A-RR1','1A-RR2','1A-RR3','1A-RR4','1A-RR5','1A-RR6','1A-NORTH-RR1','1A-NORTH-RR2'] },
```

#### Step 2 — `spawner.js`: Correct volumes, splits, and local tagging

```javascript
// Scenario volumes
export const SCENARIO_CONFIG = {
  L: { totalTrips: 336, ratRunThreshold: 0.15, habitualRatRunProb: 0.005 },
  M: { totalTrips: 420, ratRunThreshold: 0.10, habitualRatRunProb: 0.01  },
  H: { totalTrips: 504, ratRunThreshold: 0.06, habitualRatRunProb: 0.03  },
};

// Corridor splits (TIA-aligned, sum=100)
const RAW = { '1A': 14, '1A-NORTH': 11, '2A': 25, '2B': 47, '3A': 3 };

// Local vehicle fractions per corridor (% of that corridor's spawns that are local residents)
const LOCAL_FRACTION = {
  '1A':       0.07,   // 1% local / 14% total
  '1A-NORTH': 0.0,    // pure external (Dreyersdal North)
  '2A':       0.16,   // 4% local / 25% total
  '2B':       0.47,   // 22% local / 47% total (Starke N+S)
  '3A':       1.0,    // all local
};

// In spawnTick, tag each vehicle:
const isLocal = Math.random() < (LOCAL_FRACTION[cid] ?? 0);
newVehicles.push({ ..., isLocal, corridorId: cid });
```

#### Step 3 — `spawner.js`: Local vehicle rat-run boost + H corridor override

```javascript
export function assignRoute(corridorId, scenario, density, congestionScore = 0, isLocal = false) {
  const cfg = SCENARIO_CONFIG[scenario];
  const crConfig = CORRIDOR_ROUTES[corridorId];
  if (!crConfig || crConfig.ratRuns.length === 0) return crConfig?.main ?? corridorId;

  // H scenario: 1A Dreyersdal back-pressure from Sweet Valley
  const h1aBoost = (scenario === 'H' && corridorId === '1A') ? 0.08 : 0;

  // Local residents know the area — higher habitual rat-run rate
  const localBoost = isLocal ? cfg.habitualRatRunProb * 2 : 0;

  const habitualProb = Math.min(cfg.habitualRatRunProb + h1aBoost + localBoost, 0.85);

  if (Math.random() < habitualProb) {
    return crConfig.ratRuns[Math.floor(Math.random() * crConfig.ratRuns.length)];
  }
  if (density < cfg.ratRunThreshold) return crConfig.main;
  const ratRunProb = Math.min(0.15 + congestionScore * 0.70, 0.85);
  if (Math.random() < ratRunProb) {
    return crConfig.ratRuns[Math.floor(Math.random() * crConfig.ratRuns.length)];
  }
  return crConfig.main;
}
```

#### Step 4 — `spawner.js`: Scenario-aware egress with local bias

```javascript
const EGRESS_WEIGHTS = {
  L: { 'EG-A': 0.30, 'EG-B': 0.20, 'EG-C': 0.15, 'EG-D': 0.15, 'EG-E': 0.20 },
  M: { 'EG-A': 0.30, 'EG-B': 0.20, 'EG-C': 0.15, 'EG-D': 0.15, 'EG-E': 0.20 },
  H: { 'EG-A': 0.40, 'EG-B': 0.25, 'EG-C': 0.15, 'EG-D': 0.10, 'EG-E': 0.10 },
};

// Local vehicle egress bias (additive adjustment before normalisation)
const LOCAL_EGRESS_BIAS = {
  '2B': { 'EG-D': +0.15, 'EG-E': +0.10, 'EG-A': -0.15, 'EG-B': -0.10 }, // Starke → Firgrove/Homestead
  '2A': { 'EG-E': +0.20, 'EG-A': -0.10, 'EG-B': -0.10 },                 // Christopher → Homestead
  '3A': { 'EG-D': +0.25, 'EG-A': -0.15, 'EG-B': -0.10 },                 // Leyden → Firgrove
};

export function pickEgressRoute(scenario = 'M', corridorId = null, isLocal = false) {
  let weights = { ...EGRESS_WEIGHTS[scenario] };

  // Apply local bias (but in H, Sweet Valley pushes locals away from J9/J13)
  if (isLocal && corridorId && LOCAL_EGRESS_BIAS[corridorId]) {
    const bias = LOCAL_EGRESS_BIAS[corridorId];
    for (const [k, v] of Object.entries(bias)) {
      // In H scenario, halve the local bias toward J9/J13 (Sweet Valley blocking)
      const factor = (scenario === 'H' && (k === 'EG-D' || k === 'EG-E')) ? 0.5 : 1.0;
      weights[k] = Math.max(0, (weights[k] ?? 0) + v * factor);
    }
    // Renormalise
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(weights)) weights[k] /= total;
  }

  const r = Math.random();
  let cum = 0;
  for (const [id, w] of Object.entries(weights)) {
    cum += w;
    if (r < cum) return id;
  }
  return 'EG-A';
}
```

Update all call sites of `pickEgressRoute()` in `SimMap.jsx` to pass `scenario`, `corridorId`, and `isLocal`.

---

### SUMO (`sim/sumo/`)

#### Step 1 — `sumo_runner.py`: Correct volumes and corridor splits

```python
SCENARIO_DEMAND = {"L": 336, "M": 420, "H": 504}

CORRIDORS = [
    # Dreyersdal South — enters at Main Rd / Dreyersdal (J1 area)
    {"node_id": "N1", "share": 0.14, "label": "1A Dreyersdal South"},
    # Dreyersdal North — enters at Firgrove Way / Dreyersdal (J13 area)
    {"node_id": "N5", "share": 0.11, "label": "1A-NORTH Dreyersdal North"},
    # Homestead Avenue
    {"node_id": "N4", "share": 0.25, "label": "2A Homestead"},
    # Children's Way
    {"node_id": "N3", "share": 0.47, "label": "2B Children's Way"},
    # Firgrove Way → Starke Rd (local only)
    {"node_id": "N2", "share": 0.03, "label": "3A Firgrove/Starke"},
]
```

Add N5 node to `sumo_network_builder.py` at the Firgrove/Dreyersdal junction coordinates (lat -34.041334, lng 18.448684 = J13).

#### Step 2 — `demand-{L,M,H}.rou.xml`: Regenerate

Re-run `sumo_runner.py` after the above changes. The demand XML files are auto-generated — no manual editing needed.

#### Step 3 — SUMO flow corridor mapping in `sumo_to_json.py`

Update `_flowToCorridor()` in `converters/sumo_to_json.py` to handle 5 corridors (flows 0–4 = 1A, 5–9 = 1A-NORTH, 10–14 = 2A, 15–19 = 2B, 20–24 = 3A). Update `playback.js` `_flowToCorridor()` to match.

---

### UXSim (`sim/uxsim_runner.py`)

#### Step 1 — Correct volumes and corridor splits

```python
SCENARIO_DEMAND = {"L": 336, "M": 420, "H": 504}

CORRIDORS = [
    # N1 absorbs both Dreyersdal South (14%) + North (11%) = 25%
    # Simple approach: treat both Dreyersdal ends as same corridor for mesoscopic model
    {"node_id": "N1", "share": 0.25, "label": "1A Dreyersdal (both ends)"},
    {"node_id": "N4", "share": 0.25, "label": "2A Homestead"},
    {"node_id": "N3", "share": 0.47, "label": "2B Children's Way"},
    {"node_id": "N2", "share": 0.03, "label": "3A Firgrove/Starke"},
]
```

No other changes needed for UXSim. Rat-runs, local tagging, and egress biasing are not applicable to the mesoscopic model.

---

## 10. What Is NOT a Problem

- SUMO "96% on internal roads" — correct, all routes pass through residential network
- Low SUMO Out counts — genuine congestion finding, not a bug
- UXSim low vehicle counts — mesoscopic model, not comparable to SUMO/Live
- Live model rat-run divergences — internal rat-runs are legitimate
- Peak congestion at 08:15 not 07:45 — real finding, not a model error
- TIA LOS F at Main Rd/Dreyersdal, LOS C/D at Starke/Christopher and Ruskin/Aristea — consistent with model outputs
