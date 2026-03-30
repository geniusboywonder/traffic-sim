"""
schema.py — Canonical Python type definitions for the simulation output format.

These dataclasses are the authoritative types used by both uxsim_to_json.py
and sumo_to_json.py. The JSON schema is documented in docs/sim-output-format.md.
"""

from dataclasses import dataclass, field
from typing import List, Optional
import json


@dataclass
class SimMeta:
    scenario: str           # "L" | "M" | "H"
    source: str             # "uxsim" | "sumo" | "idm"
    version: int            # schema version — increment on breaking changes
    start_time: int         # seconds since midnight (06:30 = 23400)
    end_time: int           # seconds since midnight (08:30 = 30600)
    timestep: int           # seconds between frames


@dataclass
class RoadMeta:
    id: str                 # stable slug, join key throughout
    name: str               # human-readable, matches GeoJSON name property
    osm_ids: List[str]      # OSM way IDs for map feature matching
    direction_pairs: List[str]  # typically ["inbound", "outbound"]


@dataclass
class VehicleState:
    id: str                 # stable within a scenario file
    road_id: str            # references RoadMeta.id
    progress: float         # 0-1, fractional position along road GeoJSON geometry
    speed: float            # m/s
    state: str              # "inbound" | "outbound" | "queued" | "rat_run"


@dataclass
class RoadStat:
    road_id: str            # references RoadMeta.id
    inbound: int            # vehicle count, inbound direction
    outbound: int           # vehicle count, outbound direction
    avg_delay_in: Optional[int]   # seconds; None if no inbound vehicles
    avg_delay_out: Optional[int]  # seconds; None if no outbound vehicles


@dataclass
class Frame:
    t: int                  # absolute simulation time (seconds since midnight)
    vehicles: List[VehicleState] = field(default_factory=list)
    road_stats: List[RoadStat]   = field(default_factory=list)


@dataclass
class SimOutput:
    meta: SimMeta
    roads: List[RoadMeta]
    frames: List[Frame]

    def to_dict(self):
        return {
            "meta": {
                "scenario":   self.meta.scenario,
                "source":     self.meta.source,
                "version":    self.meta.version,
                "start_time": self.meta.start_time,
                "end_time":   self.meta.end_time,
                "timestep":   self.meta.timestep,
            },
            "roads": [
                {
                    "id":               r.id,
                    "name":             r.name,
                    "osm_ids":          r.osm_ids,
                    "direction_pairs":  r.direction_pairs,
                }
                for r in self.roads
            ],
            "frames": [
                {
                    "t": f.t,
                    "vehicles": [
                        {
                            "id":       v.id,
                            "road_id":  v.road_id,
                            "progress": round(v.progress, 4),
                            "speed":    round(v.speed, 2),
                            "state":    v.state,
                        }
                        for v in f.vehicles
                    ],
                    "road_stats": [
                        {
                            "road_id":       s.road_id,
                            "inbound":       s.inbound,
                            "outbound":      s.outbound,
                            "avg_delay_in":  s.avg_delay_in,
                            "avg_delay_out": s.avg_delay_out,
                        }
                        for s in f.road_stats
                    ],
                }
                for f in self.frames
            ],
        }

    def write_json(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=None, separators=(",", ":"))
        print(f"[schema] Written: {path}  ({path.stat().st_size // 1024} KB)")
