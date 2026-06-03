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
import {
  getDailyProfessor,
  getUndergradPuzzleProfessors,
} from './utils/getDailyProfessor.js'
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
    status:
      saved.status === 'won' ? 'won' : saved.status === 'gaveUp' ? 'gaveUp' : 'playing',
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
  const [giveUpPending, setGiveUpPending] = useState(false)

  const activeProfessors = useMemo(() => getUndergradPuzzleProfessors(professors), [])

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
      setGiveUpPending(false)
      setWinModalDismissed(false)
      setStatus('won')
    }
  }

  function requestGiveUp() {
    if (status !== 'playing') return
    setGiveUpPending(true)
  }

  function confirmGiveUp() {
    setGiveUpPending(false)
    setWinModalDismissed(false)
    setStatus('gaveUp')
  }

  function cancelGiveUp() {
    setGiveUpPending(false)
  }

  function showResultsAgain() {
    setWinModalDismissed(false)
  }

  function startOver() {
    clearPersistedGame()
    window.location.href = window.location.pathname
  }

  const playing = status === 'playing'
  const endModalOpen = (status === 'won' || status === 'gaveUp') && !winModalDismissed

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
        <p className="subtitle">Guess today&apos;s HDSI undergrad professor!</p>
      </header>

      {!playing ? (
        <div className="game-complete-banner" role="status">
          <p className="game-complete-text">
            {status === 'gaveUp'
              ? 'You gave up on today\u2019s puzzle.'
              : `You solved today\u2019s puzzle in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}!`}
          </p>
          <div className="game-complete-actions">
            {!endModalOpen ? (
              <button type="button" className="game-complete-btn" onClick={showResultsAgain}>
                View results
              </button>
            ) : null}
            <button type="button" className="game-complete-btn game-complete-btn--muted" onClick={startOver}>
              Start over
            </button>
          </div>
        </div>
      ) : null}

      <GuessInput
        professors={activeProfessors}
        guesses={guesses}
        disabled={!playing}
        inputHint={playing ? undefined : 'Today\u2019s puzzle is finished.'}
        onGuess={handleGuess}
      />

      <GuessTable guesses={guesses} target={init.target} puzzleDayKey={init.puzzleDayKey} />

      {playing ? (
        <div className={`give-up-row${giveUpPending ? ' give-up-row--confirm' : ''}`}>
          {giveUpPending ? (
            <>
              <p className="give-up-confirm-text">Reveal today&apos;s answer?</p>
              <button type="button" className="give-up-btn" onClick={cancelGiveUp}>
                Cancel
              </button>
              <button type="button" className="give-up-btn give-up-btn--danger" onClick={confirmGiveUp}>
                Yes, give up
              </button>
            </>
          ) : (
            <button type="button" className="give-up-btn" onClick={requestGiveUp}>
              Give up
            </button>
          )}
        </div>
      ) : null}

      <HintBox target={init.target} guessCount={guesses.length} />

      <HowToPlayDialog open={howToPlayOpen} onDismiss={() => setHowToPlayOpen(false)} />
      <FootnoteDialog open={footnoteOpen} onDismiss={() => setFootnoteOpen(false)} />

      <EndModal
        open={endModalOpen}
        variant={status === 'gaveUp' ? 'gaveUp' : 'won'}
        answerName={init.target.name}
        guessCount={guesses.length}
        shareText={shareText}
        onDismiss={() => setWinModalDismissed(true)}
      />
    </main>
  )
}
