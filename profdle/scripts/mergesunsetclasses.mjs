#!/usr/bin/env node
/**
 * Merge course codes from SunSET's published CSV into src/data/professors.json.
 *
 * DSC rows: mostTaughtClass = mode count in CSV; otherClasses = remaining DSC codes (sorted).
 * Non-DSC catalog codes (COGS, MATH, …): merged into additionalCourses (sorted), deduped with any
 * existing additionalCourses on the roster (manual extras are kept).
 *
 * Rows with no matching DSC data keep mostTaughtClass / otherClasses unchanged except additionalCourses
 * may still be filled from non-DSC CSV rows.
 *
 * SunSET: https://sheeptester.github.io/ucsd-sunset/
 * CSV: https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6KhjyiPM-rof6fqjBcmp7ygy4Dqr1LQ8uJiAOtR2IoihzQEumx-SHX_KKxLpmYGZksN6QsPPk0DNb/pub?single=true&output=csv
 *
 * Usage:
 *   node scripts/mergesunsetclasses.mjs
 *   node scripts/mergesunsetclasses.mjs ./local.csv
 *   node scripts/mergesunsetclasses.mjs --dry-run
 *
 * Name matching: exact normalized name first; otherwise each roster name token must match a
 * CSV token (handles middle initials, “Sam” vs “Samuel”, parenthetical nicknames like Lily Weng).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PROF_PATH = path.join(ROOT, 'src/data/professors.json')

const SUNSET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6KhjyiPM-rof6fqjBcmp7ygy4Dqr1LQ8uJiAOtR2IoihzQEumx-SHX_KKxLpmYGZksN6QsPPk0DNb/pub?single=true&output=csv'

function normalize(str) {
  return String(str ?? '')
    .trim()
    .toLowerCase()
}

function csvProfessorToDisplayName(field) {
  const raw = String(field ?? '').trim()
  if (!raw) return ''
  const parts = raw.split(',').map((s) => s.trim())
  if (parts.length >= 2) {
    const last = parts[0]
    const rest = parts.slice(1).join(' ')
    return `${rest} ${last}`.replace(/\s+/g, ' ').trim()
  }
  return raw
}

function normalizeCourse(code) {
  return String(code ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function isDscCourse(course) {
  return /^\s*DSC\s/i.test(String(course ?? ''))
}

/** Non-DSC department+course patterns from SunSET (COGS 108, MAED 296, etc.). */
function looksLikeCatalogCourse(courseRaw) {
  const s = String(courseRaw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!s) return false
  if (isDscCourse(s)) return false
  return /^[A-Za-z]{2,12}\s*\d+[A-Za-z]*$/i.test(s)
}

/** Tokens for matching; parenthetical nicknames count (e.g. Tsui-Wei (lily) Weng → … lily …). */
function nameTokens(displayName) {
  const s = normalize(displayName).replace(/\(([^)]*)\)/g, ' $1 ')
  return s.split(/\s+/).filter(Boolean)
}

function tokenMatch(rosterTok, csvTok) {
  if (rosterTok === csvTok) return true
  if (rosterTok.length >= 3 && csvTok.startsWith(rosterTok)) return true
  if (csvTok.length >= 3 && rosterTok.startsWith(csvTok)) return true
  return false
}

/** Each roster name token must match some CSV token (handles middle names / legal vs go-by names). */
function rosterMatchesCsvDisplay(rosterName, csvDisplay) {
  const rt = nameTokens(rosterName)
  const ct = nameTokens(csvDisplay)
  outer: for (const r of rt) {
    for (const c of ct) {
      if (tokenMatch(r, c)) continue outer
    }
    return false
  }
  return true
}

/**
 * Map SunSET CSV-derived display name → roster row.
 * Order: exact normalized full name, then token subset match; disambiguate by shared last token.
 */
