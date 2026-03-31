"""
sumo_network_builder.py — Build a SUMO network from OSM + project overlay data.

Inputs:
  osm/osm-bergvliet-withsigns.geojson   — real OSM road network (base)
  data/network-L2.geojson               — project junctions (N1-N12) + directed edges

Strategy (mirrors network_builder.py for UXsim):
  1. Load OSM LineStrings filtered to drivable highway types.
  2. Detect intersections (shared coordinates between 2+ ways) and split ways there.
  3. Overlay N1-N12 junction metadata (speed, capacity) by nearest-coordinate match.
  4. Write SUMO plain XML: bergvliet.nod.xml + bergvliet.edg.xml
  5. Run netconvert to produce bergvliet.net.xml

Outputs (written to sim/sumo/):
  bergvliet.nod.xml    SUMO node definitions
  bergvliet.edg.xml    SUMO edge definitions
  bergvliet.net.xml    compiled SUMO network (produced by netconvert)
"""

import json
import math
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET
from xml.dom import minidom

REPO_ROOT    = Path(__file__).parent.parent
OSM_PATH     = REPO_ROOT / "osm" / "osm-bergvliet-withsigns.geojson"
NETWORK_PATH = REPO_ROOT / "data" / "network-L2.geojson"
SUMO_DIR     = Path(__file__).parent / "sumo"
NETCONVERT   = Path("C:/Program Files (x86)/Eclipse/Sumo/bin/netconvert.exe")

SUMO_TOOLS   = Path("C:/Users/neill/AppData/Roaming/Python/Python314/site-packages/sumo/tools")
if str(SUMO_TOOLS) not in sys.path:
    sys.path.insert(0, str(SUMO_TOOLS))

DRIVABLE = {
    "motorway", "motorway_link",
    "trunk", "trunk_link",
    "primary", "primary_link",
    "secondary", "secondary_link",
    "tertiary", "tertiary_link",
    "unclassified", "residential",
    "living_street", "service",
}

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

# SUMO capacity (veh/hr/lane) → converted to veh/s for numLanes
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

SNAP_TOLERANCE_M = 15.0
COORD_ROUND      = 6

# School internal road: one-way loop entrance -> corner -> exit
# Entrance connects to OSM junction nearest N7; exit connects to nearest OSM junction.
SCHOOL_CORNER_ID  = "school-corner"
SCHOOL_CORNER_LON = 18.4490
SCHOOL_CORNER_LAT = -34.0528
SCHOOL_EXIT_LON   = 18.4500
SCHOOL_EXIT_LAT   = -34.0525

# Junction control overrides from routes.js (only junctions that differ from OSM defaults).
# sumo_type: traffic_light | allway_stop | priority_stop | priority
JUNCTION_CONTROLS = [
    {"id": "J8",  "lat": -34.051193, "lon": 18.457989, "sumo_type": "traffic_light"},
    {"id": "J10", "lat": -34.045008, "lon": 18.448799, "sumo_type": "allway_stop"},
    {"id": "J26", "lat": -34.052626, "lon": 18.456216, "sumo_type": "allway_stop"},
    {"id": "J28", "lat": -34.044726, "lon": 18.449741, "sumo_type": "allway_stop"},
    {"id": "J1",  "lat": -34.055818, "lon": 18.460897, "sumo_type": "priority_stop"},
    {"id": "J9",  "lat": -34.044112, "lon": 18.451770, "sumo_type": "priority_stop"},
    {"id": "J13", "lat": -34.041334, "lon": 18.448684, "sumo_type": "priority_stop"},
    {"id": "J15", "lat": -34.051531, "lon": 18.455003, "sumo_type": "priority_stop"},
    {"id": "J16", "lat": -34.051581, "lon": 18.452230, "sumo_type": "priority_stop"},
    {"id": "J4",  "lat": -34.049908, "lon": 18.451617, "sumo_type": "priority_stop"},
    {"id": "J24", "lat": -34.048973, "lon": 18.450967, "sumo_type": "priority_stop"},
]

