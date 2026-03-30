# Offline Simulation & Road Watcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a UXsim offline simulation pipeline (Python), a frontend playback engine, and a Road Watcher that shows per-road vehicle stats when a user clicks any road on the map.

**Architecture:** A Python script reads enriched OSM GeoJSON, runs UXsim, and writes pre-computed scenario JSON files to `public/sim-results/`. The frontend gains a `PlaybackSource` class (in `src/engine/playback.js`) that loads these files and serves vehicle positions and road stats through the same interface as the existing live engine. A new `RoadWatcher` component renders per-road stats when the user clicks a road segment on the map.

**Tech Stack:** Python 3.14, UXsim 1.13, pandas 3, shapely 2, pytest; React 19, Vite 8, Vitest, @testing-library/react, Leaflet

## Environment (verified 2026-03-30)

- Python 3.14, pip user install path: `C:\Users\neill\AppData\Roaming\Python\Python314\site-packages`
- SUMO 1.26.0 installed at `C:\Program Files (x86)\Eclipse\Sumo\` — binary is **not** on PATH; use full path `C:/Program Files (x86)/Eclipse/Sumo/bin/sumo.exe` or add `C:/Program Files (x86)/Eclipse/Sumo/bin` to PATH
- SUMO Python bindings (`sumolib`, `traci`) available via `eclipse-sumo` pip package — import works without extra sys.path manipulation after pip install

## UXsim 1.13 API notes (verified against installed version)

These differ from the UXsim docs referenced during design — use these exact forms:

| Item | Correct form |
|---|---|
| `World` constructor | No `dt` or `tau` params — use `reaction_time=1.5` |
| Trigger Edie-state computation | Call `W.analyzer.compute_edie_state()` **before** `link_traffic_state_to_pandas()` |
| Vehicle position column | `x` (metres from link start, not 0–1) — normalise: `progress = x / link.length` |
| Vehicle columns | `name, dn, orig, dest, t, link, x, s, v` |
| Link state columns | `link, t, x, delta_t, delta_x, q, k, v` |
| Link agg columns | `link, start_node, end_node, traffic_volume, vehicles_remain, free_travel_time, average_travel_time, stddiv_travel_time, delay_ratio, length` |

---

## Scope note — two independent phases

Phase A (Tasks 1–8) is the **Python pipeline**. It produces JSON files and can be built and tested without touching the frontend.

Phase B (Tasks 9–16) is the **frontend**. It can be built against a fixture JSON file before the Python pipeline is complete.

Both phases share the format contract in `docs/sim-output-format.md`.

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `sim/__init__.py` | Empty package marker |
| `sim/requirements.txt` | Python deps: uxsim, pandas, shapely, pytest |
| `sim/converters/__init__.py` | Empty package marker |
| `sim/converters/schema.py` | Dataclasses: `SimOutput`, `FrameData`, `VehicleState`, `RoadStat` |
| `sim/converters/uxsim_to_json.py` | `convert(W, scenario) → SimOutput` |
| `sim/converters/sumo_to_json.py` | Stub only — raises `NotImplementedError` |
| `sim/network_builder.py` | `build_network(geojson_path) → uxsim.World` |
| `sim/uxsim_runner.py` | CLI entry point: runs L/M/H, writes `public/sim-results/scenario-*.json` |
| `sim/tests/__init__.py` | Empty |
| `sim/tests/test_schema.py` | Schema dataclass + JSON roundtrip tests |
| `sim/tests/test_uxsim_to_json.py` | Converter tests with mock DataFrames |
| `sim/tests/test_network_builder.py` | Builder tests with mini fixture GeoJSON |
| `sim/tests/fixtures/mini_network.geojson` | 2 nodes + 1 link for builder tests |
| `src/engine/playback.js` | `PlaybackSource` class — load JSON, seek frames, interpolate positions |
| `src/components/RoadWatcher.jsx` | Per-road stats panel (totals, time series, avg delay) |
| `src/engine/__tests__/playback.test.js` | Vitest unit tests for PlaybackSource |
| `src/components/__tests__/RoadWatcher.test.jsx` | Vitest + RTL tests for RoadWatcher |
| `src/engine/__tests__/fixtures/scenario-fixture.json` | Minimal valid scenario JSON for frontend tests |
| `public/sim-results/.gitkeep` | Ensures directory is committed before runner output |

### Modified files

| File | Change |
|---|---|
| `package.json` | Add vitest, jsdom, @testing-library/react, @testing-library/jest-dom |
| `vite.config.js` | Add `test` config block |
| `src/App.jsx` | Add `source` state, `selectedRoad` state, `playbackFrames` state; wire RoadWatcher |
| `src/components/Header.jsx` | Add `source` + `onSourceChange` props; render `[Live] [Results]` toggle |
| `src/components/SimMap.jsx` | Accept `source` + `onRoadSelect` props; add road click/highlight; branch rAF loop for playback |
| `src/components/StatsPanel.jsx` | Accept `roadStats` prop from App; pass to display when no road selected |

---

## Phase A — Python Pipeline

---

### Task 1: Python project scaffold

**Files:**
- Create: `sim/__init__.py`
- Create: `sim/converters/__init__.py`
- Create: `sim/tests/__init__.py`
- Create: `sim/requirements.txt`
- Create: `sim/tests/fixtures/mini_network.geojson`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p sim/converters sim/tests/fixtures
touch sim/__init__.py sim/converters/__init__.py sim/tests/__init__.py
```

- [ ] **Step 2: Write requirements.txt**

```
# sim/requirements.txt
uxsim>=1.8.0
pandas>=2.0
shapely>=2.0
pytest>=8.0
```

- [ ] **Step 3: Write the mini_network fixture GeoJSON**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [18.460, -34.055] },
      "properties": { "id": "N1", "type": "junction" }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [18.462, -34.053] },
      "properties": { "id": "N2", "type": "junction" }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[18.460, -34.055], [18.461, -34.054], [18.462, -34.053]]
      },
      "properties": {
        "id": "L1",
        "name": "Test Road",
        "highway": "residential",
        "maxspeed": "30",
        "lanes": "1",
        "rat_run": false,
        "unstudied": true
      }
    }
  ]
}
```

- [ ] **Step 4: Install dependencies**

```bash
cd sim && pip install -r requirements.txt
```

Expected: all packages install without errors.

- [ ] **Step 5: Commit**

```bash
git add sim/
git commit -m "chore: scaffold Python sim pipeline directory"
```

---

### Task 2: Schema dataclasses

**Files:**
- Create: `sim/converters/schema.py`
- Create: `sim/tests/test_schema.py`

- [ ] **Step 1: Write the failing tests**

```python
# sim/tests/test_schema.py
import json
import pytest
from sim.converters.schema import SimOutput, FrameData, VehicleState, RoadStat

def test_vehicle_state_defaults():
    v = VehicleState(id="v1", road_id="test_rd", progress=0.5, speed=8.0, state="inbound")
    assert v.id == "v1"
    assert v.progress == 0.5

def test_road_stat_nullable_delay():
    r = RoadStat(road_id="test_rd", inbound=5, outbound=2, avg_delay_in=None, avg_delay_out=None)
    assert r.avg_delay_in is None

def test_frame_data():
    v = VehicleState(id="v1", road_id="r1", progress=0.1, speed=5.0, state="inbound")
    r = RoadStat(road_id="r1", inbound=1, outbound=0, avg_delay_in=10, avg_delay_out=None)
    f = FrameData(t=23400, vehicles=[v], road_stats=[r])
    assert f.t == 23400
    assert len(f.vehicles) == 1

