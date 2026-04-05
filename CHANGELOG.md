# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Fixed — 2026-04-05 (Mobile Layout — iPhone 14)

- **Horizontal overflow fixed:** `.narrative-block`, `.models-content`, and all 12-column grid children were overflowing the viewport on mobile. Root cause: `grid-column: span 9/12` on children forced implicit columns even when `grid-template-columns: 1fr` was set. Fixed by using `grid-column: 1 / -1 !important` on all grid children inside `.bento-content`, `.models-grid`, and `.models-content` at `max-width: 768px`.
- **Grid gap corrected:** `.bento-content`, `.models-grid`, `.models-content` gap reduced from `3rem` to `1.5rem` on mobile to prevent overflow contribution.
- **Footer overflow fixed:** `.footer-credits p` had `white-space: nowrap` causing `@geniusboywonder` and email to overflow. Changed to `white-space: normal; word-break: break-word; flex-wrap: wrap` on mobile. Footer padding reduced to `2.5rem 1.25rem`.
- **Road closed block:** Reduced `letter-spacing` on `.road-closed-header` from `0.2em` to `0.08em` and clamped font size to `clamp(0.9rem, 4vw, 1.2rem)` to prevent overflow on narrow screens. Padding tightened to `1.25rem 1rem`.
- **Findings section:** `.findings-col` padding reduced to `1rem` on mobile. `.findings-header .models-title` clamped to `clamp(1.5rem, 6vw, 2rem)`. `.findings-intro` font size reduced to `0.875rem`.
- **Models section:** `.models-intro p` reduced to `0.9rem`. `.pedigree-grid` forced to single column. `.model-entry` padding reduced to `1.25rem`. `.calibration-box` padding reduced to `1.5rem`.
- **Narrative text:** `.narrative-text-large` clamped to `clamp(1.1rem, 5vw, 1.5rem)`, `.narrative-text-medium` to `1rem`, `.narrative-text-body` to `0.875rem` on mobile.

### Added — 2026-04-05 (UI Polish & Production Prep)

