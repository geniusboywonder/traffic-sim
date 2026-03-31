"""
sumo_runner.py — Run L / M / H scenarios in SUMO and write canonical JSON output.

Usage:
    cd sim
    python sumo_runner.py              # all three scenarios
    python sumo_runner.py --scenario M # one scenario

SUMO outputs captured per scenario (written to sim/sumo/):
    fcd-{L,M,H}.xml        Floating Car Data — per-vehicle position/speed per timestep
    tripinfo-{L,M,H}.xml   Per-vehicle journey stats — waitingTime, timeLoss

These are then converted to public/sim-results/scenario-{L,M,H}.json
by converters/sumo_to_json.py.

Demand mirrors uxsim_runner.py exactly:
    L=420 / M=650 / H=840 total trips
    1A 24%  2A 20%  2B 35%  3A 21%
    Trapezoidal arrival profile, inbound + outbound with 45s dwell offset
"""

import argparse
import math
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from xml.dom import minidom

REPO_ROOT  = Path(__file__).parent.parent
SUMO_DIR   = Path(__file__).parent / "sumo"
OUTPUT_DIR = REPO_ROOT / "public" / "sim-results"
SUMO_BIN   = Path("C:/Program Files (x86)/Eclipse/Sumo/bin/sumo.exe")
SUMO_TOOLS = Path("C:/Users/neill/AppData/Roaming/Python/Python314/site-packages/sumo/tools")

if str(SUMO_TOOLS) not in sys.path:
    sys.path.insert(0, str(SUMO_TOOLS))

from sumo_network_builder import build_sumo_network, node_id
from converters.sumo_to_json import convert

SIM_START = 23400   # 06:30 seconds since midnight
SIM_END   = 30600   # 08:30
TIMESTEP  = 60      # output frame interval

SCENARIO_DEMAND = {"L": 420, "M": 650, "H": 840}

CORRIDORS = [
    {"node_id": "N1", "share": 0.24, "label": "1A"},
    {"node_id": "N4", "share": 0.20, "label": "2A"},
    {"node_id": "N3", "share": 0.35, "label": "2B"},
    {"node_id": "N2", "share": 0.21, "label": "3A"},
]

ARRIVAL_PROFILE = [
    (23400, 26100, 0.15),
    (26100, 27900, 0.30),
    (27900, 28800, 0.35),
    (28800, 29700, 0.15),
    (29700, 30600, 0.05),
]

DWELL_OFFSET_S = 45
SCHOOL_GATE_ID = "School-Gate"


def _pretty(root):
    raw = ET.tostring(root, encoding="unicode")
    return minidom.parseString(raw).toprettyxml(indent="  ")