def test_simoutput_json_roundtrip():
    v = VehicleState(id="v1", road_id="r1", progress=0.34, speed=8.2, state="inbound")
    r = RoadStat(road_id="r1", inbound=12, outbound=3, avg_delay_in=45, avg_delay_out=8)
    f = FrameData(t=23400, vehicles=[v], road_stats=[r])
    out = SimOutput(
        meta={"scenario": "H", "source": "uxsim", "version": 1,
              "start_time": 23400, "end_time": 30600, "timestep": 60},
        roads=[{"id": "r1", "name": "Test Road", "osm_ids": [], "direction_pairs": ["inbound", "outbound"]}],
        frames=[f]
    )
    serialised = json.loads(out.to_json())
    assert serialised["meta"]["scenario"] == "H"
    assert serialised["frames"][0]["t"] == 23400
    assert serialised["frames"][0]["vehicles"][0]["progress"] == 0.34
    assert serialised["frames"][0]["road_stats"][0]["avg_delay_in"] == 45
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd sim && pytest tests/test_schema.py -v
```

Expected: `ModuleNotFoundError: No module named 'sim.converters.schema'`

- [ ] **Step 3: Write schema.py**

```python
# sim/converters/schema.py
from __future__ import annotations
import json
import dataclasses
from typing import Optional

@dataclasses.dataclass
class VehicleState:
    id: str
    road_id: str
    progress: float   # 0.0–1.0 along road geometry
    speed: float      # m/s
    state: str        # "inbound" | "outbound" | "queued" | "rat_run"

@dataclasses.dataclass
class RoadStat:
    road_id: str
    inbound: int
    outbound: int
    avg_delay_in: Optional[int]   # seconds, None if no vehicles
    avg_delay_out: Optional[int]

@dataclasses.dataclass
class FrameData:
    t: int                        # seconds since midnight
    vehicles: list[VehicleState]
    road_stats: list[RoadStat]

@dataclasses.dataclass
class SimOutput:
    meta: dict
    roads: list[dict]
    frames: list[FrameData]

    def to_json(self) -> str:
        def _serialise(obj):
            if dataclasses.is_dataclass(obj):
                return dataclasses.asdict(obj)
            raise TypeError(f"Not serialisable: {type(obj)}")
        return json.dumps(dataclasses.asdict(self), default=_serialise, indent=2)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd sim && pytest tests/test_schema.py -v
```

Expected: 4 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add sim/converters/schema.py sim/tests/test_schema.py
git commit -m "feat: add SimOutput schema dataclasses with JSON serialisation"
```

---

### Task 3: network_builder.py

**Files:**
- Create: `sim/network_builder.py`
- Create: `sim/tests/test_network_builder.py`

- [ ] **Step 1: Write the failing tests**

```python
# sim/tests/test_network_builder.py
import pytest
import os
from sim.network_builder import build_network

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "mini_network.geojson")

def test_build_network_returns_world():
    import uxsim
    W = build_network(FIXTURE)
    assert isinstance(W, uxsim.World)

def test_network_has_nodes():
    W = build_network(FIXTURE)
    assert len(W.NODES) >= 2

def test_network_has_links():
    W = build_network(FIXTURE)
    assert len(W.LINKS) >= 1

def test_link_speed_from_maxspeed_tag():
    W = build_network(FIXTURE)
    link = W.LINKS[0]
    # maxspeed = "30" km/h → 30/3.6 ≈ 8.33 m/s
    assert abs(link.u - 30/3.6) < 0.1

def test_link_has_metadata():
    W = build_network(FIXTURE)
    link = W.LINKS[0]
    # custom attrs stored on link
    assert hasattr(link, "osm_name")
    assert link.osm_name == "Test Road"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd sim && pytest tests/test_network_builder.py -v
```

Expected: `ModuleNotFoundError: No module named 'sim.network_builder'`

- [ ] **Step 3: Write network_builder.py**

```python
# sim/network_builder.py
"""
Reads an enriched OSM GeoJSON (LineStrings + Points) and builds a UXsim World.

GeoJSON LineString properties used:
  maxspeed (str, km/h)   → link free-flow speed
  lanes    (str, int)    → number of lanes
  name     (str)         → stored as link.osm_name
  rat_run  (bool)        → stored as link.rat_run
  unstudied (bool)       → stored as link.unstudied

GeoJSON Point properties used:
  id       (str)         → node name

LineString endpoints are snapped to the nearest Point node within 10m.
"""
import json
import math
from shapely.geometry import shape, Point as SPoint
import uxsim

_SNAP_TOLERANCE_M = 10.0
_EARTH_R = 6_371_000.0

def _haversine(a, b):
    """Metres between two (lon, lat) pairs."""
    lon1, lat1 = math.radians(a[0]), math.radians(a[1])
    lon2, lat2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * _EARTH_R * math.asin(math.sqrt(h))

def _line_length_m(coords):
    return sum(_haversine(coords[i], coords[i+1]) for i in range(len(coords)-1))

def _nearest_node(coord, nodes):
    best, best_d = None, float("inf")
    for nid, ncoord in nodes.items():
        d = _haversine(coord, ncoord)
        if d < best_d:
            best_d, best = d, nid
    return best if best_d <= _SNAP_TOLERANCE_M else None

def build_network(geojson_path: str) -> uxsim.World:
    with open(geojson_path, encoding="utf-8") as f:
        fc = json.load(f)

    # Collect nodes (Point features)
    node_coords = {}  # id → [lon, lat]
    for feat in fc["features"]:
        if feat["geometry"]["type"] == "Point":
            nid = feat["properties"].get("id", str(len(node_coords)))
            node_coords[nid] = feat["geometry"]["coordinates"]

    W = uxsim.World(
        name="tokai",
        deltan=5,         # platoon size
        tmax=30600,       # 08:30 in seconds since midnight
        dt=30,
        tau=1.5,
        show_progress=False,
    )

    # Add nodes
    for nid, (lon, lat) in node_coords.items():
        W.addNode(nid, lon, lat)

    # Add links (LineString features)
    for feat in fc["features"]:
        if feat["geometry"]["type"] != "LineString":
            continue
        props = feat["properties"]
        coords = feat["geometry"]["coordinates"]

        start_coord, end_coord = coords[0], coords[-1]
        orig = _nearest_node(start_coord, node_coords)
        dest = _nearest_node(end_coord, node_coords)
        if orig is None or dest is None:
            continue  # no snap within tolerance

        length_m = _line_length_m(coords)
        if length_m < 1:
            continue

        try:
            speed_kmh = float(props.get("maxspeed", 30))
        except (ValueError, TypeError):
            speed_kmh = 30.0
        speed_ms = speed_kmh / 3.6

        try:
            lanes = int(props.get("lanes", 1))
        except (ValueError, TypeError):
            lanes = 1

        link = W.addLink(
            props.get("id", f"{orig}-{dest}"),
            orig,
            dest,
            length=length_m,
            free_flow_speed=speed_ms,
            jam_density=0.2,
            number_of_lanes=lanes,
        )
        # Store custom metadata on the link object
        link.osm_name = props.get("name", "")
        link.osm_id = props.get("id", "")
        link.rat_run = bool(props.get("rat_run", False))
        link.unstudied = bool(props.get("unstudied", False))
        link.geojson_coords = coords  # used by converter for progress→lat/lng

    return W
```

- [ ] **Step 4: Run tests**

```bash
cd sim && pytest tests/test_network_builder.py -v
```

Expected: 5 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add sim/network_builder.py sim/tests/test_network_builder.py
git commit -m "feat: add network_builder — GeoJSON to UXsim World"
```

---

### Task 4: uxsim_to_json.py converter

**Files:**
- Create: `sim/converters/uxsim_to_json.py`
- Create: `sim/tests/test_uxsim_to_json.py`

- [ ] **Step 1: Write the failing tests**

```python
# sim/tests/test_uxsim_to_json.py
import pandas as pd
import pytest
from unittest.mock import MagicMock
from sim.converters.uxsim_to_json import convert
from sim.converters.schema import SimOutput

