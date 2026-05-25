import { useMemo, useState } from 'react'
import { normalize } from '../utils/normalize.js'

/** True if query matches the start of the full name or the start of any word (e.g. last name). */
function nameLeadingMatch(name, q) {
  if (!q) return false
  const n = normalize(name)
  if (n.startsWith(q)) return true
  return n.split(/\s+/).some((part) => part.length > 0 && part.startsWith(q))
}

/** Stable random ordering: same shuffle for the lifetime of this professors list. */
function shuffleRankMap(ids) {
  const shuffled = [...ids]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const rank = new Map()
  shuffled.forEach((id, idx) => rank.set(id, idx))
  return rank
}

export function GuessInput({ professors, guesses, disabled, onGuess }) {
  const [query, setQuery] = useState('')

  const professorsDeduped = useMemo(() => {
    const byId = new Map()
    for (const p of professors) {
      if (!byId.has(p.id)) byId.set(p.id, p)
    }
    return [...byId.values()]
  }, [professors])

  const guessedIds = useMemo(() => new Set(guesses.map((g) => g.id)), [guesses])

  const randomRank = useMemo(
    () => shuffleRankMap(professorsDeduped.map((p) => p.id)),
    [professorsDeduped],
  )

  const { orderedList, prefixMatches } = useMemo(() => {
    const eligible = professorsDeduped.filter((p) => !guessedIds.has(p.id))
    const q = normalize(query)

    if (eligible.length === 0) {
      return { orderedList: [], prefixMatches: [] }
    }

    if (!q) {
      const ordered = [...eligible].sort(
        (a, b) => (randomRank.get(b.id) ?? 0) - (randomRank.get(a.id) ?? 0),
      )
      return { orderedList: ordered, prefixMatches: [] }
    }

    const prefix = eligible.filter((p) => nameLeadingMatch(p.name, q))
    const prefixIds = new Set(prefix.map((p) => p.id))
    const rest = eligible.filter((p) => !prefixIds.has(p.id))

    prefix.sort((a, b) => b.name.localeCompare(a.name))
    rest.sort((a, b) => (randomRank.get(b.id) ?? 0) - (randomRank.get(a.id) ?? 0))

    return { orderedList: [...prefix, ...rest], prefixMatches: prefix }
  }, [professorsDeduped, guessedIds, query, randomRank])

  function professorToSubmitViaShortcut() {
    if (orderedList.length === 1) return orderedList[0]
    const q = normalize(query)
    if (q !== '' && prefixMatches.length === 1) return prefixMatches[0]
    return null
  }

  const canGuess = !disabled && professorToSubmitViaShortcut() != null

  function submitProfessor(prof) {
    if (disabled || !prof) return
    onGuess(prof)
    setQuery('')
  }

  function handleGuessClick() {
    submitProfessor(professorToSubmitViaShortcut())
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    const prof = professorToSubmitViaShortcut()
    if (prof) {
      e.preventDefault()
      submitProfessor(prof)
    }
  }

  const hasTyped = normalize(query) !== ''
  const showDropdown = !disabled && hasTyped && orderedList.length > 0

  return (
    <div className="guess-input">
      <label className="guess-input-label" htmlFor="professor-query">
        Guess a professor
      </label>
      <div className="guess-input-combo">
        <div className="guess-input-row">
          <input
            id="professor-query"
            type="text"
            autoComplete="off"
            placeholder="Start typing a name…"
            value={query}
            disabled={disabled}
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? 'professor-suggestions' : undefined}
            aria-autocomplete="list"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="button" disabled={!canGuess} onClick={handleGuessClick}>
            Guess
          </button>
        </div>

        {showDropdown && (
          <ul
            id="professor-suggestions"
            className="suggestions-dropdown"
            role="listbox"
            aria-label="Matching professors"
          >
            {orderedList.map((p) => (
              <li key={p.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  className="suggestion-btn"
                  disabled={disabled}
                  onClick={() => submitProfessor(p)}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!disabled && orderedList.length === 0 && (
        <p className="guess-input-hint">Every professor has already been guessed.</p>
      )}

      {showDropdown && !canGuess && (
        <p className="guess-input-hint">
          Names matching what you typed (including last names) stay at the top; pick from the menu or narrow until
          Guess unlocks.
        </p>
      )}
    </div>
  )
}
