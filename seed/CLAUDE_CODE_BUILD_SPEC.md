# Moda Center — Phase Optioneering Dashboard
## Claude Code Build Spec (v1: cost + phase)

> Paste this entire file into a Claude Code session as the build brief. The data file
> `lineitems.json` (provided alongside this spec) reconciles to within 0.11% of the
> $347.45M base / $403.39M escalated Big Kahuna estimate. Do not invent numbers.

---

### 0. CONFIDENTIALITY / SCOPE GUARDRAIL
This is a confidential PCL pursuit artifact built on PCL's proprietary estimate. It is a
standalone project. Do NOT import, reference, or reuse code from any other project, and do
not add analytics, telemetry, or external API calls. Everything runs locally/offline.

### 1. WHAT THIS IS
An interview demo tool for the Moda Center CM/GC pursuit. A PCL exec drives it live in front
of the owner (Trail Blazers / Rip City / City / State). The owner watches scope move between
construction phases and sees cost recompute in real time. Optimize for a guided 5-minute
walkthrough on a laptop/projector — NOT a 40-tab analyst tool.

### 2. STACK
- React + Vite + TypeScript
- Tailwind for styling
- Zustand (or React context) for state — no backend, no router needed
- Recharts for the one or two charts
- All data from `src/data/lineitems.json` (copy the provided file here)
- Must run with `npm install && npm run dev` in GitHub Codespaces with zero extra setup

### 3. CORE DATA MODEL
Each line item (from lineitems.json) has: id, name, level (L100/L200/L300/L400/L500/L700/
OVERLAY/AGING), qty, unit, base (2025 dollars). The app adds runtime state per item:
- `phase`: one of the 7 phases below (or "UNASSIGNED")
- `included`: boolean (toggle scope in/out)
- `status`: "required" | "value-add" | "deferrable"  (default everything "value-add"
  EXCEPT the OVERLAY systems items — HVAC, Electrical, Plumbing, Fire Protection, Vertical
  Transportation, AV — and AGING, which default to "required")

### 4. PHASES (from Image 1 — the OS/DS map)
Ordered, each mapped to a calendar YEAR for escalation:
1. `1OS` — 1st Offseason — 2027
2. `1DS` — 1st During-Season — 2027
3. `2OS` — 2nd Offseason — 2028
4. `2DS` — 2nd During-Season — 2028
5. `3OS` — 3rd Offseason — 2029
6. `3DS` — 3rd During-Season — 2029
7. `CONT` — Continuous (MEP/AV/Structural/Envelope/VT/Food Svc throughout) — spread 2027-2029

Seed each item's default phase from the Image 1 scope map (see section 9 for the mapping).

### 5. ESCALATION ENGINE — THE HEART OF THE DEMO
- Base year is 2025. Escalation compounds from 2025.
- Each YEAR (2026, 2027, 2028, 2029) has its own escalation rate, default 5.0%.
- Per-year sliders (range 0%–10%, 0.5% steps) let the owner dial each year independently.
  THIS is the "scale escalation between years" feature — make these sliders prominent.
- Multiplier for an item in year Y = product of (1 + rate_y) for each year from 2026..Y.
  e.g. default: 2027 = 1.05^2 = 1.1025, 2028 = 1.05^3 = 1.1576, 2029 = 1.05^4 = 1.2155.
