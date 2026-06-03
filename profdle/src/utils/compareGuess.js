import { getUcsdYears } from './ucsdYears.js'

/** DSC / band tags plus optional non-DSC courses (e.g. COGS), trimmed strings */
function mergeCourseTags(prof) {
  const o = prof.otherClasses ?? []
  const x = prof.additionalCourses ?? []
  return [...o, ...x].map((s) => String(s).trim()).filter(Boolean)
}

const CLASS_BAND_KEYS = new Set(['lower', 'upper', 'grad'])

function splitRealVsBandTags(tags) {
  const reals = []
  const bands = []
  for (const t of tags) {
    const k = String(t).trim()
    if (!k) continue
    if (CLASS_BAND_KEYS.has(k.toLowerCase())) bands.push(k)
    else reals.push(k)
  }
  return { reals, bands }
}

/** Shared overlap tiers for two sets of string tags */
function compareTagSets(gs, ts) {
  if (gs.size === 0 && ts.size === 0) return 'match'
  if (gs.size === 0 || ts.size === 0) return 'none'
  let inter = 0
  for (const x of gs) {
    if (ts.has(x)) inter++
  }
  if (gs.size === ts.size && inter === gs.size) return 'match'
  if (inter >= 2) return 'partial'
  if (inter === 1) return 'partial-weak'
  return 'none'
}

/**
 * Other courses: overlap on real DSC / extra codes (not level bands).
 * When neither side lists any real code, treat as green — bands are placeholders and are hidden in the UI ("—"),
 * so comparing band sets vs empty produced inconsistent reds for identical-looking cells.
 */
function compareOtherCourseTags(guessList, targetList) {
  const { reals: gr } = splitRealVsBandTags(guessList)
  const { reals: tr } = splitRealVsBandTags(targetList)
  const gs = new Set(gr)
  const ts = new Set(tr)

  if (gs.size === 0 && ts.size === 0) {
    return 'match'
  }

  return compareTagSets(gs, ts)
}

/** Tag overlap for hubs/directory labels; both empty → match (same “no tags”). */
function compareTaggedOverlap(guessList, targetList) {
  const gs = new Set(guessList.map(String).filter(Boolean))
  const ts = new Set(targetList.map(String).filter(Boolean))
  if (gs.size === 0 && ts.size === 0) return 'match'
  if (gs.size === 0 || ts.size === 0) return 'none'
  return compareTagSets(gs, ts)
}

function compareYears(guessYears, targetYears) {
  const g = Number(guessYears)
  const t = Number(targetYears)
  if (!Number.isFinite(g) || !Number.isFinite(t)) return 'none'
  if (g === t) return 'match'
  if (Math.abs(g - t) <= 2) return 'partial'
  return 'none'
}

/** When both sides have numeric years and they differ: toward answer's count (↑ = answer has more years). */
function yearsArrowHint(guessYears, targetYears) {
  const g = Number(guessYears)
  const t = Number(targetYears)
  if (!Number.isFinite(g) || !Number.isFinite(t)) return null
  if (g === t) return null
  return g < t ? 'up' : 'down'
}

function normToken(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Parse catalog-style codes: "DSC 40", "dsc 40B", "COGS108", "DSC 210".
 * Returns null if the string doesn't match department + digits + optional letter suffix.
 */
function parseCatalogCourse(code) {
  const s = String(code ?? '').trim()
  if (!s) return null
  const m = s.match(/^([A-Za-z]+)\s*(\d+)\s*([A-Za-z]*)$/i)
  if (!m) return null
  const dept = m[1].toUpperCase()
  const num = Number(m[2])
  const suf = (m[3] || '').toLowerCase()
  if (!Number.isFinite(num)) return null
  return { dept, num, suf }
}

function catalogCourseCmp(a, b) {
  if (a.num !== b.num) return a.num - b.num
  return a.suf.localeCompare(b.suf)
}

/**
 * Same department only; ↑ when the answer's course sorts after the guess (e.g. DSC 40 → DSC 40B, DSC 40 → DSC 210).
 */
function mostTaughtCourseArrowHint(guessMt, targetMt) {
  const g = parseCatalogCourse(guessMt)
  const t = parseCatalogCourse(targetMt)
  if (!g || !t || g.dept !== t.dept) return null
  const cmp = catalogCourseCmp(g, t)
  if (cmp === 0) return null
  return cmp < 0 ? 'up' : 'down'
}

/** Same department: yellow if course numbers are within this gap (inclusive), else orange. */
const MOST_TAUGHT_CLOSE_NUMBER_GAP = 20

/**
 * SunSET primary: green = same code; yellow = listed among answer's other courses, or same
 * department and course numbers within MOST_TAUGHT_CLOSE_NUMBER_GAP; orange = same department
 * but farther apart; red = different department or unparsed.
 */
function compareMostTaughtClass(guessMt, targetMt, targetOtherTags) {
  const ge = guessMt == null || String(guessMt).trim() === ''
  const te = targetMt == null || String(targetMt).trim() === ''

  /** Neither row lists a primary — same empty UI ("—"); treat as match (like Other courses with no real codes). */
  if (ge && te) {
    return 'match'
  }

  if (!ge && !te && normToken(guessMt) === normToken(targetMt)) return 'match'

  if (!ge) {
    const gKey = normToken(guessMt)
    const otherNorms = new Set(targetOtherTags.map((t) => normToken(t)))
    if (otherNorms.has(gKey)) return 'partial'
  }

  if (ge || te) return 'none'

  const gParsed = parseCatalogCourse(guessMt)
  const tParsed = parseCatalogCourse(targetMt)
  if (gParsed && tParsed && gParsed.dept === tParsed.dept) {
    const numDist = Math.abs(gParsed.num - tParsed.num)
    if (numDist <= MOST_TAUGHT_CLOSE_NUMBER_GAP) return 'partial'
    return 'partial-weak'
  }

  return 'none'
}

/**
 * Compare a guessed professor to the daily target.
 * Expects: appointments (faculty directory tags), mostTaughtClass (optional),
 * otherClasses, optional additionalCourses, researchAreas; UCSD years via {@link prof.ucsdStartYear} — see docs/ucsd-years-data.md.
 */
export function compareGuess(guess, target, puzzleDayKey) {
  const isCorrect = guess.id === target.id

  const guessYears = getUcsdYears(guess, puzzleDayKey)
  const targetYears = getUcsdYears(target, puzzleDayKey)

  const ga = guess.appointments ?? []
  const ta = target.appointments ?? []
  const appointmentStatus = compareTaggedOverlap(ga, ta)

  const guessMt = guess.mostTaughtClass
  const targetMt = target.mostTaughtClass

  const to = mergeCourseTags(target)
  const mostTaughtStatus = compareMostTaughtClass(guessMt, targetMt, to)

  const go = mergeCourseTags(guess)
  const otherClassesStatus = compareOtherCourseTags(go, to)

  const gr = guess.researchAreas ?? []
  const tr = target.researchAreas ?? []
  const researchStatus = compareTaggedOverlap(gr, tr)

  const yearsStatus = compareYears(guessYears, targetYears)
  const yearsArrow = yearsArrowHint(guessYears, targetYears)
  const mostTaughtArrow = mostTaughtCourseArrowHint(guessMt, targetMt)

  return {
    isCorrect,
    appointmentStatus,
    mostTaughtStatus,
    mostTaughtArrow,
    otherClassesStatus,
    researchStatus,
    yearsStatus,
    yearsArrow,
  }
}
