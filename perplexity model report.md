# Traffic Simulator Anomalies Report

**Generated:** March 31, 2026  
**Data Source:** traffic-sim-log-2026-03-31T18-59-25.csv (47,479 events, 480s-6525s)

## Critical Issues Identified

### 1. Severe Prolonged Stationary Vehicles
- 14,056 zero-velocity events (v_ms ≤0.001 m/s) across all 834 vehicles
- Average spell duration between events: 118s (std 136s, max 1240s)
- Action: Investigate deadlock logic or hold release failures

### 2. Extreme Individual Delays
- 17,780 DELAY_END events, up to 125s+ per incident
- Examples: "delayedFor=125.0s", "delayedFor=75.0s" late in simulation (~6525s)
- Action: Check holdUntil thresholds and upstream cascade effects

### 3. J7 Bottleneck Overload
- jIdx=7: 5,427 events (highest concentration)
- 508 AT_J7_WAITING + 508 AT_J7 with frequent "hold4.5s" 
- Corridor 2B hit hardest (197 passes through J7)
- Action: Yield/merge logic failure; test signal priority tweaks

### 4. System Imbalance (Vehicles Accumulating)
SPAWN:              834
EGRESS_COMPLETE:    483
NET: +351 vehicles
DWELL_START:        505 (mostly onSite798/022)

- Action: Verify sink capacity, dwell loops, or unlogged vehicle drops

### 5. Excessive Rat-Run Diversion
RAT_RUN:        355 events
RAT_RUN_DIVERGE:136 events

- Triggers at congestion 0.5-1.0 (prob 0.5-0.85)
- Hotspot: 2A→2A-RR1 (5x at congestion=0.77, prob=0.69)
- Action: Validate if diversions resolve vs exacerbate gridlock

### 6. Event Mismatch Risk
DELAY_START: 18,165
DELAY_END:   17,780  (385 unresolved)

- Action: Per-vehicle audit for orphaned delay states

### 7. Late-Simulation Congestion Spike
- Longest delays, rat-runs, dwells cluster post-4500s
- Recent example: "delayedFor=40.0s" at 6525s with JUNCTION_HOLD
- Action: Insufficient warmup period or positive feedback loop

## Priority Investigation List

| Priority | Issue | Impact | Test Recommendation |
|----------|--------|---------|-------------------|
| HIGH | J7 Overload | Gridlock source | Signal timing, lane capacity |
| HIGH | Spawn/Egress Imbalance | System failure | Sink validation, dwell logic |
| MED | Prolonged zero-v | Deadlock risk | Hold release thresholds |
| MED | Event mismatches | Data integrity | Per-vehicle state tracking |
| LOW | Rat-run sensitivity | Route realism | Diversion effectiveness |

## Junction Matrix Context
From prior analysis (7,300 JUNCTION_PASS events):
J2-5 handle ~50% passes (Core network hotspots)
J7 shows yield/merge stress (536 passes)

## Next Steps
1. Rerun with capped demand
2. J7 signal optimization 
3. Extended warmup (2x duration)
4. Rat-run probability halved
# School Traffic Blocking Analysis - Christopher/Vineyard/Leyden Route

Context: One-way system into/out of school via Christopher -> Vineyard -> Leyden
Analysis: Junctions blocking despite clear downstream routes

## Primary Blocking Hotspots

J7 (jIdx=7) - Yield/Merge Failure - CRITICAL
- 508 AT_J7_WAITING + 508 AT_J7 events with "hold4.5s"
- Corridor 2B worst (197 passes), 2A also queues heavily
- BLOCKING PATTERN: Vehicles hold at J7 even when J8/J6 clear downstream
- CAUSE: Yield logic to Christopher/Vineyard merge backs up Vineyard approach
- EVIDENCE: High AT_J7 despite only 536 total passes (low throughput)

J0 (jIdx=0) - Entry Blocking
- 9,391 events (highest of all junctions)
- DELAY_START at spawn point even when corridor clear
- BLOCKING PATTERN: New vehicles (SPAWN->DELAY_START) immediately queue
- CAUSE: Ramp metering or Vineyard backup reaches entry

J2/J3 Cluster (jIdx=2,3) - Pre-Leyden Queue
- 1,099 + 1,077 passes respectively (peak junctions)
- High DELAY_END "delayedFor75s+" despite J4/J5 flowing
- BLOCKING PATTERN: Christopher approach queues before Leyden turn
- CAUSE: Right-turn squeeze into one-way school access

## Secondary Concerns

Box Junction Effect at J104 (4way_stop)
Frequent "J104waystop" in detail field
Vehicles pass but trigger upstream holds
Issue: 4-way stop creates "phantom blocking" - vehicles ahead clear but tail holds

Rat-Run Feedback Loops
2A->2A-RR1 (5x at cong=0.77) 
1A->1A-RR6 frequent diversions
Problem: Diversions from Christopher/Vineyard rejoin at J7, worsening merge

## Evidence of Clear-Downstream Blocking
J7: High holds -> Low passes (536 total) = poor release
J0: 14k zero-v events despite SPAWN success  
J2/3: Heavy delays -> J4/5 still handles 50% network flow

## School-Specific Flow Breakdown
1. Vineyard backs up to J7 (merge conflict with 2B)
2. Christopher queues at J2/3 (right-turn pinchpoint)  
3. One-way exit undersized -> 351 vehicle buildup (483 egress vs 834 spawn)

## Immediate Fixes
1. J7 yield->priority signal (Christopher gets green phase)
2. J0 spawn throttle when J1 occupancy >70%
3. Right-turn slip lane at J2/3 for Leyden  
4. Monitor "onSite798 onStreet022" dwells - school exit jam?

J7 is the smoking gun - classic junction blocking despite clear route ahead due to yield/merge starvation.
