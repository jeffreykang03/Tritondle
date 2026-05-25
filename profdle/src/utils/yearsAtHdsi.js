/** Institute public-era anchor (~2018). Not a ceiling on departmental hires at UCSD. */
export const HDSI_LAUNCH_YEAR = 2018

export function puzzleCalendarYear(puzzleDayKey) {
  const raw = String(puzzleDayKey ?? '').slice(0, 4)
  const y = Number(raw)
  return Number.isFinite(y) ? y : undefined
}

/**
 * Whole calendar years of **DSC tenure** (game column): `puzzleYear − hdsiStartYear` when synced.
 * `hdsiStartYear` comes from **`hdsi-start-years.json`** (`years:populate` + manual overrides in that JSON).
 * Falls back to legacy {@link prof.yearsAtHdsi} only when unset.
 */
export function getYearsAtHdsi(prof, puzzleDayKey) {
  if (!prof) return null
  const py = puzzleCalendarYear(puzzleDayKey)
  const start = prof.hdsiStartYear
  if (Number.isFinite(Number(start)) && Number.isFinite(py)) {
    return Math.max(0, py - Number(start))
  }
  const legacy = prof.yearsAtHdsi
  if (legacy != null && Number.isFinite(Number(legacy))) {
    return Number(legacy)
  }
  return null
}
