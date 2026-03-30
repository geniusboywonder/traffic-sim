# UXsim — Configuration & Usage Guide

## What it is

UXsim is a Python macroscopic traffic simulation library. There is no GUI — you configure and run it through Python scripts. Our scripts live in `sim/`.

Full API reference: https://toruseo.jp/UXsim/docs/

---

## Installation

UXsim is installed as a Python package:

```bash
pip install -r sim/requirements.txt
```

To verify:

```bash
pip show uxsim
# Location: C:\Python314\Lib\site-packages\uxsim
```

---

## File structure

```
sim/
  network_builder.py     HOW the road network is built (OSM + overlay data)
  uxsim_runner.py        WHAT demand to inject, WHICH scenarios to run
  test_build.py          Quick sanity check (network only, no simulation)
  requirements.txt       Python dependencies
  converters/
    schema.py            Output data types (SimOutput, Frame, VehicleState, RoadStat)
    uxsim_to_json.py     Converts raw UXsim DataFrames to canonical JSON format
    sumo_to_json.py      SUMO converter stub (not implemented)
```

---

## Running independently

**Quick network check — no simulation, ~5 seconds:**

```bash
cd C:\Users\neill\Github\tokai-sim\sim
python test_build.py
```

Expected output:
```
ALL CHECKS PASSED
  Nodes : 988
  Links : 2295
  N7    : n_18.447309_-34.051039
  School-Gate: School-Gate
```

**Run a single scenario — ~30 seconds:**

```bash
cd C:\Users\neill\Github\tokai-sim\sim
python uxsim_runner.py --scenario M
```

**Run all three scenarios — ~90 seconds:**

```bash
cd C:\Users\neill\Github\tokai-sim\sim
python uxsim_runner.py
```

Output files are written to `public/sim-results/scenario-{L,M,H}.json`.

---

## Configuration reference

### Scenario demand totals

File: `uxsim_runner.py` — `SCENARIO_DEMAND` dict

```python
SCENARIO_DEMAND = {
    "L": 420,   # Low scenario — total vehicle trips, AM peak
    "M": 650,   # Medium
    "H": 840,   # High
}
```

Source: TIA §13 origin-destination trip counts.

### Corridor demand splits

File: `uxsim_runner.py` — `CORRIDORS` list

```python
CORRIDORS = [
    {"node_id": "N1", "share": 0.24, "label": "1A Main/Dreyersdal"},
    {"node_id": "N2", "share": 0.20, "label": "2A Dreyersdal/Firgrove"},
    {"node_id": "N3", "share": 0.35, "label": "2B Ladies Mile/Childrens"},
    {"node_id": "N4", "share": 0.21, "label": "3A Ladies Mile/Homestead"},
]
```

Each corridor injects demand from its entry node to `School-Gate`.

### Arrival time profile

File: `uxsim_runner.py` — `ARRIVAL_PROFILE` list

```python
ARRIVAL_PROFILE = [
    (23400, 26100, 0.15),   # 06:30-07:15  15%
    (26100, 27900, 0.30),   # 07:15-07:45  30%
    (27900, 28800, 0.35),   # 07:45-08:00  35%  ← peak
    (28800, 29700, 0.15),   # 08:00-08:15  15%
    (29700, 30600, 0.05),   # 08:15-08:30   5%
]
```

Times are seconds since midnight. To flatten to a uniform arrival rate, replace with a single tuple covering the full window.

### School dwell time

File: `network_builder.py` — constants near the top

```python
SCHOOL_LINK_LENGTH_M  = 62    # metres
SCHOOL_LINK_SPEED_MS  = 5 / 3.6  # 5 km/h → m/s  =>  ~45s free-flow travel time
```

The dwell time is modelled as a slow internal link (`SCHOOL_INTERNAL_IN/OUT`) between node N7 (Ruskin/Leyden ingress) and the `School-Gate` node. Increasing the length or reducing the speed increases simulated dwell.

