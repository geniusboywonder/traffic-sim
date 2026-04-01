# Design Refresh Plan: Editorial Organicism (Sage Edition)

This document provides the full architectural specification for transitioning TokaiSim from its legacy dark HUD to a high-end, botanical editorial experience.

## 1. The Core Palette: "Botanical Sage"
Inspired by terrestrial minerals and cool greens, this palette rejects sterile white/black in favor of organic depth.

| Tone | Hex | Application |
| :--- | :--- | :--- |
| **Canvas** | `#F1F5F1` | Main site background. |
| **Surface Low** | `#E1E9E1` | Sidebars, secondary layout regions. |
| **Surface High** | `#D1DAD1` | Component cards, interactive widgets. |
| **Surface Highest** | `#B9C4B9` | Hover states, active selections. |
| **Primary (Brand)** | `#415D43` | Hunter Green. High-contrast headlines, primary CTAs. |
| **Secondary (Teal)** | `#709775` | Muted Teal. Secondary indicators, corridor accents. |
| **On-Surface (Text)**| `#111D13` | Carbon Black. Primary body copy and headers. |
| **Muted Text** | `#717977` | Slate Gray. Metadata, disabled states, captions. |
| **Accent (Egress)** | `#C27D60` | Copper. Dedicated to outbound flow and exit states. |
| **Accent (Delay)** | `#A64D4D` | Crimson Earth. Dedicated to congestion and active alerts. |

---

## 2. Telemetry Symbolism: "The Blueprint System"
To ensure analytical clarity in a botanical palette, we move from color-shading to **State-Based Shape Language**.

### A. State Logic (The Fill)
- **Ingress (Flow In):** **Solid Fill**. Represents heavy, purposeful entry into the system.
- **Egress (Flow Out):** **Hollow Stroke (2px)**. Represents light, exiting "ghost" paths.

### B. Route Logic (The Shape)
- **Main Corridors:** **Circles**. Feels steady and constant.
- **Rat-Runs:** **Diamonds (45° Square)**. Feels technical and divergent.
- **Parked/Dwell:** **Small Squares (■)**. Represents static "plotted" points on a site plan.

### C. Condition Logic (The Alert)
- **Congested:** **Active Pulse Halo**. An animated ring (`--delay` color) that expands from the vehicle shape, regardless of its state (Solid or Hollow).

---

## 3. Structural Philosophy: "The No-Line Rule"
**Explicit Constraint:** Never use `1px solid` borders to section the UI. 
- **Separation:** Achieved solely through tonal shifts (e.g., a `Surface Low` sidebar on a `Canvas` body).
- **Negative Space:** Use generous margins (`spacing-16` or `5.5rem` between major sections) to imply boundaries.
- **Elevation:** Use "Sunlight Shadows" only for floating elements:
  `box-shadow: 0 24px 48px -12px rgba(17, 29, 19, 0.08);`

---

## 4. Components & Interface

### A. The Command Header (Toolbar)
- **Aesthetic:** Glassmorphic navigation (`Surface Low` @ 85% opacity with `24px` backdrop blur).
- **Logo:** `Primary Green` mark using **Manrope** typography.
- **CTAs:** Gradient-filled buttons transitioning 135° from `Primary` to `Moss Green` (`#5B7A5D`).

### B. Stats Panel (The Sidebar)
- **Background:** `Surface Low` (`#E1E9E1`).
- **Cards:** `Surface High` (`#D1DAD1`) with `4px` rounded corners.
- **Metrics:** Use `Manrope` (Light/300 weight) for large values to create an expensive, mathematical feel.

### C. The Tactical Map (SimMap)
- **Map Filter:** Apply a muted grayscale/sepia CSS filter to Leaflet tiles to integrate with the Sage palette.
- **Road Geometry:** Muted `Primary` lines at 25% opacity.
- **Vehicle Rendering:** Use the **Blueprint System** detailed in Section 2.

---

## 5. Imagery & Typography

### A. Typography Scale
- **Display-LG (3.5rem):** Manrope. Letter spacing `-0.02em`. Used for "Hero" moments.
- **Headline-MD (1.25rem):** Manrope Bold. Used for component headers.
- **Body-LG (1rem):** Work Sans. Line height `1.6`. Used for all descriptive text.

### B. Imagery Handling
- **Off-Grid Layouts:** Images should intentionally overlap two surface containers (e.g., bleed from the map into the sidebar).
- **Botanical Overlays:** Use high-contrast architectural photography with a subtle green color-wash or duotone filter matching the Sage palette.
- **Corner Radius:** Standardized `0.5rem` (8px) for all graphical assets.

---

## 6. Implementation Roadmap
1. **Global Tokens:** Define CSS variables in `:root`.
2. **Typography Reset:** Import Manrope and Work Sans; strip all Inter/Space Grotesk references.
3. **The Shell:** Update `App.jsx` and `Header.jsx` to remove borders and apply the Glassmorphic toolbar.
4. **The Engine:** Update `SimMap.jsx` canvas rendering to draw the new shape archetypes (Diamonds/Rings).
5. **The Sidebar:** Refactor `StatsPanel` to use the tonal layering and updated metrics typography.
