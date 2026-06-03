const HINT1_AT = 5
const HINT2_AT = 10
/** SunSET course hint: primary when present, else roster DSC / extra codes. */
const MOST_TAUGHT_HINT_AT = 15

/** Same band-only tags as compareGuess (not real course codes). */
const CLASS_BAND_KEYS = new Set(['lower', 'upper', 'grad'])

function moreTriesPhrase(n) {
  if (n <= 0) return null
  if (n === 1) return '1 more try'
  return `${n} more tries`
}

/** Real course strings from otherClasses + additionalCourses, deduped, sorted. */
function realCatalogCourses(target) {
  const raw = [...(target.otherClasses ?? []), ...(target.additionalCourses ?? [])]
    .map((s) => String(s).trim())
    .filter(Boolean)
  const out = []
  const seen = new Set()
  for (const x of raw) {
    if (CLASS_BAND_KEYS.has(x.toLowerCase())) continue
    const k = x.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function courseFinalHintRevealText(target) {
  const mt = target.mostTaughtClass
  if (mt != null && String(mt).trim() !== '') {
    return `Today’s SunSET most-taught course: ${String(mt).trim()}`
  }
  const courses = realCatalogCourses(target)
  if (courses.length > 0) {
    const max = 8
    const shown = courses.slice(0, max)
    const more =
      courses.length > max ? ` (+${courses.length - max} more on roster)` : ''
    return `No single SunSET primary is listed: roster DSC / extra courses include ${shown.join(', ')}${more}`
  }
  return 'No SunSET primary and no discrete course codes on this roster row.'
}

export function HintBox({ target, guessCount = 0 }) {
  const hints = Array.isArray(target.hints) ? target.hints : []

  const hint1 = hints[0]
  const hint2 = hints[1]

  const n = guessCount
  const unlocked1 = n >= HINT1_AT
  const unlocked2 = n >= HINT2_AT
  const unlockedMostTaught = n >= MOST_TAUGHT_HINT_AT

  const remaining1 = Math.max(0, HINT1_AT - n)
  const remaining2 = Math.max(0, HINT2_AT - n)
  const remainingMt = Math.max(0, MOST_TAUGHT_HINT_AT - n)

  const hasThematicHints = hints.length > 0

  return (
    <section className="hint-box" aria-label="Hints">
      <div className="hint-box-inner">
        <h2 className="hint-box-heading">Hints</h2>
        <div className="hint-list">
          {hasThematicHints ? (
            <>
              <p className={unlocked1 ? 'hint unlocked' : 'hint locked'}>
                <span className="hint-num-label">Hint #1</span>
                {unlocked1 ? (
                  <>
                    <span className="hint-num-sep">: </span>
                    {hint1 ?? 'No hint available.'}
                  </>
                ) : (
                  <>
                    <span className="hint-num-sep">: </span>
                    unlocks in {moreTriesPhrase(remaining1)}.
                  </>
                )}
              </p>
              <p className={unlocked2 ? 'hint unlocked' : 'hint locked'}>
                <span className="hint-num-label">Hint #2</span>
                {unlocked2 ? (
                  <>
                    <span className="hint-num-sep">: </span>
                    {hint2 ?? 'No second hint.'}
                  </>
                ) : (
                  <>
                    <span className="hint-num-sep">: </span>
                    unlocks in {moreTriesPhrase(remaining2)}.
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="hint-box-meta">No thematic hints for today’s puzzle.</p>
          )}
          <p className={unlockedMostTaught ? 'hint unlocked' : 'hint locked'}>
            <span className="hint-num-label">Course hint</span>
            {unlockedMostTaught ? (
              <>
                <span className="hint-num-sep">: </span>
                {courseFinalHintRevealText(target)}
              </>
            ) : (
              <>
                <span className="hint-num-sep">: </span>
                SunSET course (most-taught or roster) unlocks in {moreTriesPhrase(remainingMt)}.
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}