def _make_world(links=None, vehicles_df=None, link_state_df=None, link_df=None):
    """Build a minimal mock UXsim World."""
    W = MagicMock()
    if links is None:
        link = MagicMock()
        link.name = "L1"
        link.osm_name = "Test Road"
        link.osm_id = "way/1"
        link.rat_run = False
        link.geojson_coords = [[18.460, -34.055], [18.462, -34.053]]
        links = [link]
    W.LINKS = links

    if vehicles_df is None:
        vehicles_df = pd.DataFrame({
            "name": ["v0", "v0", "v1"],
            "link": ["L1", "L1", "L1"],
            "t":    [23400, 23460, 23400],
            "x":    [0.0, 50.0, 100.0],
            "v":    [8.0, 7.5, 0.0],
        })
    W.analyzer.vehicles_to_pandas.return_value = vehicles_df

    if link_state_df is None:
        link_state_df = pd.DataFrame({
            "link": ["L1", "L1"],
            "t":    [23400, 23460],
            "q":    [0.1, 0.15],   # flow veh/s
            "k":    [0.01, 0.02],  # density veh/m
            "v":    [8.0, 7.0],    # velocity m/s
        })
    W.analyzer.link_traffic_state_to_pandas.return_value = link_state_df

    if link_df is None:
        link_df = pd.DataFrame({
            "link":       ["L1"],
            "traveltime": [45.0],
            "delay":      [15.0],
        })
    W.analyzer.link_to_pandas.return_value = link_df

    return W

def test_convert_returns_simoutput():
    W = _make_world()
    result = convert(W, "H")
    assert isinstance(result, SimOutput)

def test_meta_fields():
    W = _make_world()
    result = convert(W, "M")
    assert result.meta["scenario"] == "M"
    assert result.meta["source"] == "uxsim"
    assert result.meta["version"] == 1
    assert result.meta["timestep"] == 60

def test_roads_list_built_from_links():
    W = _make_world()
    result = convert(W, "H")
    assert len(result.roads) == 1
    assert result.roads[0]["name"] == "Test Road"
    assert result.roads[0]["id"] == "L1"

def test_frames_are_per_timestep():
    W = _make_world()
    result = convert(W, "H")
    # Vehicles at t=23400 and t=23460 → 2 frames (one per minute bucket)
    assert len(result.frames) >= 1
    assert result.frames[0].t == 23400

def test_vehicle_progress_is_normalised():
    W = _make_world()
    result = convert(W, "H")
    for frame in result.frames:
        for v in frame.vehicles:
            assert 0.0 <= v.progress <= 1.0

def test_road_stats_present_per_frame():
    W = _make_world()
    result = convert(W, "H")
    for frame in result.frames:
        assert len(frame.road_stats) >= 1
        rs = frame.road_stats[0]
        assert rs.road_id == "L1"
        assert rs.inbound >= 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd sim && pytest tests/test_uxsim_to_json.py -v
```

Expected: `ModuleNotFoundError: No module named 'sim.converters.uxsim_to_json'`

- [ ] **Step 3: Write uxsim_to_json.py**

```python
# sim/converters/uxsim_to_json.py
"""
Converts a completed UXsim World (W) into a SimOutput.

UXsim sources used:
  W.analyzer.vehicles_to_pandas()         → frames[].vehicles
  W.analyzer.link_traffic_state_to_pandas() → frames[].road_stats (flow-based counts)
  W.analyzer.link_to_pandas()             → road-level aggregate metadata
"""
import math
from .schema import SimOutput, FrameData, VehicleState, RoadStat

_START_TIME = 23400   # 06:30 in seconds since midnight
_END_TIME   = 30600   # 08:30
_TIMESTEP   = 60      # seconds per frame


def _link_length_m(coords):
    import math
    R = 6_371_000.0
    total = 0.0
    for i in range(len(coords) - 1):
        lon1, lat1 = math.radians(coords[i][0]), math.radians(coords[i][1])
        lon2, lat2 = math.radians(coords[i+1][0]), math.radians(coords[i+1][1])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
        total += 2 * R * math.asin(math.sqrt(h))
    return max(total, 1.0)


def convert(W, scenario: str) -> SimOutput:
    veh_df    = W.analyzer.vehicles_to_pandas()
    state_df  = W.analyzer.link_traffic_state_to_pandas()

    # Build road registry from links
    link_map = {link.name: link for link in W.LINKS}
    roads = [
        {
            "id":   link.name,
            "name": getattr(link, "osm_name", link.name),
            "osm_ids": [getattr(link, "osm_id", "")],
            "direction_pairs": ["inbound", "outbound"],
        }
        for link in W.LINKS
    ]

    # Build frames at each TIMESTEP boundary
    frames = []
    for t in range(_START_TIME, _END_TIME, _TIMESTEP):
        t_next = t + _TIMESTEP

        # --- vehicles in this time window ---
        veh_t = veh_df[(veh_df["t"] >= t) & (veh_df["t"] < t_next)]
        # Keep latest position per vehicle in this window
        veh_latest = veh_t.sort_values("t").groupby("name").last().reset_index()

        vehicles = []
        for _, row in veh_latest.iterrows():
            link = link_map.get(row["link"])
            if link is None:
                continue
            coords = getattr(link, "geojson_coords", [])
            length = _link_length_m(coords) if coords else 1.0
            progress = max(0.0, min(1.0, float(row["x"]) / length))
            speed = float(row["v"])
            state = "queued" if speed < 0.5 else "inbound"
            vehicles.append(VehicleState(
                id=str(row["name"]),
                road_id=str(row["link"]),
                progress=progress,
                speed=speed,
                state=state,
            ))

        # --- road stats from link_traffic_state ---
        state_t = state_df[(state_df["t"] >= t) & (state_df["t"] < t_next)]

        road_stats = []
        for link in W.LINKS:
            lt = state_t[state_t["link"] == link.name]
            if lt.empty:
                road_stats.append(RoadStat(
                    road_id=link.name, inbound=0, outbound=0,
                    avg_delay_in=None, avg_delay_out=None,
                ))
                continue

            avg_flow = float(lt["q"].mean())   # veh/s
            avg_vel  = float(lt["v"].mean())   # m/s
            # Approximate vehicle count from flow × timestep
            inbound_count = max(0, round(avg_flow * _TIMESTEP))

            # Free-flow travel time for this link
            ff_speed = float(link.u) if hasattr(link, "u") else 8.33
            coords = getattr(link, "geojson_coords", [])
            length = _link_length_m(coords) if coords else 1.0
            ff_time = length / max(ff_speed, 0.1)
            actual_time = length / max(avg_vel, 0.1)
            delay_s = max(0, round(actual_time - ff_time))

            road_stats.append(RoadStat(
                road_id=link.name,
                inbound=inbound_count,
                outbound=0,              # UXsim doesn't model direction separately
                avg_delay_in=delay_s if inbound_count > 0 else None,
                avg_delay_out=None,
            ))

        frames.append(FrameData(t=t, vehicles=vehicles, road_stats=road_stats))

    return SimOutput(
        meta={
            "scenario": scenario,
            "source": "uxsim",
            "version": 1,
            "start_time": _START_TIME,
            "end_time": _END_TIME,
            "timestep": _TIMESTEP,
        },
        roads=roads,
        frames=frames,
    )
```

- [ ] **Step 4: Run tests**

```bash
cd sim && pytest tests/test_uxsim_to_json.py -v
```

Expected: 6 tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add sim/converters/uxsim_to_json.py sim/tests/test_uxsim_to_json.py
git commit -m "feat: add uxsim_to_json converter — W.analyzer DataFrames to SimOutput JSON"
```

