# Traffic Simulator Calibration - L/M/H Scenarios vs TIA

Date: April 4, 2026
Analysis: Current simulation (834 vehicles) vs TIA Tokai High School AM Peak (840 vehicles)

## Current Simulation Issues (834 spawns)

Metric    Current        TIA Target        Status
Total Volume    834        840 ✓        Matches
Int/Ext Split    67% local    30% local / 70% ext    Too local
Peak Duration    ~1.8hrs    1hr (07:00-08:00)    Too long
Rat-runs    25%+ traffic    0% (or <3%)    Overused

Current Route Distribution (834 spawns):
2B: 18.59% (Christopher/Starke local)
2A: 16.67%
1A: 11.27%
3A: 10.91%
2A-RR2: 7.79% (Rat-runs dominate)
2B-RR1: 6.35%

## TIA M Scenario - Correct Route Probabilities (30% Local / 70% External)

Local Routes (30% total):
Christopher E: 4.0% (2A base)
Starke N: 10.0% (2B north)
Starke S: 12.0% (2B south)
Leyden N: 3.0% (3A local)
Ruskin E: 1.0% (1A local)
Total Local: 30%

External Routes (70% total):
Dreyersdal N: 11.0% (1A external north)
Homestead E: 21.0% (3A external 1)
Child Way E: 25.0% (3A external 2)
Dreyersdal S: 13.0% (1A external south)
Total External: 70%

## L/M/H Scenarios (AM Peak Hour)

Scenario      Students  Cars/Hour  Cars/Student  Local%  External%  Notes
L LOW         800       560        0.70         40%     60%       Base + walking/bus
M TIA         1,120     840        0.75         30%     70%       REPORT BASELINE
H Constantia  1,120     896        0.80         25%     75%       Max car dependency

## Simulator Configuration

Demand Settings:
L: spawn_rate = 560 / 3600 = 0.156 veh/s
M: spawn_rate = 840 / 3600 = 0.233 veh/s (RECOMMENDED)
H: spawn_rate = 896 / 3600 = 0.249 veh/s
sim_duration = 3600s (1 hour AM peak)

Route Probability Mapping:
ROUTE_WEIGHTS_M = {
    # Local 30%
    '2A': 0.04,        # Christopher E
    '2B_north': 0.10,  # Starke N
    '2B_south': 0.12,  # Starke S
    '3A_local': 0.03,  # Leyden N
    '1A_local': 0.01,  # Ruskin E
    
    # External 70%
    '1A_ext_n': 0.11,  # Dreyersdal N
    '3A_ext1': 0.21,   # Homestead E
    '3A_ext2': 0.25,   # Child Way E
    '1A_ext_s': 0.13   # Dreyersdal S
}

DISABLE or cap rat-runs: only trigger at congestion > 0.90

## Key Fixes Required

1. Reduce spawn rate to 0.233 veh/s for true 1hr peak
2. Apply exact TIA route weights above (30/70 split)
3. Disable rat-runs or threshold at cong>0.90 only
4. Fix J7 yield trap (Christopher priority signal)
5. Balance egress (currently 483 vs 834 spawns)

## Realism Check: 400 Cars for 1200 Students?

TIA: 1120 students → 840 cars = 0.75 ratio (REALISTIC)
400 cars = 0.33 ratio → 67% walking/bus (OPTIMISTIC)

Cape Town high-income reality: 0.6-0.8 cars/student
Use TIA M (0.75) as baseline - matches Constantia/Bergvliet conditions.
