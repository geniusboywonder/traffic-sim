# Simulation Output Format — Canonical Reference

**Version:** 1
**Used by:** `sim/converters/uxsim_to_json.py`, `sim/converters/sumo_to_json.py`, `src/engine/playback.js`

This document is the single source of truth for the JSON format that all simulation backends must produce and the frontend playback engine consumes.

---

## File location

Pre-computed scenario files are written to:

```
public/sim-results/scenario-L.json
public/sim-results/scenario-M.json
public/sim-results/scenario-H.json
```

These are static assets committed to the repo and served by the frontend directly.

---

## Full schema

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

---

## Field reference

### `meta`

| Field | Type | Description |
|---|---|---|
| `scenario` | `"L"` \| `"M"` \| `"H"` | Scenario identifier |
| `source` | string | Simulator that produced this file (`"uxsim"`, `"sumo"`, `"idm"`) |
| `version` | int | Schema version — increment when breaking changes are made |
| `start_time` | int | Simulation start in seconds since midnight (06:30 = 23400) |
| `end_time` | int | Simulation end in seconds since midnight (08:30 = 30600) |
| `timestep` | int | Seconds between frames (60) |

### `roads[]`

| Field | Type | Description |
|---|---|---|
| `id` | string | Stable slug — used as join key in `vehicles` and `road_stats` |
| `name` | string | Human-readable road name — must match the `name` property in the GeoJSON |
| `osm_ids` | string[] | OSM way IDs (e.g. `"way/123456"`) for matching GeoJSON features on the map |
| `direction_pairs` | string[] | Directions modelled for this road — typically `["inbound", "outbound"]` |

### `frames[]`

One frame per `timestep` interval from `start_time` to `end_time`. Total frame count = `(end_time - start_time) / timestep` = 120 frames for a 60s timestep over 2 hours.

| Field | Type | Description |
|---|---|---|
| `t` | int | Absolute simulation time (seconds since midnight) for this frame |
| `vehicles` | array | Synthesised vehicle positions at time `t` |
| `road_stats` | array | Per-road aggregate stats at time `t` |

### `frames[].vehicles[]`

| Field | Type | Description |
|---|---|---|
| `id` | string | Vehicle identifier (stable within a scenario file) |
| `road_id` | string | References `roads[].id` |
| `progress` | float 0–1 | Fractional position along the road's GeoJSON geometry. The frontend interpolates this to lat/lng using the GeoJSON LineString coordinates. |
| `speed` | float | Speed in m/s at this frame |
| `state` | string | `"inbound"` · `"outbound"` · `"queued"` · `"rat_run"` |

### `frames[].road_stats[]`

| Field | Type | Description |
|---|---|---|
| `road_id` | string | References `roads[].id` |
| `inbound` | int | Number of inbound vehicles on this road at time `t` |
| `outbound` | int | Number of outbound vehicles on this road at time `t` |
| `avg_delay_in` | int | Average delay in seconds for inbound vehicles at time `t`. `null` if no inbound vehicles. |
| `avg_delay_out` | int | Average delay in seconds for outbound vehicles at time `t`. `null` if no outbound vehicles. |

---

## Converter responsibilities

Each converter must produce a file that validates against this schema. The `schema.py` dataclasses in `sim/converters/schema.py` are the authoritative Python type definitions.

### UXsim → JSON

| UXsim source | Target field |
|---|---|
| `vehicles_to_pandas()` columns: `link`, `time`, `position`, `velocity` | `frames[].vehicles[]` |
| `link_traffic_state_to_pandas()` columns: `link`, `t`, `q` (flow), `v` (velocity) | `frames[].road_stats[]` inbound/outbound counts |
| `link_to_pandas()` columns: `link`, `traveltime`, `delay` | Road Watcher aggregate totals |

Delay is computed as `actual_travel_time - free_flow_travel_time` per vehicle per link per frame.

### SUMO → JSON (stub)

| SUMO output | Target field |
|---|---|
| FCD XML: `<vehicle id x y speed>` per timestep | `frames[].vehicles[]` (x/y → progress via road geometry) |
| `tripinfo` XML: `<tripinfo waitingTime timeLoss>` | `frames[].road_stats[].avg_delay_in/out` |
| Edge traffic XML: `<edge id entered>` | `frames[].road_stats[].inbound/outbound` |

---

## Versioning

If a breaking change is needed, increment `meta.version`. The frontend checks this value on load and rejects files with an unsupported version, prompting the user to re-run the Python pipeline.
