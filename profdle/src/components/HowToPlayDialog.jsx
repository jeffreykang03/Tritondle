import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function HowToPlayDialog({ open, onDismiss }) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') onDismiss?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onDismiss])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="info-overlay"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        id="howto-dialog"
        className="info-card info-popup howto-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="info-close" aria-label="Close" onClick={onDismiss}>
          ×
        </button>
        <h2 id="howto-dialog-title" className="info-dialog-title">
          How to play
        </h2>
        <div className="info-dialog-body howto-dialog-body">
          <p>
            Each day, you are trying to guess one HDSI professor. Using the categories and clues, deduce the professor's identity in as few tries as possible. Thematic hints unlock after 5 and 10 tries; an extra SunSET-related course hint
            unlocks after 15 tries.
          </p>

          <h3 className="howto-heading">Tile colors</h3>
          <p>Every column uses the same palette:</p>
          <p>
            <strong>Green</strong>: Exact match under that column&apos;s.
          </p>
          <p>
            <strong>Yellow</strong>: Strong partial which means two or more overlapping tags, SunSET primary course in
            the same department with course numbers within 20, or your guess&apos;s primary course is listed among the answer&apos;s
            other courses.
          </p>
          <p>
            <strong>Orange</strong>: Weak partial which means exactly one overlapping tag or same course department but
            numbers more than 20 apart.
          </p>
          <p>
            <strong>Red</strong>: No overlap.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
