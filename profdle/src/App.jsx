import { useEffect, useMemo, useState } from 'react'
import professors from './data/professors.json'
import { GuessInput } from './components/GuessInput.jsx'
import { GuessTable } from './components/GuessTable.jsx'
import { HintBox } from './components/HintBox.jsx'
import { EndModal } from './components/EndModal.jsx'
import { FootnoteDialog } from './components/FootnoteDialog.jsx'
import { HowToPlayDialog } from './components/HowToPlayDialog.jsx'
import { buildShareText } from './utils/gameShare.js'
import {
  clearPersistedGame,
  loadPersistedGame,
  savePersistedGame,
} from './utils/gameStorage.js'
import { getDailyProfessor, getActiveProfessors } from './utils/getDailyProfessor.js'
import { getPacificDateKey } from './utils/pacificDate.js'

function initGame() {
  const puzzleDayKey = getPacificDateKey(new Date())
  const target = getDailyProfessor(professors, puzzleDayKey)
  const defaults = {
    guesses: [],
    status: 'playing',
    winModalDismissed: false,
  }
  const saved = loadPersistedGame({ puzzleDayKey, targetId: target.id })
  if (!saved) {
    return { puzzleDayKey, target, ...defaults }
  }
  const guesses = saved.guessIds
    .map((id) => professors.find((p) => p.id === id))
    .filter(Boolean)
  return {
    puzzleDayKey,
    target,
    guesses,
    status: saved.status === 'won' ? 'won' : 'playing',
    winModalDismissed: saved.winModalDismissed === true,
  }
}

export default function App() {
  const [init] = useState(() => initGame())

  const [guesses, setGuesses] = useState(init.guesses)
  const [status, setStatus] = useState(init.status)
  const [winModalDismissed, setWinModalDismissed] = useState(init.winModalDismissed ?? false)
  const [footnoteOpen, setFootnoteOpen] = useState(false)
  const [howToPlayOpen, setHowToPlayOpen] = useState(false)

  const activeProfessors = useMemo(() => getActiveProfessors(professors), [])

  const shareText = useMemo(
    () =>
      buildShareText({
        guesses,
        target: init.target,
        puzzleDayKey: init.puzzleDayKey,
        gameUrl: typeof window !== 'undefined' ? window.location.href : '',
      }),
    [guesses, init.target, init.puzzleDayKey],
  )

  useEffect(() => {
    savePersistedGame({
      puzzleDayKey: init.puzzleDayKey,
      targetId: init.target.id,
      guessIds: guesses.map((g) => g.id),
      status,
      winModalDismissed,
    })
  }, [init.puzzleDayKey, init.target.id, guesses, status, winModalDismissed])

  useEffect(() => {
    const key = init.puzzleDayKey
    const id = window.setInterval(() => {
      if (getPacificDateKey(new Date()) !== key) {
        window.location.reload()
      }
    }, 45_000)
    return () => window.clearInterval(id)
  }, [init.puzzleDayKey])

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined

    window.__profdleReset = () => {
      clearPersistedGame()
      window.location.reload()
    }
    return () => {
      delete window.__profdleReset
    }
  }, [])

  function handleGuess(professor) {
    if (status !== 'playing') return
    if (guesses.some((g) => g.id === professor.id)) return

    const next = [...guesses, professor]
    setGuesses(next)

    if (professor.id === init.target.id) {
      setWinModalDismissed(false)
      setStatus('won')
    }
  }

  const playing = status === 'playing'

  return (
    <main className="profdle">
      <header className="profdle-header">
        <div className="profdle-header-top">
          <h1>HDSI Profdle</h1>
          <div className="header-help-btns" role="group" aria-label="Help">
            <button
              type="button"
              className="info-icon-btn howto-btn"
              aria-label="How to play"
              aria-expanded={howToPlayOpen}
              aria-haspopup="dialog"
              aria-controls="howto-dialog"
              onClick={() => {
                setHowToPlayOpen((open) => !open)
                setFootnoteOpen(false)
              }}
            >
              <span className="info-icon-char" aria-hidden="true">
                ?
              </span>
            </button>
            <button
              type="button"
              className="info-icon-btn"
              aria-label="About data and scoring"
              aria-expanded={footnoteOpen}
              aria-haspopup="dialog"
              aria-controls="footnote-dialog"
              onClick={() => {
                setFootnoteOpen((open) => !open)
                setHowToPlayOpen(false)
              }}
            >
              <span className="info-icon-char" aria-hidden="true">
                i
              </span>
            </button>
          </div>
        </div>
        <p className="subtitle">Guess the HDSI professor!</p>
      </header>

      <GuessInput
        professors={activeProfessors}
        guesses={guesses}
        disabled={!playing}
        onGuess={handleGuess}
      />

      <GuessTable guesses={guesses} target={init.target} puzzleDayKey={init.puzzleDayKey} />

      <HintBox target={init.target} guessCount={guesses.length} />

      <HowToPlayDialog open={howToPlayOpen} onDismiss={() => setHowToPlayOpen(false)} />
      <FootnoteDialog open={footnoteOpen} onDismiss={() => setFootnoteOpen(false)} />

      <EndModal
        open={status === 'won' && !winModalDismissed}
        guessCount={guesses.length}
        shareText={shareText}
        onDismiss={() => setWinModalDismissed(true)}
      />
    </main>
  )
}
