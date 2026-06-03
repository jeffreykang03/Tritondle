#!/usr/bin/env node
/**
 * UCSD years: canonical field is **ucsdStartYear** (roster-listed start calendar year) on each professor row.
 * Optional overrides: src/data/hdsi/ucsd-start-years.manual.json
 *
 *   node scripts/years.mjs              → populate (default)
 *   node scripts/years.mjs populate
 *   node scripts/years.mjs sync        → apply existing ucsd-start-years.json only
 *   node scripts/years.mjs wipe        → strip start-year field from every professor row
 *
 * Documentation: docs/ucsd-years-data.md
 */
import fs from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'node:url'

import { getPacificDateKey } from '../src/utils/pacificDate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(PKG_ROOT, 'src', 'data')
const HDSI_DIR = path.join(DATA_DIR, 'hdsi')
const PROF_PATH = path.join(DATA_DIR, 'professors.json')
const MANUAL_PATH = path.join(HDSI_DIR, 'ucsd-start-years.manual.json')
const OUT_MAP = path.join(HDSI_DIR, 'ucsd-start-years.json')
const OUT_PROVENANCE = path.join(HDSI_DIR, 'ucsd-start-years.roster-provenance.json')

const ABS_MIN_YEAR = 1995

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

/** Build { id → startYear } from inline ucsdStartYear + manual overrides; write JSON + provenance. */
function buildYearMap() {
  const key = getPacificDateKey(new Date())

  const professors = JSON.parse(fs.readFileSync(PROF_PATH, 'utf8'))
  const active = professors.filter((p) => p.active !== false)
  const activeIds = new Set(active.map((p) => p.id))
  const manual = loadManual()

  const out = {}
  const missing = []

  for (const p of active) {
    const y = Number(p.ucsdStartYear ?? p.hdsiStartYear)
    if (!Number.isFinite(y) || !Number.isInteger(y) || y < ABS_MIN_YEAR) {
      missing.push(p.id)
      continue
    }
    out[p.id] = y
  }

  const needManual = missing.filter((id) => manual[id] == null)
  if (needManual.length > 0) {
    const preview = needManual.slice(0, 12).join(', ')
    const more = needManual.length > 12 ? ` (+${needManual.length - 12} more)` : ''
    console.warn(
      `years: ${needManual.length} active row(s) missing ucsdStartYear — set on row or in manual JSON (${preview}${more})`,
    )
  }

  for (const [id, raw] of Object.entries(manual)) {
    if (!activeIds.has(id)) {
      console.warn(`years: manual id "${id}" not in active roster`)
      continue
    }
    const override = Number(raw)
    if (!Number.isFinite(override) || !Number.isInteger(override)) {
      console.warn(`years: skip manual "${id}": not an integer (${JSON.stringify(raw)})`)
      continue
    }
    if (override < ABS_MIN_YEAR) {
      console.warn(`years: skip manual "${id}": ${override} before ${ABS_MIN_YEAR}`)
      continue
    }
    out[id] = override
  }

  fs.writeFileSync(OUT_MAP, `${JSON.stringify(sortKeys(out), null, 2)}\n`)

  fs.writeFileSync(
    OUT_PROVENANCE,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mechanism: 'inline_ucsdStartYear_on_professor_row_plus_manual_json',
        referencePacificDateKeyWhenGenerated: key,
        formula:
          'ucsdStartYear per active row in professors.json; ucsd-start-years.manual.json overrides by id; game uses puzzle calendar year minus ucsdStartYear',
        manualOverridesPath: path.relative(PKG_ROOT, MANUAL_PATH).replace(/\\/g, '/'),
        professorJsonPath: path.relative(PKG_ROOT, PROF_PATH).replace(/\\/g, '/'),
        idsInMap: Object.keys(out).length,
        manualOverrideIds: [...Object.keys(manual)].sort(),
        documentation: 'docs/ucsd-years-data.md',
      },
      null,
      2,
    )}\n`,
  )

  console.log(`years: wrote ${OUT_MAP} (${Object.keys(out).length} ids)`)
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

  for (const [mapId, val] of Object.entries(map)) {
    const yr = Number(val)
    if (!Number.isFinite(yr) || !Number.isInteger(yr)) {
      console.warn(`years: skip "${mapId}": non-integer year (${JSON.stringify(val)})`)
      continue
    }
    if (yr < ABS_MIN_YEAR || yr > maxYear) {
      console.warn(`years: skip "${mapId}": year ${yr} outside ${ABS_MIN_YEAR}–${maxYear}`)
      continue
    }
    const p = byId.get(mapId)
    if (!p) {
      unknown.push(mapId)
      continue
    }
    p.ucsdStartYear = yr
    applied++
  }

  if (unknown.length) {
    console.warn(`years: ${unknown.length} id(s) not in professors.json: ${unknown.join(', ')}`)
  }

  fs.writeFileSync(professorsPath, JSON.stringify(professors, null, 2) + '\n')
  console.log(`years: applied ucsdStartYear for ${applied} professor row(s)`)
}

function cmdPopulate() {
  const out = buildYearMap()
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
    let hit = false
    if ('ucsdStartYear' in p) {
      delete p.ucsdStartYear
      hit = true
    }
    if ('hdsiStartYear' in p) {
      delete p.hdsiStartYear
      hit = true
    }
    if (hit) cleared++
  }
  fs.writeFileSync(PROF_PATH, JSON.stringify(professors, null, 2) + '\n')
  console.log(`years: removed start year from ${cleared} professor row(s)`)
}

const args = process.argv.slice(2)
let cmd = 'populate'
if (args[0] === 'populate' || args[0] === 'sync' || args[0] === 'wipe') {
  cmd = args.shift()
}

if (cmd === 'populate') {
  cmdPopulate()
} else if (cmd === 'sync') {
  cmdSync()
} else if (cmd === 'wipe') {
  cmdWipe()
} else {
  console.error('years: usage: years.mjs [populate|sync|wipe]')
  process.exit(1)
}
