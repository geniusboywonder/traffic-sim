# Simulation Analysis Report (2026-03-31)

This report details the validation of the TokaiSim traffic model based on vehicle logs (`traffic-sim-log-2026-03-31T18-59-25.csv`) and visual evidence (Screenshot at 8:18 AM).

## 1. Validated Anomalies

### A. Inefficient "Grabled" Routing (Corridor 2B)
*   **Observation:** Vehicles from Children's Way were bypassing the direct turn into Dreyersdal Road and instead performing a large loop through Starke and Airlie Roads.
*   **Log Evidence:** Vehicle ID 1 shows a junction sequence of `J26 (Children's Way) -> J27 (Starke) -> J22 (Airlie) -> J15 (Dreyersdal)`.
*   **Impact:** This created a "huge gap" on Dreyersdal Road while simultaneously overloading Starke Road and causing vehicles to brake prematurely as they performed unnecessary U-turns through the network.
*   **Status:** **FIXED.** Reverted `Route 2B` to the direct path: `J26 -> J15 -> J18`.

### B. Weak Yield Logic (Junction J5)
*   **Observation:** Cars are flowing from Christopher Road onto Vineyard Road without stopping or significantly slowing down.
*   **Log Evidence:** Multiple entries show vehicles passing `J5(yield)` at speeds of **11.11 m/s** (40 km/h) with 0.0s hold time.
*   **Impact:** Unrealistic throughput at the Vineyard Road merge, which masks the true back-pressure that should exist at this intersection.
*   **Recommended Fix:** Increase minimum yield gap/wait in `idm.js`.

### C. Speed Imbalance (Inbound vs. Outbound)
*   **Observation:** Outbound (egress) vehicles appear to travel significantly faster than inbound vehicles.
*   **Log Evidence:** Both inbound and outbound vehicles are capped at **11.11 m/s**. However, outbound vehicles on residential segments (Vineyard/Airlie) are maintaining this speed where they should be using `local` road parameters (approx. 8.3 m/s).
*   **Impact:** Egress clearing happens too quickly, leading to an under-estimation of congestion during the post-drop-off phase.
*   **Recommended Fix:** Implement dynamic `roadClass` attribution in `idm.js` to force egress traffic onto `local` or `collector` speed profiles.

### D. Under-utilization of Ruskin Road (J17)
*   **Observation:** Ruskin Road appears completely empty for inbound traffic.
*   **Log Evidence:** 0 matches found for inbound vehicles passing `J17(yield)` except for those specifically on Rat-Run routes (`2B-RR3`).
*   **Impact:** All main corridor traffic is being funneled through Leyden Road, creating an artificial bottleneck that doesn't reflect actual parent behavior (who would use the Ruskin approach to avoid Leyden congestion).
*   **Recommended Fix:** Integrate `J17` into the primary path for at least 30-40% of inbound vehicles.

## 2. Model Integrity Checks

| Metric | Status | Validation Method |
| :--- | :--- | :--- |
| **Traffic Signals** | **PASS** | Log shows `J26` and `J28` applying consistent 4.0s-5.0s holds. |
| **Rat-Run Triggering** | **PASS** | `RAT_RUN_DIVERGE` events only occur when `v_ms` < 0.5 (stalled traffic). |
| **Exit Logic** | **PASS** | All IDs eventually record `EGRESS_COMPLETE`, ensuring no vehicles are lost. |
| **Stats Consistency** | **FAIL** | 12% discrepancy between "Bottleneck" cards and "Watch My Road" due to Junction vs. Segment counting. |

## 3. Recommended Technical Adjustments

1.  **Tighten Yield Gap:** Increase `yield` duration in `idm.js` from 1.5s to 2.5s.
2.  **Dynamic Speed Profiles:** Update `stepAllVehicles` to check the `state` (inbound/outbound); force outbound vehicles to use `IDM_PARAMS.local`.
3.  **Path Diversity:** Update `routes.js` to include Ruskin Road (J17) in the `main` junction arrays for corridors 1A and 2B.
4.  **Sidebar Unification:** Remove fixed Bottleneck cards and rely on the superior Geographic Segment logic of "Watch My Road."
