/** UCSD-local calendar day (America/Los_Angeles), ISO-like `YYYY-MM-DD`. */
export function getPacificDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Stable integer per Pacific calendar day (for deterministic indexing). */
export function getPacificDayNumberFromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}
