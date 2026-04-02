"""
uxsim_runner.py — Run L / M / H scenarios and write pre-computed JSON output.

Usage:
    cd sim
    python uxsim_runner.py           # runs all three scenarios
    python uxsim_runner.py --scenario M   # run one scenario only

Outputs (relative to repo root):
    public/sim-results/scenario-L.json
    public/sim-results/scenario-M.json
    public/sim-results/scenario-H.json

TIA demand figures (AM peak 06:30-08:30):
    L = 420 total vehicle trips
    M = 650 total vehicle trips
    H = 840 total vehicle trips

Corridor splits (from TIA §13):
    1A (Main Rd / Dreyersdal — N1):    24%
    2A (Dreyersdal / Firgrove — N2):   20%
    2B (Ladies Mile / Children's — N3): 35%
    3A (Ladies Mile / Homestead — N4): 21%

Arrival time distribution (trapezoidal peak, empirical school pattern):
    06:30-07:15  15% of demand
    07:15-07:45  30% of demand
    07:45-08:00  35% of demand
    08:00-08:15  15% of demand
    08:15-08:30   5% of demand

School parking model:
    98 on-site bays + 22 on-street (Ruskin Rd) = 120 total
    Dwell time modelled as SCHOOL_INTERNAL link (62m @ 5km/h ≈ 45s free-flow)
    Outbound demand (departures) starts 45s after inbound, same corridor splits.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from network_builder import build_world
from converters.uxsim_to_json import convert

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "sim-results"

SIM_START = 23400   # 06:30
SIM_END   = 32400   # 09:00 — extended to allow traffic to clear post-peak
TIMESTEP  = 30      # seconds between output frames

# Total vehicle trips per scenario (TIA §13)
SCENARIO_DEMAND = {
    "L": 420,
    "M": 650,
    "H": 840,
}

# Corridor entry nodes and their demand share
CORRIDORS = [
    {"node_id": "N1", "share": 0.24, "label": "1A Main/Dreyersdal"},
    {"node_id": "N2", "share": 0.20, "label": "2A Dreyersdal/Firgrove"},
    {"node_id": "N3", "share": 0.35, "label": "2B Ladies Mile/Childrens"},
    {"node_id": "N4", "share": 0.21, "label": "3A Ladies Mile/Homestead"},
]

# Arrival time distribution: list of (t_start, t_end, share_of_total)
ARRIVAL_PROFILE = [
    (23400, 26100, 0.15),   # 06:30 - 07:15  (2700s)  15%
    (26100, 27900, 0.30),   # 07:15 - 07:30  (1800s)  30%
    (27900, 28800, 0.35),   # 07:30 - 08:00   (900s)  35%
    (28800, 29700, 0.15),   # 08:00 - 08:15   (900s)  15%
    (29700, 30600, 0.05),   # 08:15 - 08:30   (900s)   5%
]

DWELL_OFFSET_S = 45  # seconds after inbound demand that outbound demand starts


def inject_demand(W, overlay_nodes, total_trips):
    """
    Add UXsim demand for all corridors across the arrival time profile.

    Inbound:  each corridor node → School-Gate
    Outbound: School-Gate → each corridor node (offset by DWELL_OFFSET_S)

    Returns
    -------
    corridor_nodes : dict  corridor_index (0-3) → UXsim Node
        Used by the converter to map vehicles back to their corridor for
        frontend-compatible flow_N_* vehicle ID generation.
    """
    school_gate = overlay_nodes.get("School-Gate")
    if school_gate is None:
        raise RuntimeError("School-Gate node not found — check network_builder output")

    corridor_nodes = {}   # corridor_idx → Node

    for idx, corridor in enumerate(CORRIDORS):
        nid   = corridor["node_id"]
        share = corridor["share"]
        origin = overlay_nodes.get(nid)
        if origin is None:
            print(f"[runner] WARNING: {nid} ({corridor['label']}) not found — skipping")
            continue

        corridor_nodes[idx] = origin
        corridor_trips = total_trips * share

        for t_start, t_end, time_share in ARRIVAL_PROFILE:
            bucket_trips = corridor_trips * time_share
            duration_s   = t_end - t_start
            flow_veh_s   = bucket_trips / duration_s   # vehicles per second

            if flow_veh_s <= 0:
                continue

            # Inbound: corridor → school
            W.adddemand(
                orig    = origin,
                dest    = school_gate,
                t_start = t_start,
                t_end   = t_end,
                flow    = flow_veh_s,
            )

            # Outbound: school → corridor (same flow, offset by dwell time)
            out_start = t_start + DWELL_OFFSET_S
            out_end   = t_end   + DWELL_OFFSET_S
            # Cap at sim end
            if out_start >= SIM_END:
                continue
            out_end = min(out_end, SIM_END)

            W.adddemand(
                orig    = school_gate,
                dest    = origin,
                t_start = out_start,
                t_end   = out_end,
                flow    = flow_veh_s,
            )

    print(f"[runner] Demand injected: {total_trips} trips across {len(CORRIDORS)} corridors")
    return corridor_nodes


def run_scenario(scenario: str):
    total_trips = SCENARIO_DEMAND[scenario]
    print(f"\n{'='*60}")
    print(f"Running scenario {scenario} ({total_trips} trips)")
    print(f"{'='*60}")

    # Build a fresh World for each scenario
    W, node_map, overlay_nodes = build_world(
        sim_start     = SIM_START,
        sim_end       = SIM_END,
        timestep      = TIMESTEP,
        reaction_time = 1.5,
    )

    # Inject demand — returns corridor_idx→Node map for vehicle ID generation
    corridor_nodes = inject_demand(W, overlay_nodes, total_trips)

    # Run
    print(f"[runner] Starting simulation...")
    W.exec_simulation()
    print(f"[runner] Simulation complete.")

    # Convert to canonical JSON
    sim_output = convert(
        W,
        scenario       = scenario,
        corridor_nodes = corridor_nodes,
        start_time     = SIM_START,
        end_time       = SIM_END,
        timestep       = TIMESTEP,
    )

    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"scenario-{scenario}-uxsim.json"
    sim_output.write_json(out_path)

    return out_path


def main():
    parser = argparse.ArgumentParser(description="Run UXsim traffic scenarios")
    parser.add_argument(
        "--scenario", "-s",
        choices=["L", "M", "H"],
        default=None,
        help="Run a single scenario (default: run all three)",
    )
    args = parser.parse_args()

    scenarios = [args.scenario] if args.scenario else ["L", "M", "H"]

    for s in scenarios:
        out_path = run_scenario(s)
        print(f"[runner] Output: {out_path}")

    print("\nAll done.")


if __name__ == "__main__":
    main()