def lonlat_to_sumo_xy(lon, lat, net_offset):
    """
    Convert lon/lat to SUMO internal XY without pyproj.
    Uses standard UTM zone 34 formulas (WGS84 ellipsoid, central meridian 21°E).
    SUMO's proj string has no +south flag, so southern latitudes produce negative y_utm.
    net_offset is [dx, dy] from net.getLocationOffset().
    """
    a   = 6378137.0
    f   = 1.0 / 298.257223563
    b   = a * (1 - f)
    e2  = 1 - (b / a) ** 2
    ep2 = e2 / (1 - e2)
    k0  = 0.9996
    lon0 = math.radians(21.0)  # zone 34 central meridian

    lat_r = math.radians(lat)
    lon_r = math.radians(lon)
    dlon  = lon_r - lon0

    N = a / math.sqrt(1 - e2 * math.sin(lat_r) ** 2)
    T = math.tan(lat_r) ** 2
    C = ep2 * math.cos(lat_r) ** 2
    A = dlon * math.cos(lat_r)

    M = a * (
        (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * lat_r
        - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * math.sin(2*lat_r)
        + (15*e2**2/256 + 45*e2**3/1024) * math.sin(4*lat_r)
        - (35*e2**3/3072) * math.sin(6*lat_r)
    )

    x_utm = (k0 * N * (A + (1 - T + C) * A**3/6
             + (5 - 18*T + T**2 + 72*C - 58*ep2) * A**5/120)
             + 500000.0)
    y_utm = k0 * (M + N * math.tan(lat_r) * (
        A**2/2
        + (5 - T + 9*C + 4*C**2) * A**4/24
        + (61 - 58*T + T**2 + 600*C - 330*ep2) * A**6/720
    ))

    return x_utm + net_offset[0], y_utm + net_offset[1]


def write_demand(scenario, total_trips, overlay_snap, net_path, out_path):
    """
    Write a SUMO routes file (.rou.xml) with <flow> elements for each
    corridor × time bucket (inbound + outbound).

    Uses closest edges to overlay node coordinates.
    """
    import sumolib
    net = sumolib.net.readNet(str(net_path), withInternal=False)

    net_offset = net.getLocationOffset()  # [dx, dy] from UTM to SUMO internal

    def nearest_edge(nid):
        info = overlay_snap[nid]
        x, y = lonlat_to_sumo_xy(info["lon"], info["lat"], net_offset)
        edges = net.getNeighboringEdges(x, y, r=50)
        if not edges:
            raise RuntimeError(f"No edge near {nid} ({info['lon']},{info['lat']}) → SUMO ({x:.1f},{y:.1f})")
        return sorted(edges, key=lambda e: e[1])[0][0].getID()

    corridor_edges = {c["node_id"]: nearest_edge(c["node_id"]) for c in CORRIDORS}

    root = ET.Element("routes")

    # Vehicle type: car with max speed and typical school-run accel/decel
    vtype = ET.SubElement(root, "vType")
    vtype.set("id",         "car")
    vtype.set("accel",      "2.6")
    vtype.set("decel",      "4.5")
    vtype.set("sigma",      "0.5")    # driver imperfection
    vtype.set("length",     "5.0")
    vtype.set("maxSpeed",   "16.7")   # 60 km/h
    vtype.set("minGap",     "2.5")

    # Collect all flows, then sort by begin time — SUMO requires departure-time order.
    flows = []
    flow_id = 0
    for corridor in CORRIDORS:
        nid           = corridor["node_id"]
        share         = corridor["share"]
        corridor_edge = corridor_edges[nid]
        trips         = total_trips * share

        for t_start, t_end, time_share in ARRIVAL_PROFILE:
            bucket_trips = trips * time_share
            duration     = t_end - t_start
            veh_per_hour = bucket_trips / duration * 3600

            # Inbound flow: corridor → school parking (vehicles stop 45s then exit).
            # to=corridor_edge so SUMO routes them back after dwell automatically.
            flows.append({
                "id": f"flow_{flow_id}_in", "type": "car",
                "from": corridor_edge, "to": corridor_edge,
                "begin": t_start, "end": t_end,
                "vehsPerHour": veh_per_hour,
            })
            flow_id += 1

    for fd in sorted(flows, key=lambda x: x["begin"]):
        f = ET.SubElement(root, "flow")
        f.set("id",          fd["id"])
        f.set("type",        fd["type"])
        f.set("from",        fd["from"])
        f.set("to",          fd["to"])
        f.set("begin",       str(fd["begin"]))
        f.set("end",         str(fd["end"]))
        f.set("vehsPerHour", f"{fd['vehsPerHour']:.2f}")
        f.set("departSpeed", "max")
        # Inbound vehicles stop ON school_internal_in for 45s (drop-off dwell).
        # Stopping on the single lane forces queuing behind each waiting vehicle
        # → natural backpressure onto Leyden/Ruskin Rd when demand is high.
        if fd["id"].endswith("_in"):
            stop = ET.SubElement(f, "stop")
            stop.set("lane",      "school_internal_in_0")
            stop.set("startPos",  "10")
            stop.set("endPos",    "50")
            stop.set("duration",  str(DWELL_OFFSET_S))

    out_path.write_text(_pretty(root), encoding="utf-8")
    print(f"[sumo_runner] Demand written: {total_trips} trips -> {out_path.name}")


PARKING_CAPACITY = 98   # on-site bays along school_internal_in
PARKING_AREA_ID  = "school_parking"


def write_parking_additional(add_path):
    """
    Write school-parking.add.xml: a <parkingArea> on school_internal_in with 98 bays.
    When full, inbound vehicles queue on school_internal_in → backpressure onto Ruskin Rd.
    """
    root = ET.Element("additional")
    pa = ET.SubElement(root, "parkingArea")
    pa.set("id",               PARKING_AREA_ID)
    pa.set("lane",             "school_internal_in_0")
    pa.set("startPos",         "10")
    pa.set("endPos",           "320")
    pa.set("roadsideCapacity", str(PARKING_CAPACITY))
    pa.set("angle",            "45")
    add_path.write_text(_pretty(root), encoding="utf-8")
    print(f"[sumo_runner] Parking area written: {PARKING_CAPACITY} bays -> {add_path.name}")


def write_config(scenario, net_path, rou_path, fcd_path, tripinfo_path, cfg_path, add_paths=None):
    root = ET.Element("configuration")

    inp = ET.SubElement(root, "input")
    ET.SubElement(inp, "net-file").set("value", str(net_path))
    ET.SubElement(inp, "route-files").set("value", str(rou_path))
    if add_paths:
        paths = add_paths if isinstance(add_paths, list) else [add_paths]
        ET.SubElement(inp, "additional-files").set("value", ",".join(str(p) for p in paths))

    out = ET.SubElement(root, "output")
    ET.SubElement(out, "fcd-output").set("value", str(fcd_path))
    ET.SubElement(out, "device.fcd.period").set("value", str(TIMESTEP))
    ET.SubElement(out, "tripinfo-output").set("value", str(tripinfo_path))

    time = ET.SubElement(root, "time")
    ET.SubElement(time, "begin").set("value", str(SIM_START))
    ET.SubElement(time, "end").set("value",   str(SIM_END))
    ET.SubElement(time, "step-length").set("value", "1")

    proc = ET.SubElement(root, "processing")
    ET.SubElement(proc, "ignore-route-errors").set("value", "true")
    ET.SubElement(proc, "routing-algorithm").set("value", "astar")
    # Dynamic rerouting: vehicles re-evaluate routes every 60 s to model rat-runs.
    ET.SubElement(proc, "device.rerouting.probability").set("value", "1.0")
    ET.SubElement(proc, "device.rerouting.period").set("value", "60")
    ET.SubElement(proc, "device.rerouting.pre-period").set("value", "0")

    rpt = ET.SubElement(root, "report")
    ET.SubElement(rpt, "no-warnings").set("value", "true")
    ET.SubElement(rpt, "no-step-log").set("value", "true")

    cfg_path.write_text(_pretty(root), encoding="utf-8")


def run_sumo(cfg_path):
    cmd = [str(SUMO_BIN), "-c", str(cfg_path)]
    print(f"[sumo_runner] Running SUMO...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr[-3000:])
        raise RuntimeError(f"SUMO failed (exit {result.returncode})")
    print(f"[sumo_runner] SUMO complete.")


def run_scenario(scenario, net_path, overlay_snap, humps_path=None):
    total_trips = SCENARIO_DEMAND[scenario]
    print(f"\n{'='*60}")
    print(f"Running SUMO scenario {scenario} ({total_trips} trips)")
    print(f"{'='*60}")

    rou_path      = SUMO_DIR / f"demand-{scenario}.rou.xml"
    fcd_path      = SUMO_DIR / f"fcd-{scenario}.xml"
    tripinfo_path = SUMO_DIR / f"tripinfo-{scenario}.xml"
    cfg_path      = SUMO_DIR / f"bergvliet-{scenario}.sumocfg"
    add_paths = []
    if humps_path and humps_path.exists():
        add_paths.append(humps_path)

    write_demand(scenario, total_trips, overlay_snap, net_path, rou_path)
    write_config(scenario, net_path, rou_path, fcd_path, tripinfo_path, cfg_path,
                 add_paths if add_paths else None)
    run_sumo(cfg_path)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"scenario-{scenario}.json"
    sim_output = convert(fcd_path, tripinfo_path, scenario=scenario,
                         start_time=SIM_START, end_time=SIM_END, timestep=TIMESTEP)
    sim_output.write_json(out_path)

    return out_path


def main():
    parser = argparse.ArgumentParser(description="Run SUMO traffic scenarios")
    parser.add_argument("--scenario", "-s", choices=["L","M","H"], default=None)
    args = parser.parse_args()

    net_path, overlay_snap, humps_path = build_sumo_network()

    scenarios = [args.scenario] if args.scenario else ["L", "M", "H"]
    for s in scenarios:
        out_path = run_scenario(s, net_path, overlay_snap, humps_path)
        print(f"[sumo_runner] Output: {out_path}")

    print("\nAll done.")


if __name__ == "__main__":
    main()
