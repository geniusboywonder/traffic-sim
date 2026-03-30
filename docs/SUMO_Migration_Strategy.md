# Tech Stack Transition: JavaScript IDM to Python SUMO

This document evaluates the feasibility and strategic plan for migrating the Tokai High School Traffic Simulator from its current React/JavaScript implementation to the industry-standard **SUMO (Simulation of Urban MObility)** Python stack.

## Executive Recommendation: Start from Scratch (for the Engine)

It is highly recommended to **start from scratch** regarding the network data and simulation engine. The effort to convert our custom GeoJSON and JavaScript IDM logic into SUMO's XML-based format exceeds the effort of using SUMO's native import tools.

### Why SUMO?
*   **Microscopic Fidelity:** Native support for multi-lane physics, lane-changing (MOBIL), and complex gap acceptance.
*   **Validated Logic:** 20+ years of engineering research into intersection priority and "backpressure" waves.
*   **Native Rat-Runs:** Vehicles dynamically recalculate routes based on real-time congestion (A* / DUAROUTER) rather than fixed probabilities.

---

## 1. Tech Stack Comparison

| Feature | Current Build (React/JS) | Proposed Build (SUMO/Python) |
| :--- | :--- | :--- |
| **Physics Model** | Simplified Linear IDM | Validated Krauss/IDM/Wiedemann |
| **Junction Control** | Manual Directional Logic | Professional NEMA/Priority Rules |
| **Data Format** | GeoJSON / JSON | XML (Net/Rou/Add) |
| **Platform** | Static Web (client-side) | Desktop Application / Server-side |
| **Development Speed** | High (Rapid UI iteration) | Medium (Learning curve for tools) |
| **TIA Compatibility** | High (Visual/Communication) | Very High (Engineering Validation) |

---

## 2. Migration Plan

### Phase 1: Network Recreation (netconvert)
*   **OpenStreetMap Import:** Use `osmWebWizard.py` to download the Bergvliet/Tokai bounding box.
*   **Refine in `netedit`:**
    *   Add the **internal school road** (J7 to J20) manually.
    *   Set junction types to `priority` and manually define the "Stop-free Starke Rd" flow by adjusting edge-to-edge connections.
    *   Apply the `direction_only` constraints from our current `simulation-data.json`.

### Phase 2: Demand Translation (TraCI)
*   **Spawn Logic:** Port the Gaussian peak distribution (7:30 AM peak) from `spawner.js` to a Python script using the TraCI API.
*   **Route Mapping:** Translate our 17 inbound and 4 egress routes into `<route>` tags in a `.rou.xml` file.
*   **Dwell Time:** Implement the 45s drop-off using the `<stop>` element on the internal school road edges.

### Phase 3: Deployment Options
*   **Option A: Desktop Tool:** Run as a local Python script using `sumo-gui`. Best for internal analysis and generating high-res videos.
*   **Option B: Web Hybrid:** Use Python to run the simulation and a WebSocket bridge (FastAPI) to stream vehicle coordinates to the existing **React/Leaflet** front-end. This preserves the `traffic.adamson.co.za` web presence.

---

## 3. Impact Assessment

### Benefits
1.  **Zero "Phantom" Braking:** SUMO handles opposite-direction traffic on single-line roads without coordinate-clash bugs.
2.  **Realistic Queues:** Vehicle lengths and inter-vehicle gaps are physically modeled, resulting in accurate "backup" visualization on Ruskin and Starke Roads.
3.  **Audit Ready:** Results are directly comparable to Sidra/Traffix outputs used in the TIA report.

### Risks & Costs
1.  **Deployment Complexity:** Moving away from a static site requires a server/container to run the Python simulation.
2.  **UI Fragmentation:** The seamless "Play/Pause" controls in the current dashboard would need a complex bridge to talk to the Python background process.

---

## Next Steps
1.  Install SUMO locally.
2.  Run an initial `netconvert` on the Tokai area.
3.  Verify the "Stop-free Starke Rd" logic in the `sumo-gui` visualizer.
