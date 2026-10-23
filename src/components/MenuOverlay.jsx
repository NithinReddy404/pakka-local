import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { img } from '../imgPath.js'
import { DOLLY_EASE } from './Hero.jsx'
import { MENU_SECTIONS, PHONE_DISPLAY, PHONE_HREF } from '../menuData.js'

const IMG = { src: img('menu.webp'), width: 685, height: 825 }
const MIN_SCALE = 1
const MAX_SCALE = 6
const DOUBLE_SCALE = 2.5
const BUTTON_STEP = 1.4
const KEY_PAN = 60
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const OPEN_MS = 600
const CLOSE_MS = 450
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * FLIP helper: transform that maps the rectangle `from` onto the rectangle `to`
 * (uniform scale so the photo is never stretched; `to` is covered, centres coincide).
 * Must be used with transform-origin at the centre of `from`.
 */
function flipTransform(from, to) {
  const k = Math.max(to.width / from.width, to.height / from.height)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${k})`
}

function setOriginAtCenter(wrap, rect) {
  const w = wrap.getBoundingClientRect()
  wrap.style.transformOrigin = `${rect.left + rect.width / 2 - w.left}px ${rect.top + rect.height / 2 - w.top}px`
}

/**
 * Full-screen menu viewer. Scale 1 is the "fit" size:
 *  - desktop: the whole board fills the viewport height;
 *  - phones (narrow or short viewports): the board fills the viewport WIDTH and is
 *    scrolled by dragging, so the prices are readable without zooming.
 * Pan and zoom live in refs and are written straight to the element's transform, so
 * pointer motion never triggers a React render.
 */
function MenuOverlay({ onClose, returnFocusRef, heroApi }) {
  const dialogRef = useRef(null)
  const viewerRef = useRef(null)
  const sheetRef = useRef(null)
  const closeBtnRef = useRef(null)
  const flipRef = useRef(null)
  const backdropRef = useRef(null)
  const headerRef = useRef(null)
  const footerRef = useRef(null)
  // True while the open or close transition runs: all input is ignored meanwhile.
  const animating = useRef(true)
  const textRef = useRef(null)
  const api = useRef(null)
  const textId = useId()
  const [showText, setShowText] = useState(false)
  const showTextRef = useRef(false)

  useEffect(() => {
    showTextRef.current = showText
    if (showText) textRef.current?.scrollTo({ top: 0 })
  }, [showText])

  // Body scroll lock, inert page behind, focus in / focus back.
  useEffect(() => {
    const root = document.getElementById('root')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (root) root.inert = true
    closeBtnRef.current?.focus({ preventScroll: true })
    const returnTo = returnFocusRef.current
    return () => {
      document.body.style.overflow = prevOverflow
      if (root) root.inert = false
      returnTo?.focus({ preventScroll: true })
    }
  }, [returnFocusRef])

  // Close: the board image flies back to the board while the camera pulls out.
  const doClose = () => {
    if (animating.current) return
    animating.current = true
    const hero = heroApi.current
    const wrap = flipRef.current
    const sheet = sheetRef.current
    if (prefersReducedMotion() || !hero || !wrap || !sheet) {
      Promise.resolve(hero?.dollyOut()).then(onClose)
      return
    }
    const board = hero.getRestRect() // measured before the camera starts moving
    const from = sheet.getBoundingClientRect() // current rect, including any user zoom
    setOriginAtCenter(wrap, from)
    const heroDone = hero.dollyOut()
    const anims = [
      wrap.animate(
        [
          { transform: 'none', opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.7 },
          { transform: flipTransform(from, board), opacity: 0, offset: 1 },
        ],
        { duration: CLOSE_MS, easing: DOLLY_EASE, fill: 'forwards' },
      ),
      backdropRef.current.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: CLOSE_MS,
        easing: 'ease-in-out',
        fill: 'forwards',
      }),
      ...[headerRef.current, footerRef.current].map((el) =>
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }),
      ),
    ]
    Promise.all([heroDone, ...anims.map((a) => a.finished)])
      .catch(() => {})
      .then(onClose) // unmount restores focus to the board button
  }
  const closeRef = useRef(doClose)
  useLayoutEffect(() => {
    closeRef.current = doClose
  })
  const requestClose = useCallback(() => closeRef.current(), [])

  // Zoom / pan engine and keyboard handling.
  useLayoutEffect(() => {
    const viewer = viewerRef.current
    const sheet = sheetRef.current
    const dialog = dialogRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const v = { s: 1, tx: 0, ty: 0, vw: 0, vh: 0, fw: 0, fh: 0, left: 0, top: 0 }

    const measure = () => {
      // Layout size, not getBoundingClientRect: the open/close transition scales the
      // wrapper, and a transformed rect would give a tiny viewport.
      v.vw = viewer.clientWidth
      v.vh = viewer.clientHeight
      const narrow = v.vw < 768 || v.vh < 520
      const k = narrow
        ? v.vw / IMG.width
        : Math.min((v.vw - 16) / IMG.width, (v.vh - 16) / IMG.height, 1.6)
      v.fw = IMG.width * k
      v.fh = IMG.height * k
      sheet.style.width = `${v.fw}px`
      sheet.style.height = `${v.fh}px`
    }
    // Screen position of the viewer, read only when the user acts (never mid-transition).
    const syncRect = () => {
      const r = viewer.getBoundingClientRect()
      v.left = r.left
      v.top = r.top
    }
    const constrain = () => {
      const W = v.fw * v.s
      const H = v.fh * v.s
      v.tx = W <= v.vw ? (v.vw - W) / 2 : clamp(v.tx, v.vw - W, 0)
      v.ty = H <= v.vh ? (v.vh - H) / 2 : clamp(v.ty, v.vh - H, 0)
    }
    const apply = (smooth) => {
      sheet.style.transition = smooth && !reduce.matches ? 'transform 180ms ease-out' : 'none'
      sheet.style.transform = `translate3d(${v.tx}px, ${v.ty}px, 0) scale(${v.s})`
    }
    const zoomAt = (px, py, next, smooth) => {
      const ns = clamp(next, MIN_SCALE, MAX_SCALE)
      const k = ns / v.s
      v.tx = px - (px - v.tx) * k
      v.ty = py - (py - v.ty) * k
      v.s = ns
      constrain()
      apply(smooth)
    }
    const reset = (smooth) => {
      v.s = 1
      v.tx = 0
      v.ty = 0 // tall board starts at its top; short board is centred by constrain()
      constrain()
      apply(smooth)
    }
    const zoomBy = (f) => zoomAt(v.vw / 2, v.vh / 2, v.s * f, true)
    const toggleZoom = (px, py) => {
      if (v.s > 1.05) reset(true)
      else zoomAt(px, py, DOUBLE_SCALE, true)
    }
    api.current = {
      zoomIn: () => !animating.current && zoomBy(BUTTON_STEP),
      zoomOut: () => !animating.current && zoomBy(1 / BUTTON_STEP),
      reset: () => !animating.current && reset(true),
    }

    measure()
    reset(false)
    const ro = new ResizeObserver(() => {
      measure()
      constrain()
      apply(false)
    })
    ro.observe(viewer)

    // --- pointers: drag to pan, two fingers to pinch, double tap / click to toggle ---
    const ptrs = new Map()
    let pinch = null
    let moved = false
    let downX = 0
    let downY = 0
    let lastTap = { t: 0, x: 0, y: 0 }
    let lastToggle = 0

    const pinchState = () => {
      const [a, b] = [...ptrs.values()]
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2 - v.left,
        my: (a.y + b.y) / 2 - v.top,
      }
    }
    const onDown = (e) => {
      if (animating.current) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      syncRect()
      viewer.setPointerCapture(e.pointerId)
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (ptrs.size === 1) {
        moved = false
        downX = e.clientX
        downY = e.clientY
        viewer.dataset.grab = '1'
      } else if (ptrs.size === 2) {
        pinch = pinchState()
        moved = true
      }
    }
    const onMove = (e) => {
      const p = ptrs.get(e.pointerId)
      if (!p) return
      if (ptrs.size === 1) {
        v.tx += e.clientX - p.x
        v.ty += e.clientY - p.y
        p.x = e.clientX
        p.y = e.clientY
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) moved = true
        constrain()
        apply(false)
      } else if (ptrs.size === 2 && pinch) {
        p.x = e.clientX
        p.y = e.clientY
        const next = pinchState()
        v.tx += next.mx - pinch.mx
        v.ty += next.my - pinch.my
        zoomAt(next.mx, next.my, (v.s * next.dist) / pinch.dist, false)
        pinch = next
      }
    }
    const onUp = (e) => {
      if (!ptrs.has(e.pointerId)) return
      ptrs.delete(e.pointerId)
      pinch = null
      if (ptrs.size > 0) return
      delete viewer.dataset.grab
      if (e.type === 'pointercancel' || moved) return
      const sr = sheet.getBoundingClientRect()
      const onImage =
        e.clientX >= sr.left && e.clientX <= sr.right && e.clientY >= sr.top && e.clientY <= sr.bottom
      if (!onImage) {
        requestClose() // click / tap on the backdrop
        return
      }
      if (e.pointerType !== 'mouse') {
        const now = performance.now()
        if (now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
          lastTap.t = 0
          lastToggle = now
          toggleZoom(e.clientX - v.left, e.clientY - v.top)
        } else {
          lastTap = { t: now, x: e.clientX, y: e.clientY }
        }
      }
    }
    const onDblClick = (e) => {
      if (animating.current || performance.now() - lastToggle < 500) return // already handled as a touch double tap
      syncRect()
      toggleZoom(e.clientX - v.left, e.clientY - v.top)
    }
    const onWheel = (e) => {
      e.preventDefault()
      if (animating.current) return
      syncRect()
      let dy = e.deltaY
      if (e.deltaMode === 1) dy *= 16
      else if (e.deltaMode === 2) dy *= viewer.clientHeight
      const f = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002))
      zoomAt(e.clientX - v.left, e.clientY - v.top, v.s * f, false)
    }
    viewer.addEventListener('pointerdown', onDown)
    viewer.addEventListener('pointermove', onMove)
    viewer.addEventListener('pointerup', onUp)
    viewer.addEventListener('pointercancel', onUp)
    viewer.addEventListener('dblclick', onDblClick)
    viewer.addEventListener('wheel', onWheel, { passive: false })

    // --- keyboard ---
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
        return
      }
      if (e.key === 'Tab') {
        const nodes = [...dialog.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter(
          (n) => !n.disabled && n.getClientRects().length > 0,
        )
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        const active = document.activeElement
        if (!dialog.contains(active)) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
        return
      }
      if (animating.current || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault()
        zoomBy(BUTTON_STEP)
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault()
        zoomBy(1 / BUTTON_STEP)
      } else if (e.key === '0') {
        e.preventDefault()
        reset(true)
      } else if (!showTextRef.current && e.key.startsWith('Arrow') && (v.s > 1 || v.fh > v.vh)) {
        e.preventDefault()
        if (e.key === 'ArrowLeft') v.tx += KEY_PAN
        if (e.key === 'ArrowRight') v.tx -= KEY_PAN
        if (e.key === 'ArrowUp') v.ty += KEY_PAN
        if (e.key === 'ArrowDown') v.ty -= KEY_PAN
        constrain()
        apply(true)
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      ro.disconnect()
      viewer.removeEventListener('pointerdown', onDown)
      viewer.removeEventListener('pointermove', onMove)
      viewer.removeEventListener('pointerup', onUp)
      viewer.removeEventListener('pointercancel', onUp)
      viewer.removeEventListener('dblclick', onDblClick)
      viewer.removeEventListener('wheel', onWheel)
      document.removeEventListener('keydown', onKey)
      api.current = null
    }
  }, [requestClose])

  // Open: the board image flies from the board on the photo to its final place while the
  // backdrop fades in. Runs in a layout effect so nothing paints un-animated first.
  useLayoutEffect(() => {
    animating.current = true
    const hero = heroApi.current
    const wrap = flipRef.current
    const sheet = sheetRef.current
    if (prefersReducedMotion() || !hero) {
      animating.current = false
      return undefined
    }
    const board = hero.getBoardRect() // where the board is on screen right now
    const to = sheet.getBoundingClientRect() // final resting layout of the menu photo
    setOriginAtCenter(wrap, to)
    const anims = [
      wrap.animate(
        [
          { transform: flipTransform(to, board), opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.3 },
          { transform: 'none', opacity: 1, offset: 1 },
        ],
        { duration: OPEN_MS, easing: DOLLY_EASE, fill: 'both' },
      ),
      backdropRef.current.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 400,
        easing: 'ease-out',
        fill: 'backwards',
      }),
      ...[headerRef.current, footerRef.current].map((el) =>
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 400,
          delay: 150,
          easing: 'ease-out',
          fill: 'backwards',
        }),
      ),
    ]
    let alive = true
    Promise.all(anims.map((a) => a.finished))
      .catch(() => {})
      .then(() => {
        if (!alive) return
        animating.current = false
        anims.forEach((a) => a.cancel())
        wrap.style.transformOrigin = ''
      })
    return () => {
      alive = false
      anims.forEach((a) => a.cancel())
    }
  }, [heroApi])

  const toolBtn = 'glass glass-btn'

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pakka Local menu"
      className="menu-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div ref={backdropRef} className="menu-backdrop" aria-hidden="true" />
      <div ref={headerRef} className="flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-6">
        <p className="m-0 text-lg font-semibold text-white">Menu</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={toolBtn}
            aria-label="Zoom out"
            title="Zoom out (-)"
            onClick={() => api.current?.zoomOut()}
          >
            <span aria-hidden="true" className="text-xl leading-none">
              −
            </span>
            <span className="hidden sm:inline">Zoom out</span>
          </button>
          <button
            type="button"
            className={toolBtn}
            aria-label="Zoom in"
            title="Zoom in (+)"
            onClick={() => api.current?.zoomIn()}
          >
            <span aria-hidden="true" className="text-xl leading-none">
              +
            </span>
            <span className="hidden sm:inline">Zoom in</span>
          </button>
          <button
            type="button"
            className={toolBtn}
            aria-label="Reset zoom"
            title="Reset zoom (0)"
            onClick={() => api.current?.reset()}
          >
            Reset
          </button>
          <button
            ref={closeBtnRef}
            type="button"
            className={toolBtn}
            aria-label="Close menu"
            title="Close (Esc)"
            onClick={requestClose}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
            Close
          </button>
        </div>
      </div>

      <div ref={flipRef} className="menu-flip relative min-h-0 flex-1">
        <div ref={viewerRef} className="menu-viewer">
          <div ref={sheetRef} className="menu-sheet">
            <img
              src={IMG.src}
              width={IMG.width}
              height={IMG.height}
              alt="Photo of the Pakka Local menu board. A text version of every item and price is available below the board."
              draggable="false"
            />
          </div>
        </div>

        <div
          id={textId}
          ref={textRef}
          role={showText ? 'region' : undefined}
          aria-label={showText ? 'Menu, text version' : undefined}
          tabIndex={showText ? 0 : undefined}
          className={
            showText
              ? 'absolute inset-0 overflow-y-auto bg-[#0b0b0e]/95 px-5 py-6 sm:px-10'
              : 'sr-only'
          }
        >
          <h2 className="mx-auto mb-6 max-w-4xl text-xl font-semibold text-white">Menu, text version</h2>
          <div className="menu-text-list mx-auto max-w-4xl">
            {MENU_SECTIONS.map((section) => (
              <section key={section.title} aria-labelledby={`${textId}-${section.title}`}>
                <h3
                  id={`${textId}-${section.title}`}
                  className="m-0 mb-2 border-b border-white/25 pb-2 text-base font-semibold uppercase tracking-widest text-ember"
                >
                  {section.title}
                </h3>
                <ul className="m-0 list-none p-0">
                  {section.items.map((item) => (
                    <li
                      key={item.name}
                      className="flex items-baseline justify-between gap-4 border-b border-dotted border-white/15 py-2.5 text-[17px] leading-snug text-white"
                    >
                      <span>{item.name}</span>
                      <span className="shrink-0 text-right font-semibold tabular-nums">{item.price}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={footerRef}
        className="flex shrink-0 flex-col items-center justify-between gap-2 px-4 py-3 sm:flex-row sm:px-6"
      >
        <p className="m-0 text-center text-sm text-white/80">
          Prices and items as shown on the board ·{' '}
          <a href={PHONE_HREF} className="underline underline-offset-4">
            {PHONE_DISPLAY}
          </a>
        </p>
        <button
          type="button"
          className="glass glass-btn"
          aria-expanded={showText}
          aria-controls={textId}
          onClick={() => !animating.current && setShowText((s) => !s)}
        >
          {showText ? 'Show board photo' : 'Text version'}
        </button>
      </div>
    </div>,
    document.body,
  )
}

export default memo(MenuOverlay)
