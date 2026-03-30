# Tokai HS Traffic Simulator — Offline Simulation & Road Watcher

**Date:** 2026-03-30
**Branch:** `osm`
**Status:** Approved design — pending implementation

---

## 1. Purpose

Add three capabilities to the existing simulator:

1. **Offline simulation pipeline** — run UXsim (Python, macroscopic) locally to produce pre-computed scenario files that the frontend can play back
2. **Playback engine** — a `SimulationSource` abstraction that lets the frontend consume either the live IDM engine or a pre-computed JSON file through the same interface
3. **Road Watcher** — click any road on the map to see how many vehicles travel that road during the AM peak, with a time-series breakdown and per-direction delay stats

SUMO integration is scoped as a future extension; its converter stub is included but not implemented.

---

## 2. Scope & Assumptions

- OSM GeoJSON enrichment (`data/network-L2.geojson`, `data/routes.geojson`) is **in progress as a separate task** and is treated as an input assumption — it will be available before this feature is implemented.
- The Python pipeline (`sim/`) runs locally on the developer's machine. It is **not deployed**.
- Pre-computed output files (`public/sim-results/*.json`) are committed to the repo and deployed with the static site.
- The existing IDM live engine (`src/engine/idm.js`, `spawner.js`, `routes.js`) is **unchanged**.
- UXsim is macroscopic (flow/density per link, not individual vehicle positions). Vehicle dots on the map are synthesised from link-level flow data using linear position interpolation.

---

## 3. Architecture

```
Python (offline, developer machine)
  data/network-L2.geojson  (enriched OSM — separate task)
        │
  sim/network_builder.py   reads GeoJSON → UXsim World (nodes + links)
        │
  sim/uxsim_runner.py      runs L / M / H scenarios → W.analyzer DataFrames
        │
  sim/converters/uxsim_to_json.py   converts to canonical JSON format
        │
  public/sim-results/
    scenario-L.json
    scenario-M.json
    scenario-H.json        committed + deployed as static assets

Frontend
  SimulationSource         new abstraction: "live" | "playback"
    ├── live  → IDM engine (unchanged)
    └── playback → loads scenario-*.json, synthesises vehicle positions
          │
  Shared rendering (SimMap canvas, StatsPanel) — interface unchanged
          │
  RoadWatcher              click a road → full-road stats panel
```

**Source toggle:** A `[Live] [Results]` control is added to the Header. Switching source resets the simulation. Speed multiplier works in both modes (advances `simTime`; playback seeks to the nearest frame).

---

## 4. Simulation Output Format

Full format reference: `docs/sim-output-format.md`

### 4.1 Top-level schema

```json
{
  "meta": {
    "scenario": "H",
    "source": "uxsim",
    "version": 1,
    "start_time": 23400,
    "end_time": 30600,
    "timestep": 60
  },
  "roads": [
    {
      "id": "christopher_rd",
      "name": "Christopher Road",
      "osm_ids": ["way/123456", "way/123457"],
      "direction_pairs": ["inbound", "outbound"]
    }
  ],
  "frames": [
    {
      "t": 23400,
      "vehicles": [
        {
          "id": "v001",
          "road_id": "christopher_rd",
          "progress": 0.34,
          "speed": 8.2,
          "state": "inbound"
        }
      ],
      "road_stats": [
        {
          "road_id": "christopher_rd",
          "inbound": 12,
          "outbound": 3,
          "avg_delay_in": 45,
          "avg_delay_out": 8
        }
      ]
    }
  ]
}
```

### 4.2 Field definitions

| Field | Type | Description |
|---|---|---|
| `meta.start_time` | int | Seconds since midnight (06:30 = 23400) |
| `meta.timestep` | int | Seconds between frames (60) |
| `roads[].id` | string | Stable slug used as join key throughout |
| `roads[].osm_ids` | string[] | OSM way IDs for map feature matching |
| `frames[].vehicles[].progress` | float 0–1 | Position along road geometry; used to interpolate lat/lng |
| `frames[].road_stats[].avg_delay_in` | int | Seconds of avg delay, inbound direction, this frame |

