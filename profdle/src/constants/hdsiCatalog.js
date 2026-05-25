/** Official HDSI research hub slugs (paths under /research/). */
export const RESEARCH_THEME_SLUGS = [
  'artificial-intelligence-and-machine-learning',
  'biomedical-data-science',
  'data-infrastructure-and-systems',
  'data-science-for-scientific-discovery',
  'data-and-society',
  'theoretical-foundations-of-data-science',
  'statistics',
]

const RESEARCH_LABEL = {
  'artificial-intelligence-and-machine-learning':
    'Artificial Intelligence and Machine Learning',
  'biomedical-data-science': 'Biomedical Data Science',
  'data-infrastructure-and-systems': 'Data Infrastructure and Systems',
  'data-science-for-scientific-discovery': 'Data Science for Scientific Discovery',
  'data-and-society': 'Data and Society',
  'theoretical-foundations-of-data-science': 'Theoretical Foundations of Data Science',
  statistics: 'Statistics',
}

/** Faculty directory filter values from datascience.ucsd.edu/faculty/ */
export const APPOINTMENT_SLUGS = [
  'associate-faculty',
  'endowed-chairs',
  'teaching-faculty',
  'tenure-track',
  'visiting',
]

const APPOINTMENT_LABEL = {
  'associate-faculty': 'Associates',
  'endowed-chairs': 'Endowed Chairs',
  'teaching-faculty': 'Teaching Faculty',
  'tenure-track': 'Tenure-Track',
  visiting: 'Visiting',
}

export function labelResearchTheme(slug) {
  const k = String(slug ?? '').trim()
  return RESEARCH_LABEL[k] ?? k
}

export function labelAppointment(slug) {
  const k = String(slug ?? '').trim()
  return APPOINTMENT_LABEL[k] ?? k
}

/** Sort themes in hub order for stable display */
export function sortResearchThemes(slugs) {
  const rank = new Map(RESEARCH_THEME_SLUGS.map((s, i) => [s, i]))
  return [...slugs].sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99))
}

/** Sort appointments like the directory strip (filters left-to-right) */
export function sortAppointments(slugs) {
  const rank = new Map(APPOINTMENT_SLUGS.map((s, i) => [s, i]))
  return [...slugs].sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99))
}