# Speed humps from routes.js (J101-J128). Each gets a 15 km/h variableSpeedSign.
SPEED_HUMPS = [
    {"id": "J101", "lat": -34.0478486, "lon": 18.4515591},
    {"id": "J102", "lat": -34.0487467, "lon": 18.4520261},
    {"id": "J103", "lat": -34.0556745, "lon": 18.4598811},
    {"id": "J104", "lat": -34.0428669, "lon": 18.4460618},
    {"id": "J105", "lat": -34.0478846, "lon": 18.4505564},
    {"id": "J106", "lat": -34.0490817, "lon": 18.4510499},
    {"id": "J107", "lat": -34.049661,  "lon": 18.4513977},
    {"id": "J108", "lat": -34.0507691, "lon": 18.4529715},
    {"id": "J109", "lat": -34.04923,   "lon": 18.4638388},
    {"id": "J110", "lat": -34.0462875, "lon": 18.44976},
    {"id": "J111", "lat": -34.0470253, "lon": 18.4604906},
    {"id": "J112", "lat": -34.050338,  "lon": 18.4646285},
    {"id": "J113", "lat": -34.04359,   "lon": 18.4621378},
    {"id": "J114", "lat": -34.0392425, "lon": 18.4629896},
    {"id": "J115", "lat": -34.0391111, "lon": 18.4619034},
    {"id": "J116", "lat": -34.0386453, "lon": 18.4636554},
    {"id": "J117", "lat": -34.0385374, "lon": 18.4625886},
    {"id": "J118", "lat": -34.0493688, "lon": 18.4526142},
    {"id": "J119", "lat": -34.0550308, "lon": 18.4588576},
    {"id": "J120", "lat": -34.0540064, "lon": 18.4551122},
    {"id": "J121", "lat": -34.0439578, "lon": 18.4476814},
    {"id": "J122", "lat": -34.0428018, "lon": 18.4489478},
    {"id": "J123", "lat": -34.0468225, "lon": 18.4590753},
    {"id": "J124", "lat": -34.0456919, "lon": 18.4595419},
    {"id": "J125", "lat": -34.0510601, "lon": 18.4622123},
    {"id": "J126", "lat": -34.0510313, "lon": 18.4623623},
    {"id": "J127", "lat": -34.0474927, "lon": 18.4643195},
    {"id": "J128", "lat": -34.0481588, "lon": 18.4641681},
]


# ── Geometry helpers (identical to network_builder.py) ─────────────────────────