---

### Task 5: sumo_to_json.py stub + uxsim_runner.py

**Files:**
- Create: `sim/converters/sumo_to_json.py`
- Create: `sim/uxsim_runner.py`
- Create: `public/sim-results/.gitkeep`

- [ ] **Step 1: Write sumo_to_json stub**

```python
# sim/converters/sumo_to_json.py
"""
SUMO → SimOutput converter.

SUMO produces FCD XML (per-vehicle position/speed per timestep) and
tripinfo XML (per-vehicle wait time, time loss). This converter parses
both and maps them to the canonical SimOutput schema.

Status: STUB — not implemented in this version.

To implement:
  1. Parse FCD XML with xml.etree.ElementTree
  2. Parse tripinfo XML for delay figures
  3. Match vehicle positions to road names via edge IDs
  4. Group by TIMESTEP boundaries → FrameData list
  5. Return SimOutput with meta.source = "sumo"
"""
from .schema import SimOutput


def convert_fcd(fcd_xml_path: str, tripinfo_xml_path: str, scenario: str) -> SimOutput:
    """Convert SUMO FCD + tripinfo XML to SimOutput.

    Args:
        fcd_xml_path: Path to SUMO FCD output XML file.
        tripinfo_xml_path: Path to SUMO tripinfo XML file.
        scenario: Scenario label ("L", "M", or "H").

    Returns:
        SimOutput in canonical format.

    Raises:
        NotImplementedError: Always — not yet implemented.
    """
    raise NotImplementedError(
        "SUMO converter not yet implemented. "
        "Run sim/uxsim_runner.py to produce scenario JSON from UXsim instead."
    )
```

- [ ] **Step 2: Write uxsim_runner.py**

```python
# sim/uxsim_runner.py
"""
Runs all three L/M/H scenarios through UXsim and writes pre-computed
scenario JSON files to ../public/sim-results/.

Usage:
    cd sim
    python uxsim_runner.py

Output:
    ../public/sim-results/scenario-L.json
    ../public/sim-results/scenario-M.json
    ../public/sim-results/scenario-H.json
"""
import json
import os
import sys
import uxsim

from network_builder import build_network
from converters.uxsim_to_json import convert

GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "network-L2.geojson")
OUT_DIR      = os.path.join(os.path.dirname(__file__), "..", "public", "sim-results")

# TIA §13 trip counts matching existing IDM spawner scenarios
SCENARIOS = {
    "L": {"total_trips": 500, "peak_duration_s": 4500},   # 75 min peak
    "M": {"total_trips": 650, "peak_duration_s": 3600},   # 60 min peak
    "H": {"total_trips": 840, "peak_duration_s": 2700},   # 45 min peak
}

# Origin-destination split (%) — from TIA §13
OD_SPLIT = {
    "1A": 0.24,   # Dreyersdal / Main Rd (north + south)
    "2A": 0.20,   # Homestead Ave
    "2B": 0.35,   # Children's Way / Ladies Mile
    "3A": 0.21,   # Firgrove Way
}

_START = 23400  # 06:30 in seconds since midnight
_END   = 30600  # 08:30


def _run_scenario(scenario: str) -> None:
    cfg = SCENARIOS[scenario]
    W = build_network(GEOJSON_PATH)

    # Add demand: one OD pair per corridor → school ingress node
    # Node IDs must match those in network-L2.geojson
    ingress_node = "N7"  # Ruskin Rd / Leyden Rd — school ingress
    for corridor, share in OD_SPLIT.items():
        origin_map = {"1A": "N1", "2A": "N4", "2B": "N3", "3A": "N2"}
        origin = origin_map[corridor]
        n_trips = round(cfg["total_trips"] * share)
        peak_start = _START
        peak_end   = peak_start + cfg["peak_duration_s"]
        W.adddemand(origin, ingress_node, peak_start, peak_end,
                    n_trips / cfg["peak_duration_s"])  # veh/s

    W.exec_simulation()
    W.analyzer.compute_all()

    output = convert(W, scenario)

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"scenario-{scenario}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(output.to_json())
    print(f"  wrote {out_path}")


def main():
    print(f"Building network from {GEOJSON_PATH}")
    for scenario in ["L", "M", "H"]:
        print(f"Running scenario {scenario}...")
        _run_scenario(scenario)
    print("Done.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Create output directory placeholder**

```bash
mkdir -p public/sim-results
touch public/sim-results/.gitkeep
```

- [ ] **Step 4: Verify runner imports cleanly (dry-run, no network needed)**

```bash
cd sim && python -c "import uxsim_runner; print('imports OK')"
```

Expected: `imports OK`

- [ ] **Step 5: Commit**

```bash
git add sim/converters/sumo_to_json.py sim/uxsim_runner.py public/sim-results/.gitkeep
git commit -m "feat: add uxsim_runner and sumo_to_json stub — completes Python pipeline"
```

---

## Phase B — Frontend

---

### Task 6: Add Vitest + testing-library

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, update the `"scripts"` block:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
},
```

- [ ] **Step 3: Add test config to vite.config.js**

Current `vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

Replace with:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
})
```

- [ ] **Step 4: Create test setup file**

```js
// src/test-setup.js
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Create fixture scenario JSON for frontend tests**

```bash
mkdir -p src/engine/__tests__/fixtures
```

Write `src/engine/__tests__/fixtures/scenario-fixture.json`:

```json
{
  "meta": {
    "scenario": "M",
    "source": "uxsim",
    "version": 1,
    "start_time": 23400,
    "end_time": 23520,
    "timestep": 60
  },
  "roads": [
    {
      "id": "christopher_rd",
      "name": "Christopher Road",
      "osm_ids": ["way/111"],
      "direction_pairs": ["inbound", "outbound"]
    },
    {
      "id": "ruskin_rd",
      "name": "Ruskin Road",
      "osm_ids": ["way/222"],
      "direction_pairs": ["inbound", "outbound"]
    }
  ],
  "frames": [
    {
      "t": 23400,
      "vehicles": [
        { "id": "v1", "road_id": "christopher_rd", "progress": 0.1, "speed": 8.0, "state": "inbound" },
        { "id": "v2", "road_id": "christopher_rd", "progress": 0.5, "speed": 0.0, "state": "queued" }
      ],
      "road_stats": [
        { "road_id": "christopher_rd", "inbound": 2, "outbound": 0, "avg_delay_in": 30, "avg_delay_out": null },
        { "road_id": "ruskin_rd", "inbound": 1, "outbound": 0, "avg_delay_in": 10, "avg_delay_out": null }
      ]
    },
    {
      "t": 23460,
      "vehicles": [
        { "id": "v1", "road_id": "christopher_rd", "progress": 0.4, "speed": 7.5, "state": "inbound" },
        { "id": "v3", "road_id": "ruskin_rd", "progress": 0.2, "speed": 5.0, "state": "inbound" }
      ],
      "road_stats": [
        { "road_id": "christopher_rd", "inbound": 1, "outbound": 0, "avg_delay_in": 25, "avg_delay_out": null },
        { "road_id": "ruskin_rd", "inbound": 1, "outbound": 0, "avg_delay_in": 12, "avg_delay_out": null }
      ]
    }
  ]
}
```

- [ ] **Step 6: Verify Vitest runs (no tests yet)**

```bash
npm test
```

Expected: `No test files found` or 0 tests — no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json vite.config.js src/test-setup.js src/engine/__tests__/fixtures/
git commit -m "chore: add Vitest + testing-library, test fixture scenario JSON"
```

---

### Task 7: playback.js

