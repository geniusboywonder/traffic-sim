"""
uxsim_to_json.py — Convert UXsim World analyzer output to canonical SimOutput JSON.

UXsim native outputs (after W.analyzer.compute_edie_state()):
  vehicles_to_pandas()         per-vehicle: t, link, x (m from start), v (m/s)
  link_traffic_state_to_pandas() per-link per-timestep: link, t, q (veh/s), k, v

Mapping strategy:
  - Group UXsim links by road name slug → road_id
  - For each 60s frame, snapshot vehicle positions and per-road counts
  - _fwd links count as "inbound", _rev links as "outbound" (direction convention)
  - Delay = max(0, free_flow_travel_time - actual_speed_travel_time) per link per frame

Usage:
  from converters.uxsim_to_json import convert
  sim_output = convert(W, scenario="M", link_road_map=link_road_map)
  sim_output.write_json(path)
"""

import re
from collections import defaultdict
from typing import Dict, List

from .schema import SimOutput, SimMeta, RoadMeta, Frame, VehicleState, RoadStat

START_TIME = 23400   # 06:30 in seconds since midnight
END_TIME   = 30600   # 08:30
TIMESTEP   = 30      # seconds between output frames


def slugify(name: str) -> str:
    """'Christopher Road' → 'christopher_rd'  (stable, URL-safe slug)."""
    name = name.lower().strip()
    name = re.sub(r"\broad\b", "rd", name)
    name = re.sub(r"\bstreet\b", "st", name)
    name = re.sub(r"\bavenue\b", "ave", name)
    name = re.sub(r"\bdrive\b", "dr", name)
    name = re.sub(r"\bway\b", "way", name)
    name = re.sub(r"[^a-z0-9]+", "_", name)
    return name.strip("_")


def _build_link_index(W):
    """
    Returns:
      link_by_name : dict  link_name → W.Link object
      road_links   : dict  road_id → {"fwd": [links], "rev": [links], "name": str, "osm_ids": [str]}
    """
    link_by_name = {l.name: l for l in W.LINKS}

    road_links = {}
    for link in W.LINKS:
        # Link names: "Christopher Road_42_fwd" or "Christopher Road_42_rev"
        # or "residential_17_fwd" (unnamed OSM ways)
        name = link.name

        is_fwd = name.endswith("_fwd")
        is_rev = name.endswith("_rev")
        is_school = "SCHOOL_INTERNAL" in name

        if is_school:
            # Group school links under their own road_id
            road_name = "School Internal"
            road_id   = "school_internal"
            direction = "inbound" if "IN" in name else "outbound"
        elif is_fwd or is_rev:
            # Strip suffix: "Christopher Road_42_fwd" → "Christopher Road"
            parts     = name.rsplit("_", 2)
            road_name = parts[0] if len(parts) >= 3 else name
            road_id   = slugify(road_name)
            direction = "inbound" if is_fwd else "outbound"
        else:
            road_name = name
            road_id   = slugify(name)
            direction = "inbound"

        if road_id not in road_links:
            road_links[road_id] = {
                "name":    road_name,
                "osm_ids": [],
                "fwd":     [],
                "rev":     [],
            }

        if direction == "inbound":
            road_links[road_id]["fwd"].append(link)
        else:
            road_links[road_id]["rev"].append(link)

    return link_by_name, road_links


