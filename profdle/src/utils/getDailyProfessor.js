import { getPacificDayNumberFromKey } from './pacificDate.js'

const TEACHING_FACULTY = 'teaching-faculty'
const ASSOCIATE_FACULTY = 'associate-faculty'
const CLASS_BANDS = new Set(['lower', 'upper', 'grad'])

/** @param {string | null | undefined} course */
function dscCourseNumber(course) {
  const m = String(course ?? '').match(/DSC\s*(\d+)/i)
  return m ? Number(m[1]) : null
}

/**
 * Roster rows eligible for the puzzle and guess list (`active !== false`), stable-sorted by id.
 * @param {object[]} professors
 */
export function getActiveProfessors(professors) {
  return professors
    .filter((p) => p.active !== false)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Teaching Faculty only on the HDSI directory.
 * @param {object} prof
 */
export function isTeachingFacultyOnly(prof) {
  const slugs = prof.appointments ?? []
  if (slugs.length === 0) return false
  return slugs.every((s) => s === TEACHING_FACULTY)
}

/** SunSET primary is an undergrad DSC course (DSC number &lt; 200). */
export function hasUndergradMostTaught(prof) {
  const n = dscCourseNumber(prof.mostTaughtClass)
  return n != null && n < 200
}

function hasLowerOrUpperBand(prof) {
  return (prof.otherClasses ?? []).some((t) => {
    const k = String(t).trim().toLowerCase()
    return k === 'lower' || k === 'upper'
  })
}

function isGradOnlyBands(prof) {
  const bands = (prof.otherClasses ?? [])
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => CLASS_BANDS.has(t))
  return bands.length > 0 && bands.every((t) => t === 'grad')
}

/**
 * Undergrad-focused puzzle pool: teaching faculty, faculty with an undergrad SunSET primary,
 * or associates who list lower/upper teaching bands.
 * @param {object} prof
 */
export function isUndergradPuzzleEligible(prof) {
  if (isTeachingFacultyOnly(prof)) return true
  if (hasUndergradMostTaught(prof)) return true
  const appointments = prof.appointments ?? []
  if (appointments.includes(ASSOCIATE_FACULTY) && hasLowerOrUpperBand(prof) && !isGradOnlyBands(prof)) {
    return true
  }
  return false
}

/**
 * Active undergrad-puzzle roster rows; same pool as daily rotation and autocomplete.
 * @param {object[]} professors
 */
export function getUndergradPuzzleProfessors(professors) {
  return getActiveProfessors(professors).filter(isUndergradPuzzleEligible)
}

/** @deprecated Use {@link getUndergradPuzzleProfessors} */
export function getTeachingFacultyProfessors(professors) {
  return getUndergradPuzzleProfessors(professors)
}

/**
 * Pick the puzzle professor for a given Pacific calendar day (`YYYY-MM-DD` in America/Los_Angeles).
 * Rotates through {@link getUndergradPuzzleProfessors}.
 */
export function getDailyProfessor(professors, puzzleDayKey) {
  const pool = getUndergradPuzzleProfessors(professors)

  if (pool.length === 0) {
    throw new Error('No undergrad-puzzle professors in data.')
  }

  const dayNum = getPacificDayNumberFromKey(puzzleDayKey)
  const idx = ((dayNum % pool.length) + pool.length) % pool.length
  return pool[idx]
}