**Files:**
- Create: `src/engine/playback.js`
- Create: `src/engine/__tests__/playback.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/engine/__tests__/playback.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackSource } from '../playback.js';
import fixtureData from './fixtures/scenario-fixture.json';

// Helper: create a PlaybackSource pre-loaded with fixture data (bypasses fetch)
function makeLoaded(data = fixtureData) {
  const src = new PlaybackSource();
  src._loadData(data);
  return src;
}

describe('PlaybackSource', () => {
  describe('before load', () => {
    it('getVehicles returns empty array', () => {
      const src = new PlaybackSource();
      expect(src.getVehicles(23400)).toEqual([]);
    });

    it('getRoadStats returns empty Map', () => {
      const src = new PlaybackSource();
      expect(src.getRoadStats(23400).size).toBe(0);
    });

    it('isLoaded returns false', () => {
      const src = new PlaybackSource();
      expect(src.isLoaded()).toBe(false);
    });
  });

  describe('after load', () => {
    it('isLoaded returns true', () => {
      expect(makeLoaded().isLoaded()).toBe(true);
    });

    it('getVehicles returns vehicles for exact frame time', () => {
      const src = makeLoaded();
      const vehicles = src.getVehicles(23400);
      expect(vehicles.length).toBe(2);
    });

    it('getVehicles returns vehicles for nearest earlier frame', () => {
      const src = makeLoaded();
      // t=23410 is between frames 23400 and 23460 → nearest earlier is 23400
      const vehicles = src.getVehicles(23410);
      expect(vehicles.length).toBe(2);
    });

    it('getVehicles returns last frame vehicles when t > end', () => {
      const src = makeLoaded();
      const vehicles = src.getVehicles(99999);
      expect(vehicles.length).toBeGreaterThan(0);
    });

    it('vehicle has lat and lng properties', () => {
      const src = makeLoaded();
      // Fixture has no GeoJSON road lines, so lat/lng fall back to [0,0]
      const v = src.getVehicles(23400)[0];
      expect(v).toHaveProperty('lat');
      expect(v).toHaveProperty('lng');
      expect(v).toHaveProperty('state');
      expect(v).toHaveProperty('roadId');
    });

    it('getRoadStats returns Map with road_id keys', () => {
      const src = makeLoaded();
      const stats = src.getRoadStats(23400);
      expect(stats.has('christopher_rd')).toBe(true);
      expect(stats.get('christopher_rd').inbound).toBe(2);
    });

    it('isFinished returns false before end_time', () => {
      const src = makeLoaded();
      expect(src.isFinished(23400)).toBe(false);
    });

    it('isFinished returns true at end_time', () => {
      const src = makeLoaded();
      expect(src.isFinished(23520)).toBe(true);
    });

    it('getAllFrames returns full frame array', () => {
      const src = makeLoaded();
      expect(src.getAllFrames().length).toBe(2);
    });

    it('getRoads returns road registry', () => {
      const src = makeLoaded();
      expect(src.getRoads().length).toBe(2);
      expect(src.getRoads()[0].id).toBe('christopher_rd');
    });

    it('reset clears loaded data', () => {
      const src = makeLoaded();
      src.reset();
      expect(src.isLoaded()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: `Cannot find module '../playback.js'`

- [ ] **Step 3: Write playback.js**

```js
// src/engine/playback.js
// PlaybackSource — loads a pre-computed scenario JSON and serves vehicle
// positions / road stats through the SimulationSource interface.

/**
 * Interpolates a lat/lng from a GeoJSON coordinate array and a progress value.
 * progress is 0.0 (start) → 1.0 (end).
 * Coordinates are [lon, lat] pairs; returns { lat, lng }.
 */
function progressToLatLng(coords, progress) {
  if (!coords || coords.length === 0) return { lat: 0, lng: 0 };
  const clamped = Math.max(0, Math.min(1, progress));
  const idx = clamped * (coords.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, coords.length - 1);
  const t = idx - lo;
  const lon = coords[lo][0] + t * (coords[hi][0] - coords[lo][0]);
  const lat = coords[lo][1] + t * (coords[hi][1] - coords[lo][1]);
  return { lat, lng: lon };
}

export class PlaybackSource {
  constructor() {
    this._data = null;        // parsed SimOutput JSON
    this._roadCoords = {};    // road_id → [lon,lat][] (populated by setRoadCoords)
  }

  /**
   * Load pre-computed scenario data directly (used in tests and internally
   * after fetch resolves).
   * @param {object} data - Parsed SimOutput JSON object
   */
  _loadData(data) {
    this._data = data;
  }

  /**
   * Provide GeoJSON coordinates for roads so vehicle positions can be
   * interpolated to lat/lng. Call this after loading road GeoJSON in SimMap.
   * @param {Object.<string, number[][]>} coordMap - road_id → [[lon,lat],…]
   */
  setRoadCoords(coordMap) {
    this._roadCoords = coordMap;
  }

  /**
   * Fetch and load a scenario JSON file.
   * @param {string} scenario - "L", "M", or "H"
   * @returns {Promise<void>}
   */
  async loadScenario(scenario) {
    this._data = null;
    const res = await fetch(`/sim-results/scenario-${scenario}.json`);
    if (!res.ok) throw new Error(`Failed to load scenario-${scenario}.json: ${res.status}`);
    this._data = await res.json();
  }

  isLoaded() {
    return this._data !== null;
  }

  /** @returns {object[]} Full road registry from the loaded JSON */
  getRoads() {
    return this._data?.roads ?? [];
  }

  /** @returns {object[]} Full frames array (for Road Watcher totals) */
  getAllFrames() {
    return this._data?.frames ?? [];
  }

  /**
   * Find the nearest frame at or before simTime.
   * @param {number} t - seconds since midnight
   * @returns {object|null}
   */
  _nearestFrame(t) {
    if (!this._data) return null;
    const frames = this._data.frames;
    if (frames.length === 0) return null;
    // Find last frame where frame.t <= t
    let best = frames[0];
    for (const frame of frames) {
      if (frame.t <= t) best = frame;
      else break;
    }
    return best;
  }

  /**
   * Returns synthesised vehicle positions for the given sim time.
   * @param {number} simTime - seconds since midnight
   * @returns {{ lat: number, lng: number, state: string, roadId: string }[]}
   */
  getVehicles(simTime) {
    const frame = this._nearestFrame(simTime);
    if (!frame) return [];
    return frame.vehicles.map(v => {
      const coords = this._roadCoords[v.road_id] ?? [];
      const { lat, lng } = progressToLatLng(coords, v.progress);
      return { lat, lng, state: v.state, roadId: v.road_id, speed: v.speed };
    });
  }

  /**
   * Returns per-road stats for the given sim time.
   * @param {number} simTime - seconds since midnight
   * @returns {Map<string, {inbound:number, outbound:number, avg_delay_in:number|null, avg_delay_out:number|null}>}
   */
  getRoadStats(simTime) {
    const frame = this._nearestFrame(simTime);
    const result = new Map();
    if (!frame) return result;
    for (const rs of frame.road_stats) {
      result.set(rs.road_id, {
        inbound: rs.inbound,
        outbound: rs.outbound,
        avg_delay_in: rs.avg_delay_in,
        avg_delay_out: rs.avg_delay_out,
      });
    }
    return result;
  }

  /**
   * @param {number} simTime - seconds since midnight
   * @returns {boolean}
   */
  isFinished(simTime) {
    if (!this._data) return false;
    return simTime >= this._data.meta.end_time;
  }

