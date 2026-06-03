import { compareGuess } from './compareGuess.js'

function cellEmoji(status) {
  if (status === 'match') return '🟩'
  if (status === 'partial') return '🟨'
  if (status === 'partial-weak') return '🟧'
  return '🟥'
}

/** Wordle-style grid: Name · Faculty listing · Research · Most taught · Other courses · HDSI tenure */
export function buildShareText({ guesses, target, puzzleDayKey, gameUrl }) {
  const n = guesses.length
  const header = `HDSI Profdle ${puzzleDayKey} · ${n} ${n === 1 ? 'guess' : 'guesses'}\n`
  const rows = guesses.map((g) => {
    const r = compareGuess(g, target, puzzleDayKey)
    const nameSq = r.isCorrect ? '🟩' : '⬜'
    return [
      nameSq,
      cellEmoji(r.appointmentStatus),
      cellEmoji(r.researchStatus),
      cellEmoji(r.mostTaughtStatus),
      cellEmoji(r.otherClassesStatus),
      cellEmoji(r.yearsStatus),
    ].join('')
  })
  const legend = '\n⬜ name · 🟩🟨🟧🟥 columns\n'
  const link = gameUrl && String(gameUrl).trim() !== '' ? `\n${gameUrl.trim()}` : ''
  return header + rows.join('\n') + legend + link
}