def haversine_m(lon1, lat1, lon2, lat2):
    R = 6_371_000
    f1, f2 = math.radians(lat1), math.radians(lat2)
    df = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(df/2)**2 + math.cos(f1)*math.cos(f2)*math.sin(dl/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def coord_key(lon, lat):
    return (round(lon, COORD_ROUND), round(lat, COORD_ROUND))

def node_id(lon, lat):
    return f"n_{round(lon,6)}_{round(lat,6)}"

def edge_id(seg_idx, direction):
    return f"e{seg_idx}_{direction}"


# ── Load OSM ───────────────────────────────────────────────────────────────────

def load_osm_ways(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    ways = []
    for feat in data["features"]:
        if feat["geometry"]["type"] != "LineString":
            continue
        p  = feat.get("properties") or {}
        hw = p.get("highway", "")
        if hw not in DRIVABLE:
            continue
        coords = [tuple(c) for c in feat["geometry"]["coordinates"]]
        if len(coords) < 2:
            continue
        try:
            speed_kmh = float(str(p.get("maxspeed","")).replace("km/h","").strip())
        except (ValueError, TypeError):
            speed_kmh = SPEED_DEFAULTS.get(hw, 30)
        lanes  = max(1, int(p.get("lanes", 1) or 1))
        oneway = p.get("oneway","no") in ("yes","true","1","-1")
        ways.append({
            "id": feat.get("id",""), "highway": hw,
            "name": p.get("name",""), "speed_kmh": speed_kmh,
            "lanes": lanes, "oneway": oneway, "coords": coords,
        })
    return ways


def find_intersection_coords(ways):
    coord_ways = defaultdict(set)
    for i, way in enumerate(ways):
        for c in way["coords"]:
            coord_ways[coord_key(*c)].add(i)
    node_keys = set()
    for i, way in enumerate(ways):
        node_keys.add(coord_key(*way["coords"][0]))
        node_keys.add(coord_key(*way["coords"][-1]))
    for key, idxs in coord_ways.items():
        if len(idxs) >= 2:
            node_keys.add(key)
    return node_keys


def split_ways(ways, node_keys):
    segments = []
    for way in ways:
        coords  = way["coords"]
        current = [coords[0]]
        for c in coords[1:]:
            current.append(c)
            if coord_key(*c) in node_keys and len(current) >= 2:
                segments.append({**way, "coords": list(current)})
                current = [c]
        if len(current) >= 2:
            segments.append({**way, "coords": list(current)})
    return segments


def load_overlay(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    nodes, edges = {}, []
    for feat in data["features"]:
        p    = feat.get("properties") or {}
        geom = feat["geometry"]
        if geom["type"] == "Point" and p.get("id","").startswith("N"):
            lon, lat = geom["coordinates"]
            nodes[p["id"]] = {"id": p["id"], "lon": lon, "lat": lat,
                               "speed_kmh": None, "capacity": None}
        elif geom["type"] == "LineString" and p.get("id","").startswith("E"):
            edges.append({
                "id": p["id"], "from": p.get("from"), "to": p.get("to"),
                "speed_kmh": p.get("speed_kmh", 30),
                "capacity_veh_hr": p.get("capacity_veh_hr", 500),
                "lanes": p.get("lanes", 1),
            })
    return nodes, edges


# ── Write SUMO XML ─────────────────────────────────────────────────────────────

def _pretty(root):
    raw = ET.tostring(root, encoding="unicode")
    return minidom.parseString(raw).toprettyxml(indent="  ")


def write_nodes(node_keys, overlay_snap, out_path):
    """Write bergvliet.nod.xml from intersection nodes + overlay junctions + School-Gate."""
    root = ET.Element("nodes")

    written = set()
    for key in node_keys:
        lon, lat = key
        nid = node_id(lon, lat)
        if nid in written:
            continue
        written.add(nid)
        n = ET.SubElement(root, "node")
        n.set("id",   nid)
        n.set("x",    str(lon))
        n.set("y",    str(lat))
        n.set("type", "priority")

    # Overlay junctions that created synthetic nodes
    for nid, info in overlay_snap.items():
        if nid == SCHOOL_GATE_ID:
            continue
        osm_nid = node_id(info["lon"], info["lat"])
        if osm_nid not in written:
            n = ET.SubElement(root, "node")
            n.set("id",   osm_nid)
            n.set("x",    str(info["lon"]))
            n.set("y",    str(info["lat"]))
            n.set("type", "priority")
            written.add(osm_nid)

    # School-Gate
    sg = ET.SubElement(root, "node")
    sg.set("id",   SCHOOL_GATE_ID)
    sg.set("x",    str(SCHOOL_GATE_LON))
    sg.set("y",    str(SCHOOL_GATE_LAT))
    sg.set("type", "priority")

    out_path.write_text(_pretty(root), encoding="utf-8")
    print(f"[sumo_network_builder] nod.xml: {len(written)+1} nodes -> {out_path.name}")


def write_edges(segments, node_keys, overlay_snap, overlay_edges, out_path):
    """Write bergvliet.edg.xml. Returns set of written edge IDs."""
    root = ET.Element("edges")

    # Overlay edge lookup for capacity patching: (from_key, to_key) → edge props
    overlay_patch = {}
    for oe in overlay_edges:
        nf = overlay_snap.get(oe["from"])
        nt = overlay_snap.get(oe["to"])
        if nf and nt:
            fkey = coord_key(nf["lon"], nf["lat"])
            tkey = coord_key(nt["lon"], nt["lat"])
            overlay_patch[(fkey, tkey)] = oe

    written = set()
    for i, seg in enumerate(segments):
        fkey = coord_key(*seg["coords"][0])
        tkey = coord_key(*seg["coords"][-1])
        if fkey == tkey:
            continue

        fn = node_id(*fkey)
        tn = node_id(*tkey)

        # Build shape string (intermediate coords only; SUMO infers from/to from node positions)
        shape_coords = seg["coords"][1:-1]
        shape = " ".join(f"{c[0]},{c[1]}" for c in shape_coords)

        speed_ms = seg["speed_kmh"] / 3.6
        lanes    = seg["lanes"]

        # Patch from overlay if this segment's endpoints match an overlay edge
        patch = overlay_patch.get((fkey, tkey))
        if patch:
            speed_ms = patch["speed_kmh"] / 3.6
            lanes    = patch["lanes"]

        hw = seg["highway"]

        # Forward edge
        eid_fwd = edge_id(i, "fwd")
        if eid_fwd not in written:
            e = ET.SubElement(root, "edge")
            e.set("id",       eid_fwd)
            e.set("from",     fn)
            e.set("to",       tn)
            e.set("numLanes", str(lanes))
            e.set("speed",    f"{speed_ms:.4f}")
            e.set("name",     seg["name"] or hw)
            if shape:
                e.set("shape", shape)
            written.add(eid_fwd)

        # Reverse edge (unless one-way)
        if not seg["oneway"]:
            eid_rev = edge_id(i, "rev")
            if eid_rev not in written:
                e = ET.SubElement(root, "edge")
                e.set("id",       eid_rev)
                e.set("from",     tn)
                e.set("to",       fn)
                e.set("numLanes", str(lanes))
                e.set("speed",    f"{speed_ms:.4f}")
                e.set("name",     seg["name"] or hw)
                if shape:
                    rev_shape = " ".join(f"{c[0]},{c[1]}" for c in reversed(shape_coords))
                    if rev_shape:
                        e.set("shape", rev_shape)
                written.add(eid_rev)

    # School internal edges: N7 <-> School-Gate
    n7_info = overlay_snap.get("N7")
    if n7_info:
        n7_nid = node_id(n7_info["lon"], n7_info["lat"])
        speed_5kmh = 5 / 3.6

        e_in = ET.SubElement(root, "edge")
        e_in.set("id",       "school_internal_in")
        e_in.set("from",     n7_nid)
        e_in.set("to",       SCHOOL_GATE_ID)
        e_in.set("numLanes", "2")
        e_in.set("speed",    f"{speed_5kmh:.4f}")
        e_in.set("name",     "School Internal")

        e_out = ET.SubElement(root, "edge")
        e_out.set("id",       "school_internal_out")
        e_out.set("from",     SCHOOL_GATE_ID)
        e_out.set("to",       n7_nid)
        e_out.set("numLanes", "2")
        e_out.set("speed",    f"{speed_5kmh:.4f}")
        e_out.set("name",     "School Internal")
        written.update({"school_internal_in", "school_internal_out"})
    else:
        print("[sumo_network_builder] WARNING: N7 not found — school internal edges skipped")

    out_path.write_text(_pretty(root), encoding="utf-8")
    print(f"[sumo_network_builder] edg.xml: {len(written)} edges -> {out_path.name}")
    return written


# ── Run netconvert (OSM import + supplementary school gate) ───────────────────

def run_netconvert(osm_path, extra_nod_paths, extra_edg_path, net_path):
    """
    Import from OSM (proper UTM metric projection) and inject the school gate
    node + internal edges via supplementary plain XML files.
    extra_nod_paths may be a single Path or a list of Paths (comma-joined).
    """
    if isinstance(extra_nod_paths, (str, Path)):
        extra_nod_paths = [extra_nod_paths]
    node_files_str = ",".join(str(p) for p in extra_nod_paths)

    cmd = [
        str(NETCONVERT),
        "--osm-files",         str(osm_path),
        "--node-files",        node_files_str,   # school gate + junction controls
        "--edge-files",        str(extra_edg_path),   # school internal edges
        "--output-file",       str(net_path),
        "--osm.sidewalks",     "false",
        "--osm.crossings",     "false",
        "--geometry.remove",
        "--roundabouts.guess", "true",
        "--junctions.join",    "true",
        "--no-warnings",       "true",
    ]
    print(f"[sumo_network_builder] Running netconvert (OSM import)...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr[-2000:])
        raise RuntimeError(f"netconvert failed (exit {result.returncode})")
    print(f"[sumo_network_builder] net.xml written -> {net_path.name}")


def write_school_gate_xml(overlay_nodes, extra_nod_path, extra_edg_path):
    """
    Write supplementary nod.xml (School-Gate only) and edg.xml (school internal
    edges connecting nearest OSM node at N7 to School-Gate).
    """
    n7 = overlay_nodes.get("N7", {"lon": SCHOOL_GATE_LON, "lat": SCHOOL_GATE_LAT})
    # N7 node ID as it appears in the OSM-imported network (OSM numeric ID)
    # We connect via lon/lat — netconvert will snap to the nearest existing junction.
    # Use a synthetic node ID that netconvert will merge with the OSM junction.
    n7_lon, n7_lat = n7["lon"], n7["lat"]

    # Extra node: just School-Gate
    nod_root = ET.Element("nodes")
    sg = ET.SubElement(nod_root, "node")
    sg.set("id",   SCHOOL_GATE_ID)
    sg.set("x",    str(SCHOOL_GATE_LON))
    sg.set("y",    str(SCHOOL_GATE_LAT))
    sg.set("type", "priority")
    sg.set("lon",  str(SCHOOL_GATE_LON))
    sg.set("lat",  str(SCHOOL_GATE_LAT))

    raw = ET.tostring(nod_root, encoding="unicode")
    extra_nod_path.write_text(
        minidom.parseString(raw).toprettyxml(indent="  "), encoding="utf-8"
    )

    # Extra edges: school_internal_in / out connecting N7 OSM junction to School-Gate
    # Use OSM node ID format for the N7 side — netconvert resolves by coordinate proximity
    speed_5kmh = 5 / 3.6
    edg_root = ET.Element("edges")

    # We reference School-Gate by its node id; for N7 we use a coord-based synthetic id
    # that netconvert will resolve to the nearest OSM junction during import.
    n7_nid = f"n7_synthetic"

    # Add N7 as an extra node too so netconvert can find it
    n7_node = ET.SubElement(nod_root, "node")
    n7_node.set("id",   n7_nid)
    n7_node.set("x",    str(n7_lon))
    n7_node.set("y",    str(n7_lat))
    n7_node.set("type", "priority")

    raw = ET.tostring(nod_root, encoding="unicode")
    extra_nod_path.write_text(
        minidom.parseString(raw).toprettyxml(indent="  "), encoding="utf-8"
    )

    for eid, frm, to in [
        ("school_internal_in",  n7_nid, SCHOOL_GATE_ID),
        ("school_internal_out", SCHOOL_GATE_ID, n7_nid),
    ]:
        e = ET.SubElement(edg_root, "edge")
        e.set("id",       eid)
        e.set("from",     frm)
        e.set("to",       to)
        e.set("numLanes", "2")
        e.set("speed",    f"{speed_5kmh:.4f}")
        e.set("name",     "School Internal")

    raw = ET.tostring(edg_root, encoding="unicode")
    extra_edg_path.write_text(
        minidom.parseString(raw).toprettyxml(indent="  "), encoding="utf-8"
    )
    print(f"[sumo_network_builder] School gate XML written")


# ── Main entry point ───────────────────────────────────────────────────────────

def _lonlat_to_sumo_xy(lon, lat, net_offset):
    """UTM zone 34 → SUMO internal XY (no pyproj needed)."""
    a   = 6_378_137.0
    f   = 1.0 / 298.257223563
    b   = a * (1 - f)
    e2  = 1 - (b / a) ** 2
    ep2 = e2 / (1 - e2)
    k0  = 0.9996
    lon0 = math.radians(21.0)
    lr, lr2 = math.radians(lat), math.radians(lon)
    dl = lr2 - lon0
    N = a / math.sqrt(1 - e2 * math.sin(lr) ** 2)
    T = math.tan(lr) ** 2
    C = ep2 * math.cos(lr) ** 2
    A = dl * math.cos(lr)
    M = a * (
        (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * lr
        - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * math.sin(2*lr)
        + (15*e2**2/256 + 45*e2**3/1024) * math.sin(4*lr)
        - (35*e2**3/3072) * math.sin(6*lr)
    )
    x = (k0 * N * (A + (1-T+C)*A**3/6 + (5-18*T+T**2+72*C-58*ep2)*A**5/120)
         + 500000.0 + net_offset[0])
    y = (k0 * (M + N*math.tan(lr) * (A**2/2 + (5-T+9*C+4*C**2)*A**4/24
               + (61-58*T+T**2+600*C-330*ep2)*A**6/720))
         + net_offset[1])
    return x, y


def _find_nearest_junction(net, lon, lat):
    """Return the junction ID nearest to (lon, lat)."""
    offset = net.getLocationOffset()
    x, y = _lonlat_to_sumo_xy(lon, lat, offset)
    nodes = list(net.getNodes())
    return min(nodes, key=lambda n: (n.getCoord()[0]-x)**2 + (n.getCoord()[1]-y)**2).getID()


def _write_junction_controls_xml(junction_infos, path):
    """
    Write junction-controls.nod.xml with SUMO type overrides for key junctions.
    junction_infos: {osm_junction_id: {"type": str, "x": float, "y": float}}
    x/y must be included — netconvert requires positions for cluster nodes.
    """
    root = ET.Element("nodes")
    for jid, info in junction_infos.items():
        n = ET.SubElement(root, "node")
        n.set("id",   jid)
        n.set("x",    f"{info['x']:.4f}")
        n.set("y",    f"{info['y']:.4f}")
        n.set("type", info["type"])
    path.write_text(
        minidom.parseString(ET.tostring(root, encoding="unicode")).toprettyxml(indent="  "),
        encoding="utf-8",
    )
    print(f"[sumo_network_builder] Junction controls: {len(junction_infos)} overrides -> {path.name}")


def _write_speed_humps_xml(speed_humps, net, path):
    """
    Write speed-humps.add.xml: variableSpeedSign at 15 km/h on the edge nearest
    to each speed hump. Restriction zone is capped at 20 m (short section).
    """
    HUMP_SPEED_MS = 15.0 / 3.6   # 4.1667 m/s
    HUMP_ZONE_M   = 20.0

    offset = net.getLocationOffset()
    root   = ET.Element("additional")
    seen   = set()

    for sh in speed_humps:
        x, y = _lonlat_to_sumo_xy(sh["lon"], sh["lat"], offset)
        neighbors = net.getNeighboringEdges(x, y, r=40)
        if not neighbors:
            neighbors = net.getNeighboringEdges(x, y, r=80)
        if not neighbors:
            print(f"[sumo_network_builder]   {sh['id']}: no edge found, skipped")
            continue

        edge = sorted(neighbors, key=lambda e: e[1])[0][0]
        eid  = edge.getID()
        if eid.startswith(":") or eid in seen:
            continue
        seen.add(eid)

        edge_len  = edge.getLength()
        end_pos   = min(edge_len - 0.1, HUMP_ZONE_M)
        if end_pos <= 0.5:
            continue

        num_lanes = edge.getLaneNumber()
        lanes_str = " ".join(f"{eid}_{i}" for i in range(num_lanes))

        vss = ET.SubElement(root, "variableSpeedSign")
        vss.set("id",       f"vss_{sh['id']}")
        vss.set("lanes",    lanes_str)
        vss.set("startPos", "0.00")
        vss.set("endPos",   f"{end_pos:.2f}")
        step = ET.SubElement(vss, "step")
        step.set("time",  "0")
        step.set("speed", f"{HUMP_SPEED_MS:.4f}")

    path.write_text(
        minidom.parseString(ET.tostring(root, encoding="unicode")).toprettyxml(indent="  "),
        encoding="utf-8",
    )
    print(f"[sumo_network_builder] Speed humps: {len(seen)} edges restricted -> {path.name}")


def _write_school_gate_xml_for_junction(entrance_jid, exit_jid,
                                         extra_nod_path, extra_edg_path):
    """
    Write supplementary XML for a one-way school internal loop.

    No synthetic corner node — netconvert drops lon/lat supplementary nodes silently
    when using --osm-files.  Instead the corner geometry is baked into the edge
    'shape' attribute using SUMO internal UTM XY coords computed from net_offset.

    school_internal_in  : entrance -> exit  curved via corner  (inbound)
    school_internal_out : exit -> entrance  curved via corner  (outbound)
    Single lane, 5 km/h, models internal school car-park road.
    """
    speed_5kmh = 5 / 3.6
    # Shape is in lon,lat (geographic) — netconvert projects it during --osm-files import.
    corner_shape = f"{SCHOOL_CORNER_LON},{SCHOOL_CORNER_LAT}"

    # Empty node file — no extra nodes needed
    nod_root = ET.Element("nodes")
    extra_nod_path.write_text(
        minidom.parseString(ET.tostring(nod_root, encoding="unicode")).toprettyxml(indent="  "),
        encoding="utf-8",
    )

    # One-way only: entrance -> exit.  No return edge — vehicles exit onto public roads.
    edg_root = ET.Element("edges")
    e_in = ET.SubElement(edg_root, "edge")
    e_in.set("id",       "school_internal_in")
    e_in.set("from",     entrance_jid)
    e_in.set("to",       exit_jid)
    e_in.set("numLanes", "1")
    e_in.set("speed",    f"{speed_5kmh:.4f}")
    e_in.set("name",     "School Internal Road")
    e_in.set("shape",    corner_shape)

    extra_edg_path.write_text(
        minidom.parseString(ET.tostring(edg_root, encoding="unicode")).toprettyxml(indent="  "),
        encoding="utf-8",
    )
    print(f"[sumo_network_builder] School loop: '{entrance_jid}' <-> corner({SCHOOL_CORNER_LON},{SCHOOL_CORNER_LAT}) <-> '{exit_jid}'")


def build_sumo_network():
    """
    Build SUMO network from OSM file (proper UTM metric projection).

    Two-pass strategy:
      Pass 1 — import OSM only, find real junction ID nearest to N7.
      Pass 2 — reimport with school-gate node + edges referencing that junction.

    Returns
    -------
    net_path       : Path to bergvliet.net.xml
    overlay_snap   : dict  N-id → {id, lon, lat}  (for demand injection)
    """
    SUMO_DIR.mkdir(parents=True, exist_ok=True)

    osm_path = REPO_ROOT / "osm" / "bergvliet.osm"
    if not osm_path.exists():
        raise FileNotFoundError(
            f"OSM file not found: {osm_path}\n"
            "Run: node osm/geojson2osm.js osm/osm-roads.geojson osm/osm-signs.geojson -o osm/bergvliet.osm"
        )

    overlay_nodes, _ = load_overlay(NETWORK_PATH)

    extra_nod_path = SUMO_DIR / "school-gate.nod.xml"
    extra_edg_path = SUMO_DIR / "school-gate.edg.xml"
    jct_nod_path   = SUMO_DIR / "junction-controls.nod.xml"
    humps_path     = SUMO_DIR / "speed-humps.add.xml"
    net_path       = SUMO_DIR / "bergvliet.net.xml"
    tmp_net_path   = SUMO_DIR / "bergvliet-pass1.net.xml"

    # ── Pass 1: OSM-only to discover real junctions ───────────────────────────
    print("[sumo_network_builder] Pass 1: OSM-only import...")
    cmd1 = [
        str(NETCONVERT),
        "--osm-files",         str(osm_path),
        "--output-file",       str(tmp_net_path),
        "--osm.sidewalks",     "false",
        "--osm.crossings",     "false",
        "--geometry.remove",
        "--roundabouts.guess", "true",
        "--junctions.join",    "true",
        "--no-warnings",       "true",
    ]
    result = subprocess.run(cmd1, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr[-2000:])
        raise RuntimeError("netconvert pass 1 failed")

    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        import sumolib
        tmp_net = sumolib.net.readNet(str(tmp_net_path), withInternal=False)

    n7_info = overlay_nodes.get("N7", {"lon": SCHOOL_CORNER_LON, "lat": SCHOOL_CORNER_LAT})
    entrance_jid = _find_nearest_junction(tmp_net, n7_info["lon"], n7_info["lat"])
    exit_jid     = _find_nearest_junction(tmp_net, SCHOOL_EXIT_LON, SCHOOL_EXIT_LAT)
    print(f"[sumo_network_builder] School entrance junction: '{entrance_jid}'")
    print(f"[sumo_network_builder] School exit junction:     '{exit_jid}'")

    # Junction control overrides — find nearest OSM junction for each.
    # Use convertXY2LonLat so x/y in the node file are geographic (required by --osm-files).
    print("[sumo_network_builder] Mapping junction controls...")
    junction_infos = {}
    for jc in JUNCTION_CONTROLS:
        jid  = _find_nearest_junction(tmp_net, jc["lon"], jc["lat"])
        node = tmp_net.getNode(jid)
        cx, cy = node.getCoord()
        lon, lat = tmp_net.convertXY2LonLat(cx, cy)
        junction_infos[jid] = {"type": jc["sumo_type"], "x": lon, "y": lat}
        print(f"[sumo_network_builder]   {jc['id']} -> '{jid}' ({jc['sumo_type']})")
    _write_junction_controls_xml(junction_infos, jct_nod_path)

    tmp_net_path.unlink(missing_ok=True)

    # ── Pass 2: Rebuild with school loop + junction type overrides ────────────
    print("[sumo_network_builder] Pass 2: rebuild with school internal road + junction controls...")
    _write_school_gate_xml_for_junction(entrance_jid, exit_jid,
                                        extra_nod_path, extra_edg_path)
    run_netconvert(osm_path, [extra_nod_path, jct_nod_path], extra_edg_path, net_path)

    # ── Speed humps: write additional file from final network ─────────────────
    print("[sumo_network_builder] Writing speed humps additional file...")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        final_net = sumolib.net.readNet(str(net_path), withInternal=False)
    _write_speed_humps_xml(SPEED_HUMPS, final_net, humps_path)

    overlay_snap = {
        nid: {"id": nid, "lon": info["lon"], "lat": info["lat"]}
        for nid, info in overlay_nodes.items()
    }

    for nid, info in overlay_snap.items():
        print(f"[sumo_network_builder]   {nid}: ({info['lon']:.4f}, {info['lat']:.4f})")

    return net_path, overlay_snap, humps_path


if __name__ == "__main__":
    net_path, overlay_snap = build_sumo_network()
    print(f"\nSUMO network ready: {net_path}")
