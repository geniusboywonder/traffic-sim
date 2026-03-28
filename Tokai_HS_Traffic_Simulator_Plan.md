# Tokai High School — Morning Traffic Simulator: Planning Document

**Project:** Visual Traffic Impact Simulator — Erf 1061, Bergvliet, Cape Town  
**Basis:** TIA Report ITS 4839 (July 2025) + Independent Review (March 2026)  
**Focus:** AM Peak School Run (07:00–08:30)  
**Status:** Planning Draft v4 — OSM-Validated Road Network  

---

## 1. Purpose & Scope

This document plans the build of an interactive, browser-based traffic flow simulator that visualises the morning school run impact on local roads around the proposed Tokai High School site. The simulator is designed to:

- Make the abstract TIA data tangible and communicable to non-technical stakeholders
- Let users test High / Medium / Low traffic scenarios with adjustable variables
- Highlight the roads and intersections the TIA **failed to study** (the Class 5 local streets)
- Show "rat-run" alternative routes residents will likely use to avoid the main congestion points
- Display real-time vehicle counts, queue build-up, and estimated wait times per zone
- Clearly distinguish between **what the TIA modelled** and **what it left out**, via a two-layer UI

---

## 2. Source Data Summary

### 2.1 School Parameters
| Parameter | Value |
|---|---|
| Learners | 1,120 |
| AM Peak Vehicle Trips (TIA figure) | **840 trips** |
| AM Midday Trips | 392 |
| AM Peak Window | ~07:15–08:15 (assumed 60-min peak) |
| Ingress road | Ruskin Road (via Ruskin/Leyden Rd intersection) |
| Egress road | Aristea Road (currently a cul-de-sac — to be converted) |
| On-site parking | 98 bays |
| On-street parking (Ruskin Rd) | 22 bays |

### 2.2 Trip Distribution (from TIA §13)

| Origin Corridor | Share | % of 840 trips | Vehicles |
|---|---|---|---|
| North via Dreyersdal Rd | 11% | External | ~92 |
| East via Homestead Ave (Main Rd M4) | 21% | External | ~176 |
| East via Children's Way (Ladies Mile MR127) | 25% | External | ~210 |
| South via Dreyersdal Rd (Main Rd northbound) | 13% | External | ~109 |
| Christopher Road (local) | 4% | Local | ~34 |
| Starke Road – north | 10% | Local | ~84 |
| Starke Road – south | 12% | Local | ~101 |
| Leyden Road – north | 3% | Local | ~25 |
| Ruskin Road – east | 1% | Local | ~8 |

**Key insight:** 70% of all trips (external) all funnel through **Starke Road or Christopher Road** before reaching Ruskin Road — both Class 5 local streets the TIA never formally analysed.

### 2.3 Known Failure Points (from TIA + Review)
| Location | Issue | LOS |
|---|---|---|
| Main Rd / Dreyersdal Rd intersection | v/c = 1.25, critical failure | **F** |
| Ruskin Road (ingress) | 840 trips + 22 parking bays on Class 5 street, no queue analysis | Unstudied |
| Ruskin Rd / Leyden Rd intersection | Primary ingress point — never studied | Unstudied |
| Starke Road | Carries ~185 vehicles, Class 5, unstudied | Unstudied |
| Christopher Road | Carries ~143 vehicles, Class 5, unstudied | Unstudied |
| Aristea Road (egress) | Cul-de-sac conversion, no geometry analysis | Unstudied |

---

## 3. Road Network for the Simulator

All roads OSM-validated via OpenStreetMap at https://www.openstreetbrowser.org/#map=16/-34.0476/18.4565. Roads are grouped by simulation priority tier. Note: Ladies Mile Road is labelled **Lantern Road** on OSM in this section — naming discrepancy to carry through to simulator labels.

### 3.1 Primary Roads — Must Model (TIA studied)
| Road | OSM Confirmed | TIA Road Class | Sim Role | TIA Coverage |
|---|---|---|---|---|
| Main Road (M4) | ✅ | Class 3 Minor Arterial | North-south spine, LOS E/F at Dreyersdal | ✅ Studied (Int. 4) |
| Ladies Mile Rd / Lantern Rd (MR127) | ✅ ⚠️ naming discrepancy | Class 3 Minor Arterial | Primary east approach feeder | ✅ Studied (Int. 2 & 3) |
| Dreyersdal Road | ✅ | Class 4 Collector | North & south approach corridor, 24% of trips | ✅ Studied (Int. 1 & 4) |
| Homestead Avenue | ✅ | Class 5 Local | East approach, 21% of trips | ✅ Studied (Int. 2) |
| Children's Way | ✅ | Class 5 Local | East approach, 25% of trips | ✅ Studied (Int. 3) |
| Firgrove Way | ✅ | Class 4 Collector | Northern connector, 11% of trips | ✅ Studied (Int. 1) |