function resolveProfessor(displayName, professors, byNormName) {
  const nk = normalize(displayName)
  if (!nk) return null
  const exact = byNormName.get(nk)
  if (exact) return exact

  const hits = []
  for (const p of professors) {
    if (rosterMatchesCsvDisplay(p.name, displayName)) hits.push(p)
  }
  if (hits.length === 0) return null
  if (hits.length === 1) return hits[0]

  const csvTok = nameTokens(displayName)
  const csvLast = csvTok[csvTok.length - 1]
  const narrowed = hits.filter((h) => nameTokens(h.name).at(-1) === csvLast)
  if (narrowed.length === 1) return narrowed[0]

  console.warn(
    `[sunset merge] Ambiguous CSV name "${displayName}" → ${hits.map((h) => h.name).join(' | ')} (skipped)`,
  )
  return null
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let i = 0
  let q = false
  while (i < line.length) {
    const c = line[i]
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 2
          continue
        }
        q = false
        i++
        continue
      }
      cur += c
      i++
      continue
    }
    if (c === '"') {
      q = true
      i++
      continue
    }
    if (c === ',') {
      out.push(cur)
      cur = ''
      i++
      continue
    }
    cur += c
    i++
  }
  out.push(cur)
  return out
}

async function loadCsvText(argv) {
  const local = argv.find((a) => !a.startsWith('--') && a.endsWith('.csv'))
  if (local) {
    return fs.readFileSync(path.resolve(local), 'utf8')
  }
  const res = await fetch(SUNSET_CSV_URL)
  if (!res.ok) throw new Error(`Fetch SunSET CSV failed: ${res.status}`)
  return res.text()
}

/** Migrate legacy `classes` → mostTaughtClass + otherClasses */
function migrateLegacyClasses(professors) {
  for (const p of professors) {
    if (Object.hasOwn(p, 'classes') && !Object.hasOwn(p, 'otherClasses')) {
      p.otherClasses = p.classes
      p.mostTaughtClass = null
      delete p.classes
    }
    if (!Object.hasOwn(p, 'otherClasses')) p.otherClasses = []
    if (!Object.hasOwn(p, 'mostTaughtClass')) p.mostTaughtClass = null
    if (!Array.isArray(p.additionalCourses)) delete p.additionalCourses
  }
}

/** Pick mode course; ties broken alphabetically */
function modeCourse(countMap) {
  let best = null
  let bestN = -1
  for (const [course, n] of countMap) {
    if (best === null || n > bestN || (n === bestN && course.localeCompare(best) < 0)) {
      best = course
      bestN = n
    }
  }
  return best
}

