# Tokai High School Traffic Simulator (TokaiSim)

TokaiSim is a high-fidelity, interactive traffic simulation tool designed to analyze and visualize morning drop-off congestion patterns around Tokai High School. It leverages the Intelligent Driver Model (IDM) to provide realistic vehicle behavior and follows a specialized "Kinetic Sentinel" design aesthetic.

## Project Overview

- **Core Purpose:** To simulate traffic flow, identify bottlenecks (e.g., Ruskin Rd, Christopher Rd), and evaluate different traffic management scenarios for Tokai High School.
- **Main Technologies:** 
  - **Frontend:** React 19, Vite 8, Leaflet 1.9.4.
  - **Simulation:** Custom JavaScript engine using the Intelligent Driver Model (IDM).
  - **Styling:** Vanilla CSS following a custom "Glassmorphic" HUD design system.
- **Architecture:**
  - `src/App.jsx`: Manages top-level simulation state (scenario, playback, speed, and statistics).
  - `src/components/SimMap.jsx`: The primary visualization component. It integrates Leaflet for the base map and a high-performance Canvas overlay for rendering individual vehicles within a `requestAnimationFrame` loop.
  - `src/engine/`:
    - `idm.js`: Implementation of the Intelligent Driver Model physics, acceleration formulas, and junction-specific hold/wait logic.
    - `routes.js`: Defines the road network, junction coordinates, and pre-calculated routes using road-snapping geometry.
    - `spawner.js`: Handles vehicle generation based on sim-time and selected traffic scenarios.
  - `src/data/`: Contains the underlying road network (`bergvliet-roads.json`) and geographic data.

## Building and Running

The project is a standard Vite-based React application.

- **Development:** `npm run dev` (Starts the Vite development server)
- **Production Build:** `npm run build` (Generates optimized assets in `dist/`)
- **Linting:** `npm run lint` (Executes ESLint with project-specific rules)
- **Preview:** `npm run preview` (Serves the production build locally)

## Development Conventions

### 1. Design System: "The Kinetic Sentinel"
Adhere strictly to `DESIGN.md`. The UI is conceptualized as a "Futuristic Urban Control Center."
- **Tonal Depth:** Never use 1px solid borders for layout. Define sections using background color shifts (e.g., `surface` to `surface_container_low`) and negative space.
- **Luminescence:** Use neon accents (`#8aebff` for active systems, `#ef4444` for congestion) against an abyssal foundation (`#0b1326`).
- **Glassmorphism:** HUD elements and floating panels should use `backdrop-filter: blur(20px)` and semi-transparent backgrounds.
- **Typography:** Use **Space Grotesk** for high-level system stats and headlines; use **Inter** for data labels and interactive UI.

### 2. Simulation Performance
- **State Management:** To maintain 60FPS, high-frequency simulation data (vehicle positions, velocity) is stored in **React Refs** within `SimMap.jsx` to avoid unnecessary React re-renders. UI-critical stats are pushed to React state at a throttled interval (e.g., 250ms).
- **Physics Stability:** `idm.js` employs a sub-stepping approach (splitting the frame `dt` into smaller increments) to ensure numerical stability at high simulation speeds.
- **Coordinate System:** While GeoJSON data uses `[longitude, latitude]`, the internal engine and Leaflet integration use `[latitude, longitude]`.

### 3. Traffic Logic
- **Junction Holds:** Each junction type (Stop, Yield, Traffic Signal, 4-Way Stop) has specific wait-time logic defined in `idm.js`.
- **Rat-Runs:** The engine explicitly models "rat-run" routes (yellow vehicles) to differentiate them from main arterial flow (blue vehicles).
- **Egress:** Vehicles transition from "inbound" to "dwell" at the school gate, then "outbound" for their exit route.

## Key Files
- `src/components/SimMap.jsx`: Core simulation loop and Leaflet/Canvas integration.
- `src/engine/idm.js`: Physics and acceleration logic.
- `src/engine/routes.js`: Network topology and route geometry.
## Mandatory Workflows

### 1. Change Logging
- **Action:** All code changes, additions, or removals MUST be documented in `CHANGELOG.md`.
- **Format:** Adhere to the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) standard.
- **Timing:** Log changes immediately after verification, within the same session.