### 4.3 Native output formats and converter strategy

**UXsim** produces Python DataFrames via `W.analyzer`:

| Method | Content | Used for |
|---|---|---|
| `vehicles_to_pandas()` | Per-vehicle: link, time, position (0–1), velocity | `frames[].vehicles` |
| `link_traffic_state_to_pandas()` | Per-link per-timestep: flow (q), density (k), velocity (v) | `frames[].road_stats` |
| `link_to_pandas()` | Link aggregates: volume, avg travel time, delay ratio | Road Watcher totals |
| `output_data()` | Saves above to CSV | Alternative input for converter |

Converter: `sim/converters/uxsim_to_json.py` — runs in the same Python process as `uxsim_runner.py`.

**SUMO** produces XML natively, convertible to CSV:

| Output type | Content | Used for |
|---|---|---|
| FCD (Floating Car Data) | Per-vehicle: position, speed, angle per timestep | `frames[].vehicles` |
| `tripinfo` | Per-vehicle journey: wait time, time loss | `frames[].road_stats` avg delay |
| Edge traffic | Per-link counts | `frames[].road_stats` inbound/outbound |

Converter: `sim/converters/sumo_to_json.py` — **stub only in this version**. Parses FCD XML + tripinfo XML and maps to the same JSON schema.

Both converters are validated against `sim/converters/schema.py` (Python dataclasses).

---

## 5. Python Pipeline

### 5.1 File structure

```
sim/
  network_builder.py     reads enriched GeoJSON → UXsim World
  uxsim_runner.py        runs scenarios, calls converter, writes JSON
  requirements.txt       uxsim, pandas, shapely
  converters/
    schema.py            dataclasses: SimOutput, Frame, VehicleState, RoadStat
    uxsim_to_json.py     W.analyzer DataFrames → SimOutput → JSON
    sumo_to_json.py      FCD + tripinfo XML → SimOutput → JSON (stub)
```

### 5.2 network_builder.py

Reads `data/network-L2.geojson` (enriched OSM LineStrings + junction Points).

GeoJSON property → UXsim mapping:

| GeoJSON property | UXsim parameter |
|---|---|
| `maxspeed` (OSM) | `free_flow_speed` (m/s) |
| `lanes` (OSM) | `number_of_lanes` |
| geometry length (Shapely) | `length` (m) |
| `rat_run: true` (custom) | stored as link metadata, passed to output |
| `unstudied: true` (custom) | stored as link metadata, passed to output |

Junction Points → UXsim nodes. LineString endpoints snap to nearest node within 10m tolerance.

### 5.3 uxsim_runner.py

Runs three scenarios sequentially. Per scenario:

- Demand: TIA §13 origin-destination trip counts (same L/M/H figures as existing IDM spawner)
- Simulation period: 06:30–08:30 (t = 23400–30600 seconds)
- Timestep: 60s
- Calls `uxsim_to_json.convert(W, scenario)` → writes `public/sim-results/scenario-{L,M,H}.json`

**Run command:**
```bash
cd sim
pip install -r requirements.txt
python uxsim_runner.py
# Outputs:
#   ../public/sim-results/scenario-L.json
#   ../public/sim-results/scenario-M.json
#   ../public/sim-results/scenario-H.json
```

---

## 6. Frontend — SimulationSource Abstraction

### 6.1 Interface (`src/engine/simulationSource.js`)

Both live and playback modes implement this interface:

```js
{
  getVehicles(simTime)    // → [{ lat, lng, state, routeId }]
  getRoadStats(simTime)   // → Map<road_id, { inbound, outbound, avg_delay_in, avg_delay_out }>
  isFinished(simTime)     // → bool
  reset()                 // → void
}
```

`SimMap.jsx` and `StatsPanel.jsx` call this interface on each animation frame. No rendering code changes are required.

### 6.2 Playback mode (`src/engine/playback.js`)

