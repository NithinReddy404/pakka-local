import { useLayoutEffect, useRef } from 'react'
import { img } from '../imgPath.js'
import { useReducedMotion } from '../motion.js'
import { useI18n } from '../i18n.js'

const IMG = { src: img('menu.webp'), width: 685, height: 825 }
const MIN_SCALE = 1
const MAX_SCALE = 6
const DOUBLE_SCALE = 2.5
const BUTTON_STEP = 1.4
const KEY_PAN = 60
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * Zoom / pan viewer for the photo of the real menu board. Scale 1 fits the photo (to the
 * height on desktop, to the width on narrow screens, where it is dragged to read). Drag,
 * pinch, wheel, double-click / double-tap, + - 0 and arrow keys. Pan and zoom live in a
 * closure and are written straight to the transform: no React renders while moving.
 */
export default function PhotoViewer() {
  const reduceMotion = useReducedMotion()
  const { s } = useI18n()
  const viewerRef = useRef(null)
  const sheetRef = useRef(null)
  const api = useRef(null)

  useLayoutEffect(() => {
    const viewer = viewerRef.current
    const sheet = sheetRef.current
    const v = { s: 1, tx: 0, ty: 0, vw: 0, vh: 0, fw: 0, fh: 0 }
    const rect = () => viewer.getBoundingClientRect()

    const measure = () => {
      v.vw = viewer.clientWidth
      v.vh = viewer.clientHeight
      const narrow = v.vw < 640
      const k = narrow ? v.vw / IMG.width : Math.min((v.vw - 24) / IMG.width, (v.vh - 24) / IMG.height, 1.6)
      v.fw = IMG.width * k
      v.fh = IMG.height * k
      sheet.style.width = `${v.fw}px`
      sheet.style.height = `${v.fh}px`
    }
    const constrain = () => {
      const W = v.fw * v.s
      const H = v.fh * v.s
      v.tx = W <= v.vw ? (v.vw - W) / 2 : clamp(v.tx, v.vw - W, 0)
      v.ty = H <= v.vh ? (v.vh - H) / 2 : clamp(v.ty, v.vh - H, 0)
    }
    const apply = (smooth) => {
      sheet.style.transition = smooth && !reduceMotion ? 'transform 180ms ease-out' : 'none'
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
      v.ty = 0
      constrain()
      apply(smooth)
    }
    const zoomBy = (f) => zoomAt(v.vw / 2, v.vh / 2, v.s * f, true)
    const toggleZoom = (px, py) => (v.s > 1.05 ? reset(true) : zoomAt(px, py, DOUBLE_SCALE, true))
    api.current = { zoomIn: () => zoomBy(BUTTON_STEP), zoomOut: () => zoomBy(1 / BUTTON_STEP), reset: () => reset(true) }

    measure()
    reset(false)
    const ro = new ResizeObserver(() => {
      measure()
      constrain()
      apply(false)
    })
    ro.observe(viewer)

    const ptrs = new Map()
    let pinch = null
    let moved = false
    let downX = 0
    let downY = 0
    let lastTap = { t: 0, x: 0, y: 0 }
    let lastToggle = 0
    let origin = { left: 0, top: 0 }
    const pinchState = () => {
      const [a, b] = [...ptrs.values()]
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2 - origin.left,
        my: (a.y + b.y) / 2 - origin.top,
      }
    }
    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      origin = rect()
      viewer.setPointerCapture(e.pointerId)
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (ptrs.size === 1) {
        moved = false
        downX = e.clientX
        downY = e.clientY
        viewer.dataset.grab = '1'
      } else if (ptrs.size >= 2) {
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
      } else if (pinch) {
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
      pinch = ptrs.size >= 2 ? pinchState() : null
      if (ptrs.size > 0) return
      delete viewer.dataset.grab
      if (e.type === 'pointercancel' || moved || e.pointerType === 'mouse') return
      const now = performance.now()
      if (now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        lastTap.t = 0
        lastToggle = now
        toggleZoom(e.clientX - origin.left, e.clientY - origin.top)
      } else {
        lastTap = { t: now, x: e.clientX, y: e.clientY }
      }
    }
    const onDblClick = (e) => {
      if (performance.now() - lastToggle < 500) return
      const r = rect()
      toggleZoom(e.clientX - r.left, e.clientY - r.top)
    }
    const onWheel = (e) => {
      e.preventDefault()
      const r = rect()
      let dx = e.deltaX
      let dy = e.deltaY
      if (e.deltaMode === 1) {
        dx *= 16
        dy *= 16
      } else if (e.deltaMode === 2) {
        dx *= v.vw
        dy *= v.vh
      }
      if (!e.ctrlKey && (v.s > 1 || v.fh > v.vh)) {
        v.tx -= dx
        v.ty -= dy
        constrain()
        apply(false)
        return
      }
      zoomAt(e.clientX - r.left, e.clientY - r.top, v.s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)), false)
    }
    let gestureBase = 1
    const onGestureStart = (e) => {
      e.preventDefault()
      gestureBase = v.s
    }
    const onGestureChange = (e) => {
      e.preventDefault()
      const r = rect()
      zoomAt(e.clientX - r.left, e.clientY - r.top, gestureBase * e.scale, false)
    }
    const prevent = (e) => e.preventDefault()
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault()
        zoomBy(BUTTON_STEP)
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault()
        zoomBy(1 / BUTTON_STEP)
      } else if (e.key === '0') {
        e.preventDefault()
        reset(true)
      } else if (e.key.startsWith('Arrow') && (v.s > 1 || v.fh > v.vh)) {
        e.preventDefault()
        if (e.key === 'ArrowLeft') v.tx += KEY_PAN
        if (e.key === 'ArrowRight') v.tx -= KEY_PAN
        if (e.key === 'ArrowUp') v.ty += KEY_PAN
        if (e.key === 'ArrowDown') v.ty -= KEY_PAN
        constrain()
        apply(true)
      }
    }
    viewer.addEventListener('pointerdown', onDown)
    viewer.addEventListener('pointermove', onMove)
    viewer.addEventListener('pointerup', onUp)
    viewer.addEventListener('pointercancel', onUp)
    viewer.addEventListener('dblclick', onDblClick)
    viewer.addEventListener('wheel', onWheel, { passive: false })
    viewer.addEventListener('gesturestart', onGestureStart)
    viewer.addEventListener('gesturechange', onGestureChange)
    viewer.addEventListener('gestureend', prevent)
    document.addEventListener('keydown', onKey)
    return () => {
      ro.disconnect()
      viewer.removeEventListener('pointerdown', onDown)
      viewer.removeEventListener('pointermove', onMove)
      viewer.removeEventListener('pointerup', onUp)
      viewer.removeEventListener('pointercancel', onUp)
      viewer.removeEventListener('dblclick', onDblClick)
      viewer.removeEventListener('wheel', onWheel)
      viewer.removeEventListener('gesturestart', onGestureStart)
      viewer.removeEventListener('gesturechange', onGestureChange)
      viewer.removeEventListener('gestureend', prevent)
      document.removeEventListener('keydown', onKey)
      api.current = null
    }
  }, [reduceMotion])

  return (
    <div className="pv">
      <div ref={viewerRef} className="pv-viewer">
        <div ref={sheetRef} className="pv-sheet">
          <img
            src={IMG.src}
            width={IMG.width}
            height={IMG.height}
            alt={s.photoAlt}
            decoding="async"
            draggable="false"
          />
        </div>
      </div>
      <div className="pv-tools">
        <button type="button" className="glass glass-btn" aria-label={s.zoomOut} title={`${s.zoomOut} (-)`} onClick={() => api.current?.zoomOut()}>
          <span aria-hidden="true">−</span>
        </button>
        <button type="button" className="glass glass-btn" aria-label={s.zoomIn} title={`${s.zoomIn} (+)`} onClick={() => api.current?.zoomIn()}>
          <span aria-hidden="true">+</span>
        </button>
        <button type="button" className="glass glass-btn" aria-label={s.reset} title={`${s.reset} (0)`} onClick={() => api.current?.reset()}>
          {s.reset}
        </button>
      </div>
    </div>
  )
}
