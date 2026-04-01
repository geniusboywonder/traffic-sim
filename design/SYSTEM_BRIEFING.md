# System Briefing: TokaiSim Web Copy & Structure

## 1. Web Architecture: The Urban Control Center
To maintain the "Kinetic Sentinel" aesthetic, the website should follow a layered, high-fidelity structure that prioritizes data visualization while providing deep contextual "intelligence" sections.

### Primary Layout Sections:
1.  **The Command Header:** (Active) System Status, Global Controls, and the "Live vs. Results" toggle.
2.  **The Tactical Map:** (Active) Full-screen interactive visualization with Canvas-rendered vehicle telemetry.
3.  **The Analytics Sidebar:** (Active) Real-time stats, corridor congestion scores, and the "Watch My Road" analyzer.
4.  **The Intelligence Dossier (New):** A slide-up or scrolling Glassmorphic section containing the technical and analytical context detailed below.

---

## 2. The Intelligence Dossier: Copy Assets

### A. Mission Profile: Deconstructing the Morning Gridlock
> **MISSION PROFILE**  
> TokaiSim is a high-fidelity analytical engine designed to visualize and solve the complex congestion patterns surrounding Tokai High School. By simulating the 7:15 AM – 8:15 AM drop-off window, we identify critical bottlenecks at Ruskin and Christopher Roads, allowing urban planners and parents to test "what-if" scenarios in a risk-free digital twin.

### B. The Neural Engine: Multi-Model Intelligence
> TokaiSim operates on a tiered simulation architecture, combining real-time heuristic physics with validated microscopic and macroscopic models.
>
> #### 1. Real-Time Physics: The Intelligent Driver Model (IDM)
> The live simulation engine utilizes the **Intelligent Driver Model (IDM)** to calculate vehicle acceleration and gap-acceptance. This ensures that vehicles don't just "move"—they react to leaders, junctions, and congestion.
> *   **The Formula:** $accel = a \cdot [1 - (v/v_0)^4 - (s^*/s)^2]$
> *   **Dynamic Gap ($s^*$):** $s^* = s_0 + vT + \frac{v \cdot \Delta v}{2\sqrt{ab}}$
> *   **Parameters:**
>     *   $v_0$: Desired speed (Arterial: 60km/h, Collector: 40km/h, Local: 30km/h).
>     *   $T$: Safe time headway (1.5s - 2.5s).
>     *   $a / b$: Maximum acceleration (1.4 $m/s^2$) and comfortable braking (2.0 $m/s^2$).
>     *   $s_0$: Jam distance (2.0m).
>
> #### 2. Microscopic Validation: SUMO (Simulation of Urban MObility)
> For high-fidelity validation, we employ an end-to-end **SUMO pipeline**. SUMO models individual vehicle-to-vehicle interactions, including:
> *   **Infrastructure Precision:** Exact modeling of 28 speed humps and 11 unique junction control overrides.
> *   **Dynamic Rerouting:** Vehicles utilize the A* algorithm and `device.rerouting` to model natural "rat-run" emergence as primary corridors hit capacity.
> *   **Back-Pressure:** Realistic queuing logic on the school's internal one-way road, forcing physical congestion back onto the residential network.
>
> #### 3. Macroscopic Analysis: UXsim
> To ensure a canonical fit against the **TIA flow-density curves**, we utilize **UXsim**, a macroscopic traffic flow simulator. 
> *   **Grid-Scale Modeling:** UXsim processes the entire Bergvliet road network (726 ways) to validate total network throughput.
> *   **Scenario Comparisons:** Provides the foundation for our "L/M/H" scenario results, ensuring that trip generation exactly matches the TIA §13 percentages and trapezoidal arrival profiles.

### C. Data Calibration: Grounded in the TIA
> **DATA CALIBRATION**  
> The simulation is rooted in the official **Traffic Impact Assessment (TIA)** data. We utilize TIA-baseline trip generation rates, peak-hour traffic volumes, and corridor growth factors to ensure the digital environment mirrors real-world logistical constraints.