- Loads `public/sim-results/scenario-{L|M|H}.json` via `fetch()` on scenario change
- `getVehicles(t)`: finds nearest frame ≤ t, linearly interpolates each vehicle's `progress` along the road's GeoJSON geometry to produce `{ lat, lng }`
- `getRoadStats(t)`: returns `road_stats` for the nearest frame directly (no interpolation)
- Loading state: returns empty arrays until fetch resolves; Header shows a loading indicator

### 6.3 Header changes

Adds `[Live] [Results]` toggle (two-button group, same visual style as `[L] [M] [H]`). Switching source:
- Resets simulation (time → 0, vehicles cleared)
- In `Results` mode, fetches the JSON for the current scenario if not already loaded

---

## 7. Road Watcher

### 7.1 Component: `src/components/RoadWatcher.jsx`

Renders a stats panel for a selected road. Receives:
- `road` — `{ id, name }` (from map click)
- `source` — current `SimulationSource` instance (to call `getRoadStats`)
- `allFrames` — in `Results` mode: the full frame array from the loaded JSON, available immediately; in `Live` mode: `null` (totals and time series build up incrementally from `getRoadStats` calls as the simulation runs)
- `onClose` — dismiss handler

### 7.2 Map interaction (`SimMap.jsx`)

- Each GeoJSON LineString feature is registered with a `click` listener
- On click: find the `name` property of the clicked feature, collect all features sharing that name (the full road), highlight them with `setStyle({ color: '#f59e0b', weight: 4 })`, set `selectedRoad` state in `App.jsx`
- Clicking elsewhere or pressing × clears `selectedRoad` and resets road styles

Road selection is identified by **name** (e.g. `"Christopher Road"`), not by individual OSM way ID — the full road highlights as one unit regardless of how many GeoJSON segments it comprises.

### 7.3 Panel layout

```
┌─────────────────────────────────────┐
│ Christopher Road              [×]   │
│                                     │
│  Total    Inbound   Outbound        │
│   312       198       114           │
│                                     │
│  Avg delay inbound:   47s           │
│  Avg delay outbound:  12s           │
│                                     │
│  ▁▃▅█▇▆▄▃▂▁  vehicles / 15 min     │
│  06:30              08:30           │
└─────────────────────────────────────┘
```

- **Totals**: summed across entire 06:30–08:30 window from `road_stats` across all frames
- **Time series**: 8 bars (15-min buckets), inbound + outbound stacked, rendered as inline SVG
- **Avg delay**: mean of `avg_delay_in` / `avg_delay_out` across all frames for this road
- **In Live mode**: totals and chart update in real time as simulation advances; full-window totals are not available until simulation completes

### 7.4 Positioning

| Viewport | Position |
|---|---|
| Desktop (≥768px) | Replaces stats panel content while a road is selected |
| Mobile (<768px) | Slides up from bottom as a sheet overlay |

---

## 8. File Structure Changes

```
sim/                            new — Python pipeline (not deployed)
  network_builder.py
  uxsim_runner.py
  requirements.txt
  converters/
    schema.py
    uxsim_to_json.py
    sumo_to_json.py             stub

public/
  sim-results/                  new — pre-computed output (deployed)
    scenario-L.json
    scenario-M.json
    scenario-H.json

src/
  engine/
    simulationSource.js         new
    playback.js                 new
    idm.js                      unchanged
    routes.js                   unchanged
    spawner.js                  unchanged
  components/
    RoadWatcher.jsx             new
    Header.jsx                  add [Live]/[Results] toggle
    SimMap.jsx                  road click handler + highlight logic
    StatsPanel.jsx              wire to simulationSource interface
    AdSlot.jsx                  unchanged

docs/
  superpowers/specs/
    2026-03-30-offline-sim-design.md   this document
  sim-output-format.md                 canonical format reference
```

---

## 9. Out of Scope (this version)

- SUMO converter implementation (stub only)
- Backend / API — pipeline is local-only
- Interactive what-if controls (deferred from v2 spec)
- Background (non-school) traffic
- Road Watcher URL sharing (`?road=...`) — deferred
- Sweet Valley Primary School demand interaction