  reset() {
    this._data = null;
    this._roadCoords = {};
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all playback tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/engine/playback.js src/engine/__tests__/playback.test.js
git commit -m "feat: add PlaybackSource — loads scenario JSON, serves vehicle positions and road stats"
```

---

### Task 8: Header — [Live] [Results] toggle

**Files:**
- Modify: `src/components/Header.jsx`

- [ ] **Step 1: Add `source` and `onSourceChange` props to Header**

In `src/components/Header.jsx`, update the prop destructuring and add the toggle buttons.

Replace:
```js
export default function Header({
  scenario, playing, speed, simTime,
  activeVehicles, totalVehicles,
  onScenarioChange, onPlay, onPause, onReset, onSpeedChange,
}) {
```

With:
```js
export default function Header({
  scenario, playing, speed, simTime,
  activeVehicles, totalVehicles,
  source, resultsLoading,
  onScenarioChange, onPlay, onPause, onReset, onSpeedChange, onSourceChange,
}) {
```

- [ ] **Step 2: Add source toggle JSX**

After the `const speedBtns = ...` block, add:

```js
  const sourceBtns = (
    <div className="source-btns">
      {['live', 'results'].map(s => (
        <button
          key={s}
          className={`source-btn ${source === s ? 'active' : ''}`}
          onClick={() => onSourceChange(s)}
          title={s === 'live' ? 'Live IDM simulation' : 'Pre-computed UXsim results'}
        >
          {s === 'live' ? 'Live' : resultsLoading ? '⟳' : 'Results'}
        </button>
      ))}
    </div>
  );
```

- [ ] **Step 3: Add sourceBtns to both header rows**

In `header-row1` (desktop), add `{sourceBtns}` after `{playbackBtns}`:
```jsx
{playbackBtns}
{sourceBtns}
```

In `header-row2` (mobile), add `{sourceBtns}` after `{speedBtns}`:
```jsx
<div className="speed-btns">{speedBtns}</div>
{sourceBtns}
```

- [ ] **Step 4: Add CSS for source toggle in `src/App.css`**

Find the `.scenario-btns` CSS block and add after it:

```css
.source-btns { display: flex; gap: 2px; }
.source-btn {
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-transform: capitalize;
  transition: background 0.15s, color 0.15s;
}
.source-btn:hover { background: #334155; color: #e2e8f0; }
.source-btn.active { background: #7c3aed; color: #fff; border-color: #7c3aed; }
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.jsx src/App.css
git commit -m "feat: add Live/Results source toggle to Header"
```

---

### Task 9: App.jsx — source state and playback coordination

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports and state**

At the top of `src/App.jsx`, add:

```js
import { useState, useCallback, useRef } from 'react';
import { PlaybackSource } from './engine/playback.js';
```

Replace the existing `import { useState, useCallback }` line.

Inside `App()`, after the existing `useState` calls, add:

```js
const [source, setSource]                 = useState('live');
const [resultsLoading, setResultsLoading] = useState(false);
const [playbackFrames, setPlaybackFrames] = useState([]);
const [selectedRoad, setSelectedRoad]     = useState(null);
const playbackRef                         = useRef(new PlaybackSource());
```

- [ ] **Step 2: Add handleSourceChange**

After `handleAutoStop`, add:

```js
const handleSourceChange = useCallback(async (s) => {
  setSource(s);
  setPlaying(false);
  setSimTime(0);
  setActiveVehicles(0);
  setTotalVehicles(0);
  setStatsData(INITIAL_STATS);
  setSelectedRoad(null);
  if (s === 'results') {
    setResultsLoading(true);
    try {
      const pb = playbackRef.current;
      pb.reset();
      await pb.loadScenario(scenario);
      setPlaybackFrames(pb.getAllFrames());
    } catch (err) {
      console.error('Failed to load scenario results:', err);
    } finally {
      setResultsLoading(false);
    }
  }
}, [scenario]);
```

- [ ] **Step 3: Update handleScenarioChange to reload playback if in results mode**

Replace the existing `handleScenarioChange` with:

```js
const handleScenarioChange = useCallback(async (s) => {
  setScenario(s);
  setPlaying(false);
  setSimTime(0);
  setActiveVehicles(0);
  setTotalVehicles(0);
  setStatsData(INITIAL_STATS);
  setSelectedRoad(null);
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'scenario_change', scenario: s });
  if (source === 'results') {
    setResultsLoading(true);
    try {
      const pb = playbackRef.current;
      pb.reset();
      await pb.loadScenario(s);
      setPlaybackFrames(pb.getAllFrames());
    } catch (err) {
      console.error('Failed to load scenario results:', err);
    } finally {
      setResultsLoading(false);
    }
  }
}, [source]);
```

- [ ] **Step 4: Pass new props to Header and SimMap**

In the JSX, update `<Header>`:

```jsx
<Header
  scenario={scenario}
  playing={playing}
  speed={speed}
  simTime={simTime}
  activeVehicles={activeVehicles}
  totalVehicles={totalVehicles}
  source={source}
  resultsLoading={resultsLoading}
  onScenarioChange={handleScenarioChange}
  onPlay={handlePlay}
  onPause={handlePause}
  onReset={handleReset}
  onSpeedChange={handleSpeedChange}
  onSourceChange={handleSourceChange}
/>
```

Update `<SimMap>`:

```jsx
<SimMap
  scenario={scenario}
  playing={playing}
  speed={speed}
  activeRoutes={activeRoutes}
  source={source}
  playbackSource={playbackRef.current}
  onSimUpdate={handleSimUpdate}
  onStatsUpdate={handleStatsUpdate}
  onAutoStop={handleAutoStop}
  onRoadSelect={setSelectedRoad}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: App.jsx — add source state, PlaybackSource ref, scenario reload on source switch"
```

---

### Task 10: SimMap — playback branch + road click

**Files:**
- Modify: `src/components/SimMap.jsx`

- [ ] **Step 1: Add props to SimMap**

Change the function signature from:

```js
export default function SimMap({ scenario, playing, speed, activeRoutes, onSimUpdate, onStatsUpdate, onAutoStop }) {
```

To:

```js
export default function SimMap({ scenario, playing, speed, activeRoutes, source, playbackSource, onSimUpdate, onStatsUpdate, onAutoStop, onRoadSelect }) {
```

- [ ] **Step 2: Add playback branch in the animation loop**

Find the animation loop (the `loopRef.current` assignment inside `useEffect`). The loop currently calls `spawnTick`, `stepAllVehicles`, and then draws to canvas.

Add a `sourceRef` to track the current source without stale closure issues:

```js
const sourceRef = useRef(source);
useEffect(() => { sourceRef.current = source; }, [source]);
```

At the top of the animation loop function (before the IDM step calls), add:

```js
if (sourceRef.current === 'results') {
  // Playback mode — skip IDM/spawner entirely
  const pb = playbackSource;
  if (!pb.isLoaded()) return;
  const t = simTimeRef.current;
  const dt = (0.5 * speedRef.current);
  simTimeRef.current = t + dt;

  const vehicles = pb.getVehicles(simTimeRef.current);
  const roadStats = pb.getRoadStats(simTimeRef.current);

  // Draw playback vehicles on canvas
  const ctx = canvasRef.current?.getContext('2d');
  if (ctx && mapRef.current) {
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    const vr = window.innerWidth < 768 ? 3 : 4;
    for (const v of vehicles) {
      const pt = mapRef.current.latLngToContainerPoint([v.lat, v.lng]);
      const colour = v.state === 'queued' ? '#ef4444'
                   : v.state === 'rat_run' ? '#eab308'
                   : v.state === 'outbound' ? '#f97316'
                   : '#3b82f6';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, vr, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
    }
  }

  // Propagate stats upward
  const active = vehicles.length;
  onSimUpdate(simTimeRef.current, active, active);

  if (pb.isFinished(simTimeRef.current)) {
    onAutoStop();
  }
  return; // skip IDM path below
}
// ... existing IDM/spawner code continues unchanged below
```

- [ ] **Step 3: Add road polylines to Leaflet map (new) + click handler**

The current SimMap does not draw ROAD_LINES as Leaflet polylines (they exist only as route geometry in `routes.js`). Add them inside the map init `useEffect` (the one with `[]` dependency array), after the junction markers block. Also add a ref outside the useEffect and an `onRoadSelectRef` to avoid stale closures.

Add these two refs near the top of the component, alongside the existing refs:
```js
const roadPolylinesRef = useRef([]);
const onRoadSelectRef  = useRef(onRoadSelect);
useEffect(() => { onRoadSelectRef.current = onRoadSelect; }, [onRoadSelect]);
```

Inside the map init `useEffect`, after the junction marker block (after the `VISIBLE_JUNCTIONS.forEach` call), add:

```js
// Draw ROAD_LINES as Leaflet polylines (beneath canvas, for click detection + road highlighting)
const polylines = ROAD_LINES.map(feature => {
  const coords = feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  const pl = L.polyline(coords, { color: '#334155', weight: 3, opacity: 0.7 }).addTo(map);
  pl._osmName = feature.properties?.name ?? '';
  return pl;
});
roadPolylinesRef.current = polylines;

// Road click handler — highlight full road by name
polylines.forEach(pl => {
  pl.on('click', () => {
    polylines.forEach(p => p.setStyle({ color: '#334155', weight: 3, opacity: 0.7 }));
    polylines.forEach(p => {
      if (p._osmName && p._osmName === pl._osmName) {
        p.setStyle({ color: '#f59e0b', weight: 5, opacity: 1.0 });
      }
    });
    if (onRoadSelectRef.current) onRoadSelectRef.current({ name: pl._osmName });
  });
});
```

Also add cleanup to the useEffect's return function:
```js
// inside the existing return () => { ... }
roadPolylinesRef.current.forEach(p => p.remove());
roadPolylinesRef.current = [];
```

- [ ] **Step 4: Verify the app loads and Live mode still works**

```bash
npm run dev
```

Open browser → play Live simulation → verify vehicles still animate normally.

- [ ] **Step 5: Commit**

```bash
git add src/components/SimMap.jsx
git commit -m "feat: SimMap — playback branch in rAF loop, road click handler for Road Watcher"
```

---

### Task 11: RoadWatcher component

**Files:**
- Create: `src/components/RoadWatcher.jsx`
- Create: `src/components/__tests__/RoadWatcher.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
// src/components/__tests__/RoadWatcher.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoadWatcher from '../RoadWatcher.jsx';
import fixtureData from '../../engine/__tests__/fixtures/scenario-fixture.json';

const ALL_FRAMES = fixtureData.frames;
const ROAD = { name: 'Christopher Road', id: 'christopher_rd' };

describe('RoadWatcher', () => {
  it('renders road name as heading', () => {
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={() => {}} />);
    expect(screen.getByText('Christopher Road')).toBeInTheDocument();
  });

  it('shows total, inbound and outbound labels', () => {
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={() => {}} />);
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getByText(/inbound/i)).toBeInTheDocument();
    expect(screen.getByText(/outbound/i)).toBeInTheDocument();
  });

  it('computes total inbound count from allFrames', () => {
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={() => {}} />);
    // fixture: frame 23400 inbound=2, frame 23460 inbound=1 → total=3
    // (totals are sum of inbound per frame, not unique vehicles)
    expect(screen.getByTestId('total-inbound')).toHaveTextContent('3');
  });

  it('shows avg delay inbound', () => {
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={() => {}} />);
    expect(screen.getByText(/avg delay inbound/i)).toBeInTheDocument();
  });

  it('calls onClose when × button clicked', async () => {
    const onClose = vi.fn();
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders time series bars (8 buckets)', () => {
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={() => {}} />);
    // SVG bars — each bucket is a <rect>
    const bars = document.querySelectorAll('[data-testid="timeseries-bar"]');
    expect(bars.length).toBe(8);
  });

  it('shows "loading" state when allFrames is null', () => {
    render(<RoadWatcher road={ROAD} allFrames={null} onClose={() => {}} />);
    expect(screen.getByText(/simulation running/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: `Cannot find module '../RoadWatcher.jsx'`

- [ ] **Step 3: Write RoadWatcher.jsx**

```jsx
// src/components/RoadWatcher.jsx
// Displays per-road vehicle stats when a road is selected on the map.
// In Results mode: allFrames is the full frame array → totals computed up front.
// In Live mode: allFrames is null → shows accumulated stats so far.

const START_SEC = 23400; // 06:30
const END_SEC   = 30600; // 08:30
const BUCKET_COUNT = 8;
const BUCKET_SECS  = (END_SEC - START_SEC) / BUCKET_COUNT; // 900s = 15 min

function computeTotals(roadId, allFrames) {
  let totalInbound = 0, totalOutbound = 0;
  let delayInSum = 0, delayInCount = 0;
  let delayOutSum = 0, delayOutCount = 0;

  for (const frame of allFrames) {
    const rs = frame.road_stats.find(r => r.road_id === roadId);
    if (!rs) continue;
    totalInbound  += rs.inbound;
    totalOutbound += rs.outbound;
    if (rs.avg_delay_in != null)  { delayInSum  += rs.avg_delay_in;  delayInCount++; }
    if (rs.avg_delay_out != null) { delayOutSum += rs.avg_delay_out; delayOutCount++; }
  }

  return {
    totalInbound,
    totalOutbound,
    total: totalInbound + totalOutbound,
    avgDelayIn:  delayInCount  > 0 ? Math.round(delayInSum  / delayInCount)  : null,
    avgDelayOut: delayOutCount > 0 ? Math.round(delayOutSum / delayOutCount) : null,
  };
}

function computeBuckets(roadId, allFrames) {
  const buckets = Array.from({ length: BUCKET_COUNT }, () => ({ inbound: 0, outbound: 0 }));
  for (const frame of allFrames) {
    const rs = frame.road_stats.find(r => r.road_id === roadId);
    if (!rs) continue;
    const bucketIdx = Math.min(
      BUCKET_COUNT - 1,
      Math.floor((frame.t - START_SEC) / BUCKET_SECS)
    );
    if (bucketIdx >= 0) {
      buckets[bucketIdx].inbound  += rs.inbound;
      buckets[bucketIdx].outbound += rs.outbound;
    }
  }
  return buckets;
}

function formatDelay(sec) {
  if (sec == null) return '—';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function TimeSeriesChart({ buckets }) {
  const maxVal = Math.max(1, ...buckets.map(b => b.inbound + b.outbound));
  const barW = 100 / BUCKET_COUNT;
  return (
    <svg viewBox="0 0 100 40" style={{ width: '100%', height: 40, display: 'block', marginTop: 8 }}>
      {buckets.map((b, i) => {
        const totalH = ((b.inbound + b.outbound) / maxVal) * 38;
        const inboundH = (b.inbound / maxVal) * 38;
        const x = i * barW + 0.5;
        const w = barW - 1;
        return (
          <g key={i}>
            <rect
              data-testid="timeseries-bar"
              x={x} y={40 - totalH} width={w} height={totalH}
              fill="#475569"
            />
            <rect
              x={x} y={40 - inboundH} width={w} height={inboundH}
              fill="#3b82f6"
            />
          </g>
        );
      })}
    </svg>
  );
}

export default function RoadWatcher({ road, allFrames, onClose }) {
  const roadId = road.id ?? road.name?.toLowerCase().replace(/\s+/g, '_');

  if (!allFrames) {
    return (
      <div className="road-watcher">
        <div className="rw-header">
          <span className="rw-title">{road.name}</span>
          <button className="rw-close" aria-label="close" onClick={onClose}>×</button>
        </div>
        <div className="rw-loading">Simulation running — stats accumulate as vehicles pass</div>
      </div>
    );
  }

  const { total, totalInbound, totalOutbound, avgDelayIn, avgDelayOut } = computeTotals(roadId, allFrames);
  const buckets = computeBuckets(roadId, allFrames);

  return (
    <div className="road-watcher">
      <div className="rw-header">
        <span className="rw-title">{road.name}</span>
        <button className="rw-close" aria-label="close" onClick={onClose}>×</button>
      </div>

      <div className="rw-totals">
        <div className="rw-stat">
          <div className="rw-stat-label">Total</div>
          <div className="rw-stat-value">{total}</div>
        </div>
        <div className="rw-stat">
          <div className="rw-stat-label">Inbound</div>
          <div className="rw-stat-value" data-testid="total-inbound">{totalInbound}</div>
        </div>
        <div className="rw-stat">
          <div className="rw-stat-label">Outbound</div>
          <div className="rw-stat-value">{totalOutbound}</div>
        </div>
      </div>

      <div className="rw-delays">
        <div>Avg delay inbound: <strong>{formatDelay(avgDelayIn)}</strong></div>
        <div>Avg delay outbound: <strong>{formatDelay(avgDelayOut)}</strong></div>
      </div>

      <TimeSeriesChart buckets={buckets} />
      <div className="rw-axis">
        <span>06:30</span><span>08:30</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add RoadWatcher CSS to `src/App.css`**

```css
/* ── Road Watcher ──────────────────────────────────────────────────────────── */
.road-watcher {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px 14px;
  color: #e2e8f0;
}
.rw-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.rw-title { font-weight: 700; font-size: 14px; color: #f1f5f9; }
.rw-close {
  background: none; border: none; color: #64748b;
  font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1;
}
.rw-close:hover { color: #e2e8f0; }
.rw-totals { display: flex; gap: 16px; margin-bottom: 10px; }
.rw-stat { text-align: center; }
.rw-stat-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
.rw-stat-value { font-size: 22px; font-weight: 700; color: #f1f5f9; }
.rw-delays { font-size: 12px; color: #94a3b8; margin-bottom: 4px; line-height: 1.8; }
.rw-delays strong { color: #e2e8f0; }
.rw-axis {
  display: flex; justify-content: space-between;
  font-size: 10px; color: #475569; margin-top: 2px;
}
.rw-loading { font-size: 12px; color: #64748b; padding: 12px 0; }

/* Mobile: slide up from bottom */
@media (max-width: 767px) {
  .road-watcher {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    border-radius: 12px 12px 0 0;
    z-index: 1000;
    padding: 16px;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.5);
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all RoadWatcher tests PASSED.

- [ ] **Step 6: Commit**

```bash
git add src/components/RoadWatcher.jsx src/components/__tests__/RoadWatcher.test.jsx src/App.css
git commit -m "feat: add RoadWatcher component — per-road totals, time series chart, avg delay"
```

---

### Task 12: Wire RoadWatcher into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import RoadWatcher**

At the top of `src/App.jsx`, add:

```js
import RoadWatcher from './components/RoadWatcher.jsx';
```

- [ ] **Step 2: Add handleRoadSelect that resolves road id from playback source**

After `handleAutoStop` in `src/App.jsx`, add:

```js
const handleRoadSelect = useCallback((road) => {
  // SimMap passes { name } — look up the canonical id from the playback roads
  // registry so RoadWatcher can match road_stats by road_id.
  if (source === 'results') {
    const roads = playbackRef.current.getRoads();
    const found = roads.find(r => r.name === road.name);
    setSelectedRoad(found ? { name: road.name, id: found.id } : { name: road.name, id: road.name });
  } else {
    // Live mode: id is not used for road_stats lookup (allFrames is null)
    setSelectedRoad({ name: road.name, id: road.name });
  }
}, [source]);
```

Update the `onRoadSelect` prop on `<SimMap>` to use this handler:
```jsx
onRoadSelect={handleRoadSelect}
```

- [ ] **Step 3: Replace StatsPanel with RoadWatcher when a road is selected**

Find the `<StatsPanel ... />` JSX and replace it with:

```jsx
{selectedRoad ? (
  <RoadWatcher
    road={selectedRoad}
    allFrames={source === 'results' ? playbackFrames : null}
    onClose={() => setSelectedRoad(null)}
  />
) : (
  <StatsPanel
    statsData={statsData}
    activeVehicles={activeVehicles}
    totalVehicles={totalVehicles}
    activeRoutes={activeRoutes}
    onToggleRoute={handleToggleRoute}
  />
)}
```

- [ ] **Step 4: Dismiss road selection when source changes**

`handleSourceChange` already calls `setSelectedRoad(null)` (added in Task 9). Verify it does.

- [ ] **Step 5: Verify in browser — Results mode end-to-end**

```bash
npm run dev
```

1. Ensure `public/sim-results/scenario-M.json` exists (run Python pipeline, or copy fixture)
2. Click `[Results]` → should show loading indicator, then enable play
3. Press play → vehicles animate from JSON data
4. Click a road → RoadWatcher panel appears with stats
5. Click `×` → StatsPanel returns
6. Switch to `[Live]` → play → IDM vehicles animate normally

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire RoadWatcher into App — replaces StatsPanel when road selected"
```

---

### Task 13: Run Python pipeline and commit output

**Files:**
- Create: `public/sim-results/scenario-L.json`
- Create: `public/sim-results/scenario-M.json`
- Create: `public/sim-results/scenario-H.json`

- [ ] **Step 1: Ensure enriched GeoJSON is present**

```bash
ls data/network-L2.geojson
```

Expected: file exists with LineString + Point features including `maxspeed`, `lanes`, `name` properties. If missing, this task is blocked until the OSM enrichment task is complete.

- [ ] **Step 2: Run the pipeline**

```bash
cd sim && python uxsim_runner.py
```

Expected output:
```
Building network from ../data/network-L2.geojson
Running scenario L...
  wrote ../public/sim-results/scenario-L.json
Running scenario M...
  wrote ../public/sim-results/scenario-M.json
Running scenario H...
  wrote ../public/sim-results/scenario-H.json
Done.
```

- [ ] **Step 3: Validate output files match schema**

```python
cd sim && python -c "
import json
from converters.schema import SimOutput
for s in ['L','M','H']:
    with open(f'../public/sim-results/scenario-{s}.json') as f:
        data = json.load(f)
    assert data['meta']['version'] == 1
    assert len(data['frames']) > 0
    print(f'scenario-{s}: {len(data[\"frames\"])} frames, {len(data[\"roads\"])} roads — OK')
"
```

Expected: 3 lines each ending with `OK`.

- [ ] **Step 4: Run full test suite**

```bash
npm test && cd sim && pytest -v
```

Expected: all tests PASSED.

- [ ] **Step 5: Commit**

```bash
git add public/sim-results/
git commit -m "feat: add pre-computed UXsim scenario JSON files (L/M/H)"
```

---

### Task 14: Final integration check + push

- [ ] **Step 1: Build for production**

```bash
npm run build
```

Expected: build completes with no errors. `dist/` directory contains the output.

- [ ] **Step 2: Verify Results mode in browser**

```bash
npm run preview
```

1. Open the app
2. Click `[Results]` → loading indicator → clears
3. Click `▶` → vehicles animate
4. Click a road segment → RoadWatcher shows road name, totals, chart
5. Click `×` → StatsPanel returns
6. Switch to `[Live]` → play → IDM vehicles animate normally

- [ ] **Step 3: Run full test suite one final time**

```bash
npm test
cd sim && pytest -v
```

Expected: all tests PASSED.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: complete offline sim + road watcher integration"
git push origin osm
```

---

## Appendix: Format reference

The canonical JSON format is documented at `docs/sim-output-format.md`. The Python `schema.py` dataclasses and the frontend `PlaybackSource` are both authoritative implementations of this format. If the format needs to change, update `docs/sim-output-format.md` first, then update both.