- `CONT` items: split base evenly across 2027/2028/2029 and escalate each third to its year.
- escalatedCost(item) = item.base × multiplier(item's phase year). Excluded items = 0.
- VALIDATION TARGET: with all items included, default phases, flat 5%/yr, the escalated
  grand total must land ≈ $402–403M. If it doesn't, the phase→year seeding is wrong — fix
  seeding, never fudge the math. (Verified: even 3-yr spend @5% = $402.08M.)

### 6. LAYOUT (single screen, three zones)
**A. Headline bar (top, always visible) — 4 big live numbers:**
- Total Escalated Cost (the hero number, large)
- Total Base Cost (2025) — smaller, for reference
- Δ vs Baseline ($ and %) — baseline = the seeded default scenario, captured on load
- Items Included / Total (e.g. "61 / 65 scope items")
(Leave a labeled placeholder slot for "Net Seat Impact" — v2. Show "—" for now.)

**B. Escalation control strip (below headline):**
- 4 year sliders (2026–2029) with live % readout
- "Reset to 5%" button
- A tiny sparkline or the per-year escalated spend (2027/28/29) so re-phasing impact is visible

**C. The board (main area) — the optioneering surface:**
- Columns = the 7 phases. Cards = line items, grouped/colored by level.
- Drag a card between phase columns → its year changes → escalated cost updates live.
- Card shows: name, level chip, base $, escalated $ (updates on move), include toggle,
  status pill (required/value-add/deferrable).
- "Required" items: allow moving between phases but make the include-toggle require a
  confirm ("This is a building-need system — defer anyway?"). This is a selling point:
  it shows PCL knows what's truly optional vs. what the building needs regardless.
- Phase column header shows: phase name, year, # items, phase escalated subtotal.

### 7. GUARDRAIL FEATURE (build it in, it's a differentiator)
Each During-Season phase (1DS/2DS/3DS) and each Offseason phase has a soft "capacity"
(a $ or item-count ceiling representing what an NBA window can physically absorb — use a
configurable constant, default e.g. offseason can hold more than during-season). If a phase
is overloaded, show a non-blocking amber warning on the column header: "⚠ Exceeds typical
offseason window throughput." Reference point in tooltip: Crypto.com Arena ran ~50–65
interrupted workdays per phase, midnight–10am. Do not hard-block — warn.

### 8. SCENARIOS (preset buttons, top-right)
One-click presets that re-seed phase/include/status, capturing the current as comparison:
- **Baseline (Big Kahuna)** — the seeded default. The $403M starting point.
- **Capacity Protect** — push bowl/seating-affecting club & suite items OUT of during-season
  phases into offseasons. (v1: approximate by moving L300/L400 bowl-stadia items to OS.)
- **Affordability** — set "deferrable" items to excluded; recompute.
- **Premium Accelerate** — pull L300/L400 premium club items into earlier phases.
Each preset just changes item state; the engine recomputes. Keep it transparent.

### 9. DEFAULT PHASE SEEDING (from Image 1)
Seed by these rules (apply in order; an item takes the first rule it matches):
- All OVERLAY items (HVAC, Electrical, Plumbing, Fire Protection, Vertical Transportation,
  Audio/Visual, Bowl/Catwalk/Rigging, Sound, Garage, Exterior Wall/LED, Food Service Equip,
  Seating, Sitework) → `CONT`. AGING → `CONT`.
- L100 Staff Lockers/Food Service, Sideline Club #2, NBA Lockers (Home Team), NBA Team
  Parking (Balance/Add Dock) → `1OS`
- L100 Video/Aux Lockers → `1DS`
- L200 West + North restroom/concession items → `1OS`; balance of North restrooms → `1DS`
- L300 North Neighborhood Club, North bowl stadia, infill-slab items → `1OS`
- L100 WNBA Lockers, Courtside Club, Sideline Club (East) → `2OS`
- L200 Secondary/Circular entry, East restrooms/concessions → `2OS`; South restrooms → `2DS`
- L300 Rotunda, South Neighborhood Club → `2OS`
- L500 (Upper Concourse) restroom items → `2OS`; remaining → `2DS`
- L700 (Press) → `2OS` / `2DS`
- L200 Primary entrance, flooring/sealants → `3OS`
- L300 Center Court / Club suites → `3OS`
- L400 (all Suite Level clubs + lobbies) → `3OS`
- Anything still UNASSIGNED → `3OS` (and log it to console so we can refine)
Print a startup console table of itemcount-by-phase so seeding is auditable.

### 10. STYLING / TONE
Professional, executive, calm. Dark or neutral background, Trail Blazers-adjacent accent
(deep red) used sparingly. Big legible numbers (this is projected in a room). No clutter,
no emoji in the UI except the single amber ⚠ guardrail glyph. Currency formatted $XXX.XM
on headline, full $ with commas on cards.

### 11. ACCEPTANCE CHECKS (Claude Code: verify before declaring done)
1. `npm run dev` boots clean in Codespaces.
2. On load, headline escalated total is ≈ $402–403M (within 1%). Print actual to console.
3. Dragging any card to a later-year phase increases its escalated cost and the headline.
4. Moving a year slider updates every affected item and the headline live.
5. Excluding an item drops it to $0 and decrements the included count.
6. "Required" toggle shows the confirm dialog.
7. Scenario buttons visibly change the board and the Δ-vs-baseline figure.
8. Overloading a phase shows the amber warning, does not block.

### 12. EXPLICITLY OUT OF SCOPE FOR v1
Seat impact counter (v2 — leave the labeled placeholder), revenue modeling, COBID tracking,
PDF export, the 17-view analyst suite, persistence/save. Resist scope creep — this is an
interview demo, not the post-award precon platform.
