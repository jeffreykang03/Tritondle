#!/usr/bin/env node
/**
 * DSC tenure / roster start years — one entrypoint:
 *
 *   node scripts/years.mjs              → populate (default)
 *   node scripts/years.mjs populate [--reference-year=YYYY]
 *   node scripts/years.mjs sync        → apply existing hdsi-start-years.json only
 *   node scripts/years.mjs wipe        → strip hdsiStartYear from every professor row
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPacificDateKey } from '../src/utils/pacificDate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(PKG_ROOT, 'src', 'data')
const HDSI_DIR = path.join(DATA_DIR, 'hdsi')
const PROF_PATH = path.join(DATA_DIR, 'professors.json')
const MANUAL_PATH = path.join(HDSI_DIR, 'hdsi-start-years.manual.json')
const OUT_MAP = path.join(HDSI_DIR, 'hdsi-start-years.json')
const OUT_PROVENANCE = path.join(HDSI_DIR, 'hdsi-start-years.roster-provenance.json')

const ABS_MIN_YEAR = 1995

function parsePopulateArgs(rawArgs) {
  let referenceYearArg
  for (const a of rawArgs) {
    if (a.startsWith('--reference-year=')) referenceYearArg = Number(a.slice(17))
  }
  return { referenceYearArg }
}

function sortKeys(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((o, k) => {
      o[k] = obj[k]
      return o
    }, {})
}

function loadManual() {
  if (!fs.existsSync(MANUAL_PATH)) return {}
  try {
    const raw = JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf8'))
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return raw
  } catch {
    return {}
  }
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

/** Build { id → startYear } for active roster + manual overrides; write JSON + provenance. */
function buildYearMap(referenceYearArg) {
  const key = getPacificDateKey(new Date())
  const refYear = Number.isFinite(referenceYearArg)
    ? referenceYearArg
    : Number.parseInt(String(key).slice(0, 4), 10)

  if (!Number.isFinite(refYear) || refYear < ABS_MIN_YEAR) {
    console.error('years: invalid reference year')
    process.exit(1)
  }

  const professors = JSON.parse(fs.readFileSync(PROF_PATH, 'utf8'))
  const active = professors.filter((p) => p.active !== false)
  const manual = loadManual()

  const out = {}
  const derived = {}

  for (const p of active) {
    const yLegacy = Number(p.yearsAtHdsi)
    if (!Number.isFinite(yLegacy) || yLegacy < 0 || !Number.isInteger(yLegacy)) {
      console.error(`years: missing or invalid yearsAtHdsi for ${p.id} (${JSON.stringify(p.yearsAtHdsi)})`)
      process.exit(1)
    }
    const computed = refYear - yLegacy
    const start = clamp(computed, ABS_MIN_YEAR, refYear)
    if (computed < ABS_MIN_YEAR) {
      console.warn(`years: ${p.id}: implied start ${computed} clipped to ${ABS_MIN_YEAR}`)
    }
    if (computed > refYear) {
      console.warn(`years: ${p.id}: implied start ${computed} clipped to ${refYear}`)
    }
    derived[p.id] = start
    out[p.id] = start
  }

  for (const [id, raw] of Object.entries(manual)) {
    const override = Number(raw)
    if (!Number.isFinite(override) || !Number.isInteger(override)) {
      console.warn(`years: skip manual "${id}": not an integer (${JSON.stringify(raw)})`)
      continue
    }
    if (override < ABS_MIN_YEAR || override > refYear + 1) {
      console.warn(`years: skip manual "${id}": ${override} outside plausible band`)
      continue
    }
    if (!derived[id]) console.warn(`years: manual id "${id}" not in active roster`)
    out[id] = override
  }

  fs.writeFileSync(OUT_MAP, `${JSON.stringify(sortKeys(out), null, 2)}\n`)

  fs.writeFileSync(
    OUT_PROVENANCE,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mechanism: 'roster_yearsAtHdsi_minus_reference_year',
        referencePacificDateKeyDefault: Number.isFinite(referenceYearArg) ? null : key,
        referenceYearUsed: refYear,
        formula: 'hdsiStartYear = clamp(referenceYear - yearsAtHdsi, ...) then manual overrides',
        manualOverridesPath: path.relative(PKG_ROOT, MANUAL_PATH).replace(/\\/g, '/'),
        derivedCount: active.length,
        manualOverrideIds: [...Object.keys(manual)].sort(),
      },
      null,
      2,
    )}\n`,
  )

  console.log(`years: wrote ${OUT_MAP} (${Object.keys(out).length} ids, reference year ${refYear})`)
  return out
}

/** Apply a year map onto professors JSON and save. */
function applyMapToProfessors(mapOrNull, professorsPath) {
  const professors = JSON.parse(fs.readFileSync(professorsPath, 'utf8'))

  let map = mapOrNull
  if (mapOrNull == null || typeof mapOrNull !== 'object' || Array.isArray(mapOrNull)) {
    const raw = fs.readFileSync(OUT_MAP, 'utf8')
    map = JSON.parse(raw)
  }

  if (map == null || typeof map !== 'object' || Array.isArray(map)) {
    console.error('years: map must be a JSON object { "prof-id": year }')
    process.exit(1)
  }

  const byId = new Map(professors.map((p) => [p.id, p]))
  const maxYear = new Date().getFullYear() + 1
  let applied = 0
  const unknown = []

  for (const [key, val] of Object.entries(map)) {
    const yr = Number(val)
    if (!Number.isFinite(yr) || !Number.isInteger(yr)) {
      console.warn(`years: skip "${key}": non-integer year (${JSON.stringify(val)})`)
      continue
    }
    if (yr < ABS_MIN_YEAR || yr > maxYear) {
      console.warn(`years: skip "${key}": year ${yr} outside ${ABS_MIN_YEAR}–${maxYear}`)
      continue
    }
    const p = byId.get(key)
    if (!p) {
      unknown.push(key)
      continue
    }
    p.hdsiStartYear = yr
    applied++
  }

  if (unknown.length) {
    console.warn(`years: ${unknown.length} id(s) not in professors.json: ${unknown.join(', ')}`)
  }

  fs.writeFileSync(professorsPath, JSON.stringify(professors, null, 2) + '\n')
  console.log(`years: applied hdsiStartYear for ${applied} professor row(s)`)
}

function cmdPopulate(restArgs) {
  const { referenceYearArg } = parsePopulateArgs(restArgs)
  const out = buildYearMap(referenceYearArg)
  applyMapToProfessors(out, PROF_PATH)
}

function cmdSync() {
  if (!fs.existsSync(OUT_MAP)) {
    console.error(`years: missing ${OUT_MAP} (run populate first)`)
    process.exit(1)
  }
  applyMapToProfessors(null, PROF_PATH)
}

function cmdWipe() {
  const professors = JSON.parse(fs.readFileSync(PROF_PATH, 'utf8'))
  let cleared = 0
  for (const p of professors) {
    if ('hdsiStartYear' in p) {
      delete p.hdsiStartYear
      cleared++
    }
  }
  fs.writeFileSync(PROF_PATH, JSON.stringify(professors, null, 2) + '\n')
  console.log(`years: removed hdsiStartYear from ${cleared} professor rows`)
}

const args = process.argv.slice(2)
let cmd = 'populate'
if (args[0] === 'populate' || args[0] === 'sync' || args[0] === 'wipe') {
  cmd = args.shift()
}

if (cmd === 'populate') {
  cmdPopulate(args)
} else if (cmd === 'sync') {
  cmdSync()
} else if (cmd === 'wipe') {
  cmdWipe()
} else {
  console.error('years: usage: years.mjs [populate|sync|wipe] [--reference-year=YYYY]')
  process.exit(1)
}
