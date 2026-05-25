import { useEffect, useState } from 'react'

export function EndModal({ open, guessCount, shareText, onDismiss }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') onDismiss?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onDismiss])

  if (!open) return null

  return (
    <div
      className="end-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-modal-title"
      onClick={onDismiss}
    >
      <div className="end-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="end-close" aria-label="Close" onClick={onDismiss}>
          ×
        </button>
        <p id="end-modal-title" className="end-title">
          You got it in {guessCount} {guessCount === 1 ? 'guess' : 'guesses'}!
        </p>
        <button type="button" className="end-card-btn" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy results'}
        </button>
      </div>
    </div>
  )
}
