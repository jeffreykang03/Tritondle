/**
 * In-house roster CSV for review (Excel / Google Sheets).
 * Source of truth remains src/data/professors.json — re-run after edits.
 *
 *   npm run roster:spreadsheet
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  labelAppointment,
  labelResearchTheme,
  sortAppointments,
  sortResearchThemes,
} from '../src/constants/hdsiCatalog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const JSON_PATH = join(ROOT, 'src/data/professors.json')
const OUT_PATH = join(ROOT, 'roster/professors-roster.csv')

const CLASS_BAND_KEYS = new Set(['lower', 'upper', 'grad'])

/** @param {string | null | undefined} s */
function csvCell(s) {
  if (s == null || s === '') return ''
  const t = String(s)
  if (/[\r\n",]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

function joinList(arr, sep = '; ') {
  if (!Array.isArray(arr) || arr.length === 0) return ''
  return arr.map((x) => String(x).trim()).filter(Boolean).join(sep)
}

/** @param {object} p */
function hasPrimary(p) {
  return p.mostTaughtClass != null && String(p.mostTaughtClass).trim() !== ''
}

/** Count distinct real other/extra course strings (bands excluded). */
function realOtherCount(p) {
  const rawOther = (p.otherClasses ?? [])
    .map((x) => String(x).trim())
    .filter(Boolean)
    .filter((x) => !CLASS_BAND_KEYS.has(x.toLowerCase()))
  const rawAdd = Array.isArray(p.additionalCourses)
    ? p.additionalCourses.map((x) => String(x).trim()).filter(Boolean)
    : []
  const keys = [...rawOther, ...rawAdd].map((x) => x.toLowerCase())
  return new Set(keys).size
}

/** @param {object} p */
function activeRow(p) {
  return p.active !== false ? 'yes' : 'no'
}

const professors = JSON.parse(readFileSync(JSON_PATH, 'utf8'))

const headers = [
  'id',
  'name',
  'active_in_game',
  'has_most_taught_primary',
  'real_other_course_count',
  'has_primary_or_real_other',
  'most_taught_primary',
  'other_classes_raw',
  'additional_courses_raw',
  'ucsd_start_year',
  'appointments_slugs',
  'appointments_labels',
  'research_slugs',
  'research_labels',
  'hint_1',
  'hint_2',
]

const lines = [headers.join(',')]

for (const p of [...professors].sort((a, b) => a.id.localeCompare(b.id))) {
  const apRaw = [...new Set((p.appointments ?? []).map((x) => String(x).trim()).filter(Boolean))]
  const rsRaw = [...new Set((p.researchAreas ?? []).map((x) => String(x).trim()).filter(Boolean))]
  const hints = Array.isArray(p.hints) ? p.hints : []
  const roc = realOtherCount(p)
  const hp = hasPrimary(p)

  const row = [
    csvCell(p.id),
    csvCell(p.name),
    csvCell(activeRow(p)),
    csvCell(hp ? 'yes' : 'no'),
    csvCell(String(roc)),
    csvCell(hp || roc > 0 ? 'yes' : 'no'),
    csvCell(p.mostTaughtClass ?? ''),
    csvCell(joinList(p.otherClasses, '; ')),
    csvCell(joinList(p.additionalCourses, '; ')),
    csvCell(p.ucsdStartYear != null ? String(p.ucsdStartYear) : ''),
    csvCell(joinList(sortAppointments(apRaw), '; ')),
    csvCell(joinList(sortAppointments(apRaw).map(labelAppointment), '; ')),
    csvCell(joinList(sortResearchThemes(rsRaw), '; ')),
    csvCell(joinList(sortResearchThemes(rsRaw).map(labelResearchTheme), '; ')),
    csvCell(hints[0] ?? ''),
    csvCell(hints[1] ?? ''),
  ]
  lines.push(row.join(','))
}

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, lines.join('\n') + '\n', 'utf8')
console.log(`Wrote ${OUT_PATH} (${professors.length} rows + header)`)
