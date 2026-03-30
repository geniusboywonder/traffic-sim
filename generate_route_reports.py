import csv
import re
import os
import sys
from collections import defaultdict

# Junction Map from routes.js
JUNCTIONS = {
    1: {'name': 'Main Rd / Dreyersdal Rd', 'control': 'priority_stop'},
    2: {'name': 'Main Rd / Dreyersdal Farm Rd', 'control': 'yield'},
    3: {'name': 'Main Rd / Starke Rd', 'control': 'yield'},
    4: {'name': 'Starke Rd / Christopher Rd', 'control': 'stop'},
    5: {'name': 'Christopher Rd / Vineyard Rd', 'control': 'yield'},
    6: {'name': 'Vineyard Rd / Leyden Rd', 'control': 'yield'},
    7: {'name': 'School Ingress (Ruskin Rd)', 'control': 'critical'},
    8: {'name': "Ladies Mile / Children's Way", 'control': 'traffic_signal'},
    9: {'name': 'Ladies Mile / Homestead Ave', 'control': 'priority_stop'},
    10: {'name': 'Starke Rd / Homestead Ave', 'control': '4way_stop'},
    12: {'name': 'Firgrove Way / Firgrove Service Rd', 'control': 'merge'},
    13: {'name': 'Ladies Mile / Firgrove Way', 'control': 'priority_stop'},
    14: {'name': 'Airlie Rd / Dante Rd', 'control': 'yield'},
    15: {'name': 'Airlie Rd / Dreyersdal Rd', 'control': 'stop'},
    16: {'name': 'Dante Rd / Vineyard Rd', 'control': 'stop'},
    17: {'name': 'Dante Rd / Ruskin Rd', 'control': 'yield'},
    18: {'name': 'Dreyersdal Rd / Christopher Rd', 'control': 'yield'},
    19: {'name': 'Vineyard Rd / Airlie Rd', 'control': 'yield'},
    20: {'name': 'School Egress (Aristea Rd)', 'control': 'egress'},
    21: {'name': 'Dreyersdal Farm Rd / Tussendal Ave', 'control': 'yield'},
    22: {'name': 'Starke Rd / Airlie Rd', 'control': 'stop_directional'},
    23: {'name': 'Tussendal Ave / Airlie Rd', 'control': 'yield'},
    24: {'name': 'Starke Rd / Clement Rd', 'control': 'stop'},
    25: {'name': 'Clement Rd / Leyden Rd', 'control': 'yield'},
    26: {'name': "Children's Way / Dreyersdal Rd", 'control': '4way_stop'},
    27: {'name': "Children's Way / Starke Rd", 'control': 'stop_directional'},
    28: {'name': 'Homestead Ave / Dreyersdal Rd', 'control': '4way_stop'},
    29: {'name': 'Ruskin Rd / Aristea Rd', 'control': 'roundabout_planned'}
}

ROUTES = {
    '1A': [1,2,3,27,22,4,5,6,7],
    '1A-RR1': [1,2,15,18,4,5,6,7],
    '1A-RR2': [1,2,3,27,22,19,16,5,6,7],
    '1A-RR3': [1,2,3,27,22,19,16,17,7],
    '1A-RR4': [1,2,3,27,22,19,23,14,17,7],
    '1A-RR5': [1,2,3,21,23,14,17,7],
    '1A-RR6': [1,2,3,21,23,19,16,5,6,7],
    '2A': [9,28,18,4,5,6,7],
    '2A-RR1': [9,28,10,24,25,6,7],
    '2A-RR2': [9,28,10,24,4,5,6,7],
    '2B': [8,26,15,18,4,5,6,7],
    '2B-RR1': [8,26,27,22,4,5,6,7],
    '2B-RR2': [8,26,27,22,19,16,5,6,7],
    '2B-RR3': [8,26,27,22,19,16,17,7],
    '3A': [13,12,10,24,4,5,6,7],
    '3A-RR1': [13,12,10,24,25,6,7],
    '3A-RR2': [13,12,10,24,4,5,16,17,7],
    'EG-A': [7,20,29,17,16,19,22,26,8],
    'EG-B': [7,20,29,17,16,19,15,2,1],
    'EG-C': [7,20,29,17,14,23,21,2,1],
    'EG-D': [7,20,29,17,16,5,4,24,10,12,13]
}

def generate_reports(log_file):
    # route_delays[route_id][junction_id] = [delay_times]
    route_junc_delays = defaultdict(lambda: defaultdict(list))
    
    with open(log_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rid = row['routeId']
            if row['event'] == 'JUNCTION_HOLD':
                jid_match = re.search(r'J(\d+)\(', row['detail'])
                hold_match = re.search(r'hold=([\d\.]+)', row['detail'])
                if jid_match and hold_match:
                    jid = int(jid_match.group(1))
                    hold = float(hold_match.group(1))
                    route_junc_delays[rid][jid].append(hold)
            elif row['event'] == 'AT_J7_WAITING':
                hold_match = re.search(r'hold=([\d\.]+)', row['detail'])
                if hold_match:
                    hold = float(hold_match.group(1))
                    route_junc_delays[rid][7].append(hold)

    os.makedirs('docs/route_reports', exist_ok=True)

    for rid, junctions in ROUTES.items():
        filename = f"docs/route_reports/route_{rid.replace('-', '_')}.md"
        with open(filename, 'w') as f:
            f.write(f"# Traffic Analysis Report: Route {rid}\n\n")
            f.write("| Junction | Control Type | Total Occurrences | Avg Delay (s) | Total Extension | Cause of Delay |\n")
            f.write("| :--- | :--- | :---: | :---: | :---: | :--- |\n")
            
            total_extension = 0
            for jid in junctions:
                j_info = JUNCTIONS.get(jid, {'name': f'J{jid}', 'control': 'unknown'})
                delays = route_junc_delays[rid].get(jid, [])
                
                count = len(delays)
                avg_delay = sum(delays) / count if count > 0 else 0
                ext_str = f"{avg_delay:.1f}s"
                total_extension += avg_delay
                
                cause = "Queuing / Control" if count > 0 else "Free Flow"
                if jid == 7 and any('parking_full' in str(d) for d in delays):
                    cause = "Parking Full / Ingress Hold"
                
                f.write(f"| {j_info['name']} | {j_info['control']} | {count} | {avg_delay:.1f}s | {ext_str} | {cause} |\n")
            
            f.write(f"\n**Total Trip Time Extension: {total_extension:.1f} seconds**\n")

    print(f"Generated {len(ROUTES)} reports in docs/route_reports/")

if __name__ == "__main__":
    # Fallback to finding the latest log if none provided
    if len(sys.argv) > 1:
        log = sys.argv[1]
    else:
        logs = [f for f in os.listdir('.') if f.startswith('traffic-sim-log-') and f.endswith('.csv')]
        log = sorted(logs)[-1] if logs else None
    
    if log:
        generate_reports(log)
    else:
        print("No log file found to analyze.")