import {
  labelAppointment,
  labelResearchTheme,
  sortAppointments,
  sortResearchThemes,
} from '../constants/hdsiCatalog.js'
import { compareGuess } from '../utils/compareGuess.js'
import { getUcsdYears } from '../utils/ucsdYears.js'

function cellClass(status) {
  if (status === 'match') return 'cell match'
  if (status === 'partial') return 'cell partial'
  if (status === 'partial-weak') return 'cell partial-weak'
  return 'cell none'
}

function formatMostTaught(value) {
  if (value == null || String(value).trim() === '') return '—'
  return String(value).trim()
}

const CLASS_BAND_KEYS = new Set(['lower', 'upper', 'grad'])

function dscCodesForDisplay(items) {
  if (!Array.isArray(items) || items.length === 0) return []
  return items
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0 && !CLASS_BAND_KEYS.has(x.toLowerCase()))
}

/** DSC / SunSET codes plus optional non-DSC tags (e.g. COGS); deduped, bands stripped */
function otherCoursesForDisplay(guess) {
  const dsc = dscCodesForDisplay(guess.otherClasses)
  const add = Array.isArray(guess.additionalCourses)
    ? guess.additionalCourses.map((x) => String(x).trim()).filter(Boolean)
    : []
  const out = []
  const seen = new Set()
  for (const x of [...dsc, ...add]) {
    const k = x.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

function joinParts(parts) {
  if (parts.length === 0) return '—'
  return parts.join(', ')
}

/** Small triangle toward the answer (years: higher UCSD years when ↑; catalog course: later course when ↑). */
function HintChevron({ direction }) {
  if (direction !== 'up' && direction !== 'down') return null
  const up = direction === 'up'
  return (
    <svg
      className="hint-chevron"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      focusable="false"
    >
      {up ? (
        <path d="M5 2 L8.5 7.5 H1.5 Z" fill="currentColor" />
      ) : (
        <path d="M5 8 L1.5 2.5 H8.5 Z" fill="currentColor" />
      )}
    </svg>
  )
}

function appointmentLabelsForDisplay(guess) {
  const raw = Array.isArray(guess.appointments)
    ? guess.appointments.map((x) => String(x).trim()).filter(Boolean)
    : []
  return sortAppointments([...new Set(raw)]).map(labelAppointment)
}

function researchLabelsForDisplay(guess) {
  const raw = Array.isArray(guess.researchAreas)
    ? guess.researchAreas.map((x) => String(x).trim()).filter(Boolean)
    : []
  return sortResearchThemes([...new Set(raw)]).map(labelResearchTheme)
}

export function GuessRow({ guess, target, puzzleDayKey }) {
  const r = compareGuess(guess, target, puzzleDayKey)
  const rowCorrect = r.isCorrect

  const yNum = getUcsdYears(guess, puzzleDayKey)
  const yearsDisplay = yNum != null && Number.isFinite(yNum) ? `${yNum}` : '—'

  const otherParts = otherCoursesForDisplay(guess)
  const directoryParts = appointmentLabelsForDisplay(guess)
  const researchParts = researchLabelsForDisplay(guess)

  const yearsCellTitle =
    r.yearsArrow === 'up'
      ? 'Answer has more DSC tenure (from this roster start year) than this professor'
      : r.yearsArrow === 'down'
        ? 'Answer has fewer DSC tenure (from this roster start year) than this professor'
        : undefined

  const mostTaughtCellTitle =
    r.mostTaughtArrow === 'up'
      ? 'Answer’s most-taught course is later in the catalog than this guess (same department)'
      : r.mostTaughtArrow === 'down'
        ? 'Answer’s most-taught course is earlier in the catalog than this guess (same department)'
        : undefined

  const cellTone = (status) => (rowCorrect ? 'cell match' : cellClass(status))

  return (
    <tr>
      <td className={rowCorrect ? 'cell match name-cell' : 'name-cell'}>{guess.name}</td>
      <td className={cellTone(r.appointmentStatus)}>{joinParts(directoryParts)}</td>
      <td className={cellTone(r.researchStatus)}>{joinParts(researchParts)}</td>
      <td className={cellTone(r.mostTaughtStatus)} title={mostTaughtCellTitle}>
        <span className="hint-cell">
          <span className="hint-cell-value">{formatMostTaught(guess.mostTaughtClass)}</span>
          <HintChevron direction={r.mostTaughtArrow} />
        </span>
      </td>
      <td className={cellTone(r.otherClassesStatus)}>{joinParts(otherParts)}</td>
      <td className={cellTone(r.yearsStatus)} title={yearsCellTitle}>
        <span className="hint-cell">
          <span className="hint-cell-value">{yearsDisplay}</span>
          <HintChevron direction={r.yearsArrow} />
        </span>
      </td>
    </tr>
  )
}
