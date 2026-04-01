# Design System Specification: Editorial Organicism

## 1. Overview & Creative North Star
### The Creative North Star: "The Curated Earth"
This design system rejects the "templated" nature of modern SaaS interfaces in favor of a high-end, editorial experience. It is designed to feel like a premium monograph—part architectural blueprint, part sustainable lifestyle journal. We move beyond standard grids by embracing **intentional asymmetry**, where content breathes through expansive whitespace and "broken" layouts that allow images and typography to bleed across traditional boundaries.

The aesthetic is built on the tension between the structured (Professionalism/Architecture) and the fluid (Organic/Sustainability). We achieve this through:
- **Tonal Depth:** Replacing harsh borders with soft shifts in background value.
- **Micro-Editorial Layouts:** Using drastic typographic scale to guide the eye.
- **The "Bespoke" Detail:** Custom interaction states and layered "glass" surfaces that feel tactile and expensive.

---

## 2. Colors: Tonal Architecture
The palette is rooted in earth and minerals. We treat color not just as decoration, but as a structural material.

### Color Tokens
*   **Primary (`#365652` - Hooker's Green):** Our primary voice. Use for authoritative elements and brand presence.
*   **Secondary (`#795831` - Buff/Deep Earth):** The grounding element. Used for warmth and tactile highlights.
*   **Background (`#fff9ea` - Champagne/Eggshell):** The canvas. High-end editorial feel, moving away from sterile pure whites.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section content. Boundaries must be defined solely by background color shifts. 
*   *Correct:* A `surface_container_low` (`#faf3dd`) card sitting on a `background` (`#fff9ea`) canvas.
*   *Forbidden:* A `1px solid #717977` border around a white box.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of fine paper.
*   **Layer 1 (Canvas):** `surface` (`#fff9ea`)
*   **Layer 2 (Content Areas):** `surface_container_low` (`#faf3dd`)
*   **Layer 3 (Floating Elements/Action Areas):** `surface_container_highest` (`#e9e2cd`)

### The "Glass & Gradient" Rule
To add soul to the "flat" web, main CTAs and floating navigation should utilize:
*   **Signature Gradients:** Transitioning from `primary` (`#365652`) to `primary_container` (`#4e6e6a`) at a 135-degree angle.
*   **Glassmorphism:** Use `surface_bright` at 80% opacity with a `24px` backdrop blur for floating headers to allow the organic background tones to bleed through.

---

## 3. Typography: The Editorial Voice
We use two distinct typefaces to balance precision with humanism.

*   **Display & Headlines (Manrope):** A geometric sans-serif that feels engineered yet accessible. Used in exaggerated scales to create "hero moments."
*   **Body & Labels (Work Sans):** High legibility with a slightly wider stance, providing a professional, architectural feel.

### Key Scales
*   **Display-LG (3.5rem):** Reserved for hero titles. Letter spacing should be set to `-0.02em` for a tighter, premium feel.
*   **Headline-MD (1.75rem):** Used for section starts, always paired with generous `spacing-16` (5.5rem) top margins.
*   **Body-LG (1rem):** The workhorse. Line height must be `1.6` to maintain the "breathing room" required by the brand.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "digital." In this system, depth is biological and ambient.

*   **The Layering Principle:** Depth is achieved by stacking `surface-container` tiers. A `surface_container_lowest` (`#ffffff`) card placed on a `surface_dim` (`#e0dac5`) background creates a natural lift.
*   **Ambient Shadows:** If a floating effect is mandatory (e.g., a modal), use a "Sunlight Shadow":
    *   `box-shadow: 0 24px 48px -12px rgba(30, 28, 15, 0.06);`
    *   Note: The shadow uses `on_surface` (`#1e1c0f`) as its base color, not pure black, to mimic natural light.
*   **The "Ghost Border":** For essential accessibility in inputs, use `outline_variant` at 20% opacity.

---

## 5. Components: Style Guide

### Buttons
*   **Primary:** `primary` background, `on_primary` text. No border. `0.25rem` (sm) roundedness. Subtle gradient on hover.
*   **Secondary:** `surface_container_high` background. Text in `secondary`.
*   **Tertiary:** No background. Underline using `primary_fixed` with a 2px offset.

### Cards & Sections
*   **Constraint:** No dividers. Use `spacing-10` (3.5rem) or `spacing-12` (4rem) to separate content blocks.
*   **Image Handling:** Images should have `0.5rem` (lg) corner radius. Encourage "Off-Grid" placement where an image overlaps two different surface containers.

### Input Fields
*   **Base:** `surface_container_lowest` background. 
*   **States:** On focus, transition background to `surface_container_low` and apply a `ghost border` using `primary` at 30% opacity.

### Selection Chips
*   **Unselected:** `surface_variant` with `on_surface_variant` text.
*   **Selected:** `primary` background with a subtle inner glow.

---

## 6. Do's and Don'ts

### Do:
*   **Use Asymmetry:** Place a `headline-lg` on the left with a `body-md` column offset to the right.
*   **Exaggerate Whitespace:** If you think there is enough space, add one more level from the spacing scale (`spacing-16` or `20`).
*   **Embrace Muted Tones:** Use `ash gray` and `charcoal` for captions and metadata to reduce visual noise.

### Don't:
*   **Don't use 100% Black:** Always use `on_surface` (`#1e1c0f`) for text to maintain the earthy, organic warmth.
*   **Don't use "Default" Shadows:** Never use high-opacity, tight-radius shadows.
*   **Don't use Center-Alignment for Everything:** Editorial layouts thrive on "Left-Heavy" or "Right-Heavy" balance. Center-alignment should be reserved for the most minimal of landing pages.
*   **Don't use Dividers:** Avoid the horizontal line. If content needs to be separated, use a shift from `surface` to `surface_container_low`.