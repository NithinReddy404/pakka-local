import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MENU_SECTIONS, PHONE_DISPLAY, PHONE_HREF, SITE_URL } from '../menuData.js'
import { DOLLY } from '../scene.js'
import { lockPage, trapTab } from '../a11y.js'
import { fill, useI18n } from '../i18n.js'
import { variantsOf } from '../orderStore.js'
import { prefersReducedMotion } from '../motion.js'
import Mandala from './Mandala.jsx'
import PhotoViewer from './PhotoViewer.jsx'
import Order, { OrderButton } from './Order.jsx'
import Stepper from './Stepper.jsx'

const OPEN_MS = 520
const CLOSE_MS = 420
// Column layout as on the board.
const LEFT = ['Sandwiches', 'Starters', 'Add Ons']
const RIGHT = ['Indo-Chinese', 'Drinks']
const SITE_HOST = new URL(SITE_URL).host

const sectionsFor = (titles) => titles.map((t) => MENU_SECTIONS.find((s) => s.title === t)).filter(Boolean)
const LEFT_SECTIONS = [...sectionsFor(LEFT), ...MENU_SECTIONS.filter((s) => !LEFT.includes(s.title) && !RIGHT.includes(s.title))]
const RIGHT_SECTIONS = sectionsFor(RIGHT)

// The board prints a small red square before the chicken dishes.
const isChicken = (name) => name.startsWith('Chicken')

/** Transform mapping rect `to` onto rect `from` (non-uniform, origin top-left). */
const flip = (to, from) =>
  `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`