### 3.2 Local Streets — The "Last Mile" (critical, unstudied)
All 100% of school-bound vehicles must pass through this tier for the final approach. None formally analysed in the TIA.

| Road | OSM Confirmed | Class | Sim Role | TIA Coverage |
|---|---|---|---|---|
| Ruskin Road | ✅ | Class 5 Local | **School ingress — 100% of AM trips** | ❌ Never studied |
| Aristea Road | ✅ | Class 5 Local | **School egress — 100% of AM trips** | ❌ Never studied |
| Starke Road | ✅ | Class 5 Local | Primary local collector, ~22% of trips N+S | ❌ Never studied |
| Christopher Road | ✅ | Class 5 Local | Secondary local collector, ~17% of trips | ❌ Never studied |
| Leyden Road | ✅ | Class 5 Local | Ingress junction arm, 3% of trips | ❌ Never studied |
| Vineyard Road | ✅ | Class 5 Local | North-south connector between Ruskin and Dreyersdal — direct cut-through to ingress | ❌ Not mentioned in TIA |
| Dante Road | ✅ | Class 5 Local | Runs parallel to Aristea Rd one block east — immediate egress overflow route | ❌ Not mentioned in TIA |
| Dante Close | ✅ | Class 5 Local (cul-de-sac) | Dead-end off Dante Rd opposite school southern boundary — deadlock risk | ❌ Not mentioned in TIA |
| Airlie Road | ✅ | Class 5 Local | East-west cut between Aristea and Dante — direct rat-run linking egress to residential grid | ❌ Not mentioned in TIA |

### 3.3 Secondary Residential Feeders — Model as Origin/Overflow (unstudied)
These roads feed traffic into the primary and last-mile networks. They will carry overflow when principal routes saturate. None mentioned in the TIA.

| Road | OSM Confirmed | Direction | Overflow Role | TIA Coverage |
|---|---|---|---|---|
| Clement Way | ✅ | East-west, off Dreyersdal | Residential connector feeding Dreyersdal from the east | ❌ Not mentioned |
| Protea Road | ✅ | East-west, Homestead Ave area | Links Homestead Ave catchment to Dreyersdal | ❌ Not mentioned |
| Pekalmy Road | ✅ | Short north-south, off Homestead | Feeds Homestead Ave from northern residential | ❌ Not mentioned |
| Timber Road | ✅ | Off Homestead Ave | Short residential feeder into Homestead Ave | ❌ Not mentioned |
| Mutual Way | ✅ | Off Homestead Ave area | Residential connector into Homestead Ave catchment | ❌ Not mentioned |
| Kelvin Road | ✅ | Southern, feeds Children's Way | Southern approach into Children's Way catchment | ❌ Not mentioned |
| Silverhurst Way / Silverway | ✅ | Eastern connector | Eastern approach feeding into Children's Way / Main Rd corridor | ❌ Not mentioned |

### 3.4 Rat-Run Routes — Confirmed via OSM (model as triggered overflow)
Activated in simulation when primary route v/c exceeds threshold. Ordered by likelihood of use.

