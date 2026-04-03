# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Added — 2026-04-03 (Simulation Engine Fixes & Modal Redesign)
- **SmokeBackground Component:** Created `src/components/SmokeBackground.jsx` — a zero-dependency WebGL2 animated smoke shader. Raw GLSL fragment shader (fbm noise, animated drift), vanilla JS Renderer class, React hook wrapper. Accepts `smokeColor` hex prop mapped to a GLSL `u_color` uniform. Used as the Access Barrier modal background.
- **Road Closed Block:** Added a prominent "✕ ROAD CLOSED ✕" notice to the Models/Under the Hood section with a full list of modelling exclusions: Sweet Valley school runs, Bergvliet local traffic, all exit traffic to Firgrove/Ladies Mile/Main Rd, and new traffic calming measures. Dark card on the light section background for maximum readability. Includes caveat that Avg Time Out figures are massively understated.

### Changed — 2026-04-03 (Simulation Engine)
- **Sim Start Time:** Clock display shifted from 06:30 to 06:40 (`baseMin = 6*60+40`) to skip the near-empty Gaussian tail at sim start. `SIM_START_OFFSET = 600` exported from `spawner.js` for the live engine.
- **Sim End Time (per scenario):** Added `SIM_END_SEC = { L: 9000, M: 9000, H: 10800 }` to `spawner.js`. H scenario now runs to 09:30 — the queue has not cleared by 09:00 under High demand.
- **Habitual Rat-Run Users:** Added `habitualRatRunProb` to `SCENARIO_CONFIG` (L: 6%, M: 8%, H: 10%). A base percentage of drivers always take rat-runs regardless of congestion level, representing commuters who know the shortcut and use it in both directions. Applies to all inbound rat-run corridors.
- **J8 Exit Hold (Children's Way / Ladies Mile):** Added dynamic queue-overflow hold for J8 egress, layered on top of the existing signal cycle. Peak hold ~12s centred at simTime 4800 (07:50), active 07:30–08:30. Models backlog from vehicles unable to clear the signal in a single phase during peak hour.
- **J1/J9/J13 Exit Hold Window:** Extended upper bound from simTime 8000 to 9000 to cover the full H scenario runtime.

### Fixed — 2026-04-03 (Modal)
- **Access Barrier — Overflow Bug:** Removed `bezel-outer` / `bezel-inner` wrapper divs from the modal (these map bezel classes forced `overflow: hidden` + `height: 100%` which clipped modal content and prevented scrolling). Modal now uses `barrier-card` and `barrier-content` only, with correct `overflow-y: auto`.
- **Access Barrier — Smoke Background:** Added `SmokeBackground` as an absolute-positioned layer behind modal content (`opacity: 0.18`). Modal content floats on top via `backdrop-filter: blur(4px)` + semi-transparent background (`rgba(241,245,241,0.88)`).

### Changed — 2026-04-03 (Models Section)
- **Road Tested Heading Restored:** ModelsSection title set back to "Road Tested" with "Under the Hood" eyebrow — reversed a parallel-edit regression.
- **Road Closed Notice Moved:** Moved modelling limitations notice from BentoBriefing to the top of ModelsSection with expanded, more readable copy.

### Added — 2026-04-03 (UI/UX Transformation & Mobile Optimization)
- **Mobile Responsive Infrastructure**: Implemented a comprehensive responsive strategy across all editorial sections. Briefing, Models, and Findings grids now stack gracefully into a single-column layout on mobile and tablet viewports.
- **Scroll-Aware Navigation**: Integrated an `IntersectionObserver` system that automatically synchronizes the navigation pill with the user's scroll position across the simulator and editorial sections.
- **Sticky Glassmorphic Header**: Refactored the top bar to be persistent (`sticky`), centered the telemetry stats pill, and balanced the grid for a more grounded, professional feel.
- **Interactive Briefing Cards**: Replaced static tech popovers with mobile-friendly, click-to-flip cards using React state, eliminating hover-dependency for touch devices.
- **Enhanced Visual Legend**: Upgraded the map legend with custom toggle pills and a formal shape vocabulary (Solid Circles, Rat-run Diamonds, Parked Squares) matching the telemetry spec.
- **Traff✱k Rebrand**: Officially renamed the application from "Tokai-Sim" to **Traff✱k**. Updated branding across the splash modal, navigation bar, and footer.
- **Lucide Icon Integration**: Replaced custom SVG and Braille icons with high-quality Lucide icons throughout the application for a more consistent and professional UI.
- **Themed Navigation Labels**: Replaced generic labels with immersive, car-themed terminology: "The Road Map" (Simulator), "The Damage Report" (Findings), "Under the Hood" (Models), and "Pit Stop" (Contact).

### Fixed — 2026-04-03 (Performance & Polish)
- **Deselected Card Collapse**: Implemented an auto-collapsing animation for deselected corridor cards, reducing their footprint to 48px to maximize vertical dashboard space.
- **Accessibility Floor**: Enforced a minimum typography floor of `0.65rem` (10.4px) across all telemetry labels and metadata to ensure WCAG compliance.
- **Token-Based Theming**: Systematically audited the CSS to replace hardcoded Tailwind hex values with formal design tokens (`--on-surface`, `--muted-text`, `--surface-watch`, etc.).
- **iOS Viewport Fix**: Switched main layout height from `100vh` to `100dvh` to resolve "hidden bottom" issues caused by browser chrome on mobile devices.
- **Reference Error & Parsing Fixes**: Resolved multiple `ReferenceError` crashes and JSX parsing errors caused by missing imports and "smart quotes".
- **Iconic Visual Language**: Significantly enhanced icon visibility by doubling sizes (`size={28-32}`) and increasing boldness (`strokeWidth={3}`) across primary telemetry displays.
- **Visibility Toggle Logic**: Fixed `Eye`/`EyeOff` icons to remain bright, high-contrast, and on top of cards, ensuring visibility even when corridors are deselected and faded.
- **Editorial Flow**: Introduced alternating section backgrounds (`canvas` -> `surface-low` -> `surface-high`) and thin accent strips to improve vertical rhythm and section differentiation.
- **Corridor Auto-Zoom**: Fixed a bug where selecting/deselecting corridor cards failed to zoom the map by stabilizing the map initialization effect and its dependencies.
- **SUMO & UXSim Playback Loop**: Fixed a `TypeError` in the playback interpolation engine that was silently killing the animation loop when results mode was active.
