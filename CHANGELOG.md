# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
