# Moda Center — Phase Optioneering Dashboard

**Confidential PCL pursuit artifact.** A live phase-optioneering dashboard for the
Moda Center CM/GC interview. A PCL exec drives it in front of the owner: renovation
scope is assembled across 7 construction windows while cost recomputes live.

Standalone, offline, no backend. No external API calls, analytics, or telemetry.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

Boots clean in GitHub Codespaces with zero extra setup.

## What it does

- **Headline bar** — Total Escalated Cost (hero), Total Base Cost (2025), Δ vs
  baseline ($ + %), Items Included / Total. (Net Seat Impact is a labeled v2
  placeholder.)
- **Escalation engine** — base year 2025, four per-year sliders (2026–2029,
  0–10% in 0.5% steps) plus a Reset-to-5% button and a per-year escalated-spend
  chart. Multipliers compound from 2025; `CONT` scope splits evenly across
  2027–29.
- **The board** — 7 phase columns; drag scope cards between phases to re-time
  work and watch escalated cost move. Cards carry level chip, base/escalated $,
  include toggle, and a status pill. Deferring a *Required* building-system item
  requires a confirm.
- **Scenarios** — Baseline (Big Kahuna), Capacity Protect, Affordability,
  Premium Accelerate. Each re-seeds item state; the engine recomputes.
- **Guardrail** — a non-blocking orange ⚠ warns when a phase exceeds the physical
  throughput a construction window can absorb (2025 base $; offseason > during).

## Validation

With all items included, default phases, flat 5%/yr, the escalated grand total
lands at **$403.15M** — within the $402–403M target and 0.06% off the reported
$403.39M Big Kahuna escalated total. A startup audit (item-count-by-phase + the
validation verdict) prints to the browser console on load. Costs come only from
`src/data/lineitems.json`; nothing is hardcoded or fudged.

## Branding

PCL Green / Yellow primary, gray hierarchy, secondary accents on chips/buttons
only, orange reserved for the overload alert. **Barlow is self-hosted** — the
woff2 files live in `src/fonts/` and load via `@font-face`; no Google Fonts CDN,
so the app renders fully offline. The header carries a labeled placeholder for
the PCL logo asset.

## Stack

React + Vite + TypeScript, Tailwind, Zustand, Recharts. No router, no backend.

## Out of scope for v1

Seat-impact counter (v2 — placeholder is in the headline), revenue modeling,
COBID tracking, PDF export, the analyst-view suite, persistence/save.
