# Implementation Plan: Hybrid Path4GMNS Strategy

This plan details the steps to integrate professional-grade traffic assignment logic into the Tokai High School Traffic Simulator using a hybrid approach: **Python (Path4GMNS)** for mathematical routing and **React/JavaScript** for live-web visualization.

## Objective
Replace simplified, probability-based rat-run logic with **User Equilibrium (UE)** assignment. This ensures that vehicles choose side-streets only when mathematically optimal based on real-world congestion math (Volume-Delay Functions).

---

## Phase 1: The GMNS Data Bridge
**Goal:** Convert our custom network model into the industry-standard GMNS format.

1.  **Script Development (`engine/export_to_gmns.py`):**
    *   Read `simulation-data.json`.
    *   Map existing junctions to `node.csv`.
    *   Map road segments to `link.csv` (assigning BPR delay coefficients, capacities, and lane counts).
2.  **Demand Synthesis:**
    *   Generate `demand.csv` based on TIA volumes (840 trips/hr for Scenario H).
    *   Map corridor entries (J1, J8, J9, J13) as Origins and the School Gate (J7) as the Destination.

## Phase 2: Equilibrium Calculation (Python)
**Goal:** Calculate the "Network Equilibrium" where no driver can reduce their travel time by switching routes.

1.  **UE Assignment Execution:**
    *   Run `Path4GMNS.find_ue()`.
    *   The engine will calculate the "Cost" (Travel Time) for every possible path through the Tokai neighborhood.
2.  **Path Export:**
    *   Extract the resulting paths and their assigned volumes.
    *   *Result:* We will know exactly what percentage of vehicles "should" take each side street to minimize total network delay.

## Phase 3: Integration with React
**Goal:** Feed the professional routing data back into our live JavaScript engine.

1.  **Optimized Route Export:**
    *   Convert the Python output into `src/data/optimized-routes.json`.
    *   Format: `{ routeId: "1A-RR2", equilibrium_weight: 0.22, path: [1, 2, 3, 27, 22, 19, 16, 5, 6, 7] }`.
2.  **Engine Refactor:**
    *   Update `src/engine/spawner.js` to use `equilibrium_weight` instead of `ratRunThreshold`.
    *   This removes the "guessing game" from our logic; cars spawn on routes already balanced for the peak hour.

## Phase 4: Verification & TIA Alignment
**Goal:** Ensure the model matches the engineering expectations of the TIA report.

1.  **Validation Run:**
    *   Run the simulation in React.
    *   Use `analyze_traffic.py` to verify that the convergence at J4 (Starke/Christopher) is now handled by the "smart" route distribution calculated in Phase 2.
2.  **Reporting:**
    *   Update the route markdown reports to include the "Mathematical Basis" (User Equilibrium) for each route's utilization rate.

---

## Summary of Benefits
*   **Scientific Accuracy:** Rat-runs become an emergent behavior of congestion math, not a hard-coded script.
*   **Zero Latency:** The complex math is done pre-build. The browser remains fast and responsive.
*   **Engineering Authority:** The simulation logic now mirrors the analytical tools used by professional traffic engineers.
