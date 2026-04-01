"""
sumo_to_json.py — Convert SUMO FCD + tripinfo XML to canonical SimOutput JSON.

FCD XML per timestep:
  <vehicle id="flow_0_in.3" lane="e1015_rev_0" pos="45.2" speed="8.3" .../>

tripinfo XML per vehicle:
  <tripinfo id="flow_0_in.3" timeLoss="12.4" waitingTime="3.0" .../>

Mapping:
  lane "e1015_rev_0" → edge "e1015_rev" → road name (from net.xml) → slug
  pos / edge_length  → progress 0-1
  "flow_N_in.*"      → state "inbound"
  "flow_N_out.*"     → state "outbound"
  speed < 0.5 m/s    → state "queued"
"""

import re
import sys
import warnings
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, "C:/Users/neill/AppData/Roaming/Python/Python314/site-packages/sumo/tools")

from .schema import SimOutput, SimMeta, RoadMeta, Frame, VehicleState, RoadStat


def _slug(name: str) -> str:
    """'Ladies Mile Road' → 'ladies_mile_road'"""
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def _edge_from_lane(lane_id: str) -> str | None:
    """'e1015_rev_0' → 'e1015_rev';  ':junction_...' → None (internal, skip)."""
    if lane_id.startswith(":"):
        return None
    # Strip trailing _<digit(s)> lane suffix
    return re.sub(r"_\d+$", "", lane_id)


def _build_edge_offset_map(edge_meta: dict) -> dict:
    """
    For each SUMO edge, compute its cumulative offset within its road direction group
    so that progress can be calculated as (offset + pos) / total_road_length.

    Groups edges by (road_slug, base_osm_id, is_reversed).  Within each group,
    edges are sorted by their #N sequence number, giving the correct road order.

    For reversed edges (negative OSM ID) progress is inverted so it always runs
    0→1 in the same direction as the GeoJSON geometry.

    Returns {edge_id: {'offset': float, 'total': float, 'reversed': bool}}
    Falls back gracefully — if an edge_id is not in the result the caller should
    use pos/edge_length as before.
    """
    from collections import defaultdict

    # group key → [(seq, edge_id, length)]
    groups: dict[tuple, list] = defaultdict(list)

    for eid, meta in edge_meta.items():
        slug = meta["slug"]
        is_neg = eid.startswith("-")
        clean = eid.lstrip("-")

        # Match base ID and optional #N sequence suffix
        m = re.match(r"^(.+?)(?:#(\d+))?$", clean)
        if not m:
            continue
        base = m.group(1)
        seq  = int(m.group(2)) if m.group(2) is not None else 0

        groups[(slug, base, is_neg)].append((seq, eid, meta["length"]))

    offset_map: dict[str, dict] = {}

    for (slug, base, is_neg), edges in groups.items():
        edges.sort(key=lambda x: x[0])          # order by #0, #1, #2 …
        total = sum(length for _, _, length in edges)
        if total <= 0:
            continue

        cumulative = 0.0
        for _, eid, length in edges:
            offset_map[eid] = {
                "offset":   cumulative,
                "total":    total,
                "reversed": is_neg,   # reversed relative to the GeoJSON direction
            }
            cumulative += length

    return offset_map


