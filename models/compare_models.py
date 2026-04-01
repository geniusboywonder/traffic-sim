"""
compare_models.py
=================
Compares IDM (live simulation) output against SUMO microscopic simulation
for the same scenario (default: L = 420 trips).

Outputs a plain-text summary report to stdout and saves a CSV comparison
table to models/comparison_report.csv.

Usage:
    python models/compare_models.py
    python models/compare_models.py --scenario M
    python models/compare_models.py --idm-log models/l/traffic-sim-log-2026-04-01T11-26-56.csv \
                                    --idm-roads models/l/traffic-road-stats-2026-04-01T11-30-46.csv \
                                    --sumo-tripinfo sim/sumo/tripinfo-L.xml \
                                    --sumo-json public/sim-results/scenario-L.json
"""

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from collections import defaultdict

import pandas as pd

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
FREE_FLOW_TRIP_S = 420      # rough free-flow round-trip (school route ~3 km @ 40 km/h ≈ 7 min + 45s dwell)
SCHOOL_DWELL_S   = 45       # fixed dwell at school
SIM_START_S      = 23400    # 06:30 in seconds since midnight
BASE_MIN         = 6 * 60 + 30

def sec_to_clock(s):
    total_min = BASE_MIN + int(s) // 60
    h = (total_min // 60) % 24
    m = total_min % 60
    h12 = h % 12 or 12
    ap = "AM" if h < 12 else "PM"
    return f"{h12}:{m:02d} {ap}"

def sim_to_clock(sim_s):
    return sec_to_clock(SIM_START_S + sim_s)

# ---------------------------------------------------------------------------
# IDM log parsing
# ---------------------------------------------------------------------------

def parse_idm(log_path: Path, roads_path: Path):
    log   = pd.read_csv(log_path)
    roads = pd.read_csv(roads_path)

    # ── Per-vehicle trip times ───────────────────────────────────────────────
    spawns  = log[log["event"] == "SPAWN"][["id", "simTime"]].rename(columns={"simTime": "spawn_t"})
    dwells  = log[log["event"] == "DWELL_START"][["id", "simTime"]].rename(columns={"simTime": "dwell_t"})
    ob_st   = log[log["event"] == "OUTBOUND_START"][["id", "simTime"]].rename(columns={"simTime": "depart_t"})

    trips = spawns.merge(dwells, on="id", how="left").merge(ob_st, on="id", how="left")
    trips["inbound_s"]  = trips["dwell_t"]  - trips["spawn_t"]
    trips["outbound_s"] = trips["depart_t"] - trips["dwell_t"] - SCHOOL_DWELL_S

    # Only vehicles that completed the full journey
    completed = trips.dropna(subset=["depart_t"]).copy()
    completed["total_s"] = completed["depart_t"] - completed["spawn_t"]
    completed["delay_s"] = (completed["total_s"] - FREE_FLOW_TRIP_S).clip(lower=0)
    completed["delay_ratio"] = completed["delay_s"] / FREE_FLOW_TRIP_S

    # ── Corridor info ────────────────────────────────────────────────────────
    corridors_raw = log[log["event"] == "SPAWN"][["id", "corridorId"]].set_index("id")

    # ── Road congestion ──────────────────────────────────────────────────────
    ib = roads[roads["direction"] == "inbound"].copy()
    ib["congestion_index"] = ib["slowing"] + 2 * ib["stopped"]  # weighted

    road_peak_congestion = (
        ib.groupby("road")["congestion_index"].max().sort_values(ascending=False)
    )
    road_stopped_max = (
        ib.groupby("road")["stopped"].max().sort_values(ascending=False)
    )
    road_throughput = (
        ib.groupby("road")["total_cumulative"].max().sort_values(ascending=False)
    )

    # ── Peak congestion timing ───────────────────────────────────────────────
    total_congestion_ts = (
        ib.groupby("simTime")["congestion_index"].sum().reset_index()
    )
    peak_idx = total_congestion_ts["congestion_index"].idxmax()
    peak_sim_t = total_congestion_ts.loc[peak_idx, "simTime"]

    # ── School throughput per 15-min ─────────────────────────────────────────
    school_ib = roads[(roads["road"].str.contains("Internal", case=False)) &
                      (roads["direction"] == "inbound")][["simTime", "total_cumulative"]].copy()
    if not school_ib.empty:
        school_ib = school_ib.sort_values("simTime")
        school_ib["15min_bin"] = ((school_ib["simTime"]) // 900).astype(int)
        school_arrivals_15 = (
            school_ib.groupby("15min_bin")["total_cumulative"].last().diff().fillna(0)
        )
    else:
        school_arrivals_15 = pd.Series(dtype=float)

    return {
        "completed_n": len(completed),
        "total_spawned": log["id"].nunique(),
        "completion_rate": len(completed) / log["id"].nunique() if log["id"].nunique() > 0 else 0,
        "trip_mean_s": completed["total_s"].mean(),
        "trip_median_s": completed["total_s"].median(),
        "trip_p85_s": completed["total_s"].quantile(0.85),
        "trip_p95_s": completed["total_s"].quantile(0.95),
        "delay_mean_s": completed["delay_s"].mean(),
        "delay_ratio_mean": completed["delay_ratio"].mean(),
        "inbound_mean_s": completed["inbound_s"].mean(),
        "outbound_mean_s": completed["outbound_s"].mean(),
        "stopped_time_mean_s": completed["delay_s"].mean(),  # proxy
        "peak_congestion_sim_t": peak_sim_t,
        "peak_congestion_clock": sim_to_clock(peak_sim_t),
        "road_congestion_rank": road_peak_congestion.head(8).to_dict(),
        "road_stopped_rank": road_stopped_max.head(8).to_dict(),
        "road_throughput": road_throughput.head(10).to_dict(),
        "school_arrivals_15min": school_arrivals_15.to_dict(),
        "completed_df": completed,
        "corridors_raw": corridors_raw,
    }


# ---------------------------------------------------------------------------
# SUMO parsing
# ---------------------------------------------------------------------------

def parse_sumo(tripinfo_path: Path, json_path: Path):
    tree = ET.parse(tripinfo_path)
    root = tree.getroot()
    trips = root.findall("tripinfo")

    rows = []
    for t in trips:
        rows.append({
            "id":          t.get("id"),
            "duration":    float(t.get("duration", 0)),
            "timeLoss":    float(t.get("timeLoss", 0)),
            "waitingTime": float(t.get("waitingTime", 0)),
            "stopTime":    float(t.get("stopTime", 0)),
            "routeLength": float(t.get("routeLength", 0)),
            "depart":      float(t.get("depart", 0)),
        })
    df = pd.DataFrame(rows)

    # Total trips = vehicles that were created (read from JSON)
    with open(json_path) as f:
        jdata = json.load(f)
    meta = jdata.get("meta", {})
    total_trips = meta.get("total_trips", len(df))

    # Completed = those in tripinfo
    completed = df.copy()
    completed["delay_s"]     = (completed["duration"] - FREE_FLOW_TRIP_S).clip(lower=0)
    completed["delay_ratio"] = completed["delay_s"] / FREE_FLOW_TRIP_S
    completed["stopped_s"]   = completed["waitingTime"]

    # Road congestion from JSON frames
    frames = jdata.get("frames", [])
    road_active_max   = defaultdict(int)
    road_stopped_max  = defaultdict(int)
    road_throughput   = defaultdict(int)
    total_q_by_t      = {}

    for fr in frames:
        t_sim = fr["t"] - SIM_START_S
        total_q = 0
        for rs in fr.get("road_stats", []):
            rid = rs["road_id"]
            q   = rs.get("queued", 0)
            ib  = rs.get("inbound", 0) + q
            road_active_max[rid]  = max(road_active_max[rid], ib)
            road_stopped_max[rid] = max(road_stopped_max[rid], q)
            total_q += q
        total_q_by_t[t_sim] = total_q

    # Road throughput from cumulative inbound counts (last frame)
    if frames:
        last_frame = frames[-1]
        for rs in last_frame.get("road_stats", []):
            road_throughput[rs["road_id"]] = rs.get("inbound", 0) + rs.get("outbound", 0)

    road_active_series  = pd.Series(road_active_max).sort_values(ascending=False)
    road_stopped_series = pd.Series(road_stopped_max).sort_values(ascending=False)
    road_throughput_s   = pd.Series(road_throughput).sort_values(ascending=False)

    # Peak congestion time
    q_series = pd.Series(total_q_by_t).sort_index()
    peak_sim_t = q_series.idxmax() if not q_series.empty else 0

    # School throughput per 15-min from cumulative in/out
    school_ids = [r for r in road_active_max if "school" in r.lower()]
    school_15 = {}
    if school_ids and frames:
        school_id = school_ids[0]
        prev = 0
        for fr in frames:
            t_sim = fr["t"] - SIM_START_S
            bin15 = int(t_sim // 900)
            for rs in fr.get("road_stats", []):
                if rs["road_id"] == school_id:
                    cur = rs.get("inbound", 0)
                    school_15[bin15] = cur - prev
                    prev = cur

    return {
        "completed_n": len(completed),
        "total_spawned": total_trips,
        "completion_rate": len(completed) / total_trips if total_trips > 0 else 0,
        "trip_mean_s": completed["duration"].mean(),
        "trip_median_s": completed["duration"].median(),
        "trip_p85_s": completed["duration"].quantile(0.85),
        "trip_p95_s": completed["duration"].quantile(0.95),
        "delay_mean_s": completed["timeLoss"].mean(),
        "delay_ratio_mean": (completed["timeLoss"] / FREE_FLOW_TRIP_S).mean(),
        "inbound_mean_s": (completed["duration"] - completed["stopTime"]).mean() / 2,
        "stopped_time_mean_s": completed["waitingTime"].mean(),
        "peak_congestion_sim_t": peak_sim_t,
        "peak_congestion_clock": sim_to_clock(peak_sim_t),
        "road_congestion_rank": road_active_series.head(8).to_dict(),
        "road_stopped_rank": road_stopped_series.head(8).to_dict(),
        "road_throughput": road_throughput_s.head(10).to_dict(),
        "school_arrivals_15min": school_15,
        "completed_df": completed,
    }


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def fmt(val, unit="s", decimals=1):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return "—"
    if unit == "s":
        return f"{val:.{decimals}f}s ({val/60:.1f}min)"
    if unit == "%":
        return f"{val*100:.1f}%"
    return f"{val:.{decimals}f}"


def print_report(idm, sumo, scenario):
    sep = "=" * 70
    print(f"\n{sep}")
    print(f"  MODEL COMPARISON — Scenario {scenario}  (IDM live vs SUMO microscopic)")
    print(sep)

    print("\n── 1. TRIP COMPLETION ─────────────────────────────────────────────────")
    rows = [
        ("Trips spawned",    f"{idm['total_spawned']}",          f"{sumo['total_spawned']}"),
        ("Trips completed",  f"{idm['completed_n']}",            f"{sumo['completed_n']}"),
        ("Completion rate",  fmt(idm['completion_rate'], '%'),   fmt(sumo['completion_rate'], '%')),
    ]
    _print_table(rows)

    print("\n── 2. TRIP DURATION ───────────────────────────────────────────────────")
    rows = [
        ("Mean trip time",   fmt(idm['trip_mean_s']),   fmt(sumo['trip_mean_s'])),
        ("Median trip time", fmt(idm['trip_median_s']), fmt(sumo['trip_median_s'])),
        ("P85 trip time",    fmt(idm['trip_p85_s']),    fmt(sumo['trip_p85_s'])),
        ("P95 trip time",    fmt(idm['trip_p95_s']),    fmt(sumo['trip_p95_s'])),
    ]
    _print_table(rows)

    print("\n── 3. DELAY & CONGESTION ──────────────────────────────────────────────")
    rows = [
        ("Mean delay",             fmt(idm['delay_mean_s']),          fmt(sumo['delay_mean_s'])),
        ("Delay ratio (delay/FF)", fmt(idm['delay_ratio_mean'], '%'), fmt(sumo['delay_ratio_mean'], '%')),
        ("Avg stopped/waiting",    fmt(idm['stopped_time_mean_s']),   fmt(sumo['stopped_time_mean_s'])),
        ("Peak congestion at",     idm['peak_congestion_clock'],      sumo['peak_congestion_clock']),
    ]
    _print_table(rows)

    print("\n── 4. TOP CONGESTED ROADS (max simultaneous stopped/queued) ───────────")
    print(f"  {'Road':<32} {'IDM (max stopped)':>20}  {'SUMO (max queued)':>20}")
    print(f"  {'-'*32} {'-'*20}  {'-'*20}")
    idm_roads  = idm['road_stopped_rank']
    sumo_roads = sumo['road_stopped_rank']
    all_roads  = list(dict.fromkeys(list(idm_roads.keys()) + list(sumo_roads.keys())))[:10]
    for r in all_roads:
        iv = f"{idm_roads.get(r, 0):.0f}" if r in idm_roads else "—"
        sv = f"{sumo_roads.get(r, 0):.0f}" if r in sumo_roads else "—"
        # normalise road name for matching
        print(f"  {r:<32} {iv:>20}  {sv:>20}")

    print("\n── 5. ROAD RANK AGREEMENT ─────────────────────────────────────────────")
    idm_top  = [r.lower().replace(" ", "_").replace("'", "") for r in list(idm['road_congestion_rank'].keys())[:5]]
    sumo_top = [r for r in list(sumo['road_congestion_rank'].keys())[:5]]
    idm_top_s  = ", ".join(idm_top[:5])
    sumo_top_s = ", ".join(sumo_top[:5])
    # Count overlap (fuzzy)
    overlap = sum(1 for ir in idm_top for sr in sumo_top if ir[:6] in sr or sr[:6] in ir)
    print(f"  IDM  top-5: {idm_top_s}")
    print(f"  SUMO top-5: {sumo_top_s}")
    print(f"  Overlap:    {overlap}/5 roads appear in both top-5 lists")

    print("\n── 6. SCHOOL THROUGHPUT (vehicles/15-min arriving at school) ──────────")
    print(f"  {'15-min window':<20} {'IDM arrivals':>14}  {'SUMO arrivals':>14}")
    print(f"  {'-'*20} {'-'*14}  {'-'*14}")
    idm_s  = idm.get('school_arrivals_15min', {})
    sumo_s = sumo.get('school_arrivals_15min', {})
    all_bins = sorted(set(list(idm_s.keys()) + list(sumo_s.keys())))
    for b in all_bins:
        label = f"{sim_to_clock(b*900)}–{sim_to_clock((b+1)*900)}"
        iv = f"{idm_s.get(b, 0):.0f}" if b in idm_s else "—"
        sv = f"{sumo_s.get(b, 0):.0f}" if b in sumo_s else "—"
        print(f"  {label:<20} {iv:>14}  {sv:>14}")

    print(f"\n{'─'*70}")
    print("  VERDICT")
    print('─'*70)
    idm_mean  = idm['trip_mean_s']
    sumo_mean = sumo['trip_mean_s']
    ratio = abs(idm_mean - sumo_mean) / max(sumo_mean, 1)
    if ratio < 0.15:
        verdict = "GOOD — mean trip times within 15%."
    elif ratio < 0.30:
        verdict = "ACCEPTABLE — mean trip times within 30%; check bottleneck agreement."
    else:
        verdict = "DIVERGENT — mean trip times differ >30%; investigate demand or routing."
    print(f"  Trip time difference: {abs(idm_mean-sumo_mean):.0f}s ({ratio*100:.1f}%) → {verdict}")
    print(f"  Peak congestion: IDM={idm['peak_congestion_clock']}, SUMO={sumo['peak_congestion_clock']}")
    print(f"  Road rank overlap (top-5): {overlap}/5\n")


def _print_table(rows):
    print(f"  {'Metric':<32} {'IDM':>18}  {'SUMO':>18}")
    print(f"  {'-'*32} {'-'*18}  {'-'*18}")
    for label, idm_val, sumo_val in rows:
        print(f"  {label:<32} {idm_val:>18}  {sumo_val:>18}")


def save_csv(idm, sumo, scenario, out_path: Path):
    records = [
        ("scenario",              scenario,    scenario),
        ("trips_spawned",         idm["total_spawned"],    sumo["total_spawned"]),
        ("trips_completed",       idm["completed_n"],      sumo["completed_n"]),
        ("completion_rate_pct",   round(idm["completion_rate"]*100, 1), round(sumo["completion_rate"]*100, 1)),
        ("trip_mean_s",           round(idm["trip_mean_s"], 1),    round(sumo["trip_mean_s"], 1)),
        ("trip_median_s",         round(idm["trip_median_s"], 1),  round(sumo["trip_median_s"], 1)),
        ("trip_p85_s",            round(idm["trip_p85_s"], 1),     round(sumo["trip_p85_s"], 1)),
        ("trip_p95_s",            round(idm["trip_p95_s"], 1),     round(sumo["trip_p95_s"], 1)),
        ("delay_mean_s",          round(idm["delay_mean_s"], 1),   round(sumo["delay_mean_s"], 1)),
        ("delay_ratio_pct",       round(idm["delay_ratio_mean"]*100, 1), round(sumo["delay_ratio_mean"]*100, 1)),
        ("stopped_time_mean_s",   round(idm["stopped_time_mean_s"], 1), round(sumo["stopped_time_mean_s"], 1)),
        ("peak_congestion_clock", idm["peak_congestion_clock"], sumo["peak_congestion_clock"]),
    ]
    df = pd.DataFrame(records, columns=["metric", "idm", "sumo"])
    df.to_csv(out_path, index=False)
    print(f"  CSV saved → {out_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

SCENARIO_DEFAULTS = {
    "L": {
        "idm_log":       "models/l/traffic-sim-log-2026-04-01T11-26-56.csv",
        "idm_roads":     "models/l/traffic-road-stats-2026-04-01T11-30-46.csv",
        "sumo_tripinfo": "sim/sumo/tripinfo-L.xml",
        "sumo_json":     "public/sim-results/scenario-L.json",
    }
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", "-s", default="L", choices=["L", "M", "H"])
    parser.add_argument("--idm-log")
    parser.add_argument("--idm-roads")
    parser.add_argument("--sumo-tripinfo")
    parser.add_argument("--sumo-json")
    args = parser.parse_args()

    defaults = SCENARIO_DEFAULTS.get(args.scenario, SCENARIO_DEFAULTS["L"])

    idm_log       = Path(args.idm_log       or REPO_ROOT / defaults["idm_log"])
    idm_roads     = Path(args.idm_roads     or REPO_ROOT / defaults["idm_roads"])
    sumo_tripinfo = Path(args.sumo_tripinfo or REPO_ROOT / defaults["sumo_tripinfo"])
    sumo_json     = Path(args.sumo_json     or REPO_ROOT / defaults["sumo_json"])

    print(f"Loading IDM log:       {idm_log.name}")
    print(f"Loading IDM roads:     {idm_roads.name}")
    print(f"Loading SUMO tripinfo: {sumo_tripinfo.name}")
    print(f"Loading SUMO JSON:     {sumo_json.name}")

    idm  = parse_idm(idm_log, idm_roads)
    sumo = parse_sumo(sumo_tripinfo, sumo_json)

    print_report(idm, sumo, args.scenario)

    out_path = REPO_ROOT / "models" / f"comparison_{args.scenario}.csv"
    save_csv(idm, sumo, args.scenario, out_path)


if __name__ == "__main__":
    main()
