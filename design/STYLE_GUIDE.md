# Style Guide: Editorial Organicism (Sage Edition)
**Project:** TokaiSim v3.0  
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
| `surface-watch` | `#D0DDD0` | Watch My Road / Overall Summary card. Sage-tinted surface between `surface-high` and the 3A corridor card — distinguishes the primary summary card without competing with the coloured corridor cards. |
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

Stat block insets use `rgba(255,255,255,0.28)` (frosted white). Congestion bar track uses `rgba(0,0,0,0.12)`. Hot/stopped accent: `#8B1A1A` (dark crimson, readable on light backgrounds).

The **Watch My Road** card uses `surface-watch` (`#D0DDD0`) with the same dark-text convention: values `#0F1E13`, labels `rgba(15,30,19,0.55)`.

### C. Condition Accents
| State | Hex | Name | Rationale |
| :--- | :--- | :--- | :--- |
| **Delay** | `#A64D4D` | **Crimson Earth** | Subdued red for congestion/distress. |
| **Egress** | `#C27D60` | **Copper** | Warm mineral for system exits. |

---

## 2. Typography: The Engineered Voice
High-contrast type system balancing precision with editorial breathing room.

### A. Font Families
- **Headlines/Metrics:** **Manrope** (Geometric, architectural).
- **Body/Labels:** **Work Sans** (Wide stance, high legibility).

### B. Typographic Hierarchy
| Role | Size | Font | Weight | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Display-LG** | `3.5rem` | Manrope | 800 | Hero titles, `-0.02em` tracking. |
| **Headline-MD** | `1.25rem` | Manrope | 700 | Component titles. |
| **Sim Clock** | `1.1rem` | Manrope | 500 | `tabular-nums` for playback stability. |
| **Metric-XL** | `1.5rem` | Manrope | 300 | Large data values. |
| **Body-LG** | `1rem` | Work Sans | 400 | `1.6` line-height for readability. |
| **Label-SM** | `0.65rem` | Work Sans | 700 | Uppercase, `0.1em` letter-spacing. |

---

## 3. Structural Philosophy: "The No-Line Rule"
**Borders are forbidden.** Boundaries are defined by tonal shifts and negative space.

- **Layout Separation:** Sidebar (`surface-low`) sits against Map/Canvas (`canvas`).
- **Nesting Hierarchy:** Canvas → Surface-Low (Region) → Surface-High (Card).
- **Elevation:** Use "Sunlight Shadows" only for floating modals:  
  `box-shadow: 0 24px 48px -12px rgba(17, 29, 19, 0.08);`

---

## 4. Components & Interactive States

### A. The Control Deck (Header)
- **Aesthetic:** Glassmorphic (`surface-low` @ 85% opacity, `24px` blur).
- **Buttons (Default):** No border. Background `surface-high`. Text `on-surface`.
- **Buttons (Active):** 135° Gradient (`primary` → `primary-container`). Text `canvas`.
- **Buttons (Hover):** Background `surface-highest`.

### B. Intelligence Cards (Sidebar)
- **Identity:** `3px` left-border using the corridor **Accent / Border** colour (see §1C).
- **Background:** Light pastel gradient per §1C. Dark text throughout — see §1C for values.
- **Stat Blocks:** Frosted-white inset (`rgba(255,255,255,0.28)`), `8px` radius.
- **Congestion Meter:** Single horizontal bar — fill colour is the corridor Accent; `#8B1A1A` when stopped > 70%. Track: `rgba(0,0,0,0.12)`.
- **Breakdown Row:** `% active | % slowing | % stopped` at 7px uppercase. Stopped segment uses `#8B1A1A` when hot.
- **STOPPED Badge:** Appears on corridor card header when congestion > 70%. Crimson Earth tones.

### C. Road Analyzer (Watch My Road)
- **Aesthetic:** High-contrast "Black Box" (`on-surface` background).
- **Title:** `c-3a (Celadon)` for the street name to signify "Active Selection."

---

## 5. Tactical Map & Telemetry
The map is a "Digital Twin" plotted as an architectural blueprint.

### A. Map Tiles
- **OpenStreetMap Filter:**  
  `filter: grayscale(0.2) sepia(0.1) contrast(0.9) brightness(1.05);`

### B. Telemetry Symbolism (The Blueprint System)
| Vehicle Type | Shape | State |
| :--- | :--- | :--- |
| **Inbound Main** | ● **Solid Circle** | Arriving via primary route. |
| **Inbound Rat-Run**| ◆ **Solid Diamond** | Arriving via residential diversion. |
| **Egress Main** | ○ **Hollow Circle** | Exiting via primary route. |
| **Egress Rat-Run** | ◇ **Hollow Diamond**| Exiting via residential diversion. |
| **Parked** | ■ **Slate Square** | Static / Site Plan Plot Point. |

### C. Congestion Animation
- **Subtle Breathing:** Vehicle color fades between Corridor Color and `Crimson Earth`.
- **Duration:** 3s `ease-in-out` loop. No footprint change.

---

## 6. Sizing & Spacing
- **Sidebar Width:** `340px` (Expanded for editorial clarity).
- **Header Height:** `72px`.
- **Corner Radius:** `4px` (Standard components), `8px` (Map/Hero images).
- **Standard Padding:** `1.5rem` (`space-4`).