def _load_edge_meta(net_path: Path) -> dict:
    """
    Returns {edge_id: {'slug': str, 'name': str, 'length': float}}.
    Uses sumolib; suppresses the rtree warning.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        import sumolib
        net = sumolib.net.readNet(str(net_path), withInternal=False)

    meta = {}
    for edge in net.getEdges():
        eid = edge.getID()
        raw_name = edge.getName() or eid
        meta[eid] = {
            "slug":   _slug(raw_name),
            "name":   raw_name,
            "length": edge.getLength(),
        }
    return meta


def _load_tripinfo(tripinfo_path: Path) -> dict:
    """Returns {vehicle_id: {'timeLoss': float, 'waitingTime': float}}."""
    info = {}
    for event, elem in ET.iterparse(str(tripinfo_path), events=("end",)):
        if elem.tag == "tripinfo":
            info[elem.get("id")] = {
                "timeLoss":    float(elem.get("timeLoss",    0)),
                "waitingTime": float(elem.get("waitingTime", 0)),
            }
            elem.clear()
    return info


def _vehicle_state(speed: float, is_outbound: bool = False) -> str:
    if speed < 0.5:
        return "queued"
    if is_outbound:
        return "outbound"
    return "inbound"


def convert(
    fcd_xml_path,
    tripinfo_xml_path,
    scenario: str,
    start_time: int = 23400,
    end_time: int   = 30600,
    timestep: int   = 60,
    net_path=None,
) -> SimOutput:
    fcd_xml_path     = Path(fcd_xml_path)
    tripinfo_xml_path = Path(tripinfo_xml_path)

    if net_path is None:
        net_path = fcd_xml_path.parent / "bergvliet.net.xml"

    print(f"[sumo_to_json] Loading edge metadata from {net_path.name}...")
    edge_meta = _load_edge_meta(net_path)
    edge_offsets = _build_edge_offset_map(edge_meta)
    print(f"[sumo_to_json] Edge offset map: {len(edge_offsets)} edges mapped")

    print(f"[sumo_to_json] Loading tripinfo...")
    tripinfo = _load_tripinfo(tripinfo_xml_path)

    # Collect per-vehicle timeLoss keyed by road slug + direction for delay stats
    # vehicle_id pattern: "flow_{N}_in.{M}" — all flows are inbound; outbound is
    # detected by tracking vehicles that have been on the school internal road.
    road_delay: dict[tuple, list] = {}  # (slug, state) → [timeLoss, ...]

    # Build frames by streaming FCD XML
    frame_times = range(start_time, end_time + 1, timestep)
    frames_by_t: dict[int, Frame] = {t: Frame(t=t) for t in frame_times}
    road_set: dict[str, RoadMeta] = {}

    # Track which vehicles have completed their school drop-off (been on school
    # internal road).  Subsequent appearances on other roads → state "outbound".
    visited_school: set[str] = set()
    SCHOOL_SLUG = "school_internal_road"

    current_t: int | None = None

    print(f"[sumo_to_json] Parsing FCD XML...")
    for event, elem in ET.iterparse(str(fcd_xml_path), events=("start", "end")):
        if event == "start" and elem.tag == "timestep":
            t = int(float(elem.get("time", -1)))
            current_t = t if t in frames_by_t else None

        elif event == "end" and elem.tag == "vehicle" and current_t is not None:
            vid      = elem.get("id", "")
            lane_id  = elem.get("lane", "")
            pos      = float(elem.get("pos",   0))
            speed    = float(elem.get("speed", 0))

            edge_id = _edge_from_lane(lane_id)
            if edge_id is None or edge_id not in edge_meta:
                elem.clear()
                continue

            em   = edge_meta[edge_id]
            slug = em["slug"]

            # Mark vehicle as having visited school; detect outbound state.
            if slug == SCHOOL_SLUG:
                visited_school.add(vid)
            is_outbound = (vid in visited_school) and (slug != SCHOOL_SLUG)

            # Use cumulative offset map for accurate road-level progress.
            # Falls back to pos/edge_length for edges not in the map.
            if edge_id in edge_offsets:
                om       = edge_offsets[edge_id]
                raw      = (om["offset"] + pos) / om["total"]
                progress = float(1.0 - raw if om["reversed"] else raw)
                progress = max(0.0, min(1.0, progress))
            else:
                length   = em["length"]
                progress = min(1.0, pos / length) if length > 0 else 0.0

            state = _vehicle_state(speed, is_outbound)

            frames_by_t[current_t].vehicles.append(
                VehicleState(id=vid, road_id=slug, progress=progress, speed=speed, state=state)
            )

            if slug not in road_set:
                road_set[slug] = RoadMeta(
                    id=slug,
                    name=em["name"],
                    osm_ids=[],
                    direction_pairs=["inbound", "outbound"],
                )

            # Accumulate delay stats
            ti = tripinfo.get(vid)
            if ti:
                key = (slug, state)
                road_delay.setdefault(key, []).append(ti["timeLoss"])

            elem.clear()

        elif event == "end" and elem.tag == "timestep":
            elem.clear()

    # Build road_stats per frame
    print(f"[sumo_to_json] Building road stats...")
    for frame in frames_by_t.values():
        counts: dict[str, dict] = {}
        for v in frame.vehicles:
            c = counts.setdefault(v.road_id, {"inbound": 0, "outbound": 0, "queued": 0})
            if v.state == "inbound":
                c["inbound"] += 1
            elif v.state == "outbound":
                c["outbound"] += 1
            else:
                c["queued"] += 1

        for slug, c in counts.items():
            delay_in  = road_delay.get((slug, "inbound"))
            delay_out = road_delay.get((slug, "outbound"))
            frame.road_stats.append(RoadStat(
                road_id=slug,
                inbound=c["inbound"],
                outbound=c["outbound"],
                avg_delay_in=int(sum(delay_in) / len(delay_in))   if delay_in  else None,
                avg_delay_out=int(sum(delay_out) / len(delay_out)) if delay_out else None,
            ))

    meta = SimMeta(
        scenario=scenario,
        source="sumo",
        version=1,
        start_time=start_time,
        end_time=end_time,
        timestep=timestep,
    )

    roads  = sorted(road_set.values(), key=lambda r: r.id)
    frames = [frames_by_t[t] for t in frame_times]

    total_vehicles = sum(len(f.vehicles) for f in frames)
    print(f"[sumo_to_json] Done: {len(roads)} roads, {len(frames)} frames, {total_vehicles} vehicle-frames")

    return SimOutput(meta=meta, roads=roads, frames=frames)
