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
            Thematic hints unlock after 5 and 10 tries. After 15 tries, the answer&apos;s SunSET{' '}
            <strong>most-taught course</strong> is shown when the roster lists one; otherwise you see{' '}
            <strong>real course codes</strong> from that row&apos;s DSC / extra course tags (band-only tags like
            “lower” don&apos;t count). If there are no course tags at all, the hint says so.
          </p>
          <p>
            <strong>DSC tenure</strong> is whole calendar years from each professor&apos;s roster affiliation{' '}
            <strong>start year</strong> through this puzzle&apos;s calendar year—the same progression as UCSD DSC
            faculty listings, not strictly “years since the Halicioğlu-era institute existed.” Start years come from{' '}
            <strong>yearsAtHdsi</strong> on each row plus <strong>manual</strong> exceptions;{' '}
            <code>years:populate</code> derives <strong>start years</strong> from the roster using the Pacific
            calendar&apos;s puzzle year minus that count so displayed tenure advances year over year—not HR-official data. Green / yellow / arrows work like other numeric columns.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
