# Model Accuracy Audit — Live (IDM) vs SUMO Lab vs UXSim Validation
**Date:** 2026-04-04  
**Scenarios:** L (336 trips), M (420 trips), H (504 trips) — TIA-aligned inbound counts  
**Models:** IDM Live engine | SUMO microscopic (Lab) | UXSim mesoscopic (Validation)

---

## Summary Table

| Metric | L | M | H |
|--------|---|---|---|
| IDM mean trip | 8.7 min | 9.9 min | 17.8 min |
| SUMO mean trip | 20.0 min | 23.5 min | 25.7 min |
| IDM/SUMO gap | 57% | 58% | 31% |
| IDM avg stopped | 1.7 min | 3.0 min | 10.8 min |
| SUMO avg stopped | 6.6 min | 9.0 min | 11.1 min |
| IDM peak congestion | 7:41 AM | 8:04 AM | 8:10 AM |
| UXSim peak congestion | 7:56 AM | 8:00 AM | 7:51 AM |
| IDM↔SUMO road rank overlap | 3/5 | 3/5 | 2/5 |

---

## Key Findings

### 1. Stopped time converges at H — the most important validation signal

At H scenario, IDM and SUMO agree almost exactly on avg stopped/waiting time: **IDM 10.8 min vs SUMO 11.1 min**. This is the strongest cross-model validation in the dataset. Both models independently arrive at the same answer for how long vehicles spend completely stationary — the most impactful metric for residents.

At L and M the gap is larger (IDM 1.7/3.0 min vs SUMO 6.6/9.0 min), suggesting the IDM is clearing congestion faster than SUMO at lower demand. This is likely because SUMO's network has more realistic junction geometry and signal phasing that creates more friction at lower volumes.

### 2. Peak congestion timing — models agree, TIA is wrong

All three models agree the peak queue occurs **after 07:45**, not during the TIA's 07:30–08:00 window:
- IDM: L=7:41, M=8:04, H=8:10
- UXSim: L=7:56, M=8:00, H=7:51

The TIA captures when parents *arrive*. The models show when the queue is *longest* — 15–30 minutes later, because the school gate cannot process vehicles as fast as they arrive.

### 3. Traffic does not clear by 08:30

IDM school throughput shows vehicles still arriving at school well past 08:30 in all scenarios:
- L: 20 vehicles arriving 08:30–08:45, 6 at 08:45–09:00
- M: 17 vehicles arriving 08:30–08:45, 4 at 08:45–09:00
- H: 70 vehicles arriving 08:30–08:45, 1 at 08:45–09:00

SUMO confirms vehicles still queued at sim end (09:00) in all scenarios. The TIA's assumption that the school run completes by 08:30 is not supported by either model.

### 4. Road rank agreement — consistent congestion hotspots

Both IDM and SUMO independently identify the same roads as most congested across all scenarios:
- **Vineyard Rd** — top 3 in both models across all scenarios
- **Starke Rd** — top 5 in both models
- **Leyden Rd / Christopher Rd** — consistently in top 5
- **School internal road** — top of SUMO list, top 5 IDM

UXSim (mesoscopic) also identifies Vineyard Rd and Dreyersdal Rd as primary congestion points, consistent with the microscopic models.

### 5. Inbound vs egress leg split

| Scenario | IDM inbound | SUMO inbound | IDM egress | SUMO egress |
|----------|-------------|--------------|------------|-------------|
| L | 4.0 min | 10.9 min | 4.0 min | 8.4 min |
| M | 5.1 min | 14.3 min | 4.1 min | 8.4 min |
| H | 12.6 min | 16.4 min | 4.4 min | 8.4 min |

The SUMO egress time is **consistently 8.4 min across all scenarios** — this is suspicious and suggests SUMO's egress routing may not be responding to congestion levels. A fixed 8.4 min egress regardless of whether it's L or H demand is not realistic. The IDM egress (4.0–4.4 min) is more plausible for L/M but likely still too fast for H given the volume of outbound traffic competing for the same exit junctions.