| Rat-Run Route | OSM Confirmed | Trigger | Mechanism | Risk |
|---|---|---|---|---|
| Aristea Rd → **Dante Rd** (parallel egress) | ✅ | Aristea Rd egress backs up | Drivers exit Aristea, loop one block east onto Dante Rd southbound | Pushes egress overflow deep into residential grid; Dante Close creates deadlock |
| **Airlie Rd** cut (Aristea↔Dante shortcut) | ✅ | Aristea Rd or Dante Rd congestion | East-west cut directly between the two egress-parallel roads | Concentrates conflict at both junctions simultaneously |
| Starke Rd → Christopher Rd → Ruskin Rd | ✅ | Main Rd / Dreyersdal congestion | 70% external traffic funnels off collector network onto Class 5 streets | Overloads three unstudied roads simultaneously |
| **Vineyard Rd** → Ruskin Rd (ingress shortcut) | ✅ | Starke Rd / Christopher Rd backup | North-south shortcut directly to ingress, bypasses Starke Rd queue | Narrows to single-file; no capacity data |
| Homestead Ave → Protea Rd / Clement Way → Dreyersdal | ✅ | Homestead Ave backup from Ladies Mile | Drivers cut through residential grid to rejoin Dreyersdal north of the jam | Spreads congestion across multiple unstudied residential streets |
| Pekalmy Rd / Timber Rd / Mutual Way → Homestead Ave | ✅ | Homestead Ave queue building from east | Drivers approach Homestead Ave via parallel residential connectors | Turns quiet residential streets into school-run cut-throughs |
| Kelvin Rd → Children's Way (southern approach) | ✅ | Children's Way queue at Ladies Mile | Southern approach into Children's Way avoids the Ladies Mile junction | Uncontrolled merge onto already-loaded collector |
| Silverhurst Way → Main Rd / Children's Way | ✅ | Eastern approach congestion | Alternative eastern access toward school via Silverhurst corridor | Adds load to unstudied eastern residential grid |
| Ladies Mile → estate alternate entries | ✅ | Children's Way queue | Drivers seek alternate entries south of the Ladies Mile / Children's Way junction | Displaces congestion into southern residential neighbourhood |
| Simon van der Stel Freeway (M3) off-ramp redistribution | ✅ | M3 not modelled but relevant | M3 is the primary western boundary feeder — congestion on Main Rd (M4) may push drivers to use M3 off-ramps and approach from the west | Adds an unmodelled external demand vector |

### 3.5 OSM Validation Notes
| Item | Status |
|---|---|
| All 20 roads above confirmed present on OSM at zoom level 16 | ✅ |
| Ladies Mile Rd labelled "Lantern Road" on OSM | ⚠️ Naming discrepancy — simulator to show both names |
| Dante Close confirmed as cul-de-sac (dead end) | ✅ Deadlock risk confirmed |
| Airlie Road confirmed east-west between Aristea and Dante | ✅ Rat-run confirmed viable |
| Vineyard Road confirmed north-south Ruskin↔Dreyersdal | ✅ Ingress shortcut confirmed viable |
| Simon van der Stel Freeway (M3) western boundary | ✅ Visible — origin feeder, not modelled as road segment |

---

## 4. Simulator Engine Selection

### 4.1 Open-Source Simulator Research Summary

Seven open-source traffic simulators were evaluated for fit. The full comparison is below:

| Simulator | Tech | Browser? | Embeddable? | Traffic Model | Fit |
|---|---|---|---|---|---|
| **traffic-simulation.de** (movsim) | JavaScript + HTML5 Canvas | ✅ Yes | ✅ Yes — pure JS | IDM/ACC + MOBIL lane-change | ⭐⭐⭐⭐⭐ |
| **A/B Street** | Rust → WASM | ✅ Yes | ⚠️ Complex 50MB+ bundle | Agent-based, OSM-driven | ⭐⭐⭐⭐ |
| **Eclipse SUMO** | C++ / Python | ❌ Desktop | ❌ Not feasible | Full microscopic, industry standard | ⭐⭐ |
| **CityFlow** | C++ + Python API | ❌ Backend | ❌ Not feasible | RL signal-control focused | ⭐ |
| **OpenTrafficSim** | Java (TU Delft) | ❌ Desktop | ❌ Not feasible | Multi-level micro/macro | ⭐ |
| **MovSim (Java)** | Java + XML | ❌ Desktop | ❌ Not feasible | IDM/ACC multi-model | ⭐ |
| **JSTrafficSimulator** | JavaScript | ✅ Yes | ✅ Yes | IDM/ACC (movsim-based) | ⭐⭐⭐ |

### 4.2 Recommended Engine: traffic-simulation.de (movsim/traffic-simulation-de)

**Repository:** https://github.com/movsim/traffic-simulation-de  
**License:** GPL-3.0  
**Stars:** ~1,000 ⭐ | **Last active:** 2024

This is the clear winner. Key reasons:

- **Pure JavaScript + HTML5 Canvas** — drops directly into a browser artifact with zero install, no backend, and no WASM complexity. The entire engine is ~1,500 lines of JS
- **Academically rigorous physics** — implements the **Intelligent Driver Model (IDM/ACC)** and **MOBIL lane-change model**, the same car-following framework used in professional traffic engineering and referenced in the textbook *Traffic Flow Dynamics* (Treiber & Kesting, 2013) — the same theoretical basis underpinning the TIA methodology
- **Built-in interactive controls** — sliders for inflow rate, desired speed, time headway, truck percentage etc. map directly to our H/M/L scenario parameters and What if... toggles
- **Road network objects** — supports links, on-ramps, intersections, and conflict zones that directly model our Ruskin Rd / Starke Rd / Dreyersdal Rd / Main Rd network topology
- **Proven embeddability** — the same author's site (traffic-simulation.de) runs it in-browser with no server dependency; multiple academic forks confirm its adaptability

