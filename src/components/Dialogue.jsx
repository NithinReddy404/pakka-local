import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildDialogue, spoken } from '../dialogue.js'
import { useI18n } from '../i18n.js'
import { lockPage, trapTab } from '../a11y.js'
import { useReducedMotion, wait } from '../motion.js'
import Vendor from './Vendor.jsx'

const CHARS_PER_SECOND = 35
const SWIPE_CLOSE_PX = 90
const LONG_LINE = 56 // lines longer than this use the smaller heading size

/**
 * The vendor dialogue: a solid black card docked bottom-left (a bottom sheet on phones).
 * The vendor's line types out as a big heading at ~35 chars/s (click, tap or Space shows
 * it all; instant under reduced motion). Questions are light cards, the main actions white
 * buttons, Back / Anything else? / Bye underlined links. Arrow keys move between them,
 * number keys pick one, Esc, Close, Bye or a swipe down closes. Focus is trapped while open
 * and returns to the counter hotspot on close.
 *
 * `speaker` picks the tree and portrait: 'truck' (the vendor) or 'cart' (the chaat cart).
 * onClose(reason) runs after the exit animation; reason is 'menu', 'bye' or 'esc'.
 */
export default function Dialogue({ speaker = 'truck', onClose, onBye, returnFocusRef }) {
  const reduce = useReducedMotion()
  const { s } = useI18n()
  const [nodeId, setNodeId] = useState('root')
  const tree = buildDialogue(s, speaker)
  const node = tree[nodeId] ?? tree.root
  const panelRef = useRef(null)
  const scrollRef = useRef(null)
  const textRef = useRef(null)
  const choicesRef = useRef(null)
  const portraitApi = useRef(null)
  const typing = useRef(null) // { skip } while the typewriter runs
  const closing = useRef(false)
  const swallowSpaceUp = useRef(false)
  const nameId = useId()
  const textId = useId()

  // Page behind is inert; focus comes back to the counter on unmount.
  useEffect(() => lockPage(returnFocusRef.current), [returnFocusRef])

  // Enter: slide up.
  useLayoutEffect(() => {
    if (reduce) return undefined
    const a = panelRef.current.animate(
      [
        { transform: 'translate3d(0, 40px, 0)', opacity: 0 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
      ],
      { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
    return () => a.cancel()
  }, [reduce])

  const close = useCallback(
    async (reason) => {
      if (closing.current) return
      closing.current = true
      typing.current?.skip()
      if (reason === 'bye') {
        portraitApi.current?.wave()
        onBye?.()
        if (!reduce) await wait(450)
      }
      const panel = panelRef.current
      if (!reduce && panel) {
        const from = getComputedStyle(panel).transform
        const a = panel.animate(
          [
            { transform: from === 'none' ? 'translate3d(0, 0, 0)' : from, opacity: 1 },
            { transform: 'translate3d(0, 60px, 0)', opacity: 0 },
          ],
          { duration: 220, easing: 'ease-in', fill: 'forwards' },
        )
        await a.finished.catch(() => {})
      }
      onClose(reason)
    },
    [onBye, onClose, reduce],
  )

  const choose = useCallback(
    (choice) => {
      if (closing.current) return
      if (choice.to) setNodeId(choice.to)
      else if (choice.action) close(choice.action)
    },
    [close],
  )

  // Typewriter: writes straight to the heading's text node, never through React state.
  useEffect(() => {
    const el = textRef.current
    const panel = panelRef.current
    const full = node.text
    let raf = 0
    const finish = () => {
      cancelAnimationFrame(raf)
      el.textContent = full
      delete panel.dataset.typing
      typing.current = null
    }
    if (reduce) {
      finish()
    } else {
      panel.dataset.typing = '1'
      el.textContent = ''
      const start = performance.now()
      const step = (now) => {
        const n = Math.floor(((now - start) * CHARS_PER_SECOND) / 1000)
        if (n >= full.length) {
          finish()
          return
        }
        el.textContent = full.slice(0, n)
        raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
      typing.current = { skip: finish }
    }
    scrollRef.current?.scrollTo?.({ top: 0 })
    choicesRef.current?.querySelector('.choice')?.focus({ preventScroll: true })
    return () => {
      cancelAnimationFrame(raf)
      typing.current = null
    }
  }, [node, reduce])

  // Keyboard: Esc, Space to skip, 1-9 to choose, arrows to move, Tab trapped.
  useEffect(() => {
    const onKey = (e) => {
      const panel = panelRef.current
      if (!panel) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close('esc')
        return
      }
      if (e.key === 'Tab') {
        trapTab(e, panel)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.key === ' ' || e.key === 'Spacebar') && typing.current) {
        e.preventDefault()
        swallowSpaceUp.current = true
        typing.current.skip()
        return
      }
      const items = [...(choicesRef.current?.querySelectorAll('.choice') ?? [])]
      if (/^[1-9]$/.test(e.key)) {
        const target = items[Number(e.key) - 1]
        if (target) {
          e.preventDefault()
          target.focus({ preventScroll: true })
          target.click()
        }
        return
      }
      if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key) && items.length) {
        e.preventDefault()
        const i = items.indexOf(document.activeElement)
        const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
        const next = i < 0 ? 0 : (i + dir + items.length) % items.length
        items[next].focus()
      }
    }
    const onKeyUp = (e) => {
      if ((e.key === ' ' || e.key === 'Spacebar') && swallowSpaceUp.current) {
        e.preventDefault() // the skip must not also press the focused choice
        swallowSpaceUp.current = false
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('keyup', onKeyUp, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('keyup', onKeyUp, true)
    }
  }, [close])

  // Swipe down on the sheet's top area to dismiss (touch and pen).
  const swipe = useRef(null)
  const onGripDown = (e) => {
    if (e.pointerType === 'mouse' || e.target.closest('button, a')) return
    swipe.current = { id: e.pointerId, y: e.clientY, dy: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onGripMove = (e) => {
    const s = swipe.current
    if (!s || s.id !== e.pointerId) return
    s.dy = Math.max(0, e.clientY - s.y)
    panelRef.current.style.transform = `translate3d(0, ${s.dy}px, 0)`
  }
  const onGripUp = (e) => {
    const s = swipe.current
    if (!s || s.id !== e.pointerId) return
    swipe.current = null
    const panel = panelRef.current
    if (s.dy > SWIPE_CLOSE_PX) {
      close('esc')
      return
    }
    if (!reduce && s.dy > 0) {
      panel.animate([{ transform: `translate3d(0, ${s.dy}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }], {
        duration: 200,
        easing: 'ease-out',
      })
    }
    panel.style.transform = ''
  }

  const skip = () => typing.current?.skip()
  const cards = node.choices.filter((c) => c.kind === 'card')
  const primaries = node.choices.filter((c) => c.kind === 'primary')
  const links = node.choices.filter((c) => c.kind === 'link')
  const ordered = [...cards, ...primaries, ...links] // DOM order = number-key order
  const renderChoice = (ch) => {
    const i = ordered.indexOf(ch)
    const key = `${nodeId}-${i}`
    const cls = `choice choice-${ch.kind}`
    if (ch.href) {
      return (
        <a key={key} className={cls} href={ch.href}>
          {ch.label}
        </a>
      )
    }
    return (
      <button key={key} type="button" className={cls} onClick={() => choose(ch)}>
        {ch.kind === 'card' && <span className="choice-dot" aria-hidden="true" />}
        {ch.label}
      </button>
    )
  }
  return createPortal(
    <div
      ref={panelRef}
      className="dlg"
      role="dialog"
      aria-modal="true"
      aria-labelledby={nameId}
      aria-describedby={textId}
    >
      <div
        className="dlg-meta"
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
      >
        <span className="dlg-grip" aria-hidden="true" />
        <span className="dlg-face" aria-hidden="true">
          <Vendor apiRef={portraitApi} who={speaker === 'cart' ? 'woman' : 'man'} variant="portrait" className="dlg-face-svg" />
        </span>
        <svg className="dlg-pin" viewBox="0 0 12 16" aria-hidden="true" focusable="false">
          <path d="M6 0a6 6 0 0 1 6 6c0 4.2-6 10-6 10S0 10.2 0 6a6 6 0 0 1 6-6zm0 3.6A2.4 2.4 0 1 0 6 8.4 2.4 2.4 0 0 0 6 3.6z" fill="currentColor" />
        </svg>
        <p id={nameId} className="dlg-name">
          {speaker === 'cart' ? s.cartName : s.vendorName}
        </p>
        <button type="button" className="dlg-close" onClick={() => close('esc')}>
          {s.close}
        </button>
      </div>

      <div ref={scrollRef} className="dlg-scroll">
        <div className="dlg-text-wrap" onClick={skip}>
          {/* The invisible full line reserves the height so typing never shifts layout. */}
          <p className={`dlg-text display${node.text.length > LONG_LINE ? ' dlg-text-long' : ''} dlg-text-ghost`} aria-hidden="true">
            {node.text}
          </p>
          <p ref={textRef} className={`dlg-text display${node.text.length > LONG_LINE ? ' dlg-text-long' : ''}`} aria-hidden="true" />
        </div>
        <p id={textId} className="sr-only" aria-live="polite">
          {spoken(node)}
        </p>

        {node.items?.length > 0 && (
          <ul className="dlg-items" aria-hidden="true">
            {node.items.map((it) => (
              <li key={it.name}>
                <span>{it.name}</span>
                <span className="dlg-price">{it.price}</span>
              </li>
            ))}
          </ul>
        )}

        <div ref={choicesRef} className="dlg-choices" role="group" aria-labelledby={nameId}>
          {cards.length > 0 && <div className="dlg-cards">{cards.map(renderChoice)}</div>}
          {primaries.length > 0 && <div className="dlg-primaries">{primaries.map(renderChoice)}</div>}
          {links.length > 0 && <div className="dlg-links">{links.map(renderChoice)}</div>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
