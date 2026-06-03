import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function FootnoteDialog({ open, onDismiss }) {
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
        id="footnote-dialog"
        className="info-card info-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="footnote-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="info-close" aria-label="Close" onClick={onDismiss}>
          ×
        </button>
        <h2 id="footnote-dialog-title" className="info-dialog-title">
          About this puzzle
        </h2>
        <div className="info-dialog-body">
          <p>
            Course data is obtained from SunSETs at{' '}
            <a href="https://sheeptester.github.io/ucsd-sunset/" target="_blank" rel="noopener noreferrer">
              https://sheeptester.github.io/ucsd-sunset/
            </a>, professor data obtained from HDSI website.
          </p>
          <p>
            General hints unlock after 5 and 10 tries. After 15 tries, the answer&apos;s SunSET{' '}
            <strong>most-taught course</strong> is shown if available. Otherwise, other courses professor has taught are shown.
          </p>
          <p>
            HDSI tenure is WIP, only partial data.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
