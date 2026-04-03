# Style Guide: Editorial Organicism (Sage Edition)
**Project:** Traff<span>✱</span>k v3.1  
**Creative North Star:** "The Curated Earth" — Architectural Monographs meets Botanical Mineralogy.

---

## 1. Color Palette: The Mineral Spectrum
A high-contrast mineral system designed for analytical precision within a calm botanical theme.

### A. Core Surfaces
| Token | Hex | Role |
| :--- | :--- | :--- |
| `canvas` | `#F1F5F1` | Main site background. |
| `surface-low` | `#E1E9E1` | Sidebar and secondary regions. |
| `surface-high` | `#D1DAD1` | Component cards and interactive widgets. |
| `surface-watch` | `#D0DDD0` | Watch My Road / Overall Summary card. Sage-tinted surface between `surface-high` and the 3A corridor card. |
| `on-surface` | `#111D13` | Primary body copy and headers (Carbon Black). |
| `muted-text` | `#717977` | Metadata, disabled states, and captions (Slate Gray). |

### B. Corridor Chromatics (Telemetry & Identity)
| Corridor | Hex | Name | Application |
| :--- | :--- | :--- | :--- |
| **1A** | `#111D13` | **Carbon Black** | Primary artery anchor. |
| **2A** | `#A1CCA5` | **Bright Celadon** | High-luminance botanical green. |
| **2B** | `#D0A679` | **Mineral Ochre** | Warm mineral break. |
| **3A** | `#709775` | **Muted Teal** | Cool medium-depth green. |

### C. Corridor Card Palette (Intelligence Cards)
Cards use light pastel backgrounds with dark text — each corridor's hue expressed as a soft gradient, accented by its dark base colour on the left border and congestion bar.

| Corridor | Background (from→to) | Accent / Border | Text (values) | Text (labels/muted) |
| :--- | :--- | :--- | :--- | :--- |
| **1A** | `#8FB89A` → `#6BA47A` | `#2D5438` | `#0E1C11` | `rgba(14,28,17,0.6)` |
| **2A** | `#A1CCA5` → `#7AAF82` | `#415D43` | `#132215` | `rgba(19,34,21,0.6)` |
| **2B** | `#E0B88A` → `#C49660` | `#8B5A28` | `#221808` | `rgba(34,24,8,0.6)` |
| **3A** | `#C8E0C8` → `#A4C4A8` | `#709775` | `#0F1E13` | `rgba(15,30,19,0.6)` |

---

## 2. Typography & Iconography
High-contrast type system and professional Lucide icons balancing precision with editorial breathing room.

### A. Font Families
- **Headlines/Metrics:** **Manrope** (Geometric, architectural).
- **Body/Labels:** **Work Sans** (Wide stance, high legibility).
- **Logo:** **Space Grotesk** (Bold, futuristic, high personality).

### B. Iconography (Lucide System)
Standardised icon set for telemetry and navigation. All primary telemetry icons use `strokeWidth={3}` for increased weight.

| Role | Icon | Size | Weight |
| :--- | :--- | :--- | :--- |
| **Traffic / Total** | `Car` | 28-32px | Bold (3) |
| **Time / Average** | `Timer` / `Clock` | 28-32px | Bold (3) |
| **Visibility** | `Eye` / `EyeOff` | 18px | Semi (2.5) |
| **Action** | `Play` / `Pause` | 16-20px | Solid |
| **Navigation** | `Map`, `Bot`, `Monitor` | 20px | Regular (2) |

---

## 3. Structural Philosophy: "The No-Line Rule"
**Borders are forbidden.** Boundaries are defined by tonal shifts and negative space.

- **Layout Separation:** Sidebar (`surface-low`) sits against Map/Canvas (`canvas`).
- **Nesting Hierarchy:** Canvas → Surface-Low (Region) → Surface-High (Card).
- **Responsive Pading:** Section vertical padding uses `--section-vpad: clamp(3.5rem, 7vw, 6rem)`.

---

## 4. Components & Interactive States

### A. Persistent Navigation (The Control Deck)
- **Traff<span>✱</span>k Logo:** Left-aligned, Space Grotesk, Carbon Black with Celadon `✱`.
- **Sticky Header:** Fixed at top, glassmorphic (`surface-low` @ 90% opacity, `20px` blur).
- **Scroll-Aware:** Nav items update active state automatically via IntersectionObserver.

### B. Summary Pill (Live Telemetry)
- **Layout:** Vertical stacks (Label over Value). Centered in header.
- **No-Wrap:** All values use `white-space: nowrap` to prevent jumping.

### C. Intelligence Cards (Sidebar)
- **Row-Based Layout:** 
    - Row 1: `Car` icon leading In/Out Traffic stat blocks.
    - Row 2: `Timer` icon leading In/Out Average Time stat blocks.
- **Auto-Collapse:** Deselected cards collapse to `48px` max-height.
- **Persistent Toggles:** `Eye` icons are always visible (`zIndex: 100`) and never faded.

---

## 5. Tactical Map & Telemetry
The map is a "Digital Twin" plotted as an architectural blueprint.

### A. Telemetry Symbolism (The Blueprint System)
| Vehicle Type | Shape | State |
| :--- | :--- | :--- |
| **Inbound Main** | ● **Solid Circle** | Arriving via primary route. |
| **Inbound Rat-Run**| ◆ **Solid Diamond** | Arriving via residential diversion. |
| **Egress Main** | ○ **Hollow Circle** | Exiting via primary route. |
| **Egress Rat-Run** | ◇ **Hollow Diamond**| Exiting via residential diversion. |
| **Parked** | ■ **Slate Square** | Static / Site Plan Plot Point. |

---

## 6. Mobile Responsiveness
- **Breakpoint (1024px):** Dashboard stacks; stats pill hides.
- **Breakpoint (768px):** Editorial grids collapse to single column; section backgrounds preserved edge-to-edge.
- **iOS Safari:** Uses `100dvh` for full-screen reliability.