def _build_vehicle_id_map(W, corridor_nodes):
    """
    Map every UXsim vehicle name to a frontend-compatible flow ID.

    The frontend's _flowToCorridor() parses "flow_{N}_*" where corridor index
    = floor(N / 5).  We assign each corridor a block of 5 flow numbers so the
    mapping stays stable: corridor 0 → flow_0_*, corridor 1 → flow_5_*, etc.

    Vehicles whose origin OR destination matches a corridor node are tagged;
    any others fall back to an opaque "v_{name}" ID (school-internal traffic,
    edge-case orphans).
    """
    if not corridor_nodes:
        return {}

    # Map node name (string) → corridor index — more robust than id() comparison
    corridor_by_node_name = {node.name: cidx for cidx, node in corridor_nodes.items()}

    seq_counter = {cidx: 0 for cidx in corridor_nodes}
    veh_id_map = {}   # vehicle_name → stable flow ID string

    # W.VEHICLES is an OrderedDict[str, Vehicle] — iterate values()
    for veh in W.VEHICLES.values():
        orig_name = veh.orig.name if veh.orig else None
        dest_name = veh.dest.name if veh.dest else None
        cidx = corridor_by_node_name.get(orig_name)
        if cidx is None:
            cidx = corridor_by_node_name.get(dest_name)
        if cidx is not None:
            flow_num = cidx * 5
            seq = seq_counter[cidx]
            seq_counter[cidx] += 1
            veh_id_map[veh.name] = f"flow_{flow_num}_{seq}"

    tagged = sum(1 for v in veh_id_map.values() if v.startswith("flow_"))
    print(f"[uxsim_to_json] Vehicle corridor mapping: {tagged}/{len(W.VEHICLES)} tagged")
    return veh_id_map


