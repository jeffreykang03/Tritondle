import { getPacificDayNumberFromKey } from './pacificDate.js'

/**
 * Pick the puzzle professor for a given Pacific calendar day (`YYYY-MM-DD` in America/Los_Angeles).
 * Only {@link active} roster rows (`active !== false`) are eligible.
 */
export function getDailyProfessor(professors, puzzleDayKey) {
  const active = professors
    .filter((p) => p.active !== false)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))

  if (active.length === 0) {
    throw new Error('No active professors in data.')
  }

  const dayNum = getPacificDayNumberFromKey(puzzleDayKey)
  const idx = ((dayNum % active.length) + active.length) % active.length
  return active[idx]
}
