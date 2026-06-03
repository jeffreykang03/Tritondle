/** Institute public-era anchor (~2018). Not a ceiling on departmental hires at UCSD. */
export const HDSI_LAUNCH_YEAR = 2018

export function puzzleCalendarYear(puzzleDayKey) {
  const raw = String(puzzleDayKey ?? '').slice(0, 4)
  const y = Number(raw)
  return Number.isFinite(y) ? y : undefined
}

/**
 * Whole calendar years **at UCSD** for the puzzle column (displayed “UCSD years”):
 * `puzzle calendar year − ucsdStartYear` (floored at 0).
 *
 * **`ucsdStartYear`** must be maintained on each `professors.json` row (calendar year first roster-listed/joined; see docs).
 * Overrides and sync: **`npm run years:populate`** — see **`docs/ucsd-years-data.md`**.
 */
export function getUcsdYears(prof, puzzleDayKey) {
  if (!prof) return null
  const py = puzzleCalendarYear(puzzleDayKey)
  const start = prof.ucsdStartYear
  if (Number.isFinite(Number(start)) && Number.isFinite(py)) {
    return Math.max(0, py - Number(start))
  }
  return null
}
