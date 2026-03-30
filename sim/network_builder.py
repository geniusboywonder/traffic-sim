"""
network_builder.py — Build a UXsim World from OSM + project overlay data.

Inputs:
  osm/osm-bergvliet-withsigns.geojson   — real OSM road network (base)
  data/network-L2.geojson               — project junctions (N1-N12) + directed edges (E1-E20)

Strategy:
  1. Load OSM LineStrings filtered to drivable highway types.
  2. Detect intersections: coordinates shared between 2+ ways → split ways there.
  3. Create UXsim nodes at every intersection + endpoints.
  4. Create UXsim links for every split segment.
  5. Overlay N1-N12 junction metadata (speed, capacity) by nearest-coordinate match.
  6. Add School-Gate node and SCHOOL_INTERNAL slow link (models 45s dwell).
  7. Return the configured UXsim World (not yet run).
"""

import json
import math
from collections import defaultdict
from pathlib import Path

import uxsim
from shapely.geometry import LineString, Point

# ── Constants ──────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).parent.parent

OSM_PATH       = REPO_ROOT / "osm" / "osm-bergvliet-withsigns.geojson"
NETWORK_PATH   = REPO_ROOT / "data" / "network-L2.geojson"

# Drivable highway types to include from OSM (exclude footway, path, cycleway, steps)
DRIVABLE = {
    "motorway", "motorway_link",
    "trunk", "trunk_link",
    "primary", "primary_link",
    "secondary", "secondary_link",
    "tertiary", "tertiary_link",
    "unclassified",
    "residential",
    "living_street",
    "service",         # includes Dreyersdal Farm Road approach
}

# Default speed (km/h) by highway type when maxspeed is absent
SPEED_DEFAULTS = {
    "motorway": 120, "motorway_link": 80,
    "trunk": 80,     "trunk_link": 60,
    "primary": 60,   "primary_link": 60,
    "secondary": 60, "secondary_link": 50,
    "tertiary": 50,  "tertiary_link": 40,
    "unclassified": 40,
    "residential": 30,
    "living_street": 20,
    "service": 20,
}

# Default capacity (veh/hr/lane) by highway type
CAPACITY_DEFAULTS = {
    "motorway": 2200, "motorway_link": 1500,
    "trunk": 1800,    "trunk_link": 1200,
    "primary": 1600,  "primary_link": 1200,
    "secondary": 1200,"secondary_link": 900,
    "tertiary": 900,  "tertiary_link": 700,
    "unclassified": 600,
    "residential": 500,
    "living_street": 200,
    "service": 300,
}

SNAP_TOLERANCE_M = 15.0   # metres — overlay junction snap radius
COORD_ROUND      = 6      # decimal places for coordinate key

# School gate node (approximate centroid of school site entrance)
SCHOOL_GATE_LON  = 18.4455
SCHOOL_GATE_LAT  = -34.0512
SCHOOL_GATE_ID   = "School-Gate"

# Internal school link: ~62 m at 5 km/h ≈ 45 s free-flow (models dwell time)
SCHOOL_LINK_LENGTH_M  = 62
SCHOOL_LINK_SPEED_MS  = 5 / 3.6
SCHOOL_LINK_CAPACITY  = 350   # matches E14 in network-L2


# ── Geometry helpers ───────────────────────────────────────────────────────────

def haversine_m(lon1, lat1, lon2, lat2):
    """Great-circle distance in metres."""
    R = 6_371_000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(dλ/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def linestring_length_m(coords):
    """Total length in metres of a coordinate list [(lon,lat), ...]."""
    return sum(
        haversine_m(coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1])
        for i in range(len(coords) - 1)
    )


def coord_key(lon, lat):
    return (round(lon, COORD_ROUND), round(lat, COORD_ROUND))


# ── Load and filter OSM ────────────────────────────────────────────────────────

