import { getPacificDayNumberFromKey } from './pacificDate.js'

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
 * Pick the puzzle professor for a given Pacific calendar day (`YYYY-MM-DD` in America/Los_Angeles).
 * Only {@link active} roster rows (`active !== false`) are eligible — same pool as the guess UI.
 */
export function getDailyProfessor(professors, puzzleDayKey) {
  const active = getActiveProfessors(professors)

  if (active.length === 0) {
    throw new Error('No active professors in data.')
  }

  const dayNum = getPacificDayNumberFromKey(puzzleDayKey)
  const idx = ((dayNum % active.length) + active.length) % active.length
  return active[idx]
}
