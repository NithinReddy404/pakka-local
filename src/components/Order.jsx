import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PHONE_DISPLAY, PHONE_HREF } from '../menuData.js'
import { fill, useI18n } from '../i18n.js'
import { linesOf, orderStore, useOrder } from '../orderStore.js'
import { prefersReducedMotion } from '../motion.js'
import Stepper from './Stepper.jsx'

const money = (cents) => `$${(cents / 100).toFixed(2)}`

// The board's number as an SMS link. "?&body=" works on both iOS and Android.
const SMS_NUMBER = PHONE_HREF.replace(/^tel:/, '')
const smsHref = (body) => `sms:${SMS_NUMBER}?&body=${encodeURIComponent(body)}`

/** "Pakka Local order:\n2x Chicken Noodles $25.98\n...\nTotal $31.97" (always English). */
const orderText = (lines, totalCents) =>
  ['Pakka Local order:', ...lines.map((l) => `${l.n}x ${l.label} ${money(l.cents * l.n)}`), `Total ${money(totalCents)}`].join('\n')

/** Draws the order as a receipt in the yellow board style and returns a PNG blob. */
function receiptBlob(lines, totalCents) {
  const W = 720
  const PAD = 56
  const ROW = 52
  const H = 300 + lines.length * ROW + 170
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const INK = '#141414'
  g.fillStyle = '#fff8e6'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#ffbe1a'
  g.beginPath()
  if (g.roundRect) g.roundRect(16, 16, W - 32, H - 32, 18)
  else g.rect(16, 16, W - 32, H - 32)
  g.fill()
  g.fillStyle = INK
  g.font = '900 52px "Archivo Black", "Arial Black", Arial, sans-serif'
  g.fillText('PAKKA LOCAL', PAD, 112)
  g.font = '800 24px Arial, sans-serif'
  g.fillText('FOOD TRUCK', PAD, 146)
  g.font = '700 30px Georgia, serif'
  g.fillText('Order', PAD, 218)
  g.fillRect(PAD, 236, W - PAD * 2, 3)
  let y = 236 + ROW
  g.font = '700 26px Georgia, serif'
  for (const l of lines) {
    g.textAlign = 'left'
    g.fillText(`${l.n}x ${l.label}`, PAD, y, W - PAD * 2 - 140)
    g.textAlign = 'right'
    g.fillText(money(l.cents * l.n), W - PAD, y)
    y += ROW
  }
  g.textAlign = 'left'
  g.fillRect(PAD, y - 28, W - PAD * 2, 3)
  g.font = '800 32px Georgia, serif'
  g.fillText('Total', PAD, y + 20)
  g.textAlign = 'right'
  g.fillText(money(totalCents), W - PAD, y + 20)
  g.textAlign = 'left'
  g.font = '600 26px Arial, sans-serif'
  g.fillText(PHONE_DISPLAY, PAD, y + 92)
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'))
}

const BasketIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="order-icon">
    <path
      d="M5 9h14l-1.4 9.1a2 2 0 0 1-2 1.7H8.4a2 2 0 0 1-2-1.7L5 9zm3 0 3-5m5 5-3-5M3 9h18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * The big yellow "Your order · N items · $T" pill. Subscribes to the order store, so it
 * updates on every change without re-rendering the menu; bounces when something is added.
 */
export function OrderButton({ open, onToggle }) {
  const { s } = useI18n()
  const { totalItems, totalCents } = linesOf(useOrder())
  const ref = useRef(null)
  const prev = useRef(totalItems)
  useEffect(() => {
    if (totalItems > prev.current && !prefersReducedMotion() && ref.current?.getClientRects().length) {
      ref.current.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.04) translateY(-3px)' }, { transform: 'scale(0.99)' }, { transform: 'scale(1)' }],
        { duration: 360, easing: 'ease-out' },
      )
    }
    prev.current = totalItems
  }, [totalItems])
  const summary = totalItems === 0 ? s.yourOrder : `${s.yourOrder} · ${s.items(totalItems)} · ${money(totalCents)}`
  return (
    <button ref={ref} type="button" className="order-btn" data-empty={totalItems === 0 ? '1' : undefined} aria-expanded={open} onClick={onToggle}>
      <BasketIcon />
      <span className="order-summary">{summary}</span>
      {totalItems > 0 && (
        <span className="order-badge" aria-hidden="true">
          {totalItems}
        </span>
      )}
    </button>
  )
}

/**
 * The order drawer: each line with the same stepper as the board, the total, "Text your
 * order" (opens the SMS app with the order filled in, in English), "Call to order",
 * "Share order image" (a receipt PNG via the share sheet, or a download) and Clear.
 * The page itself never sends anything.
 */
export default function Order({ onHide }) {
  const { s } = useI18n()
  const { lines, totalCents } = linesOf(useOrder())
  const ref = useRef(null)
  const [note, setNote] = useState('')

  // Slide in (transform / opacity only) and move focus inside.
  useLayoutEffect(() => {
    const el = ref.current
    el.querySelector('button, a[href]')?.focus({ preventScroll: true })
    if (prefersReducedMotion()) return undefined
    const a = el.animate(
      [
        { opacity: 0, transform: 'translate3d(0, 16px, 0)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 220, easing: 'ease-out' },
    )
    return () => a.cancel()
  }, [])

  const share = async () => {
    setNote('')
    const blob = await receiptBlob(lines, totalCents)
    if (!blob) return
    const file = new File([blob], 'pakka-local-order.png', { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Pakka Local order' })
        return
      }
    } catch (err) {
      if (err?.name === 'AbortError') return // the visitor closed the share sheet
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    setNote(fill(s.downloaded, { file: file.name }))
  }

  return (
    <div ref={ref} className="order-drawer" role="region" aria-label={s.yourOrder}>
      <div className="order-head">
        <h3 className="order-title display">{s.yourOrder}</h3>
        <button type="button" className="order-link" onClick={onHide}>
          {s.hide}
        </button>
      </div>
      {lines.length === 0 ? (
        <p className="order-empty">{s.orderEmpty}</p>
      ) : (
        <>
          <ul className="order-lines">
            {lines.map((l) => (
              <li key={l.key}>
                <span className="order-name">{l.label}</span>
                <span className="order-line">{money(l.cents * l.n)}</span>
                <Stepper entryKey={l.key} label={l.label} />
              </li>
            ))}
          </ul>
          <p className="order-total">
            <span>{s.total}</span>
            <span>{money(totalCents)}</span>
          </p>
          <div className="order-actions">
            <a className="order-primary" href={smsHref(orderText(lines, totalCents))}>
              {s.textOrder}
            </a>
            <a className="order-secondary" href={PHONE_HREF}>
              {fill(s.callOrder, { phone: PHONE_DISPLAY })}
            </a>
            <div className="order-links">
              <button type="button" className="order-link" onClick={share}>
                {s.shareImage}
              </button>
              <button type="button" className="order-link" onClick={() => orderStore.clear()}>
                {s.clear}
              </button>
            </div>
            <p className="order-note" aria-live="polite">
              {note}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