def load_osm_ways(path):
    """Return list of dicts: {id, highway, name, maxspeed, lanes, oneway, coords}."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    ways = []
    for feat in data["features"]:
        if feat["geometry"]["type"] != "LineString":
            continue
        p = feat.get("properties") or {}
        hw = p.get("highway", "")
        if hw not in DRIVABLE:
            continue
        coords = [tuple(c) for c in feat["geometry"]["coordinates"]]
        if len(coords) < 2:
            continue

        # Parse maxspeed
        ms = p.get("maxspeed")
        try:
            speed_kmh = float(str(ms).replace(" mph", "").replace("km/h", "").strip())
        except (TypeError, ValueError):
            speed_kmh = SPEED_DEFAULTS.get(hw, 30)

        lanes = max(1, int(p.get("lanes", 1) or 1))
        oneway = p.get("oneway", "no") in ("yes", "true", "1", "-1")

        ways.append({
            "id":       feat.get("id", ""),
            "highway":  hw,
            "name":     p.get("name", ""),
            "speed_kmh": speed_kmh,
            "lanes":    lanes,
            "oneway":   oneway,
            "coords":   coords,
        })

    return ways


# ── Intersection detection ─────────────────────────────────────────────────────

def find_intersection_coords(ways):
    """
    Return set of coord_key tuples that appear in 2+ distinct ways
    (intersections + shared endpoints = network nodes).
    """
    coord_ways = defaultdict(set)
    for i, way in enumerate(ways):
        for coord in way["coords"]:
            coord_ways[coord_key(*coord)].add(i)

    # A coordinate is a node if it's used by 2+ ways OR it's a way endpoint
    node_keys = set()
    for i, way in enumerate(ways):
        # Endpoints are always nodes
        node_keys.add(coord_key(*way["coords"][0]))
        node_keys.add(coord_key(*way["coords"][-1]))

    for key, way_indices in coord_ways.items():
        if len(way_indices) >= 2:
            node_keys.add(key)

    return node_keys


# ── Split ways at intersections ────────────────────────────────────────────────

def split_ways(ways, node_keys):
    """
    Split each way wherever a coordinate is in node_keys.
    Returns list of segments: {way_id, name, highway, speed_kmh, lanes, oneway, coords}
    """
    segments = []
    for way in ways:
        coords = way["coords"]
        current = [coords[0]]
        for coord in coords[1:]:
            current.append(coord)
            if coord_key(*coord) in node_keys and len(current) >= 2:
                segments.append({**way, "coords": list(current)})
                current = [coord]
        # Flush any remainder (shouldn't happen if last coord is a node, but guard anyway)
        if len(current) >= 2:
            segments.append({**way, "coords": list(current)})
    return segments


# ── Load overlay data (N1-N12 + E1-E20) ───────────────────────────────────────

def load_overlay(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    nodes, edges = {}, []
    for feat in data["features"]:
        p = feat.get("properties") or {}
        geom = feat["geometry"]
        if geom["type"] == "Point":
            nid = p.get("id", "")
            if nid.startswith("N"):
                lon, lat = geom["coordinates"]
                nodes[nid] = {
                    "id": nid, "lon": lon, "lat": lat,
                    "label": p.get("label", ""),
                    "type": p.get("type", ""),
                }
        elif geom["type"] == "LineString":
            eid = p.get("id", "")
            if eid.startswith("E"):
                edges.append({
                    "id": eid,
                    "road": p.get("road", ""),
                    "from": p.get("from", ""),
                    "to": p.get("to", ""),
                    "lanes": p.get("lanes", 1),
                    "speed_kmh": p.get("speed_kmh", 30),
                    "capacity_veh_hr": p.get("capacity_veh_hr", 500),
                })

    return nodes, edges


# ── Build UXsim World ──────────────────────────────────────────────────────────

def build_world(sim_start=23400, sim_end=30600, timestep=60, reaction_time=1.5):
    """
    Build and return a configured UXsim World.

    Parameters
    ----------
    sim_start      : int   seconds since midnight (06:30 = 23400)
    sim_end        : int   seconds since midnight (08:30 = 30600)
    timestep       : int   seconds per simulation step
    reaction_time  : float UXsim reaction_time parameter (replaces dt/tau)

    Returns
    -------
    W              : uxsim.World
    node_map       : dict  coord_key → UXsim Node (for demand injection)
    overlay_nodes  : dict  N-id → UXsim Node (for E14 / school gate lookup)
    """

    # ── 1. Load data ──────────────────────────────────────────────────────────
    ways          = load_osm_ways(OSM_PATH)
    overlay_nodes, overlay_edges = load_overlay(NETWORK_PATH)

    # ── 2. Find intersections and split ways ──────────────────────────────────
    node_keys = find_intersection_coords(ways)
    segments  = split_ways(ways, node_keys)

    print(f"[network_builder] OSM ways loaded:      {len(ways)}")
    print(f"[network_builder] Intersection nodes:   {len(node_keys)}")
    print(f"[network_builder] Segments after split: {len(segments)}")

    # ── 3. Create UXsim World ─────────────────────────────────────────────────
    W = uxsim.World(
        name               = "bergvliet",
        deltan             = 5,           # vehicles per platoon
        reaction_time      = reaction_time,
        duo_update_time    = 600,
        duo_update_weight  = 0.5,
        duo_noise          = 0.01,
        eular_dt           = timestep,
        eular_dx           = 100,
        random_seed        = 42,
        print_mode         = 0,
    )

    # ── 4. Create nodes at every intersection ─────────────────────────────────
    node_map = {}   # coord_key → W.Node
    for key in node_keys:
        lon, lat = key
        n = W.addNode(name=f"n_{lon}_{lat}", x=lon, y=lat)
        node_map[key] = n

    # ── 5. Snap overlay N1-N12 junctions to nearest OSM node ─────────────────
    overlay_node_map = {}   # N-id → W.Node
    for nid, info in overlay_nodes.items():
        best_key, best_dist = None, float("inf")
        for key in node_map:
            d = haversine_m(info["lon"], info["lat"], key[0], key[1])
            if d < best_dist:
                best_dist, best_key = d, key
        if best_dist <= SNAP_TOLERANCE_M:
            overlay_node_map[nid] = node_map[best_key]
            print(f"[network_builder]   {nid} ({info['label']}) snapped ({best_dist:.1f}m)")
        else:
            # No OSM node nearby — create a synthetic node
            n = W.addNode(name=nid, x=info["lon"], y=info["lat"])
            node_map[coord_key(info["lon"], info["lat"])] = n
            overlay_node_map[nid] = n
            print(f"[network_builder]   {nid} ({info['label']}) synthetic node ({best_dist:.1f}m from nearest OSM)")

    # ── 6. Add School-Gate node ───────────────────────────────────────────────
    school_gate = W.addNode(name=SCHOOL_GATE_ID, x=SCHOOL_GATE_LON, y=SCHOOL_GATE_LAT)
    overlay_node_map[SCHOOL_GATE_ID] = school_gate

    # ── 7. Create links from OSM segments ────────────────────────────────────
    seg_link_map = {}  # index → W.Link (for overlay capacity patching)
    for i, seg in enumerate(segments):
        start_key = coord_key(*seg["coords"][0])
        end_key   = coord_key(*seg["coords"][-1])
        n_start   = node_map[start_key]
        n_end     = node_map[end_key]

        length_m  = linestring_length_m(seg["coords"])
        if length_m < 1:
            continue  # degenerate segment

        speed_ms  = seg["speed_kmh"] / 3.6
        lanes     = seg["lanes"]
        hw        = seg["highway"]
        capacity  = CAPACITY_DEFAULTS.get(hw, 500) * lanes

        name_fwd = f"{seg['name'] or hw}_{i}_fwd"
        link_fwd = W.addLink(
            name              = name_fwd,
            start_node        = n_start,
            end_node          = n_end,
            length            = length_m,
            free_flow_speed   = speed_ms,
            jam_density       = 0.2,
            number_of_lanes   = lanes,
            merge_priority    = 1.0,
        )
        seg_link_map[i] = link_fwd

        # Add reverse direction unless one-way
        if not seg["oneway"]:
            W.addLink(
                name              = f"{seg['name'] or hw}_{i}_rev",
                start_node        = n_end,
                end_node          = n_start,
                length            = length_m,
                free_flow_speed   = speed_ms,
                jam_density       = 0.2,
                number_of_lanes   = lanes,
                merge_priority    = 1.0,
            )

    print(f"[network_builder] UXsim links created:  {len(W.LINKS)}")

    # ── 8. Patch overlay edge capacities / speeds onto matched OSM links ──────
    # For the critical edges (E14 school ingress etc.) we find the closest link
    # by matching from/to overlay nodes and override speed & capacity.
    for edge in overlay_edges:
        n_from = overlay_node_map.get(edge["from"])
        n_to   = overlay_node_map.get(edge["to"])
        if n_from is None or n_to is None:
            continue
        # Find all links between these two nodes
        for link in W.LINKS:
            if link.start_node is n_from and link.end_node is n_to:
                link.u  = edge["speed_kmh"] / 3.6           # free_flow_speed
                # UXsim capacity is set via link.capacity; patch if available
                if hasattr(link, "capacity"):
                    link.capacity = edge["capacity_veh_hr"] / 3600  # veh/s

    # ── 9. School-Gate internal link (dwell model) ────────────────────────────
    # N7 is the school ingress node. Cars travel from N7 → School-Gate at 5km/h
    # (~45s free-flow), modelling the drop-off dwell time before they exit again.
    n7 = overlay_node_map.get("N7")
    if n7 is not None:
        W.addLink(
            name              = "SCHOOL_INTERNAL_IN",
            start_node        = n7,
            end_node          = school_gate,
            length            = SCHOOL_LINK_LENGTH_M,
            free_flow_speed   = SCHOOL_LINK_SPEED_MS,
            jam_density       = 0.2,
            number_of_lanes   = 2,
            merge_priority    = 0.5,
        )
        W.addLink(
            name              = "SCHOOL_INTERNAL_OUT",
            start_node        = school_gate,
            end_node          = n7,
            length            = SCHOOL_LINK_LENGTH_M,
            free_flow_speed   = SCHOOL_LINK_SPEED_MS,
            jam_density       = 0.2,
            number_of_lanes   = 2,
            merge_priority    = 0.5,
        )
    else:
        print("[network_builder] WARNING: N7 not found — school internal link skipped")

    print(f"[network_builder] Total UXsim links:    {len(W.LINKS)}")
    print(f"[network_builder] Total UXsim nodes:    {len(W.NODES)}")

    return W, node_map, overlay_node_map


if __name__ == "__main__":
    W, node_map, overlay_nodes = build_world()
    print("[network_builder] Build complete — world ready for demand injection.")