function main() {
  const argv = process.argv.slice(2)
  const dry = argv.includes('--dry-run')

  loadCsvText(argv).then((text) => {
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) {
      console.error('CSV empty or missing header')
      process.exit(1)
    }

    const header = parseCsvLine(lines[0]).map((h) => h.trim())
    const idxCourse = header.indexOf('Course')
    const idxProf = header.indexOf('Professor')
    if (idxCourse < 0 || idxProf < 0) {
      console.error('Expected columns Course, Professor. Got:', header)
      process.exit(1)
    }

    const professors = JSON.parse(fs.readFileSync(PROF_PATH, 'utf8'))
    migrateLegacyClasses(professors)

    const byNormName = new Map()
    for (const p of professors) {
      byNormName.set(normalize(p.name), p)
    }

    /** id -> Map<normalized DSC course, count> */
    const dscCountsById = new Map()
    /** id -> Map<normalized course, display (uppercase normalized)> — non-DSC catalog codes only */
    const nonDscById = new Map()
    const unmatchedPairs = new Map()

    for (let li = 1; li < lines.length; li++) {
      const cols = parseCsvLine(lines[li])
      const courseRaw = cols[idxCourse]
      const profRaw = cols[idxProf]
      const trimmed = String(courseRaw ?? '').trim()
      if (!trimmed) continue

      const useDsc = isDscCourse(courseRaw)
      const useNonDsc = !useDsc && looksLikeCatalogCourse(courseRaw)
      if (!useDsc && !useNonDsc) continue

      const displayName = csvProfessorToDisplayName(profRaw)
      const row = resolveProfessor(displayName, professors, byNormName)
      const courseKey = normalizeCourse(courseRaw)

      if (!row) {
        unmatchedPairs.set(`${profRaw}|${courseKey}`, (unmatchedPairs.get(`${profRaw}|${courseKey}`) ?? 0) + 1)
        continue
      }

      if (useDsc) {
        if (!dscCountsById.has(row.id)) dscCountsById.set(row.id, new Map())
        const cm = dscCountsById.get(row.id)
        cm.set(courseKey, (cm.get(courseKey) ?? 0) + 1)
      } else {
        if (!nonDscById.has(row.id)) nonDscById.set(row.id, new Map())
        nonDscById.get(row.id).set(courseKey, courseKey)
      }
    }

    let dscUpdated = 0
    for (const p of professors) {
      const cm = dscCountsById.get(p.id)
      if (!cm || cm.size === 0) continue

      const top = modeCourse(cm)
      const others = [...cm.keys()].filter((c) => c !== top).sort((a, b) => a.localeCompare(b))

      p.mostTaughtClass = top
      p.otherClasses = others
      dscUpdated++
    }

    let additionalMergedCount = 0
    for (const p of professors) {
      const fromCsv = nonDscById.get(p.id)
      const existing = Array.isArray(p.additionalCourses) ? [...p.additionalCourses] : []
      const merged = new Map()
      for (const x of existing) {
        const nk = normalizeCourse(x)
        if (nk) merged.set(nk, String(x).trim())
      }
      if (fromCsv) {
        for (const [nk, disp] of fromCsv) {
          if (!merged.has(nk)) merged.set(nk, disp)
        }
      }
      if (merged.size > 0) {
        p.additionalCourses = [...merged.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([, disp]) => disp)
        if (fromCsv?.size) additionalMergedCount++
      } else {
        delete p.additionalCourses
      }
    }

    console.log(`SunSET CSV rows (all departments): ${lines.length - 1} data lines`)
    console.log(`Professors updated from SunSET DSC counts: ${dscUpdated}`)
    console.log(`Professors with SunSET non-DSC courses merged into additionalCourses: ${additionalMergedCount}`)
    console.log(
      `Unmatched professor+course keys (no roster row / ambiguous name): ${unmatchedPairs.size}`,
    )

    const unmatchedCsvNames = new Set()
    for (const key of unmatchedPairs.keys()) {
      const profRaw = key.split('|')[0]
      unmatchedCsvNames.add(profRaw)
    }
    if (unmatchedCsvNames.size > 0) {
      console.log(`Distinct CSV professor strings still unmatched (${unmatchedCsvNames.size}):`)
      for (const raw of [...unmatchedCsvNames].sort()) {
        console.log(`  ${raw} → ${csvProfessorToDisplayName(raw)}`)
      }
    }

    if (!dry) {
      fs.writeFileSync(PROF_PATH, JSON.stringify(professors, null, 2) + '\n')
      console.log(`Wrote ${PROF_PATH}`)
    } else {
      console.log('Dry run: no file written.')
      for (const p of professors) {
        const cm = dscCountsById.get(p.id)
        const extra = nonDscById.get(p.id)
        if (!cm?.size && !extra?.size) continue
        const dscLine =
          cm?.size > 0
            ? (() => {
                const top = modeCourse(cm)
                const others = [...cm.keys()].filter((c) => c !== top).sort((a, b) => a.localeCompare(b))
                return `DSC most=${top}; DSC other=${others.join(', ') || '—'}`
              })()
            : 'DSC (unchanged)'
        const extraLine =
          extra?.size > 0 ? `; additional=${[...extra.keys()].sort((a, b) => a.localeCompare(b)).join(', ')}` : ''
        console.log(`  ${p.name}: ${dscLine}${extraLine}`)
      }
    }
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

main()