### D. Heuristic Parameters: Modeling the Human Factor
> **HEURISTIC PARAMETERS**  
> Beyond raw volume, we model the "Human Variable":
> *   **Dwell Dynamics:** Dynamic wait times at the school gate (7.5s - 15s) based on bay occupancy and student drop-off intervals.
> *   **Rat-Run Probability:** Vehicles actively reroute through residential corridors (Ruskin/Leyden) as primary arterials reach saturation.
> *   **Parking Logic:** Real-time tracking of 120 on-site bays and their impact on road back-pressure.

### E. Multi-Model Credibility: SUMO & UXSim Validation
> **MULTI-MODEL CREDIBILITY**  
> We don't just simulate; we validate.  
> *   **SUMO Pipeline:** Our microscopic simulation models individual vehicle-to-vehicle interaction, speed humps, and intersection signal timings.
> *   **UXSim Integration:** Provides a macroscopic fit against TIA flow-density curves.
> *   **The Result:** A "Live vs. Results" toggle that lets you compare theoretical flow against pre-computed, canonical traffic models.

### F. System Notice: Analytical Boundaries
> **SYSTEM NOTICE**  
> This simulator is a tool for pattern analysis and comparative scenario testing. While calibrated to TIA data and IDM physics, simulation results are stochastic and should be used as a supplement to, not a replacement for, professional engineering certifications.

### G. Contact: Direct Telemetry
> **ENCRYPTED UPLINK**  
> Have a scenario to test or an architectural inquiry?  
> **[CONNECT WITH THE ARCHITECT]**

---

## 3. Key Model & TIA Parameters

The following parameters represent the core configuration of the TokaiSim engine. These values are derived directly from the Traffic Impact Assessment (TIA) or calibrated to reflect realistic urban flow dynamics.

| Category | Attribute | Value | Source / Impact |
| :--- | :--- | :--- | :--- |
| **TIA Baseline** | Required Throughput | 840 veh/hr | TIA Peak Capacity Requirement |
| **TIA Baseline** | High Scenario Trips | 840 | TIA Baseline (100% Volume) |
| **TIA Baseline** | Medium Scenario Trips | 650 | 77% of TIA Baseline |
| **TIA Baseline** | Low Scenario Trips | 500 | 60% of TIA Baseline |
| **TIA Baseline** | Inbound Split: Dreyersdal N | 16% | TIA §13 Origin Distribution |
| **TIA Baseline** | Inbound Split: Homestead Ave | 30% | TIA §13 Origin Distribution |
| **TIA Baseline** | Inbound Split: Children's Way | 36% | TIA §13 Origin Distribution |
| **TIA Baseline** | Inbound Split: Firgrove Way | 18% | TIA §13 Origin Distribution |
| **Infrastructure** | Total Parking Capacity | 120 Bays | 98 On-site + 22 On-street |
| **Behavioral** | Drop-off Dwell Time | 45s | Simulated student discharge interval |
| **Behavioral** | Rat-Run Threshold | 6% - 10% | Corridor density before diversion |
| **Behavioral** | Max Rat-Run Probability | 85% | Peak diversion during high congestion |
| **Physics (IDM)** | Arterial Speed ($v_0$) | 60 km/h | Main Rd / Primary Corridors |
| **Physics (IDM)** | Collector Speed ($v_0$) | 40 km/h | Primary residential collectors |
| **Physics (IDM)** | Local Speed ($v_0$) | 30 km/h | Side-streets and rat-runs |
| **Physics (IDM)** | Safe Time Gap ($T$) | 1.5s - 2.5s | Follower-leader buffer |
| **Physics (IDM)** | Jam Distance ($s_0$) | 2.0m - 3.0m | Minimum bumper-to-bumper gap |
| **Junctions** | Stop/4-Way Delay | 4.0s - 8.0s | Minimum wait for clear intersection |
| **Junctions** | Yield Delay | 2.5s | Minimum gap for merging traffic |
| **Junctions** | Speed Hump Penalty | 1.2s | Physical traversal delay per hump |
| **Junctions** | Peak Egress Delay | 3s - 20s | External back-pressure (7:30-8:30) |
