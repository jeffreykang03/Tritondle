export const GAME_STORAGE_KEY = 'profdle-game-v2'

export function clearPersistedGame() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(GAME_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** If URL has ?reset, clear saved game and strip the param (no reload). Call before React mounts. */
export function consumeResetQuery() {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('reset')) return false
    clearPersistedGame()
    params.delete('reset')
    const qs = params.toString()
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`,
    )
    return true
  } catch {
    return false
  }
}

export function loadPersistedGame({ puzzleDayKey, targetId }) {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data.puzzleDayKey !== puzzleDayKey || data.targetId !== targetId) return null
    if (!Array.isArray(data.guessIds)) return null
    return data
  } catch {
    return null
  }
}

export function savePersistedGame({
  puzzleDayKey,
  targetId,
  guessIds,
  status,
  winModalDismissed = false,
}) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      GAME_STORAGE_KEY,
      JSON.stringify({
        puzzleDayKey,
        targetId,
        guessIds,
        status,
        winModalDismissed,
      }),
    )
  } catch {
    // quota / private mode
  }
}
