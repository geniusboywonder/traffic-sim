# Tech Stack

## Build System
- Vite 8 (ESM, `@vitejs/plugin-react`)
- Node/npm

## Core Libraries
- React 19 — UI framework
- Leaflet 1.9 — interactive map
- lucide-react — icons
- Vitest 4 + Testing Library — unit/component tests
- jsdom — test environment

## Language
- JavaScript (JSX) — no TypeScript
- ES modules throughout (`"type": "module"` in package.json)

## Styling
- Plain CSS (`src/App.css`, `src/index.css`) — no CSS-in-JS, no Tailwind
- CSS custom properties for design tokens (e.g. `var(--c-3a)`, `var(--canvas)`, `var(--muted-text)`)
- Fonts: Manrope (primary), Work Sans, Space Grotesk — loaded via Google Fonts

## Analytics / Ads
- Google Tag Manager (`GTM-60147474`) in `index.html`
- Google AdSense in `index.html`
- `window.dataLayer.push(...)` used for GTM events (scenario changes, play/reset)

## Common Commands

```bash
npm run dev        # start dev server (Vite HMR)
npm run build      # production build → dist/
npm run preview    # preview production build
npm run lint       # ESLint
npm run test       # Vitest single run
npm run test:watch # Vitest watch mode
```

## ESLint
- `eslint.config.js` using flat config
- Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Rule: `no-unused-vars` ignores ALL_CAPS and PascalCase names (`varsIgnorePattern: '^[A-Z_]'`)