def convert(W, scenario: str, corridor_nodes=None,
            start_time=START_TIME, end_time=END_TIME, timestep=TIMESTEP) -> SimOutput:
    """
    Convert a completed UXsim World to a SimOutput.

    Call this AFTER W.exec_simulation() has returned.

    Parameters
    ----------
    corridor_nodes : dict  corridor_index (0-3) → UXsim Node, optional
        When provided, vehicles are assigned frontend-compatible flow_N_*
        IDs so the dashboard corridor stats (spawned, slowTime, congestion)
        work correctly.
    """
    print(f"[uxsim_to_json] Computing Edie state for scenario {scenario}...")
    W.analyzer.compute_edie_state()

    print("[uxsim_to_json] Fetching vehicle DataFrame...")
    veh_df = W.analyzer.vehicles_to_pandas()

    print("[uxsim_to_json] Fetching link traffic state DataFrame...")
    link_df = W.analyzer.link_traffic_state_to_pandas()

    # Build vehicle name → stable corridor-tagged ID
    veh_id_map = _build_vehicle_id_map(W, corridor_nodes)

    _, road_links = _build_link_index(W)

    # Build road metadata list (skip unnamed/residential stubs with no OSM name)
    roads_meta = []
    for road_id, info in sorted(road_links.items()):
        road_name = info["name"]
        # Skip anonymous OSM segments (highway type used as name)
        if road_name in ("residential", "service", "tertiary", "secondary",
                         "unclassified", "living_street", "primary", "trunk"):
            continue
        roads_meta.append(RoadMeta(
            id              = road_id,
            name            = road_name,
            osm_ids         = info["osm_ids"],
            direction_pairs = ["inbound", "outbound"],
        ))

    # Map link name → road_id and direction for fast lookup
    link_road_id  = {}   # link_name → road_id
    link_direction = {}  # link_name → "inbound" | "outbound"
    for road_id, info in road_links.items():
        for link in info["fwd"]:
            link_road_id[link.name]   = road_id
            link_direction[link.name] = "inbound"
        for link in info["rev"]:
            link_road_id[link.name]   = road_id
            link_direction[link.name] = "outbound"

    # Map link name → free flow speed (m/s) for delay calc
    link_ffs = {l.name: l.u for l in W.LINKS}

    # Build frames
    frames = []
    frame_times = range(start_time, end_time + 1, timestep)

    # Pre-index veh_df by time bucket for speed
    veh_df_indexed = None
    if veh_df is not None and len(veh_df) > 0 and "t" in veh_df.columns:
        veh_df_indexed = veh_df.set_index("t").sort_index()

    # Pre-index link_df by time for speed
    link_df_indexed = None
    if link_df is not None and len(link_df) > 0 and "t" in link_df.columns:
        link_df_indexed = link_df.set_index("t").sort_index()

    print(f"[uxsim_to_json] Building {len(list(frame_times))} frames...")

    for frame_t in frame_times:
        vehicles    = []
        road_counts = defaultdict(lambda: {"in": 0, "out": 0, "delay_in": [], "delay_out": []})

        # ── Vehicle positions at this timestep ────────────────────────────────
        if veh_df_indexed is not None:
            # Get vehicles recorded at this exact time (UXsim records every reaction_time step)
            try:
                snap = veh_df_indexed.loc[frame_t:frame_t]
            except KeyError:
                snap = veh_df_indexed.iloc[0:0]  # empty

            for i, row in enumerate(snap.itertuples()):
                link_name = getattr(row, "link", None)
                if link_name is None:
                    continue
                road_id = link_road_id.get(link_name)
                if road_id is None:
                    continue

                # dn = platoon size (vehicles per row in UXsim with deltan>1)
                dn = int(getattr(row, "dn", 1) or 1)

                link_obj = next((l for l in W.LINKS if l.name == link_name), None)
                link_len = link_obj.length if link_obj else 1.0
                x        = float(getattr(row, "x", 0))
                progress = min(1.0, max(0.0, x / link_len)) if link_len > 0 else 0.0
                speed    = float(getattr(row, "v", 0))
                direction = link_direction.get(link_name, "inbound")

                # Resolve stable corridor-tagged ID (falls back to opaque ID)
                # DataFrame column is 'name' (not 'vehicle') per UXSim API
                veh_name = getattr(row, "name", None)
                veh_id   = veh_id_map.get(veh_name, f"v{frame_t}_{i}") if veh_name else f"v{frame_t}_{i}"

                vehicles.append(VehicleState(
                    id       = veh_id,
                    road_id  = road_id,
                    progress = progress,
                    speed    = speed,
                    state    = direction,
                ))

                rc = road_counts[road_id]
                if direction == "inbound":
                    rc["in"] += dn
                else:
                    rc["out"] += dn

                # Delay estimate: if moving slower than free-flow
                ffs = link_ffs.get(link_name, speed)
                if ffs > 0 and speed < ffs:
                    delay_s = (1/speed - 1/ffs) * link_len if speed > 0 else link_len / ffs
                    for _ in range(dn):
                        if direction == "inbound":
                            rc["delay_in"].append(delay_s)
                        else:
                            rc["delay_out"].append(delay_s)

        # ── Road stats from link traffic state ────────────────────────────────
        # Fill in any roads that have vehicles per link_df but not per veh_df
        if link_df_indexed is not None:
            try:
                lsnap = link_df_indexed.loc[frame_t:frame_t]
            except KeyError:
                lsnap = link_df_indexed.iloc[0:0]

            for row in lsnap.itertuples():
                link_name = getattr(row, "link", None)
                if link_name is None:
                    continue
                road_id   = link_road_id.get(link_name)
                if road_id is None:
                    continue
                direction = link_direction.get(link_name, "inbound")
                q         = float(getattr(row, "q", 0) or 0)  # flow veh/s
                v         = float(getattr(row, "v", 0) or 0)

                # Convert flow to approximate vehicle count over the timestep
                count = int(round(q * timestep))
                rc    = road_counts[road_id]
                if direction == "inbound":
                    if rc["in"] == 0:
                        rc["in"] = count
                else:
                    if rc["out"] == 0:
                        rc["out"] = count

        # ── Build road_stats list ─────────────────────────────────────────────
        road_stats = []
        for road in roads_meta:
            rc = road_counts.get(road.id, {"in": 0, "out": 0, "delay_in": [], "delay_out": []})
            di = rc["delay_in"]
            do = rc["delay_out"]
            road_stats.append(RoadStat(
                road_id      = road.id,
                inbound      = rc["in"],
                outbound     = rc["out"],
                avg_delay_in  = int(sum(di) / len(di)) if di else None,
                avg_delay_out = int(sum(do) / len(do)) if do else None,
            ))

        frames.append(Frame(t=frame_t, vehicles=vehicles, road_stats=road_stats))

    meta = SimMeta(
        scenario   = scenario,
        source     = "uxsim",
        version    = 1,
        start_time = start_time,
        end_time   = end_time,
        timestep   = timestep,
    )

    print(f"[uxsim_to_json] Done. {len(frames)} frames, {len(roads_meta)} named roads.")
    return SimOutput(meta=meta, roads=roads_meta, frames=frames)