/** One board row: name, "i" note toggle, dotted leader, price, inline quantity control. */
const Item = memo(function Item({ item }) {
  const { s } = useI18n()
  const [open, setOpen] = useState(false)
  const noteRef = useRef(null)
  const noteId = useId()
  const variants = variantsOf(item)
  const note = s.dishes?.[item.name]

  useLayoutEffect(() => {
    if (!open || prefersReducedMotion()) return
    noteRef.current?.animate(
      [
        { opacity: 0, transform: 'translateY(-6px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 200, easing: 'ease-out' },
    )
  }, [open])

  return (
    <li className="mb-item">
      <div className="mb-row">
        <span className="mb-name">
          {isChicken(item.name) && <span className="mb-chk" aria-hidden="true" />}
          {item.name}
        </span>
        {note && (
          <button
            type="button"
            className="mb-info"
            aria-label={fill(s.aboutDish, { dish: item.name })}
            aria-expanded={open}
            aria-controls={noteId}
            onClick={() => setOpen((o) => !o)}
          >
            i
          </button>
        )}
        <span className="mb-leader" aria-hidden="true" />
        {variants.length === 1 && <span className="mb-price">{item.price}</span>}
        {variants.length === 1 && <Stepper entryKey={variants[0].key} label={item.name} />}
      </div>
      {variants.length > 1 &&
        variants.map((v) => (
          <div key={v.key} className="mb-row mb-subrow">
            <span className="mb-leader" aria-hidden="true" />
            <span className="mb-price">{v.price}</span>
            <Stepper entryKey={v.key} label={v.label} />
          </div>
        ))}
      {open && note && (
        <p ref={noteRef} id={noteId} className="mb-note">
          {note} <span className="mb-note-foot">{s.dishFootnote}</span>
        </p>
      )}
    </li>
  )
})

const Section = memo(function Section({ section }) {
  const { s } = useI18n()
  const id = useId()
  return (
    <section className="mb-section" aria-labelledby={id}>
      <h3 id={id} className="mb-heading display">
        {s.sections[section.title] ?? section.title}
      </h3>
      <ul className="mb-list">
        {section.items.map((item) => (
          <Item key={item.name} item={item} />
        ))}
      </ul>
    </section>
  )
})

/**
 * The menu, styled like the real A-frame board. Opens by growing out of the board in the
 * scene after the camera dolly; closing shrinks it back while the camera pulls out. Every
 * row has its own quantity control; the order (orderStore) lives outside React state, so
 * a change re-renders only that row's control and the order button. "Photo of the board"
 * shows the real board photo in a zoom / pan viewer. Only transform and opacity animate.
 */
export default function MenuPanel({ onClose, sceneApi, returnFocusRef }) {
  const { s } = useI18n()
  const [photo, setPhoto] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const rootRef = useRef(null)
  const frameRef = useRef(null)
  const backdropRef = useRef(null)
  const toolsRef = useRef(null)
  const closeBtnRef = useRef(null)
  const animating = useRef(true)
  const orderOpenRef = useRef(false)
  const titleId = useId()

  useEffect(() => {
    const unlock = lockPage(returnFocusRef.current)
    closeBtnRef.current?.focus({ preventScroll: true })
    return unlock
  }, [returnFocusRef])

  useEffect(() => {
    orderOpenRef.current = orderOpen
  }, [orderOpen])

  // Open: grow out of the board's current on-screen rect.
  useLayoutEffect(() => {
    const frame = frameRef.current
    if (prefersReducedMotion() || !sceneApi.current) {
      animating.current = false
      return undefined
    }
    const board = sceneApi.current.getBoardRect()
    const to = frame.getBoundingClientRect()
    frame.style.transformOrigin = '0 0'
    const anims = [
      frame.animate(
        [
          { transform: flip(to, board), opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.35 },
          { transform: 'none', opacity: 1, offset: 1 },
        ],
        { duration: OPEN_MS, easing: DOLLY.ease, fill: 'backwards' },
      ),
      backdropRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out', fill: 'backwards' }),
      toolsRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: OPEN_MS - 150, fill: 'backwards' }),
    ]
    let alive = true
    Promise.all(anims.map((a) => a.finished))
      .catch(() => {})
      .then(() => {
        if (!alive) return
        animating.current = false
        frame.style.transformOrigin = ''
      })
    return () => {
      alive = false
      anims.forEach((a) => a.cancel())
    }
  }, [sceneApi])

  const close = useCallback(() => {
    if (animating.current) return
    animating.current = true
    const scene = sceneApi.current
    const frame = frameRef.current
    if (prefersReducedMotion() || !scene || !frame) {
      Promise.resolve(scene?.dollyOut()).then(onClose)
      return
    }
    const board = scene.getRestRect()
    const from = frame.getBoundingClientRect()
    frame.style.transformOrigin = '0 0'
    const pullOut = scene.dollyOut()
    const anims = [
      frame.animate(
        [
          { transform: 'none', opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.6 },
          { transform: flip(from, board), opacity: 0, offset: 1 },
        ],
        { duration: CLOSE_MS, easing: DOLLY.ease, fill: 'forwards' },
      ),
      backdropRef.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, fill: 'forwards' }),
      toolsRef.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }),
    ]
    Promise.all([pullOut, ...anims.map((a) => a.finished)])
      .catch(() => {})
      .then(onClose)
  }, [onClose, sceneApi])

  const focusOrderButton = useCallback(() => {
    const btns = [...(rootRef.current?.querySelectorAll('.order-btn') ?? [])]
    btns.find((b) => b.getClientRects().length > 0)?.focus({ preventScroll: true })
  }, [])

  // Esc closes the order drawer, then the menu; Tab stays inside.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (orderOpenRef.current) {
          setOrderOpen(false)
          focusOrderButton()
        } else close()
      } else if (e.key === 'Tab') {
        trapTab(e, rootRef.current)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, focusOrderButton])

  const toggleOrder = useCallback(() => setOrderOpen((o) => !o), [])
  const hideOrder = useCallback(() => {
    setOrderOpen(false)
    focusOrderButton()
  }, [focusOrderButton])

  return createPortal(
    <div
      ref={rootRef}
      className="mp"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target === backdropRef.current) close()
      }}
    >
      <div ref={backdropRef} className="mp-backdrop" />
      <div ref={toolsRef} className="mp-tools">
        <button type="button" className="glass glass-btn" aria-pressed={photo} onClick={() => setPhoto((p) => !p)}>
          {photo ? s.backToMenu : s.photoOfBoard}
        </button>
        <button ref={closeBtnRef} type="button" className="glass glass-btn" aria-label={s.closeMenu} title={s.closeMenu} onClick={close}>
          <span aria-hidden="true" className="text-xl leading-none">
            ×
          </span>
          <span className="hidden sm:inline">{s.close}</span>
        </button>
      </div>

      <div ref={frameRef} className="mp-frame">
        <div className="mb-board">
          {photo ? (
            <PhotoViewer />
          ) : (
            <div className="mb-scroll">
              <Mandala className="mb-mandala mb-mandala-l" />
              <Mandala className="mb-mandala mb-mandala-r" />
              <h2 id={titleId} className="mb-title display">
                {s.menuTitle}
              </h2>
              <div className="mb-cols">
                <div className="mb-col">
                  {LEFT_SECTIONS.map((sec) => (
                    <Section key={sec.title} section={sec} />
                  ))}
                </div>
                <div className="mb-col mb-col-right">
                  {RIGHT_SECTIONS.map((sec) => (
                    <Section key={sec.title} section={sec} />
                  ))}
                  <div className="order-dock order-dock-desktop">
                    <OrderButton open={orderOpen} onToggle={toggleOrder} />
                  </div>
                </div>
              </div>
              <footer className="mb-foot">
                <p className="mb-brand">
                  <span className="mb-brand-big">PAKKA LOCAL</span>
                  <span className="mb-brand-small">FOOD TRUCK</span>
                </p>
                <div className="mb-contact">
                  <a href={PHONE_HREF}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor" />
                    </svg>
                    {PHONE_DISPLAY}
                  </a>
                  <a href={SITE_URL}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                      <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                    {SITE_HOST}
                  </a>
                </div>
              </footer>
            </div>
          )}

          <div className={photo ? 'order-dock order-dock-phone order-dock-photo' : 'order-dock order-dock-phone'}>
            <OrderButton open={orderOpen} onToggle={toggleOrder} />
          </div>
          {orderOpen && <Order onHide={hideOrder} />}
        </div>
      </div>
    </div>,
    document.body,
  )
}
