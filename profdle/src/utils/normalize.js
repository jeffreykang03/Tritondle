/** Lowercase and trim for case-insensitive comparisons. */
export function normalize(str) {
  return String(str ?? '').trim().toLowerCase()
}