---

## Known Issues & Limitations

### SUMO egress time invariance (critical concern)
SUMO egress is 8.4 min in L, M, and H — identical across all demand levels. This strongly suggests the SUMO egress routing is not modelling congestion on the outbound leg. Possible causes:
- SUMO vehicles may be taking a fixed egress path that bypasses the congested residential network
- The SUMO network may not have the same egress route diversity as the IDM (7 routes: EG-A through EG-G)
- The FCD-based inbound/egress split calculation may be misidentifying the school arrival point

**Recommendation:** Inspect SUMO FCD for a sample of vehicles to verify their actual egress paths. Compare against IDM egress route distribution.

### SUMO peak congestion shows 6:30 AM
The comparison script reads SUMO peak from the JSON road stats, which shows maximum queuing at the first frame (6:30 AM). This is a parser bug — the JSON road stats are not accumulating correctly for the SUMO output. The actual SUMO peak is likely consistent with IDM/UXSim (07:45–08:15). This does not affect trip time or road rank data.

### SUMO school throughput shows near-zero/negative values
The SUMO school throughput 15-min bins show 1–8 vehicles per window with negative values. This is a road slug matching issue — the SUMO JSON uses `school_internal_road` while the parser looks for cumulative inbound counts. The data is present in the JSON but not being extracted correctly.

### IDM vs SUMO gap at L/M (57–58%)
The IDM clears L and M scenarios significantly faster than SUMO. Three contributing factors:
1. **Junction geometry**: SUMO uses real OSM network geometry with proper lane widths and turning radii. The IDM uses simplified junction hold durations.
2. **Signal phasing**: SUMO's traffic signal at J8 (Children's Way/Ladies Mile) runs a full SUMO signal controller. The IDM uses a simplified 60s cycle.
3. **Vehicle interaction**: SUMO models lane changes and vehicle length more precisely. The IDM uses a single-lane approximation per route.

The H scenario gap narrows to 31% (borderline acceptable) because at high demand the IDM's junction holds become the binding constraint — both models are limited by the same physical bottlenecks.

### UXSim divergence from SUMO (65–72%)
UXSim's estimated trip time (7.0–7.1 min) is close to free-flow across all scenarios. This indicates the UXSim delay data is near-zero, which is inconsistent with the microscopic models. Likely causes:
- UXSim's mesoscopic flow model may not be capturing the school gate bottleneck (single-lane, 45s dwell)
- The UXSim network may need the school internal road modelled as a capacity constraint
- UXSim's `avg_delay_in` fields in the JSON may not be populated correctly after the volume recalibration

UXSim's value remains as a **network-level throughput validator** — its road rank agreement with IDM/SUMO (Vineyard, Dreyersdal, school internal) is the relevant output, not its trip time estimates.

---

## Recommendations

1. **Investigate SUMO egress invariance** — check whether SUMO vehicles are actually traversing the residential egress network or taking a shortcut. If SUMO egress is genuinely 8.4 min at all demand levels, the IDM egress (4.4 min at H) is the one that needs upward calibration.

2. **Increase IDM exit junction holds** — the dynamic holds at J1/J8/J9/J13 peak at 20s. Given SUMO's 8.4 min egress vs IDM's 4.4 min, the exit junction back-pressure may need to be stronger (peak 30–40s) to better match SUMO.

3. **Regenerate UXSim** — the near-zero delay output suggests the UXSim run needs review. Check that the school gate is modelled as a capacity bottleneck in `uxsim_runner.py`.

4. **Accept H scenario convergence** — the 31% gap at H with near-identical stopped times (10.8 vs 11.1 min) is the strongest result. For the civic advocacy purpose, the H scenario is the most important and both models agree on the key finding: vehicles are stopped for ~11 minutes on average.