- **Product tour:** 4-step spotlight walkthrough auto-activates on first visit after the access barrier. Steps: Map → Simulation controls → Live telemetry → Corridor cards. Spotlight uses box-shadow hole technique with animated green border pulse. Stores completion in `localStorage` — never shows again. Keyboard navigation (Enter/Space/Arrow keys/Escape). Help button (bold `HelpCircle` icon) in header resets and replays the tour.
- **Share buttons fixed:** Removed native Web Share API — always shows explicit WhatsApp, X, and Email buttons. Prevents macOS/iOS share sheet opening unwanted local app options. Icons enlarged to 20px for better proportion.
- **School site marker:** Zoom-responsive `Warehouse` SVG icon anchored at school coordinates (-34.05171, 18.44881). Scales with map zoom (16px base at zoom 14, doubles per level). Drop-shadow pulse animation matches entry/exit point beacons.
- **Entry/exit point beacons:** J1 (Main Rd), J8 (Children's Way), J9 (Homestead), J13 (Firgrove) each have a pulsing circle DivIcon overlay in their corridor colour. Same `school-shadow-pulse` animation with staggered delays.
- **School internal road line:** Dashed grey line restored on canvas showing the internal road geometry (J7→J20).
- **Scroll hint:** Animated mouse-wheel icon below corridor cards prompts users to scroll down to editorial sections. Slow fade pulse, disappears on mobile.
- **Footer OSS credits expanded:** Added OpenStreetMap, geojson.io, and Overpass Turbo to the open-source contributors list.
- **Footer credits block:** Reduced font sizes (1.25rem→0.85rem) and added `white-space: nowrap` to prevent wrapping on smaller viewports.
- **Damage Report updated with final model numbers:** Header stats: 32min→26min (Lab H mean), 108→68 vehicles after 08:30. Write-off: corrected to 18min (Live)/26min (Lab), 11min stopped (both models agree to 6 seconds). Fender-bender: school gate rewritten as 6-min crawl; added Aristea single-exit and Dante/Vineyard egress bottleneck bullets. Side-swipe: peak timing updated to 07:52–08:14 range; rat-run updated to 1-in-4/25.6%; Vineyard/Dante egress finding added.
- **Findings cards compressed:** Badge and heading merged onto one line. Padding/gap tightened then restored to fill available space after removing duplicate content.
- **Log download buttons commented out:** LOG and ROAD LOG CSV buttons hidden for production. Re-enable by uncommenting in `SimMap.jsx`.
- **Code review fixes:** `parseInt(jid)` removed from hot path (7 calls per junction per frame). `conflictRoads` objects hoisted to module-level constants. `trafficHold` closure inlined. `EGRESS_ROUTES` stale export removed from `routes.js`. `school-shadow-pulse` keyframe added to `App.css`.
- **Sim clock starts at 06:30:** `SIM_START_OFFSET` set to 0. Clock now correctly shows 06:30 at sim start matching SUMO/UXSim playback.
- **1A-NORTH merged into Firgrove Way corridor card:** Both Dreyersdal entry points (South 14% + North 11%) now display under the Firgrove Way card (J13 junction). Main Rd card shows Dreyersdal South only. TIA Highway Code card updated to reflect combined 14% Firgrove entry.

### Changed — 2026-04-04 (Simulation Engine — Egress & Physics Fixes)

- **Egress route expansion:** Added EG-F (Ruskin→Clement→Leyden→J8) and EG-G (Ruskin→Starke→J9) — vehicles turning left from the Aristea/Ruskin roundabout (J29) onto Ruskin Rd. These routes conflict with inbound traffic at J7 (school ingress), modelling the real back-pressure where exiting parents must yield to arriving parents on Ruskin/Leyden. Share: 5–6% of egress traffic.
- **Egress weights rebalanced:** Previous weights were heavily skewed toward EG-A (40% in H). Rebalanced to spread load across all 7 routes: EG-A/EG-C each 22% in H (both use Airlie Rd), EG-B 18%, EG-D/EG-E 13% each (Firgrove/Homestead, reduced due to Sweet Valley back-pressure), EG-F/EG-G 6% each (Ruskin routes).
- **EG-C route corrected:** EG-C now correctly routes Dante→Airlie south→Tussendal→Dreyersdal Farm Rd→Main Rd (J29→J17→J14→J23→J21→J2→J1), providing a shorter Airlie leg to Main Rd that bypasses the Vineyard/Christopher congestion.
- **Aristea/Ruskin roundabout hold reduced:** J29 hold reduced from 2.5s to 1s. The previous 2.5s was creating artificial queuing at the one junction every vehicle must pass through, contributing to Dante/Aristea deadlocks.
- **Outbound junction holds fixed:** Outbound vehicles were incorrectly receiving holds at intermediate residential junctions (stop_directional, 4way_stop) calibrated for inbound traffic. Root cause: J22 (Starke/Airlie, `stop_directional`) was applying a 5s hold to EG-A vehicles travelling Vineyard→Airlie→Starke northbound — the opposite direction to the intended inbound restriction. Fixed by restoring the directional check: hold only applies when `fromJid` is J4 or J24 (Starke approach), not J19 (Airlie approach).
- **Rat-run divergence window widened:** Mid-route rat-run switching trigger distance increased from 15m to 50m. At 8m/s vehicles were passing divergence waypoints before the check fired, resulting in only 9 mid-route switches for 508 H vehicles. The 50m window gives vehicles adequate time to switch routes when congestion builds.
- **EXIT log event added:** `SimMap.jsx` now logs an `EXIT` event when each vehicle leaves the network, including `totalTrip` (full round-trip seconds) and `egressRoute` in the detail field. Enables accurate round-trip time measurement in `compare_models.py`.
- **Egress start time null guard:** Fixed bug where `v.dwellStart` could be `null` for vehicles that transitioned without completing the dwell state, causing `null + 45 = 45` — a wildly incorrect egress start time. Now falls back to current sim time if `dwellStart` is null.
- **compare_models.py — EXIT-based trip times:** `parse_idm()` now uses the `EXIT` event timestamp for full round-trip time calculation, falling back to `OUTBOUND_START` for older logs without EXIT events.
- **compare_models.py — SUMO inbound/egress split:** `parse_sumo()` now streams the FCD XML to find each vehicle's first appearance on `school_internal_road`, enabling accurate inbound/egress leg split for SUMO (M: 14.3min inbound / 8.4min egress; H: 16.4min / 8.4min).
- **compare_models.py — clock fix:** `sec_to_clock()` was double-adding the 06:30 base offset, showing all times as PM. Fixed to convert absolute seconds-since-midnight directly.

### Changed — 2026-04-04 (Model Accuracy Audit — TIA Recalibration)

- **Scenario volumes corrected to TIA inbound counts:** The 840 in TIA Annexure B (COTO TMH17 Code 530) is total two-way trips — 420 unique vehicles each making one inbound + one outbound trip. Both Live and SUMO spawn inbound-only, so spawned count = inbound vehicle count. Previous volumes (L:500, M:650, H:840) were ~50–67% over TIA. Corrected to L:336 (TIA×0.80), M:420 (TIA exact), H:504 (TIA×1.20). Standard ±20% sensitivity band around the TIA baseline.
- **H scenario framing:** H is not just higher volume — it changes routing behaviour on the 1A corridor. Sweet Valley Primary (~200m away on Firgrove Way) runs concurrently. We don't model Sweet Valley volumes (unknown), but we model the consequence: Dreyersdal Rd is already congested when Tokai High vehicles arrive from the north, so they divert earlier onto Firgrove Service Rd or Starke rat-runs. Editorial framing: *"M is what the TIA predicts. H is what happens when car dependency is slightly higher and Dreyersdal is already congested from Sweet Valley Primary next door."*
- **1A-NORTH corridor added (Dreyersdal North):** Dreyersdal Rd runs east-west with two entry points. The previous model only had 1A (J1/Main Rd, Dreyersdal South = 13%). The TIA's "North along Dreyersdal" (11%) — traffic entering at the Firgrove Way/Dreyersdal junction (J13) and travelling east to the school — was entirely missing. Added `1A-NORTH` route (J13→J15→J18→J4→J5→J6→J7) with two rat-runs. J13 now correctly serves two corridors: 1A-NORTH (east on Dreyersdal) and 3A (south on Starke). The 1A corridor card in the UI merges both Dreyersdal entries.
- **TIA-aligned corridor splits:** Previous splits were incorrect. Corrected to: 2B Children's Way 47% (25% external + 22% Starke N+S local), 2A Homestead 25% (21% + 4% Christopher local), 1A Dreyersdal South 14% (13% + 1% Ruskin local), 1A-NORTH Dreyersdal North 11% (pure external), 3A Firgrove/Starke 3% (all local). Total = 100%.
- **Local vehicle tagging (`isLocal`):** The TIA's 30% local traffic (Starke, Christopher, Leyden, Ruskin residents) originates inside the network. Rather than adding mid-network spawn points, local traffic is absorbed into the nearest external corridor with adjusted behaviour. Each spawned vehicle is tagged `isLocal: true` at the fraction matching its corridor's local share (2B: 47%, 2A: 16%, 1A: 7%, 3A: 100%, 1A-NORTH: 0%). Local vehicles get 3× habitual rat-run probability (they know the area).
- **Rat-run thresholds recalibrated:** L: threshold 15%, habitual 0.5%. M: threshold 10%, habitual 1%. H: threshold 6%, habitual 3%. H/1A gets an additional +8% habitual boost (Sweet Valley back-pressure on Dreyersdal). Previous values were too aggressive for L/M.
- **Scenario-aware egress routing:** `pickEgressRoute()` was previously random with fixed weights. Now scenario-aware: H shifts weight toward Children's Way J8 (40%, signal self-regulates) and Main Rd J1 (25% overflow), away from Firgrove J13 (10%) and Homestead J9 (10%) which are congested by Sweet Valley egress traffic. L/M weights unchanged (30/20/15/15/20).
- **Local vehicle egress bias:** Local residents exit via nearest perimeter point. Starke/2B locals bias toward Firgrove J13 and Homestead J9. Christopher/2A locals bias toward Homestead J9. Leyden/3A locals bias toward Firgrove J13. In H scenario, Sweet Valley back-pressure halves the local bias toward J9/J13, pushing locals toward Children's Way J8 and Main Rd J1 instead.
- **UI copy updated:** TIA Highway Code card corrected — inbound vehicles L:336/M:420/H:504; corridor splits updated to match audit. Engine Specs rat-run threshold range corrected to 6–15% (was 6–10%).

### Changed — 2026-04-04 (Share, Copy, UI Polish)

- **Share Buttons:** Added share widget to top-right header slot. Uses native Web Share API on mobile/modern desktop (opens OS share sheet). Falls back to WhatsApp, X and Email icon buttons on older desktop. Styled to match the glassy nav/stats pill. URL: `https://traffic.adamson.co.za`.
- **Findings Section — Full Copy & Structure Rewrite:** Restructured three columns around clear message themes: Write-off = The Congestion, Fender-bender = The Bottlenecks, Side-swipe = The Routes. "Three models, one answer" moved to Write-off as validation. "Rat-run" bullet moved to Side-swipe; rewritten to distinguish main collector roads from final-approach convergence. Christopher Rd bullet corrected: it's the main-route convergence point; rat-run bypasses (Clement/Leyden, Dante/Ruskin) named and clarified.
- **Road/Junction Styling Convention:** Road names in bold (`**Vineyard Rd**`), junction intersections in italic (`*Starke/Christopher*`). Removed `.road-name` chip style.
- **Road Name Abbreviations:** Standardised across all visible text — Road → Rd, Avenue → Av. Applied to App.jsx copy, SimMap legend, corridor labels, junction popups, playback labels.
- **Road Closed Block:** Dark red `#1e0a0a` background, solid `2.5px #C47070` border with glow. Intro reframed as "inbound school traffic only". List items wrapped in `stat-pill--dark` hover cards with context. Footer: "Every exit time shown is a minimum bound."
- **Stat-pill Tooltips:** Fixed invisible text (was `color: var(--canvas)` — circular CSS ref). Hardcoded `#1a2a1d` bg + `rgba(241,245,241,0.95)` text.
- **Speed Hump Count:** Corrected from 28 to 14 (excluded Main Rd and Ladies Mile which don't affect the model).
- **Player Toolbar:** Moved from bottom of map to top (`top: 0.75rem`).
- **Initial Map Zoom:** Tighter bounds with minimal padding so entry points and school sit at viewport edge.
- **Findings Stat Numbers:** Reduced font size from `clamp(2–3rem)` to `clamp(1.4–1.9rem)` so all three blocks fit without scrolling.
- **UXSim renamed "Validation model":** In all copy outside the Under the Hood section. Under the Hood retains SUMO/UXSim by full name for credibility.
- **Under the Hood Entry ④:** Renamed from "UXSim — Network-Level Confirmation" to "Validation — Network-Level Confirmation".
- **Access Barrier:** Button moved from full-width footer into left narrative column, bottom-aligned with Road Warning card. "Just be lekker" moved into Road Warning card as separator block. Sub-text colour fixed. Disclaimer updated to include WCED and City of Cape Town.
- **J-number references removed:** All J4, J5, J8 etc. replaced with plain-language junction descriptions in visible copy.
- **Neill Adamson footer link:** Name links to `https://neill.adamson.co.za/`; `@geniusboywonder` keeps X link separately.

### Changed — 2026-04-03 (Access Barrier Transformation)
- **Full-Screen Hero Redesign:** Replaced the centered card modal with a high-fidelity, full-screen "Hero" introduction.
- **Improved Visual Fidelity:** Increased the prominence of the `SmokeBackground` WebGL animation and added a radial "veil" gradient for better text legibility and depth.
- **Component Extraction:** Moved `AccessBarrier` to its own component file (`src/components/AccessBarrier.jsx`) for better maintainability.
- **Responsive Layout:** Implemented a refined 12-column grid for large screens that stacks gracefully on mobile, with polished typography using `clamp()` for fluid scaling.
- **Enhanced "Start" Action:** Upgraded the "Start the Engine" button to a more prominent, high-contrast pill with hover elevation and color shifts.

### Changed — 2026-04-03 (Production Readiness & UI Fixes)
- **Star Logo Integration:** Updated site title, meta tags, and favicon to use the official ✱ symbol for consistent Traff✱k branding.
- **Ad Relocation:** Moved Google AdSense from the top of the page to the "Damage Report" (Findings) section. This ensures the simulator is the first thing users see while maintaining ad visibility near key analytical content.
- **Header Spacing Fixed:** Eliminated the large empty gap between the navigation bar and the map by refactoring the top-level layout grid and removing redundant padding.
- **Footer Legibility & Padding:** Refined the dark footer for better accessibility. Brightened grey text to `rgba(241, 245, 241, 0.8)`, improved link contrast using a brighter green (`#A1CCA5`), and reduced excessive padding.
- **Log Downloads Hidden:** Commented out the "LOG" and "ROAD LOG" CSV download buttons from the simulator controls for a cleaner production UI.
- **Build System Fix:** Corrected `vite.config.js` by removing the invalid `mockup.html` entry, allowing successful production builds.

### Fixed — 2026-04-03 (CSS)
- **Under the Hood Grid Layout:** Fixed a layout regression where the models-content section failed to span the full width of its parent container. Implemented a refined 2-column grid: entries 1 & 2 share Row 1, entries 3 & 4 share Row 2, and entry 5 spans both columns on Row 3. Adjusted padding and typography constraints for better visual balance in the 2nd column layout.
- **App.css line 1338 — Stray `}` removed:** Orphaned closing brace from a parallel UI edit caused PostCSS parse failure. Removed stray brace and duplicate `.model-entry-body` rule block that followed it (parallel team's version retained).

### Changed — 2026-04-03 (Findings Section Rewrite)
- **Intro stats row:** Replaced single intro paragraph with a 4-stat highlight row — free-flow baseline (~7 min), Lab H mean trip (~32 min), vehicles at 08:30 (108), and model count (3). Alert numbers styled in `#C47070`.
- **Write-off copy updated:** Two bullets with real model data. Key numbers — 108 vehicles, 192 vehicles, 7 min, 32 min, 16 min stopped, 1-in-20 takes an hour — wrapped in `.stat-pill` with `data-source` tooltips on hover.
- **Fender-bender copy updated:** School gate bottleneck (33s → 71s UXSim delay L→H) and rat-run structural loading (Dreyersdal #1 in M/H, Ruskin 74–106s, Vineyard 86s). All key numbers hoverable.
- **Side-swipe copy updated:** Queue peaks at 08:15 not 07:45 (Lab model), and cross-model convergence on school internal road + Dreyersdal/Vineyard corridor.
- **UXSim limitation card removed:** "What UXSim cannot tell us" block removed per brief — this is covered in the Under the Hood section.
- **Width expanded:** `.findings-section` padding-inline tightened to `clamp(1rem, 3vw, 2.5rem)` (was `1.5rem`); `.findings-grid` max-width raised from 1400px to 1600px.
- **`.stat-pill` component:** Dashed underline on key numbers; CSS `::after` tooltip shows `data-source` on hover (model/scenario attribution).

### Changed — 2026-04-03 (Model Naming: Live / Lab)
- **Player control toggle:** SUMO button label changed from "SUMO" to "Lab". Internal `id` value remains `'sumo'` — no logic changes. Tooltip updated to "Pre-run lab simulation (SUMO microscopic model)".
- **Under the Hood copy:** Entry ③ heading updated to "Lab — Professional Cross-Check". All body copy references to "SUMO" as a user-facing term replaced with "the Lab model" or "Lab model". SUMO is still mentioned by full name once for credibility ("The Lab model runs on SUMO...").
- **Findings section copy:** "SUMO's microscopic simulation" → "the Lab simulation"; "SUMO records ~480 vehicles" → "the Lab model records ~480 vehicles"; "UXsim and SUMO identify" → "UXSim and the Lab model identify".
- **Rationale:** General visitors don't know what SUMO is without reading deep editorial copy. "Live" and "Lab" are immediately understood: Live = interactive browser simulation, Lab = pre-run scientific/professional model.

### Changed — 2026-04-03 (Under the Hood Section Rewrite)
- **ModelsSection — Full Copy & Structure Rewrite:** Replaced the previous two-entry layout with a five-entry numbered chain narrative. Entries: ① The Foundation (TIA), ② Our Live Simulation, ③ SUMO — Professional Cross-Check, ④ UXSim — Network-Level Confirmation, ⑤ Reading the Instruments (discrepancies). Copy rewritten to clearly communicate the validation hierarchy: build on TIA → validate with SUMO → cross-check SUMO & Live with UXSim.
- **Intro Text Added:** New `models-intro` block (span 8, paired with header span 4) with lead copy: "Three independent models. One consistent conclusion."
- **Road Closed Block Repositioned:** Moved from standalone full-width block before content into the bottom of `models-content`, framed as an important note concluding the section.
- **Chain Badge Component:** Added `.model-chain-badge` (numbered circle ①–⑤) beside each entry header, communicating the sequential validation chain visually.
- **Layout Change:** `models-content` now spans 12 columns (was 8) — full-width layout suits the linear narrative better than the previous side-by-side column with empty header space.
- **UXSim Framing Corrected:** UXSim is no longer presented as a co-equal model alongside SUMO. Its role is clearly scoped as network-level throughput validation only — it does not model speed humps, junction behaviour, or rat-run decisions.

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

### Fixed — 2026-04-03 (UI Refinements & Mobile Optimization)
- **Corridor Card Visibility:** Restored visibility of congestion graphs and breakdown text for all corridor cards. Removed the aggressive 48px collapse on deselected cards to ensure telemetry remains accessible.
- **Stats Panel Density:** Systematically reduced padding, margins, and typography sizes across the `StatsPanel`, `StatBlock`, and `CorridorCard` components. This ensures all telemetry fits within the vertical boundary of the map viewport while maintaining readability.
- **Global Sticky Navigation:** Moved the top navigation bar outside the main simulator layout, ensuring it remains persistent and "sticky" across the entire application, including the editorial sections.
- **Initial Map Viewport:** Optimized the initial map zoom to ensure all four entry points and the school frontage are clearly visible within the viewport on startup.
- **Mobile Map Optimization:** Implemented mobile-specific zoom logic that focuses directly on the study area (the school zone) without the darkened peripheral map, providing a cleaner experience on smaller screens.
- **Navigation Synchronisation:** Fixed a bug where the active navigation pill would fail to transition correctly during page scrolling.