**Why not A/B Street (the next best):** A/B Street would give us actual OSM streets of Bergvliet with real geometry, which is compelling. However it compiles to a 50MB+ Rust/WASM bundle that cannot be embedded in a React artifact and requires a separate web server to host. It remains a viable option if the project evolves to a standalone hosted tool.

**Why not SUMO:** The industry gold standard for professional traffic engineering, but it is a desktop C++ application with no browser deployment path — completely wrong for this use case.

### 4.3 Integration Approach: IDM Core Re-implemented in React

Rather than embedding the traffic-simulation.de files directly (they require a local file server for asset loading and use global JS variables incompatible with React's module system), the implementation approach is to **re-implement the IDM/ACC model core natively in the React artifact** — approximately 150 lines of JavaScript — using traffic-simulation.de's road network architecture as the direct blueprint.

This gives us:
- Full control over the Bergvliet road layout without adapting foreign HTML/canvas scaffolding
- The H/M/L + What if... UI wired directly to IDM parameters
- No external dependencies, no CORS issues, no asset loading
- The same physics that traffic-simulation.de uses, with attribution to Treiber/Kesting

### 4.4 IDM Parameter Mapping to Our Simulation Variables

The IDM model governs each vehicle's acceleration based on five parameters. Each maps directly to one or more of our TIA variables and What if... toggles:

| IDM Parameter | Meaning | TIA Baseline Value | What if... Toggle Effect |
|---|---|---|---|
| `v0` — desired speed | Free-flow target speed | Arterial: 60 km/h; Class 5: 30 km/h | Narrow carriageway: reduces to 20 km/h |
| `T` — time headway | Gap a driver keeps to the car ahead | 1.5s (standard) | Parking conflict: increases to 2.5s (merging delays) |
| `a` — max acceleration | How fast vehicles speed up | 1.4 m/s² | Marshal toggle: improves junction throughput |
| `b` — comfortable deceleration | How hard drivers brake | 2.0 m/s² | Pedestrian conflict: reduces to 1.2 m/s² (cautious driving) |
| `s0` — minimum gap | Bumper-to-bumper gap at standstill | 2.0m | Narrow carriageway: increases to 3.5m (passing constraint) |

The **inflow rate** (vehicles/hour entering each road from its origin) is set directly from the TIA trip distribution percentages × total peak trips for the active scenario.

### 4.5 Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React + Tailwind CSS | Single `.jsx` artifact — no separate files |
| Simulation engine | IDM/ACC (re-implemented from traffic-simulation.de blueprint) | ~150 lines of JS, in-memory only |
| Rendering | HTML5 Canvas via `useRef` + `requestAnimationFrame` | Vehicles as coloured dots; roads as canvas paths |
| Road network | Custom JS road segment objects (traffic-simulation.de architecture) | Hardcoded to Bergvliet network topology |
| State management | React `useState` / `useReducer` | No `localStorage` — all in-memory |
| Map tiles | None | Stylised schematic only — no licensing issues |

---

## 5. Two-Layer UI Architecture

The simulator has two distinct layers that operate simultaneously. The layer model is the central design principle — it lets any audience immediately see the gap between the official TIA picture and reality.

### 5.1 Layer Model

| | Layer 1: TIA Baseline | Layer 2: "What if..." |
|---|---|---|
| **What it shows** | The TIA as submitted — official figures, no missing variables applied | The three groups of variables the TIA omitted, toggled on top of Layer 1 |
| **Controls** | H / M / L scenario selector | Three expandable toggle groups |
| **State** | Always visible; cannot be hidden | Each group independently on/off; individual items within groups also toggled |
| **Combined states** | 3 scenarios | Up to 6 combinations (each scenario × What if... overlay active or not) |
| **Visual indicator** | Clean simulation, road colours per TIA LOS | Overlay badge: "⚠ What if active" + changed roads pulse/highlight |

The **6 possible combinations** are:

| Combination | Description |
|---|---|
| H + No What if | TIA worst case, as submitted |
| H + What if ON | TIA worst case + reality corrections applied |
| M + No What if | TIA medium case, as submitted |
| M + What if ON | TIA medium case + reality corrections |
| L + No What if | TIA optimistic case, as submitted |
| L + What if ON | TIA optimistic case + reality corrections |

### 5.2 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🏫 Tokai HS Morning Traffic Simulator          ⚠ What if... ACTIVE      │
├────────────────────────────────────────┬─────────────────────────────────┤
│                                        │  ── LAYER 1: TIA BASELINE ──    │
│                                        │  Scenario:  [H]  [M]  [L]       │
│   ROAD MAP / ANIMATION                 │  AM Peak Trips:  840             │
│   (SVG schematic — no map tiles)       │  Peak Window:    60 min          │
│                                        │  Time:  [▶]  [⏸]  [↺]          │
│   • Moving vehicle dots                │  Speed: [──●──] 1x – 5x         │
│   • Blue = inbound                     │                                  │
│   • Orange = outbound                  │  ── LAYER 2: WHAT IF... ──      │
│   • Yellow = rat-run                   │                                  │
│   • Grey = queued                      │  🚗 Road Capacity Realities      │
│                                        │     [collapsed / expanded ▼]    │
│   Road heat: 🟢🟡🟠🔴⬛ per v/c        │                                  │
│                                        │  📋 Demand Management            │
│   Queue bars visible at:               │     [collapsed / expanded ▼]    │
│   • Ruskin Rd ingress                  │                                  │
│   • Main/Dreyersdal junction           │  🚶 Modal Split                  │
│   • Starke Rd merge                    │     [collapsed / expanded ▼]    │
│   • Christopher Rd                     │                                  │
│                                        │  ── LIVE COUNTERS ──             │
│                                        │  Ruskin Rd queue:  ## veh        │
│                                        │  Main/Dreyersdal:  ##s wait      │
│                                        │  Starke Rd load:   ##%           │
│                                        │  Christopher Rd:   ##%           │
│                                        │  Total vehicles:   ## active     │
└────────────────────────────────────────┴─────────────────────────────────┤
│  ZONE TABLE:  Road | Queue | Wait | v/c | LOS | Δ vs TIA baseline        │
└──────────────────────────────────────────────────────────────────────────┘
```

The **Δ vs TIA baseline** column in the zone table is key — it shows the numerical difference that each active "What if..." group is making in real time (e.g. "−120 vehicles", "+2m 30s wait").

### 5.3 Layer 1 — TIA Baseline Scenario Definitions

These are locked to TIA figures. No missing variables applied.

| Parameter | High (H) | Medium (M) | Low (L) |
|---|---|---|---|
| Total AM vehicle trips | **840** (TIA, no reduction) | **650** (notional 15% reduction) | **500** (notional 40% reduction) |
| Peak arrival window | 45 min (sharp peak) | 60 min | 75 min |
| Rat-run activation threshold | 70% capacity | 80% capacity | 85% capacity |
| Drop-off dwell time | 45s (TIA assumption) | 45s | 45s |
| Carriageway constraint | Not applied | Not applied | Not applied |
| Modal split | 0% (TIA as-submitted) | 0% | 0% |
| School Travel Plan | No | No | No |

### 5.4 Layer 2 — "What if..." Toggle Groups

Each group is an accordion panel in the sidebar. Groups can be toggled independently. Within each group, individual items can be switched on/off. When any item is active, the simulation recalculates live and the road heat map updates.

---

#### Group A — 🚗 Road Capacity Realities
*What the TIA ignored about the physical constraints of the roads*

| Toggle | Effect on Simulation | TIA Gap |
|---|---|---|
| **On-street parking conflict** (22 bays on Ruskin Rd) | Reduces Ruskin Rd effective capacity by 35%; models loss of one moving lane during drop-off | TIA proposes 22 on-street bays on the ingress road — conflict never assessed |
| **Narrow carriageway friction** (Ruskin Rd Class 5) | Applies 0.85 capacity multiplier to Ruskin Rd; vehicles slow when opposing traffic present | Class 5 road width never formally evaluated against 840 peak trips |
| **Pedestrian-vehicle conflict** (no footpaths) | Applies 0.80 capacity multiplier; learners walking on carriageway create friction | No sidewalks on Ruskin or Aristea Rd; TIA recommends 2m paths but doesn't model the gap period |
| **Aristea Rd egress delay** (cul-de-sac geometry) | Adds 30s per-vehicle delay at egress; models turning/reversing constraint | No swept-path or turning circle analysis presented for cul-de-sac conversion |

When this group is active, Ruskin Rd and Aristea Rd visually "tighten" — queue bars extend, road heat intensifies, and the zone counter shows effective capacity vs TIA-assumed capacity.

---

#### Group B — 📋 Demand Management
*Interventions that reduce or redistribute traffic — none recommended in the TIA*

| Toggle | Effect on Simulation | TIA Gap |
|---|---|---|
| **School Travel Plan (STP)** | Reduces total vehicle trips by 15% (conservative STP estimate) | No STP or TDM strategy recommended anywhere in the TIA |
| **Staggered bell times** (15-min split) | Spreads arrival spike across two waves; softens the peak sharply | Single bell assumed throughout — worst-case peaking never stress-tested |
| **Traffic marshal at Ruskin/Leyden** | Increases Ruskin/Leyden junction throughput by 25%; reduces ingress queue | No marshal or traffic management plan proposed for peak drop-off |

When all three are active together, the simulation shows the realistic "managed" scenario — what the school *could* achieve with basic operational measures.

---

#### Group C — 🚶 Modal Split
*Trips that don't generate a car — ignored entirely in the TIA*

| Toggle | Effect on Simulation | TIA Gap |
|---|---|---|
| **Walkers & cyclists** (15% of learners) | Removes ~126 vehicles from peak; shown as pedestrian icons on map | TIA states "no reduction factors applied" for middle-to-high income area — contested by review |
| **Public transport** (MBT / GABS, 10%) | Removes ~84 vehicles; shown as bus icons on Ladies Mile / Main Rd routes | MBT and GABS routes on Main Rd and Ladies Mile Rd entirely unacknowledged |
| **Lift clubs** (5% of families share) | Removes ~42 vehicles (assumes avg 2 learners per lift club car) | No lift club or carpooling factor modelled |

When all three are active, total vehicle load drops by ~30% — the simulation shows what a realistic modal split assessment would have produced vs the TIA's zero-reduction assumption.

### 5.5 Colour Coding

#### Vehicles
| Colour | Meaning |
|---|---|
| 🔵 Blue | Inbound vehicle (approaching school) |
| 🟠 Orange | Outbound vehicle (leaving school / post drop-off) |
| 🟡 Yellow | Rat-run / backroad diversion vehicle |
| ⚫ Dark grey | Queued / stationary vehicle |
| 🟣 Purple | "What if..." overlay vehicle (only appears when Layer 2 changes routing) |

#### Road Segments (congestion heat)
| Colour | LOS | v/c Ratio |
|---|---|---|
| 🟢 Green | A–B | < 0.60 |
| 🟡 Yellow | C | 0.60–0.75 |
| 🟠 Amber | D | 0.75–0.90 |
| 🔴 Red | E | 0.90–1.00 |
| ⬛ Dark Red | F — Failure | > 1.00 |

Roads with active "What if..." overlays display a **dashed border pulse** to indicate they are modified from the TIA baseline. The zone table Δ column shows the before/after delta numerically.

---

## 6. Zone Counter Displays

Each key zone shows a live panel during simulation:

```
┌─────────────────────────────────────┐
│ ZONE: Ruskin Road Ingress           │
│ Vehicles queued:        ████ 42     │
│ Avg wait time:          6m 20s      │
│ Current v/c:            1.18  🔴    │
│ Status:                 FAILURE     │
└─────────────────────────────────────┘
```

Zones to instrument:
1. **Ruskin Rd / Leyden Rd** — ingress queue + drop-off stack
2. **Main Rd / Dreyersdal Rd** — the known LOS F failure point
3. **Starke Road** — north and south approach loads
4. **Christopher Road** — load and spillback
5. **Aristea Road** — egress queue after school
6. **Children's Way / Ladies Mile entry** — eastern approach pressure
7. **Homestead Ave / Starke Rd junction** — eastern corridor merge point

---

## 7. Variables Missing from the TIA Model

All missing variables are exposed in Layer 2 ("What if..." groups). The table below maps each variable to its group and quantifies the simulation effect.

| Missing Variable | Layer 2 Group | Simulation Effect | TIA Gap |
|---|---|---|---|
| On-street parking conflict (Ruskin Rd) | 🚗 Road Capacity | −35% Ruskin Rd capacity | 22 bays on ingress road, never assessed |
| Narrow carriageway friction | 🚗 Road Capacity | ×0.85 capacity multiplier on Ruskin Rd | Class 5 width never evaluated |
| Pedestrian-vehicle conflict | 🚗 Road Capacity | ×0.80 capacity multiplier; friction on carriageway | No footpaths; TIA doesn't model gap period |
| Aristea Rd egress geometry | 🚗 Road Capacity | +30s per vehicle at egress | No swept-path or turning analysis |
| School Travel Plan / TDM | 📋 Demand Mgmt | −15% total vehicle trips | No STP recommended in TIA |
| Staggered bell times | 📋 Demand Mgmt | Splits peak into 2 waves; reduces spike | Single bell assumed throughout |
| Traffic marshal at ingress | 📋 Demand Mgmt | +25% junction throughput at Ruskin/Leyden | No traffic management plan proposed |
| Walker / cyclist modal split | 🚶 Modal Split | −15% vehicles (~126 fewer trips) | Zero reduction factor applied |
| Public transport (MBT / GABS) | 🚶 Modal Split | −10% vehicles (~84 fewer trips) | Bus routes entirely unacknowledged |
| Lift clubs / carpooling | 🚶 Modal Split | −5% vehicles (~42 fewer trips) | No carpooling factor modelled |

**Variables intentionally excluded from Layer 2** (dropped from earlier draft per user decision):
- Future school extension trips — relevant but de-scoped
- Background traffic growth — de-scoped
- Weather / rain effect — de-scoped
- CoCT Main Rd upgrade timing — de-scoped

---

## 8. Build Plan — Phased Delivery

**Engine basis:** IDM/ACC re-implemented from traffic-simulation.de (movsim/traffic-simulation-de, GPL-3.0) blueprint. All vehicle movement physics are based on Treiber & Kesting (2013), *Traffic Flow Dynamics*, Springer.

### Phase 1 — Static Schematic Map + Layer 1 Scenario Panel ✅ COMPLETE
- Stylised SVG road network of Bergvliet area
- H / M / L scenario toggle wired to trip counts and road heat colours (v/c-based)
- Layer 2 "What if..." panel structure present with all three groups and individual toggles
- Zone counter panels with v/c, queue estimate, wait time, and Δ vs baseline
- Zone table at bottom with LOS colour coding

**Deliverable:** `TokaiTrafficSim.jsx` (React artifact)  
**Status:** ✅ Built

### Phase 2 — IDM Vehicle Animation
- Integrate IDM/ACC core engine (~150 lines) into the React artifact
- Road segment objects modelled on traffic-simulation.de architecture, mapped to Bergvliet topology
- Vehicle agents spawned at origin points per TIA trip distribution percentages
- Animated vehicle dots on Canvas: blue (inbound), orange (outbound), yellow (rat-run), grey (queued)
- Queue accumulation at Ruskin Rd ingress — vehicles stack, slow, and wait using IDM physics
- Play / Pause / Reset controls + simulation speed multiplier slider (1×–5×)
- Rat-run diversion: when a road segment v/c exceeds threshold, a proportion of vehicles reroute to backroad alternative

**IDM parameters wired to scenario:**
- `v0` set per road class (arterial 60 km/h, Class 5 30 km/h)
- `inflow` set from scenario trip count × origin distribution %
- All five IDM parameters adjustable via What if... toggles (§4.4)

**Deliverable:** Updated `.jsx` artifact with live animation  
**Effort:** 1–2 build sessions

### Phase 3 — Layer 2 "What if..." Live on IDM Engine
- Wire all three toggle groups to IDM parameter changes (not just v/c multipliers)
- Road Capacity toggles modify `T`, `s0`, `v0` and effective lane capacity in the engine
- Demand Management toggles modify inflow rate and peak distribution timing
- Modal Split toggles remove vehicles from the spawn queue before they enter the network
- Zone table Δ column updates in real time from actual IDM output (queue length, mean speed, delay)
- "⚠ What if... ACTIVE" badge pulses; modified road segments shown with dashed canvas stroke

**Deliverable:** Full two-layer interactive `.jsx` artifact  
**Effort:** 1–2 build sessions

### Phase 4 — Polish & Clarity
- Summary stats bar: peak duration, worst LOS, max queue length, total vehicles removed by active What if... groups
- "Reset to TIA baseline" single button
- Active combination label: e.g. "High + Road Capacity Realities + Modal Split"
- Colour-blind safe palette toggle
- Attribution footer: "Vehicle physics based on IDM/ACC model — Treiber & Kesting (2013), via movsim/traffic-simulation-de (GPL-3.0)"

---

## 9. Assumptions & Caveats

1. **This is a communicative visualisation, not a certified traffic model.** Results should not be used for regulatory submissions without a qualified traffic engineer's sign-off.
2. Vehicle movement physics are based on the **Intelligent Driver Model (IDM/ACC)** as implemented in movsim/traffic-simulation-de (GPL-3.0) by Treiber & Kesting. The IDM is academically validated but the parameter values used here are estimates calibrated to road class, not site-measured data.
3. Trip distribution percentages are taken directly from TIA §13 and applied as inflow rates to IDM road segments proportionally to total vehicle counts per scenario.
4. Road capacities and IDM parameters for Class 5 local streets are estimated from standard South African guidelines (HCM adapted for SA context) since the TIA did not formally assess them — these are the most uncertain inputs in the model.
5. Rat-run routing logic is heuristic — vehicles divert when their primary route's mean speed drops below a threshold; real driver behaviour involves information lag and route familiarity effects not modelled here.
6. The simulation time step is 0.5 seconds of simulated time per frame; the IDM is numerically stable at this resolution for the speed ranges involved.
7. No turning movement analysis is modelled at intersections — merge/yield conflicts are approximated via IDM gap acceptance on connecting road segments.
8. The A/B Street simulator (Rust/WASM, Apache 2.0) is noted as a future upgrade path if the project requires real OSM street geometry and a hosted standalone tool, at the cost of significantly higher deployment complexity.

---

## 10. Success Criteria

- [ ] All 20 OSM-validated roads represented in simulator (§3.1–3.4), with correct tier grouping
- [ ] Dante Road, Airlie Road, and Vineyard Road modelled as active rat-run routes alongside the original four
- [ ] Dante Close deadlock risk visible when Dante Rd egress overflow activates
- [ ] Ladies Mile / Lantern Road naming discrepancy noted in UI tooltip
- [ ] Vehicle movement driven by IDM/ACC physics — vehicles slow, queue, and brake realistically rather than teleporting or moving at fixed speeds
- [ ] Queue build-up on Ruskin Road emerges organically from IDM physics in the High scenario (not hardcoded)
- [ ] Rat-run activation shows on Starke Rd and Christopher Rd when primary routes saturate
- [ ] All three Layer 2 "What if..." groups independently toggleable with live IDM parameter changes
- [ ] Individual items within each group independently toggleable
- [ ] Zone table Δ column shows real-time numerical delta vs TIA baseline when What if... active
- [ ] "⚠ What if... ACTIVE" indicator clearly visible when any Layer 2 toggle is on
- [ ] Modified roads visually distinguishable from TIA-baseline roads (dashed canvas stroke)
- [ ] All 6 scenario combinations (3 × 2 layers) produce meaningfully different vehicle behaviour
- [ ] Non-technical stakeholders can understand both layers within 2 minutes of viewing
- [ ] Runs entirely in-browser with no backend, no external CDN dependencies for the engine, no CORS issues
- [ ] Attribution to Treiber/Kesting and movsim/traffic-simulation-de present in UI footer

---

## 11. References & Attribution

- **TIA source data:** ITS Global, *Transport Impact Assessment — Tokai High School, Bergvliet*, ITS 4839, July 2025 (Draft)
- **Independent review:** ITS Global Independent Review, March 2026
- **Vehicle physics model:** Treiber, M. & Kesting, A. (2013). *Traffic Flow Dynamics: Data, Models and Simulation*. Springer. https://doi.org/10.1007/978-3-642-32460-4
- **IDM reference implementation:** movsim/traffic-simulation-de (GPL-3.0). https://github.com/movsim/traffic-simulation-de
- **IDM original paper:** Treiber, M., Hennecke, A., & Helbing, D. (2000). Congested traffic states in empirical observations and microscopic simulations. *Physical Review E*, 62, 1805–1824.
- **MOBIL lane-change model:** Kesting, A., Treiber, M., & Helbing, D. (2007). General lane-changing model MOBIL for car-following models. *Transportation Research Record*, 86–94.
- **Road classification:** South African Road Classification and Access Management Manual, TRH26 v1.0 (2012)
- **Trip generation:** South African Trip Data Manual, TMH17 v1.1, COTO (2013)

---

*Document prepared: March 2026 | v4 — OSM-validated road network via OpenStreetBrowser*  
*Based on TIA ITS 4839 (July 2025), ITS Global Independent Review (March 2026), movsim/traffic-simulation-de engine research, and OSM validation at zoom 16 / -34.0476 / 18.4565*
