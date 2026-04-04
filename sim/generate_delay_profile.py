import json
import os

# Delay estimates based on idm.js logic
DELAY_ESTIMATES = {
    'traffic_signal': 7.5, # Avg wait for 30s green/red cycle
    'priority_stop': 8.0,
    '4way_stop': 4.0,
    'stop': 4.0,
    'yield': 1.5,
    'critical': 4.5,
    'stop_directional': 5.0, # Worst case gap for 1A/2B
    'roundabout_planned': 0.0,
    'egress': 0.0,
    'merge': 0.0
}

CAUSE_MAP = {
    'traffic_signal': "Signalized Intersection",
    'priority_stop': "Priority Intersection (Major Road)",
    '4way_stop': "All-Way Stop Control",
    'stop': "Stop Control (Minor Road)",
    'yield': "Yield Control",
    'critical': "School Ingress Gate (Security/Check)",
    'stop_directional': "Directional Stop Control",
    'roundabout_planned': "Planned Roundabout (Free Flow in Sim)",
    'egress': "School Egress Point",
    'merge': "Merging Traffic"
}

def generate_profile():
    with open('simulation-data.json', 'r') as f:
        data = json.load(f)
    
    junctions = data['junctions']
    # Add J29 if missing (it was in routes.js but not in the snippet)
    if "29" not in junctions:
        junctions["29"] = { "name": "Ruskin Rd / Aristea Rd — roundabout", "control": "roundabout_planned" }
    
    routes = data['routes']
    
    with open('docs/network_delay_profile.md', 'w') as f:
        f.write("# Tokai Traffic Simulation: Network Delay Profile\n\n")
        f.write("This document details the expected delays for each route based on junction control configurations.\n\n")
        
        # Group routes by corridor
        by_corridor = {}
        for rid, rdata in routes.items():
            corr = rdata['corridor']
            if corr not in by_corridor: by_corridor[corr] = []
            by_corridor[corr].append((rid, rdata))
            
        for corr in sorted(by_corridor.keys()):
            f.write(f"## Corridor: {corr}\n\n")
            for rid, rdata in by_corridor[corr]:
                f.write(f"### Route {rid}\n\n")
                f.write("| Jid | Junction Name | Control Type | Delay Est. | Cumulative Extension | Cause of Delay |\n")
                f.write("| :--- | :--- | :--- | :---: | :---: | :--- |\n")
                
                total_delay = 0
                for jid in rdata['junctions']:
                    j = junctions.get(str(jid), {'name': f'Junction {jid}', 'control': 'unknown'})
                    # Special case for stop_directional: only 5s for 1A/2B
                    ctrl = j['control']
                    delay = DELAY_ESTIMATES.get(ctrl, 0.0)
                    if ctrl == 'stop_directional' and corr not in ['1A', '2B']:
                        delay = 0.0
                        
                    total_delay += delay
                    f.write(f"| {jid} | {j['name']} | {ctrl} | {delay:.1f}s | {total_delay:.1f}s | {CAUSE_MAP.get(ctrl, 'Unknown')} |\n")
                
                f.write(f"\n**Total Trip Time Extension: {total_delay:.1f} seconds**\n\n")

    print("Generated docs/network_delay_profile.md")

if __name__ == "__main__":
    generate_profile()
