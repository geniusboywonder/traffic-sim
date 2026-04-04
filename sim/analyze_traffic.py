import csv
import sys
import os
import re
from collections import Counter, defaultdict

# Critical Junction Map for readability
JUNC_MAP = {
    1: "Main Rd / Dreyersdal (J1)",
    4: "Starke / Christopher (J4)",
    5: "Christopher / Vineyard (J5)",
    6: "Vineyard / Leyden (J6)",
    7: "School Ingress (J7)",
    8: "Ladies Mile / Children's (J8)",
    9: "Ladies Mile / Homestead (J9)",
    10: "Starke / Homestead (J10)",
    13: "Firgrove Way (J13)",
    20: "School Egress (J20)",
    26: "Children's / Dreyersdal (J26)",
    29: "Ruskin / Aristea Roundabout (J29)"
}

def analyze_log(file_path):
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    print(f"--- Comprehensive Traffic Analysis: {file_path} ---")
    
    events = []
    vehicles = set()
    sim_end_time = 0
    
    # Pre-pass: Load events and basic stats
    with open(file_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                row['simTime'] = float(row['simTime'])
                row['v_ms'] = float(row['v_ms']) if row['v_ms'] != '—' else 0.0
                row['pos'] = float(row['pos']) if row['pos'] != '—' else 0.0
                row['jIdx'] = int(row['jIdx']) if row['jIdx'] != '—' else -1
                
                vehicles.add(row['id'])
                sim_end_time = max(sim_end_time, row['simTime'])
                events.append(row)
            except ValueError: continue

    # 1. Junction Throughput Validation
    print("\n[1] JUNCTION THROUGHPUT VALIDATION")
    junc_passes = defaultdict(list)
    for e in events:
        if e['event'] in ['JUNCTION_PASS', 'AT_J7', 'EGRESS_COMPLETE']:
            jid_match = re.search(r'J(\d+)\(', e['detail'])
            if jid_match:
                jid = int(jid_match.group(1))
                junc_passes[jid].append(e['simTime'])
            elif e['event'] == 'AT_J7':
                junc_passes[7].append(e['simTime'])
            elif e['event'] == 'EGRESS_COMPLETE':
                junc_passes[999].append(e['simTime'])

    for jid in sorted(junc_passes.keys()):
        if jid == 999: continue
        times = junc_passes[jid]
        count = len(times)
        actual_hr = (count / (sim_end_time / 3600))
        
        max_gap = 0
        if len(times) > 1:
            max_gap = max(times[i] - times[i-1] for i in range(1, len(times)))
        
        label = JUNC_MAP.get(jid, f"J{jid}")
        print(f" {label:30} | Flow: {actual_hr:5.1f} veh/hr | Max Gap: {max_gap:6.1f}s")
        
        if max_gap > 600 and sim_end_time > 1800:
            print(f"  !! ANOMALY: Junction {jid} went dark for {max_gap/60:.1f} mins. Potential gridlock source.")

    # 2. Backpressure Chain Correlation
    print("\n[2] BACKPRESSURE CORRELATION")
    j7_stalls = [e['simTime'] for e in events if e['event'] == 'AT_J7_WAITING']
    j4_stalls = [e['simTime'] for e in events if 'J4' in e['detail'] and e['event'] == 'JUNCTION_HOLD']
    
    if j7_stalls and j4_stalls:
        first_j7_stall = min(j7_stalls)
        first_j4_heavy_delay = 0
        for e in events:
            if 'J4' in e['detail'] and 'hold=' in e['detail']:
                hold_m = re.search(r'hold=([\d\.]+)', e['detail'])
                if hold_m:
                    hold = float(hold_m.group(1))
                    if hold > 5.0 and e['simTime'] > first_j7_stall:
                        first_j4_heavy_delay = e['simTime']
                        break
        
        if first_j4_heavy_delay > 0:
            print(f" Chain: J7 (School) stalled at {first_j7_stall:.1f}s.")
            print(f" Chain: J4 (Upstream) backed up at {first_j4_heavy_delay:.1f}s (Gap: {first_j4_heavy_delay - first_j7_stall:.1f}s).")
            print("  -> Result: VALIDATED. Bottleneck is downstream (J7/Egress) creating backpressure upstream.")
        else:
            print(" Chain: J7 stalled, but J4 remained clear or delayed independently.")

    # 3. Physics vs. Control Logic Diagnostics
    print("\n[3] PHYSICS VS. CONTROL DIAGNOSTICS")
    phantom_events = []
    for e in events:
        if e['event'] == 'DELAY_START':
            jid_in_detail = re.search(r'holdAt=(\d+)', e['detail'])
            hold_at = jid_in_detail.group(1) if jid_in_detail else 'none'
            
            if hold_at == 'none' and e['jIdx'] != -1:
                if e['state'] == 'outbound' and e['jIdx'] == 1:
                    phantom_events.append(e)

    if phantom_events:
        print(f" Detected {len(phantom_events)} Outbound Physics Stalls at J20 (No Junction Hold).")
        print("  -> Pointer: idm.js Look-ahead (Search 2) missing !o.isParking or direction filter.")

    # 4. Scenario Validation
    print("\n[4] SCENARIO INTEGRITY")
    spawn_counts = Counter([e['corridorId'] for e in events if e['event'] == 'SPAWN'])
    print(f" Spawn Distribution: {dict(spawn_counts)}")
    
    # 5. Conclusion
    print("\n--- FINAL DIAGNOSIS ---")
    egress_count = len(junc_passes.get(999, []))
    if egress_count < (len(vehicles) * 0.2) and len(vehicles) > 50:
        print(" CRITICAL: Egress completion rate is extremely low. Simulation is deadlocking.")
        if phantom_events:
            print(" CAUSE: Code Bug (Physics Phantom Leader at J20).")
        else:
            print(" CAUSE: Natural Gridlock (J7 capacity exceeded).")
    else:
        print(" Simulation completed with healthy flow.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        logs = [f for f in os.listdir('.') if f.startswith('traffic-sim-log-') and f.endswith('.csv')]
        if logs:
            analyze_log(sorted(logs)[-1])
        else:
            print("Usage: python3 analyze_traffic.py <path_to_log_csv>")
    else:
        analyze_log(sys.argv[1])