### Road speed and capacity defaults

File: `network_builder.py` — `SPEED_DEFAULTS` and `CAPACITY_DEFAULTS` dicts

Applied to OSM ways that have no `maxspeed` tag. Values are per lane.

```python
SPEED_DEFAULTS = {
    "residential": 30,   # km/h
    "tertiary":    50,
    "secondary":   60,
    ...
}

CAPACITY_DEFAULTS = {
    "residential": 500,  # veh/hr/lane
    "tertiary":    900,
    "secondary":  1200,
    ...
}
```

Critical overlay edges (E1-E20 from `data/network-L2.geojson`) have their speed and capacity patched over OSM defaults after the network is built.

### Which road types are included

File: `network_builder.py` — `DRIVABLE` set

```python
DRIVABLE = {
    "secondary", "tertiary", "residential", "service",
    "unclassified", "living_street", ...
}
```

OSM ways with `highway` types not in this set (footway, path, cycleway, steps) are excluded from the simulation network.

### Output timestep

File: `uxsim_runner.py` — `TIMESTEP`

```python
TIMESTEP = 60   # seconds between output frames
```

Reducing this increases JSON file size proportionally (currently ~2.5 MB per scenario at 60s).

---

## Data sources

| File | Purpose |
|---|---|
| `osm/osm-bergvliet-withsigns.geojson` | Base road network — 726 drivable OSM ways |
| `data/network-L2.geojson` | Project overlay — N1-N12 junctions, E1-E20 directed edges with capacity data |

The network builder loads OSM as the base, detects intersections by finding shared coordinates between ways, splits ways at intersections, then snaps N1-N12 junction nodes onto the nearest OSM intersection node (tolerance 15m — all 12 junctions snap within 13m).

---

## Interactive exploration (Jupyter / REPL)

```python
import sys
sys.path.insert(0, r"C:\Users\neill\Github\tokai-sim\sim")

from network_builder import build_world

# Build the network
W, node_map, overlay_nodes = build_world()

# Inject demand manually (example: 0.05 veh/s from N1 to school for 1 hour)
school = overlay_nodes["School-Gate"]
n1     = overlay_nodes["N1"]
W.adddemand(n1, school, t_start=25200, t_end=28800, flow=0.05)

# Run
W.exec_simulation()

# Inspect results
W.analyzer.compute_edie_state()

veh_df  = W.analyzer.vehicles_to_pandas()         # per-vehicle: t, link, x, v, dn
link_df = W.analyzer.link_traffic_state_to_pandas()  # per-link per-timestep: q, k, v
agg_df  = W.analyzer.link_to_pandas()             # aggregate totals per link

print(veh_df.head())

# UXsim built-in plots (requires matplotlib)
W.analyzer.time_space_diagram_traj_links(links=W.LINKS[:5])
W.analyzer.macroscopic_fundamental_diagram()
```

### Key DataFrame columns

**`vehicles_to_pandas()`**

| Column | Description |
|---|---|
| `t` | Time (seconds since midnight, matching our frame timestamps) |
| `link` | UXsim link name (e.g. `"Christopher Road_42_fwd"`) |
| `x` | Position in metres from link start (NOT 0-1; divide by link.length for progress) |
| `v` | Speed in m/s |
| `dn` | Platoon size — each row represents this many vehicles (we use `deltan=5`) |

**`link_traffic_state_to_pandas()`**

| Column | Description |
|---|---|
| `link` | Link name |
| `t` | Time |
| `q` | Flow in vehicles/second (Edie's definition) |
| `k` | Density in vehicles/metre |
| `v` | Space-mean speed in m/s |

---

## Regenerating output after data changes

Any change to demand figures, road geometry, or junction data requires re-running the pipeline:

```bash
cd C:\Users\neill\Github\tokai-sim\sim
python uxsim_runner.py
git add ../public/sim-results/
git commit -m "chore: regenerate scenario JSON"
```
