// Idempotent Supabase seeder. Run locally:
//   export SUPABASE_URL=https://<project>.supabase.co
//   export SUPABASE_SERVICE_KEY=<service role secret — never committed>
//   npm run seed
// Emergency reseed from a prior backup (skips derivation):
//   npm run seed -- --from backup/seed-<timestamp>/
//
// Inputs live in gitignored scripts/data/ (lineitems.json + constants.json);
// every run writes a full backup under gitignored backup/ before touching the
// database, upserts + prunes so reruns converge, then verifies row counts and
// the base-dollar sum read back from the database against the source.
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LineItemData } from '../src/types'
import { buildLineItemRows } from './derive.ts'
import type { LineItemRow } from './derive.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY
if (!url || !serviceKey) {
  console.error(
    'SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment.\n' +
      'Export them in your terminal before running — never write the service key to a file.',
  )
  process.exit(2)
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } })

interface ConstantRow {
  key: string
  value: unknown
  description: string
}

function fail(msg: string): never {
  console.error(`SEED FAILED: ${msg}`)
  process.exit(1)
}

function readJson<T>(path: string, label: string): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch (e) {
    fail(`cannot read ${label} at ${path} — ${(e as Error).message}\n` +
      'If this machine has no local seed data, restore scripts/data/ from a backup/ folder.')
  }
}

// ── Assemble rows (normal mode derives; --from mode replays a backup) ──────
const fromIdx = process.argv.indexOf('--from')
const fromDir = fromIdx !== -1 ? resolve(repoRoot, process.argv[fromIdx + 1] ?? '') : null

let lineItemRows: LineItemRow[]
let constantRows: ConstantRow[]

if (fromDir) {
  console.log(`Replaying backup: ${fromDir}`)
  lineItemRows = readJson<LineItemRow[]>(join(fromDir, 'line_items.rows.json'), 'backup line_items rows')
  constantRows = readJson<ConstantRow[]>(join(fromDir, 'app_constants.rows.json'), 'backup app_constants rows')
} else {
  const data = readJson<LineItemData>(join(repoRoot, 'scripts/data/lineitems.json'), 'catalog JSON')
  const constants = readJson<Record<string, unknown>>(
    join(repoRoot, 'scripts/data/constants.json'),
    'constants JSON',
  )
  lineItemRows = buildLineItemRows(data)

  const descriptions: Record<string, string> = {
    meta: 'Catalog meta: source, basis, reported totals, reconciliation notes',
    guardrail_capacity: 'Soft per-phase capacity ceilings (2025 base $)',
    season_windows: 'Offseason/during-season window months and calendar bounds',
    escalation_default_rates: 'Default per-year escalation rates',
    public_funding_caps: 'Term-sheet public funding caps and total cap',
    startup_audit_band: 'Expected escalated grand-total validation band',
    sequence_captions: 'Six-window build-sequence captions, keyed by phase id',
  }
  constantRows = [
    { key: 'meta', value: data.meta, description: descriptions.meta },
    ...Object.entries(constants).map(([key, value]) => {
      if (!(key in descriptions)) fail(`unexpected constants.json key '${key}'`)
      return { key, value, description: descriptions[key] }
    }),
  ]
}

const sourceBaseSum = lineItemRows.reduce((s, r) => s + r.base, 0)
const meta = constantRows.find((r) => r.key === 'meta')?.value as
  | { reported_base_total?: number }
  | undefined
if (meta?.reported_base_total !== sourceBaseSum) {
  fail(
    `derived base sum ${sourceBaseSum} does not equal meta.reported_base_total ` +
      `${meta?.reported_base_total} — source data is inconsistent, refusing to seed`,
  )
}

// ── Backup before writing (skipped when replaying a backup) ────────────────
if (!fromDir) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(repoRoot, 'backup', `seed-${stamp}`)
  mkdirSync(backupDir, { recursive: true })
  writeFileSync(join(backupDir, 'lineitems.json'), readFileSync(join(repoRoot, 'scripts/data/lineitems.json')))
  writeFileSync(join(backupDir, 'constants.json'), readFileSync(join(repoRoot, 'scripts/data/constants.json')))
  writeFileSync(join(backupDir, 'line_items.rows.json'), JSON.stringify(lineItemRows, null, 2))
  writeFileSync(join(backupDir, 'app_constants.rows.json'), JSON.stringify(constantRows, null, 2))
  writeFileSync(
    join(backupDir, 'manifest.json'),
    JSON.stringify(
      { createdAt: stamp, lineItems: lineItemRows.length, constants: constantRows.length, baseSum: sourceBaseSum },
      null,
      2,
    ),
  )
  console.log(`Backup written: ${backupDir}`)
}

// ── Upsert + prune ─────────────────────────────────────────────────────────
function quoteList(vals: string[]): string {
  return `(${vals.map((v) => `"${v}"`).join(',')})`
}

{
  const { error } = await db.from('line_items').upsert(lineItemRows, { onConflict: 'id' })
  if (error) fail(`line_items upsert — ${error.code ?? ''} ${error.message}`)
}
{
  const ids = lineItemRows.map((r) => r.id)
  const { error } = await db.from('line_items').delete().not('id', 'in', quoteList(ids))
  if (error) fail(`line_items prune — ${error.code ?? ''} ${error.message}`)
}
{
  const { error } = await db.from('app_constants').upsert(constantRows, { onConflict: 'key' })
  if (error) fail(`app_constants upsert — ${error.code ?? ''} ${error.message}`)
}
{
  const keys = constantRows.map((r) => r.key)
  const { error } = await db.from('app_constants').delete().not('key', 'in', quoteList(keys))
  if (error) fail(`app_constants prune — ${error.code ?? ''} ${error.message}`)
}

// ── Verify by reading back ─────────────────────────────────────────────────
const { data: liRows, error: liErr } = await db.from('line_items').select('id, base')
if (liErr || !liRows) fail(`readback line_items — ${liErr?.message}`)
if (liRows.length !== lineItemRows.length) {
  fail(`row count ${liRows.length}, expected ${lineItemRows.length}`)
}
const dbBaseSum = liRows.reduce((s, r) => s + Number(r.base), 0)
if (dbBaseSum !== sourceBaseSum) fail(`db base sum ${dbBaseSum}, expected ${sourceBaseSum}`)

const { data: constRows, error: cErr } = await db.from('app_constants').select('key, value')
if (cErr || !constRows) fail(`readback app_constants — ${cErr?.message}`)
if (constRows.length !== constantRows.length) {
  fail(`app_constants count ${constRows.length}, expected ${constantRows.length}`)
}
const captions = constRows.find((r) => r.key === 'sequence_captions')?.value as
  | Record<string, string>
  | undefined
if (!captions || Object.keys(captions).length !== 6) {
  fail('sequence_captions missing or does not have 6 entries')
}

console.log(
  `Seed OK: ${liRows.length} line items (base sum $${dbBaseSum.toLocaleString('en-US')}), ` +
    `${constRows.length} constants.`,
)
