"""
compare_models.py
=================
Compares IDM (live simulation), SUMO microscopic, and UXSim mesoscopic
simulations for the same scenario (default: L = 420 trips).

Outputs a plain-text summary report to stdout and saves a CSV comparison
table to models/comparison_{scenario}.csv.

Usage:
    python models/compare_models.py
    python models/compare_models.py --scenario M
    python models/compare_models.py --scenario H --idm-log models/h/log.csv \
                                    --idm-roads models/h/roads.csv
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
    """Convert absolute seconds-since-midnight to 12h clock string."""
    total_min = int(s) // 60
    h = (total_min // 60) % 24
    m = total_min % 60
    h12 = h % 12 or 12
    ap = "AM" if h < 12 else "PM"
    return f"{h12}:{m:02d} {ap}"

def sim_to_clock(sim_s):
    """Convert relative sim seconds (0 = 06:30) to 12h clock string."""
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
    exits   = log[log["event"] == "EXIT"][["id", "simTime"]].rename(columns={"simTime": "exit_t"})

    trips = spawns.merge(dwells, on="id", how="left").merge(ob_st, on="id", how="left").merge(exits, on="id", how="left")
    trips["inbound_s"]  = trips["dwell_t"]  - trips["spawn_t"]
    trips["outbound_s"] = trips["exit_t"] - trips["dwell_t"] - SCHOOL_DWELL_S

    # Use exit_t for total trip if available, else fall back to depart_t (old logs)
    trips["total_s"] = trips.apply(
        lambda r: r["exit_t"] - r["spawn_t"] if pd.notna(r.get("exit_t")) else r["depart_t"] - r["spawn_t"],
        axis=1
    )

    # Only vehicles that completed the full journey
    completed = trips.dropna(subset=["total_s"]).copy()
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
        "inbound_mean_s": completed["inbound_s"].mean() if completed["inbound_s"].notna().any() else None,
        "egress_mean_s":  completed["outbound_s"].mean() if completed["outbound_s"].notna().any() else None,
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

    # Infer inbound leg end time from FCD: first timestep vehicle appears on school_internal
    fcd_path = tripinfo_path.parent / tripinfo_path.name.replace("tripinfo", "fcd")
    school_arrival = {}  # vid -> abs time first seen on school_internal
    if fcd_path.exists():
        import xml.etree.ElementTree as ET2
        current_t = None
        for event, elem in ET2.iterparse(str(fcd_path), events=("start", "end")):
            if event == "start" and elem.tag == "timestep":
                current_t = float(elem.get("time", 0))
            elif event == "end" and elem.tag == "vehicle":
                vid = elem.get("id", "")
                lane = elem.get("lane", "")
                if "school_internal" in lane and vid not in school_arrival:
                    school_arrival[vid] = current_t
                elem.clear()
        print(f"[parse_sumo] FCD school arrivals: {len(school_arrival)} vehicles")

    df["school_arrival_t"] = df["id"].map(school_arrival)
    df["inbound_s"] = df.apply(
        lambda r: (r["school_arrival_t"] - r["depart"]) if pd.notna(r.get("school_arrival_t")) else None, axis=1
    )
    df["egress_s"] = df.apply(
        lambda r: (r["duration"] - (r["school_arrival_t"] - r["depart"]) - r["stopTime"])
                  if pd.notna(r.get("school_arrival_t")) else None, axis=1
    )

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
        "inbound_mean_s": completed["inbound_s"].mean() if "inbound_s" in completed and completed["inbound_s"].notna().any() else None,
        "egress_mean_s":  completed["egress_s"].mean()  if "egress_s"  in completed and completed["egress_s"].notna().any()  else None,
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
# UXSim parsing  (from pre-computed scenario-{S}-uxsim.json)
# ---------------------------------------------------------------------------

def parse_uxsim(json_path: Path):
    """
    Extract comparable metrics from a UXSim scenario JSON.

    UXSim uses deltan=5 (platoon size), so vehicle row counts are ÷5 of real
    vehicles. We multiply by deltan where counting individuals, and note this
    in the output.

    Metrics extracted:
      - Peak vehicle count on network (proxy for capacity utilisation)
      - Frame where vehicles still active at sim end (clearance check)
      - Per-road max vehicle counts (congestion ranking)
      - Peak congestion timing (frame with most vehicles)
      - Avg delay per road (from avg_delay_in fields)
    """
    DELTAN = 5   # UXSim platoon size

    with open(json_path) as f:
        jdata = json.load(f)

    meta   = jdata.get("meta", {})
    frames = jdata.get("frames", [])

    SIM_END_T = meta.get("end_time", 32400)

    # Peak vehicle count and timing
    frame_counts = [(fr["t"], len(fr["vehicles"]) * DELTAN) for fr in frames]
    if frame_counts:
        peak_t, peak_count = max(frame_counts, key=lambda x: x[1])
        peak_sim_t = peak_t - SIM_START_S
    else:
        peak_t, peak_count, peak_sim_t = 0, 0, 0

    # Clearance check: vehicles still present in final frame
    last_frame = frames[-1] if frames else {"t": SIM_END_T, "vehicles": []}
    vehicles_at_end = len(last_frame["vehicles"]) * DELTAN
    clears_by_end = vehicles_at_end == 0

    # Road-level stats: max inbound count per road across all frames
    road_max_inbound  = defaultdict(int)
    road_max_outbound = defaultdict(int)
    road_avg_delay    = defaultdict(list)

    for fr in frames:
        for rs in fr.get("road_stats", []):
            rid = rs["road_id"]
            ib  = rs.get("inbound", 0) * DELTAN
            ob  = rs.get("outbound", 0) * DELTAN
            road_max_inbound[rid]  = max(road_max_inbound[rid], ib)
            road_max_outbound[rid] = max(road_max_outbound[rid], ob)
            d = rs.get("avg_delay_in")
            if d is not None:
                road_avg_delay[rid].append(d)

    road_congestion_rank = pd.Series(road_max_inbound).sort_values(ascending=False)
    road_delay_rank      = pd.Series({
        rid: sum(v) / len(v) for rid, v in road_avg_delay.items() if v
    }).sort_values(ascending=False)

    # Journey time estimate: UXSim doesn't track per-vehicle trip times,
    # but we can estimate from the delay data on key entry roads
    all_delays = [d for delays in road_avg_delay.values() for d in delays]
    avg_delay_s = sum(all_delays) / len(all_delays) if all_delays else 0
    est_trip_s  = FREE_FLOW_TRIP_S + avg_delay_s

    return {
        "total_spawned":          meta.get("total_trips", "N/A"),
        "peak_vehicles_on_net":   peak_count,
        "peak_congestion_sim_t":  peak_sim_t,
        "peak_congestion_clock":  sim_to_clock(peak_sim_t),
        "vehicles_at_end":        vehicles_at_end,
        "clears_by_end":          clears_by_end,
        "avg_delay_s":            avg_delay_s,
        "est_trip_s":             est_trip_s,
        "road_congestion_rank":   road_congestion_rank.head(8).to_dict(),
        "road_delay_rank":        road_delay_rank.head(8).to_dict(),
        "note":                   f"Platoon-based (deltan={DELTAN}); counts are ×{DELTAN} scaled",
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


def print_report(idm, sumo, uxsim, scenario):
    sep = "=" * 80
    print(f"\n{sep}")
    print(f"  MODEL COMPARISON — Scenario {scenario}  (IDM live | SUMO microscopic | UXSim mesoscopic)")
    print(sep)

    print("\n── 1. TRIP COMPLETION ─────────────────────────────────────────────────────────")
    rows = [
        ("Trips spawned",    f"{idm['total_spawned']}",          f"{sumo['total_spawned']}",     "N/A (flow-based)"),
        ("Trips completed",  f"{idm['completed_n']}",            f"{sumo['completed_n']}",       "N/A"),
        ("Completion rate",  fmt(idm['completion_rate'], '%'),   fmt(sumo['completion_rate'], '%'), "N/A"),
    ]
    _print_table3(rows)

    print("\n── 2. TRIP DURATION ───────────────────────────────────────────────────────────")
    ux_trip = fmt(uxsim['est_trip_s']) if uxsim else "—"
    ux_delay = fmt(uxsim['avg_delay_s']) if uxsim else "—"
    sumo_ib = fmt(sumo.get('inbound_mean_s')) if sumo.get('inbound_mean_s') else "—"
    sumo_eg = fmt(sumo.get('egress_mean_s')) if sumo.get('egress_mean_s') else "—"
    rows = [
        ("Mean trip time (full)",     fmt(idm['trip_mean_s']),   fmt(sumo['trip_mean_s']),   ux_trip + " (est)"),
        ("  → Inbound leg mean",      fmt(idm.get('inbound_mean_s')), sumo_ib,               "—"),
        ("  → Egress leg mean",       fmt(idm.get('egress_mean_s')),  sumo_eg,               "—"),
        ("Median trip time",          fmt(idm['trip_median_s']), fmt(sumo['trip_median_s']), "—"),
        ("P85 trip time",             fmt(idm['trip_p85_s']),    fmt(sumo['trip_p85_s']),    "—"),
        ("P95 trip time",             fmt(idm['trip_p95_s']),    fmt(sumo['trip_p95_s']),    "—"),
        ("Mean delay",                fmt(idm['delay_mean_s']),  fmt(sumo['delay_mean_s']),  ux_delay),
    ]
    _print_table3(rows)

    print("\n── 3. CONGESTION & PEAK TIMING ────────────────────────────────────────────────")
    ux_peak = uxsim['peak_congestion_clock'] if uxsim else "—"
    ux_peak_veh = f"{uxsim['peak_vehicles_on_net']}" if uxsim else "—"
    rows = [
        ("Peak congestion at",       idm['peak_congestion_clock'],           sumo['peak_congestion_clock'],         ux_peak),
        ("Peak vehicles on network", "—",                                    "—",                                   ux_peak_veh),
        ("Delay ratio (delay/FF)",   fmt(idm['delay_ratio_mean'], '%'),      fmt(sumo['delay_ratio_mean'], '%'),    "—"),
        ("Avg stopped/waiting",      fmt(idm['stopped_time_mean_s']),        fmt(sumo['stopped_time_mean_s']),      "—"),
    ]
    _print_table3(rows)

    print("\n── 4. TRAFFIC CLEARANCE ───────────────────────────────────────────────────────")
    print("  ⚠  TIA assumes all traffic clears by 08:30. Models show:")
    ux_clears = ("✓ CLEARS" if uxsim and uxsim['clears_by_end'] else f"✗ {uxsim['vehicles_at_end']} veh still active") if uxsim else "—"
    sumo_end_veh = sumo.get('vehicles_at_end', 'unknown')
    sumo_clears = f"✗ ~{sumo_end_veh} veh still active" if sumo_end_veh and sumo_end_veh != 0 else "✓ CLEARS"
    rows = [
        ("Clears by sim end?",  "— (live, user-controlled)", sumo_clears, ux_clears),
    ]
    _print_table3(rows)

    print("\n── 5. TOP CONGESTED ROADS ─────────────────────────────────────────────────────")
    print(f"  {'Road':<35} {'IDM':>15}  {'SUMO':>15}  {'UXSim':>15}")
    print(f"  {'-'*35} {'-'*15}  {'-'*15}  {'-'*15}")
    idm_roads  = idm['road_stopped_rank']
    sumo_roads = sumo['road_stopped_rank']
    ux_roads   = (uxsim['road_congestion_rank'] if uxsim else {})
    all_roads  = list(dict.fromkeys(list(idm_roads.keys()) + list(sumo_roads.keys()) + list(ux_roads.keys())))[:10]
    for r in all_roads:
        iv = f"{idm_roads.get(r, 0):.0f}"   if r in idm_roads  else "—"
        sv = f"{sumo_roads.get(r, 0):.0f}"  if r in sumo_roads else "—"
        uv = f"{ux_roads.get(r, 0):.0f}"    if r in ux_roads   else "—"
        print(f"  {r:<35} {iv:>15}  {sv:>15}  {uv:>15}")

    print("\n── 6. ROAD RANK AGREEMENT ─────────────────────────────────────────────────────")
    idm_top  = [r.lower().replace(" ", "_").replace("'", "") for r in list(idm['road_congestion_rank'].keys())[:5]]
    sumo_top = list(sumo['road_congestion_rank'].keys())[:5]
    ux_top   = list(ux_roads.keys())[:5] if ux_roads else []
    overlap_idm_sumo = sum(1 for ir in idm_top for sr in sumo_top if ir[:6] in sr or sr[:6] in ir)
    overlap_sumo_ux  = sum(1 for sr in sumo_top for ur in ux_top   if sr[:6] in ur or ur[:6] in sr)
    print(f"  IDM   top-5: {', '.join(idm_top)}")
    print(f"  SUMO  top-5: {', '.join(sumo_top)}")
    print(f"  UXSim top-5: {', '.join(ux_top) or '—'}")
    print(f"  IDM↔SUMO overlap: {overlap_idm_sumo}/5  |  SUMO↔UXSim overlap: {overlap_sumo_ux}/5")

    print("\n── 7. SCHOOL THROUGHPUT (vehicles/15-min arriving at school) ──────────────────")
    print(f"  {'15-min window':<20} {'IDM':>12}  {'SUMO':>12}")
    print(f"  {'-'*20} {'-'*12}  {'-'*12}")
    idm_s  = idm.get('school_arrivals_15min', {})
    sumo_s = sumo.get('school_arrivals_15min', {})
    for b in sorted(set(list(idm_s.keys()) + list(sumo_s.keys()))):
        label = f"{sim_to_clock(b*900)}–{sim_to_clock((b+1)*900)}"
        iv = f"{idm_s.get(b, 0):.0f}" if b in idm_s else "—"
        sv = f"{sumo_s.get(b, 0):.0f}" if b in sumo_s else "—"
        print(f"  {label:<20} {iv:>12}  {sv:>12}")

    # ── Verdict ──────────────────────────────────────────────────────────────
    print(f"\n{'─'*80}")
    print("  VERDICT")
    print('─'*80)
    idm_mean  = idm['trip_mean_s']
    sumo_mean = sumo['trip_mean_s']
    ratio_is  = abs(idm_mean - sumo_mean) / max(sumo_mean, 1)

    if ratio_is < 0.15:
        verdict_is = "GOOD — IDM/SUMO mean trip times within 15%"
    elif ratio_is < 0.30:
        verdict_is = "ACCEPTABLE — IDM/SUMO within 30%; check bottleneck agreement"
    else:
        verdict_is = "DIVERGENT — IDM/SUMO differ >30%; investigate demand or routing"

    if uxsim:
        ux_est = uxsim['est_trip_s']
        ratio_su = abs(sumo_mean - ux_est) / max(sumo_mean, 1)
        if ratio_su < 0.20:
            verdict_su = f"GOOD — SUMO/UXSim trip estimates within 20% ({ratio_su*100:.0f}%)"
        elif ratio_su < 0.40:
            verdict_su = f"REASONABLE — SUMO/UXSim within 40% ({ratio_su*100:.0f}%); mesoscopic abstraction expected"
        else:
            verdict_su = f"DIVERGENT — SUMO/UXSim differ {ratio_su*100:.0f}%; review network demand"
    else:
        verdict_su = "UXSim data not available"

    print(f"  IDM vs SUMO:   {abs(idm_mean-sumo_mean):.0f}s ({ratio_is*100:.1f}%) → {verdict_is}")
    print(f"  SUMO vs UXSim: → {verdict_su}")
    print(f"  Peak congestion: IDM={idm['peak_congestion_clock']}, SUMO={sumo['peak_congestion_clock']}", end="")
    if uxsim: print(f", UXSim={uxsim['peak_congestion_clock']}")
    else: print()

    # Clearance warning
    if uxsim and not uxsim['clears_by_end']:
        print(f"\n  ⚠  CLEARANCE FLAG: UXSim shows {uxsim['vehicles_at_end']} vehicles still active at sim end.")
        print(f"     TIA assumption that traffic clears by 08:30 is NOT supported by modelling.")
    print()


def _print_table3(rows):
    print(f"  {'Metric':<32} {'IDM':>18}  {'SUMO':>18}  {'UXSim':>18}")
    print(f"  {'-'*32} {'-'*18}  {'-'*18}  {'-'*18}")
    for label, idm_val, sumo_val, ux_val in rows:
        print(f"  {label:<32} {idm_val:>18}  {sumo_val:>18}  {ux_val:>18}")


def save_csv(idm, sumo, uxsim, scenario, out_path: Path):
    ux = uxsim or {}
    records = [
        ("scenario",               scenario,                          scenario,                           scenario),
        ("trips_spawned",          idm["total_spawned"],              sumo["total_spawned"],              "N/A"),
        ("trips_completed",        idm["completed_n"],                sumo["completed_n"],                "N/A"),
        ("completion_rate_pct",    round(idm["completion_rate"]*100, 1), round(sumo["completion_rate"]*100, 1), "N/A"),
        ("trip_mean_s",            round(idm["trip_mean_s"], 1),     round(sumo["trip_mean_s"], 1),     round(ux.get("est_trip_s", 0), 1)),
        ("trip_median_s",          round(idm["trip_median_s"], 1),   round(sumo["trip_median_s"], 1),   "N/A"),
        ("trip_p85_s",             round(idm["trip_p85_s"], 1),      round(sumo["trip_p85_s"], 1),      "N/A"),
        ("trip_p95_s",             round(idm["trip_p95_s"], 1),      round(sumo["trip_p95_s"], 1),      "N/A"),
        ("delay_mean_s",           round(idm["delay_mean_s"], 1),    round(sumo["delay_mean_s"], 1),    round(ux.get("avg_delay_s", 0), 1)),
        ("delay_ratio_pct",        round(idm["delay_ratio_mean"]*100, 1), round(sumo["delay_ratio_mean"]*100, 1), "N/A"),
        ("stopped_time_mean_s",    round(idm["stopped_time_mean_s"], 1), round(sumo["stopped_time_mean_s"], 1), "N/A"),
        ("peak_congestion_clock",  idm["peak_congestion_clock"],     sumo["peak_congestion_clock"],     ux.get("peak_congestion_clock", "N/A")),
        ("peak_vehicles_on_net",   "N/A",                             "N/A",                             ux.get("peak_vehicles_on_net", "N/A")),
        ("vehicles_at_end",        "N/A",                             ux.get("vehicles_at_end", "N/A"),  ux.get("vehicles_at_end", "N/A")),
        ("clears_by_end",          "N/A",                             "N/A",                             str(ux.get("clears_by_end", "N/A"))),
    ]
    df = pd.DataFrame(records, columns=["metric", "idm", "sumo", "uxsim"])
    df.to_csv(out_path, index=False)
    print(f"  CSV saved → {out_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

SCENARIO_DEFAULTS = {
    "L": {
        "idm_log":       "models/l/traffic-sim-log-2026-04-04T16-05-11.csv",
        "idm_roads":     "models/l/traffic-road-stats-2026-04-04T16-05-13.csv",
        "sumo_tripinfo": "sim/sumo/tripinfo-L.xml",
        "sumo_json":     "public/sim-results/scenario-L-sumo.json",
        "uxsim_json":    "public/sim-results/scenario-L-uxsim.json",
    },
    "M": {
        "idm_log":       "models/m/traffic-sim-log-2026-04-04T16-05-57.csv",
        "idm_roads":     "models/m/traffic-road-stats-2026-04-04T16-06-02.csv",
        "sumo_tripinfo": "sim/sumo/tripinfo-M.xml",
        "sumo_json":     "public/sim-results/scenario-M-sumo.json",
        "uxsim_json":    "public/sim-results/scenario-M-uxsim.json",
    },
    "H": {
        "idm_log":       "models/h/traffic-sim-log-2026-04-04T16-07-23.csv",
        "idm_roads":     "models/h/traffic-road-stats-2026-04-04T16-07-25.csv",
        "sumo_tripinfo": "sim/sumo/tripinfo-H.xml",
        "sumo_json":     "public/sim-results/scenario-H-sumo.json",
        "uxsim_json":    "public/sim-results/scenario-H-uxsim.json",
    },
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", "-s", default="L", choices=["L", "M", "H"])
    parser.add_argument("--idm-log")
    parser.add_argument("--idm-roads")
    parser.add_argument("--sumo-tripinfo")
    parser.add_argument("--sumo-json")
    parser.add_argument("--uxsim-json")
    args = parser.parse_args()

    defaults = SCENARIO_DEFAULTS.get(args.scenario, SCENARIO_DEFAULTS["L"])

    sumo_tripinfo = Path(args.sumo_tripinfo or REPO_ROOT / defaults["sumo_tripinfo"])
    sumo_json     = Path(args.sumo_json     or REPO_ROOT / defaults["sumo_json"])
    uxsim_json    = Path(args.uxsim_json    or REPO_ROOT / defaults["uxsim_json"])

    # IDM logs are optional — only available for scenario L currently
    idm_log_default   = defaults.get("idm_log")
    idm_roads_default = defaults.get("idm_roads")
    idm_log   = Path(args.idm_log   or REPO_ROOT / idm_log_default)   if (args.idm_log   or idm_log_default)   else None
    idm_roads = Path(args.idm_roads or REPO_ROOT / idm_roads_default) if (args.idm_roads or idm_roads_default) else None

    # Parse models
    idm  = None
    if idm_log and idm_roads and idm_log.exists() and idm_roads.exists():
        print(f"Loading IDM log:       {idm_log.name}")
        print(f"Loading IDM roads:     {idm_roads.name}")
        idm = parse_idm(idm_log, idm_roads)
    else:
        print(f"[SKIP] IDM logs not available for scenario {args.scenario}")

    print(f"Loading SUMO tripinfo: {sumo_tripinfo.name}")
    print(f"Loading SUMO JSON:     {sumo_json.name}")
    sumo = parse_sumo(sumo_tripinfo, sumo_json)

    uxsim = None
    if uxsim_json.exists():
        print(f"Loading UXSim JSON:    {uxsim_json.name}")
        uxsim = parse_uxsim(uxsim_json)
    else:
        print(f"[SKIP] UXSim JSON not found: {uxsim_json.name}")

    if idm:
        print_report(idm, sumo, uxsim, args.scenario)
        out_path = REPO_ROOT / "models" / f"comparison_{args.scenario}.csv"
        save_csv(idm, sumo, uxsim, args.scenario, out_path)
    else:
        # SUMO vs UXSim only report
        sep = "=" * 80
        print(f"\n{sep}")
        print(f"  SUMO vs UXSim — Scenario {args.scenario}  (no IDM log available)")
        print(sep)
        if uxsim:
            print(f"\n  SUMO peak congestion:  {sumo['peak_congestion_clock']}")
            print(f"  UXSim peak congestion: {uxsim['peak_congestion_clock']}")
            print(f"  SUMO mean trip time:   {fmt(sumo['trip_mean_s'])}")
            print(f"  UXSim est trip time:   {fmt(uxsim['est_trip_s'])} (estimated from delay data)")
            print(f"  UXSim avg delay:       {fmt(uxsim['avg_delay_s'])}")
            if not uxsim['clears_by_end']:
                print(f"\n  ⚠  CLEARANCE FLAG: UXSim shows {uxsim['vehicles_at_end']} vehicles still active at sim end.")
                print(f"     TIA assumption that traffic clears by 08:30 is NOT supported.")
        out_path = REPO_ROOT / "models" / f"comparison_{args.scenario}.csv"
        save_csv({"total_spawned":"N/A","completed_n":"N/A","completion_rate":0,"trip_mean_s":0,"trip_median_s":0,
                  "trip_p85_s":0,"trip_p95_s":0,"delay_mean_s":0,"delay_ratio_mean":0,"stopped_time_mean_s":0,
                  "peak_congestion_clock":"N/A","road_stopped_rank":{},"road_congestion_rank":{},"school_arrivals_15min":{}},
                 sumo, uxsim, args.scenario, out_path)


if __name__ == "__main__":
    main()
