// Design-token authority. Read via fs (not an ESM JSON import) so the config
// loads identically under every pipeline — Vite/jiti, PostCSS CLI, and Node
// ESM (where bare JSON imports require import attributes and can fail,
// silently dropping every token utility class).
import { readFileSync } from 'node:fs'

const tokens = JSON.parse(
  readFileSync(new URL('./src/theme/tokens.json', import.meta.url), 'utf8'),
)
const c = tokens.color

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Self-hosted Barlow (see src/index.css @font-face). System fallback only.
        sans: ['Barlow', 'system-ui', 'sans-serif'],
      },
      // Role-named design tokens — values live in src/theme/tokens.json.
      colors: {
        accent: { DEFAULT: c.accent, hover: c.accentHover, tint: c.accentTint },
        chrome: { DEFAULT: c.chrome, deep: c.chromeDeep },
        ink: { DEFAULT: c.ink, muted: c.inkMuted },
        surface: { DEFAULT: c.surface, alt: c.surfaceAlt },
        line: c.line,
        gridline: c.gridline,
        silver: c.silver,
        alert: c.alert,
        gold: c.gold,
        // Secondary brand accents — callouts/badges/chips only.
        'brand-yellow': {
          DEFAULT: c.brandYellow,
          ink: c.brandYellowInk,
          'ink-soft': c.brandYellowInkSoft,
        },
        'brand-indigo': c.brandIndigo,
        // Named one-off tints (previously inline hex) — token-driven now.
        grip: c.grip,
        'hint-border': c.hintBorder,
        'column-bg': c.columnBg,
        'track-bg': c.trackBg,
        'panel-tint': c.panelTint,
        'card-tint': c.cardTint,
        // Print-report neutrals (PrintReport.tsx only).
        print: {
          border: tokens.print.statBorder,
          cell: tokens.print.cellBorder,
          body: tokens.print.body,
          label: tokens.print.label,
          secondary: tokens.print.secondary,
          fine: tokens.print.fine,
        },
      },
    },
  },
  plugins: [],
}
