import { memo, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { CROP_TOP_MAX,
  DEPTH,
  DOLLY,
  HOTSPOTS,
  IMAGE,
  LANDSCAPE_MIN_ASPECT,
  PAN_KEEP_VISIBLE,
  PAN_START_X,
  POLYGONS,
  RATIO,
  RECTS,
  SCENE_H,
  SCENE_W,
  TILT,
  WINDOW_INTERIOR,
  LIGHTS,
  SEAM,
  CART_PERSON,
  BUBBLES,
  polygonBounds, PORTRAIT, MENU_TAG } from '../scene.js'
import { isDesktopPointer, pauseAnimations, useReducedMotion } from '../motion.js'
import Vendor from './Vendor.jsx'
import { Birds, Clouds, Dust, Steam, SunsetGlow, TreeFilter } from './SceneFx.jsx'
import Butterfly from './Butterfly.jsx'
import { useI18n } from '../i18n.js'

const pct = (n) => `${n}%`
const rectStyle = (r) => ({ left: pct(r.left), top: pct(r.top), width: pct(r.width), height: pct(r.height) })
// translateZ pushes a layer forward or back; the scale undoes the perspective enlargement so
// every copy registers exactly on the base image at rest.
const layerStyle = (z) => ({ transform: `translateZ(${z}px) scale(${(DEPTH.perspective - z) / DEPTH.perspective})` })
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const FULL = { left: 0, top: 0, width: 100, height: 100 }
const TREES_L = polygonBounds(POLYGONS.treesLeft)
const TREES_R = polygonBounds(POLYGONS.treesRight)
const DRAG_THRESHOLD = 6
const NUDGE_PX = 64 // the first-visit swipe hint slides the scene this far and back
const HINT_KEY = 'pakka-drag-hint-seen'

function SceneImg({ imgRef, alt = '', style, priority }) {
  return (
    <img
      ref={imgRef}
      className="scene-img"
      src={IMAGE.src}
      srcSet={IMAGE.srcSet}
      sizes={IMAGE.sizes}
      width={SCENE_W}
      height={SCENE_H}
      alt={alt}
      aria-hidden={alt ? undefined : 'true'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      draggable="false"
      style={style}
    />
  )
}

/**
 * A copy of the scene image cut to `rect` (and optionally to a polygon inside it), all in
 * percent of the scene. The element is only as big as the rect, so filters and transforms on
 * it touch only those pixels.
 */
function Cutout({ rect, poly, className = '', imgRef, alt, priority }) {
  const { left: l, top: t, width: w, height: h } = rect
  const clipPath = poly
    ? `polygon(${poly.map(([x, y]) => `${(((x - l) / w) * 100).toFixed(3)}% ${(((y - t) / h) * 100).toFixed(3)}%`).join(', ')})`
    : undefined
  return (
    <div className={`cutout ${className}`} style={{ ...rectStyle(rect), clipPath }}>
      <SceneImg
        imgRef={imgRef}
        alt={alt}
        priority={priority}
        style={{ left: pct((-l / w) * 100), top: pct((-t / h) * 100), width: pct(10000 / w), height: pct(10000 / h) }}
      />
    </div>
  )
}

const makeView = () => ({
  w: 1, h: 1, W: 1, H: 1, boxLeft: 0, boxTop: 0, portrait: false,
  x: 0, x0: 0, centre: null, gyro: 0, nx: 0, ny: 0, locked: false,
  write: () => {}, glide: () => {}, stopInertia: () => {}, resume: null,
})

/** The real sky just below the seam, mirrored upward and faded (see SEAM in scene.js). */
function SeamMirror() {
  const { y, height: h } = SEAM
  return (
    <div className="seam-mirror" style={{ top: pct(y - h), height: pct(h) }} aria-hidden="true">
      <div className="seam-mirror-flip">
        <SceneImg style={{ left: 0, top: pct((-y / h) * 100), width: '100%', height: pct(10000 / h) }} />
      </div>
    </div>
  )
}

const readHintSeen = () => {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The whole website: one living 2.5D picture of the truck. Layout, pan, tilt, entrance and
 * every effect write straight to element styles through refs; React renders this once.
 * `apiRef` exposes the camera to <App> (dolly into the board, look at the window, wave).
 */
function Scene({ apiRef, onOpenMenu, onTalk, menuBtnRef, counterBtnRef, cartBtnRef, talking }) {
  const reduce = useReducedMotion()
  const { s } = useI18n()
  const [desktop] = useState(isDesktopPointer)
  const [hintSeen] = useState(readHintSeen)
  const stageRef = useRef(null)
  const panRef = useRef(null)
  const boxRef = useRef(null)
  const introRef = useRef(null)
  const driftRef = useRef(null)
  const rigRef = useRef(null)
  const veilRef = useRef(null)
  const hintsRef = useRef(null)
  const baseImgRef = useRef(null)
  const vendorApi = useRef(null)
  const cartApi = useRef(null)
  const pausedRef = useRef(false)
  const live = useRef([])
  // Mutable view state shared by layout, pan, tilt and the camera API (never React state).
  const viewRef = useRef(null)


  // ---------- Layout: cover (landscape) or fill-height + pan (portrait) ----------
  useLayoutEffect(() => {
    if (!viewRef.current) viewRef.current = makeView()
    const v = viewRef.current
    const stage = stageRef.current
    const box = boxRef.current
    const layout = () => {
      const w = stage.clientWidth || 1
      const h = stage.clientHeight || 1
      v.w = w
      v.h = h
      v.portrait = w / h < LANDSCAPE_MIN_ASPECT
      if (!v.portrait) {
        v.W = Math.max(w, h * RATIO)
        v.H = v.W / RATIO
        v.boxLeft = (w - v.W) / 2
        // Crop the top band (generated sky) first, but never so far that the roof goes.
        v.boxTop = -Math.min(v.H - h, (v.H * CROP_TOP_MAX) / 100)
        v.x = 0
      } else {
        // Portrait: a shorter scene (less to pan), centred over the blurred ambient copy.
        v.H = Math.round(h * PORTRAIT.fill)
        v.W = v.H * RATIO
        v.boxLeft = 0
        v.boxTop = Math.round((h - v.H) / 2)
        const min = w - v.W
        if (v.centre == null) {
          // First layout: centre the truck window, then nudge left so the board shows too.
          let x = w / 2 - (PAN_START_X / 100) * v.W
          const over = (PAN_KEEP_VISIBLE.right / 100) * v.W + x - w
          if (over > 0) x = Math.max(x - over, 8 - (PAN_KEEP_VISIBLE.windowLeft / 100) * v.W)
          v.x = clamp(x, min, 0)
          v.x0 = v.x
        } else {
          v.x = clamp(w / 2 - v.centre * v.W, min, 0)
          v.x0 = clamp(w / 2 - (PAN_START_X / 100) * v.W, min, 0)
        }
        v.centre = (w / 2 - v.x) / v.W
      }
      box.style.width = `${v.W}px`
      box.style.height = `${v.H}px`
      box.style.left = `${v.boxLeft}px`
      box.style.top = `${v.boxTop}px`
      stage.dataset.mode = v.portrait ? 'pan' : 'cover'
      panRef.current.style.transform = v.portrait ? `translate3d(${v.x.toFixed(1)}px, 0, 0)` : ''
      v.write()
    }
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(stage)

    // First visit on a phone: after the entrance, slide the scene right and back twice, so the
    // visitor sees it moves. Stops the moment they touch it.
    let raf = 0
    let timer = 0
    if (v.portrait && !stage.dataset.dragged && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const swing = (start, dur, done) => {
        const base = v.x
        const step = (now) => {
          if (stage.dataset.dragged || v.locked) return
          const t = Math.min(1, (now - start) / dur)
          v.x = clamp(base + NUDGE_PX * Math.sin(Math.PI * t), v.w - v.W, 0)
          v.centre = (v.w / 2 - v.x) / v.W
          v.write()
          if (t < 1) raf = requestAnimationFrame(step)
          else done?.()
        }
        raf = requestAnimationFrame(step)
      }
      timer = window.setTimeout(() => {
        swing(performance.now(), 1300, () => {
          timer = window.setTimeout(() => swing(performance.now(), 1300), 500)
        })
      }, 1900)
    }
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [])

  // ---------- Pan (drag, inertia, gyro) and tilt (mouse, or follows pan on touch) ----------
  useEffect(() => {
    const v = viewRef.current
    const stage = stageRef.current
    const pan = panRef.current
    const rig = rigRef.current
    let raf = 0
    const writeNow = () => {
      raf = 0
      pan.style.transform = v.portrait ? `translate3d(${v.x.toFixed(1)}px, 0, 0)` : ''
      if (reduce || v.locked) {
        rig.style.transform = ''
        return
      }
      if (v.portrait) {
        // Touch: tilt follows how far the view has been panned from its starting point.
        v.nx = clamp((v.x0 - v.x) / Math.max(1, (v.W - v.w) / 2), -1, 1)
      }
      rig.style.transform = `rotateX(${(TILT.maxX * v.ny).toFixed(3)}deg) rotateY(${(-TILT.maxY * v.nx).toFixed(3)}deg)`
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(writeNow)
    }
    v.write = schedule
    const setX = (x) => {
      v.x = clamp(x, v.w - v.W, 0)
      v.centre = (v.w / 2 - v.x) / v.W
      schedule()
      return v.x
    }

    // Inertia and glides share one rAF loop.
    let motionRaf = 0
    const stopMotion = () => {
      cancelAnimationFrame(motionRaf)
      motionRaf = 0
    }
    v.stopInertia = stopMotion
    const inertia = (vel) => {
      stopMotion()
      if (reduce) return
      let last = performance.now()
      const step = (now) => {
        const dt = Math.min(48, now - last)
        last = now
        const before = v.x
        setX(v.x + vel * dt)
        vel *= Math.pow(0.94, dt / 16.7)
        if (Math.abs(vel) > 0.02 && v.x !== before) motionRaf = requestAnimationFrame(step)
        else motionRaf = 0
      }
      motionRaf = requestAnimationFrame(step)
    }
    // Smoothly pan so scene x (percent) sits at the viewport centre.
    v.glide = (xPct) => {
      if (!v.portrait) return
      stopMotion()
      const target = clamp(v.w / 2 - (xPct / 100) * v.W, v.w - v.W, 0)
      if (reduce) {
        setX(target)
        return
      }
      const step = () => {
        const d = target - v.x
        if (Math.abs(d) < 0.5) {
          setX(target)
          motionRaf = 0
          return
        }
        setX(v.x + d * 0.14)
        motionRaf = requestAnimationFrame(step)
      }
      motionRaf = requestAnimationFrame(step)
    }

    // Drag (portrait only). Capture starts only after a real drag, so taps still click.
    let drag = null
    let suppressClick = false
    const onDown = (e) => {
      if (!v.portrait || v.locked || (e.pointerType === 'mouse' && e.button !== 0)) return
      stopMotion()
      drag = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, lastT: e.timeStamp, vel: 0, active: false }
    }
    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.lastX
      if (!drag.active) {
        if (Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD) return
        drag.active = true
        stage.setPointerCapture?.(e.pointerId)
        stage.dataset.dragging = '1'
        if (!stage.dataset.dragged) {
          stage.dataset.dragged = '1'
          try {
            window.localStorage.setItem(HINT_KEY, '1')
          } catch {
            /* storage blocked: the hint simply shows again next visit */
          }
        }
      }
      const dt = Math.max(1, e.timeStamp - drag.lastT)
      drag.vel = drag.vel * 0.6 + (dx / dt) * 0.4
      drag.lastX = e.clientX
      drag.lastT = e.timeStamp
      setX(v.x + dx)
    }
    const onUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return
      const wasActive = drag.active
      const vel = e.timeStamp - drag.lastT > 80 ? 0 : drag.vel
      drag = null
      delete stage.dataset.dragging
      if (wasActive) {
        suppressClick = true
        window.setTimeout(() => {
          suppressClick = false
        }, 0)
        inertia(clamp(vel, -3, 3))
      }
    }
    const onClickCapture = (e) => {
      if (suppressClick) {
        e.preventDefault()
        e.stopPropagation()
        suppressClick = false
      }
    }
    stage.addEventListener('pointerdown', onDown)
    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerup', onUp)
    stage.addEventListener('pointercancel', onUp)
    stage.addEventListener('click', onClickCapture, true)

    // Mouse tilt (desktop, landscape).
    const onMouse = (e) => {
      if (e.pointerType !== 'mouse' || v.portrait) return
      v.nx = clamp((e.clientX / v.w) * 2 - 1, -1, 1)
      v.ny = clamp((e.clientY / v.h) * 2 - 1, -1, 1)
      schedule()
    }
    const onLeave = () => {
      v.nx = 0
      v.ny = 0
      schedule()
    }
    if (desktop && !reduce) {
      window.addEventListener('pointermove', onMouse, { passive: true })
      document.documentElement.addEventListener('pointerleave', onLeave)
    }

    // Gyro (touch devices): tilting the phone pans (portrait) or tilts (landscape).
    let gamma0 = null
    let beta0 = null
    const onOrient = (e) => {
      if (e.gamma == null || v.locked || document.hidden) return
      if (gamma0 == null) {
        gamma0 = e.gamma
        beta0 = e.beta ?? 0
      }
      const dg = clamp(e.gamma - gamma0, -25, 25)
      if (v.portrait) {
        const target = (-dg / 25) * ((v.W - v.w) / 2)
        const prev = v.gyro
        v.gyro += (target - v.gyro) * 0.15
        setX(v.x + (v.gyro - prev))
      } else {
        v.nx += (dg / 20 - v.nx) * 0.15
        v.ny += (clamp(((e.beta ?? 0) - beta0) / 20, -1, 1) - v.ny) * 0.15
        v.nx = clamp(v.nx, -1, 1)
        schedule()
      }
    }
    let orientOn = false
    const startOrient = () => {
      if (orientOn) return
      orientOn = true
      window.addEventListener('deviceorientation', onOrient)
    }
    const DOE = window.DeviceOrientationEvent
    const coarse = window.matchMedia('(pointer: coarse)').matches
    let askOnTap = null
    if (!reduce && coarse && DOE) {
      if (typeof DOE.requestPermission === 'function') {
        // iOS: ask on the first tap; silently skip if denied.
        askOnTap = () => {
          stage.removeEventListener('pointerup', askOnTap)
          DOE.requestPermission()
            .then((r) => r === 'granted' && startOrient())
            .catch(() => {})
        }
        stage.addEventListener('pointerup', askOnTap)
      } else {
        startOrient()
      }
    }

    schedule()
    return () => {
      cancelAnimationFrame(raf)
      stopMotion()
      v.write = () => {}
      stage.removeEventListener('pointerdown', onDown)
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerup', onUp)
      stage.removeEventListener('pointercancel', onUp)
      stage.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('pointermove', onMouse)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('deviceorientation', onOrient)
      if (askOnTap) stage.removeEventListener('pointerup', askOnTap)
    }
  }, [reduce, desktop])

  // ---------- Entrance: blurred placeholder, then the real image fades and pushes in ----------
  useEffect(() => {
    const intro = introRef.current
    const drift = driftRef.current
    const img = baseImgRef.current
    let alive = true
    let driftAnim = null
    const show = () => {
      if (!alive) return
      if (reduce) {
        intro.style.opacity = '1'
        return
      }
      const a = intro.animate(
        [
          { opacity: 0, transform: 'scale(1.04)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' },
      )
      // Push-in continues a little after the fade for a slow settle.
      a.finished
        .then(() => {
          if (!alive) return
          intro.style.opacity = '1'
          a.cancel()
          // Idle camera: very slow drift. The 1.2% overscale covers the 0.6% travel.
          driftAnim = drift.animate(
            [
              { transform: 'translate3d(-0.6%, -0.3%, 0) scale(1.012)' },
              { transform: 'translate3d(0.6%, 0.3%, 0) scale(1.012)' },
            ],
            { duration: 30000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' },
          )
          driftAnim.currentTime = 15000 // start at the centre of the swing: no jump
        })
        .catch(() => {})
    }
    if (img.complete && img.naturalWidth) {
      ;(img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(show)
    } else {
      img.addEventListener('load', () => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(show), { once: true })
      img.addEventListener('error', show, { once: true })
    }
    return () => {
      alive = false
      driftAnim?.cancel()
      intro.getAnimations().forEach((a) => a.cancel())
    }
  }, [reduce])

  // ---------- Camera API for <App> ----------
  useImperativeHandle(
    apiRef,
    () => {
      const v = viewRef.current
      const box = () => boxRef.current
      const clearLive = () => {
        live.current.forEach((a) => a.cancel())
        live.current = []
      }
      const track = (el, keyframes, options) => {
        const a = el.animate(keyframes, { fill: 'forwards', ...options })
        live.current.push(a)
        return a
      }
      const boardCentre = () => ({
        x: HOTSPOTS.menu.left + HOTSPOTS.menu.width / 2,
        y: HOTSPOTS.menu.top + HOTSPOTS.menu.height / 2,
      })
      let hintsAnim = null
      return {
        /** Current on-screen rectangle of the menu board. */
        getBoardRect: () => menuBtnRef.current.getBoundingClientRect(),
        /** Where the board sits with the camera at rest (computed from the layout). */
        getRestRect: () => {
          const m = HOTSPOTS.menu
          const x = v.portrait ? v.x : 0
          return {
            left: x + v.boxLeft + (m.left / 100) * v.W,
            top: v.boxTop + (m.top / 100) * v.H,
            width: (m.width / 100) * v.W,
            height: (m.height / 100) * v.H,
          }
        },
        /** Camera dollies into the board; resolves when it arrives. */
        dollyIn: () => {
          v.locked = true
          v.stopInertia()
          v.write()
          clearLive()
          const c = boardCentre()
          box().style.transformOrigin = `${c.x}% ${c.y}%`
          // Stop every scene effect (tree displacement, motes, clouds...) before the camera
          // moves, so the dolly has the compositor to itself.
          pausedRef.current = true
          v.resume = pauseAnimations(introRef.current)
          if (reduce) return Promise.resolve()
          hintsAnim?.cancel()
          hintsAnim = hintsRef.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' })
          const opts = { duration: DOLLY.inMs, easing: DOLLY.ease }
          track(veilRef.current, [{ opacity: 0 }, { opacity: 0.5 }], opts)
          if (v.portrait) {
            const tx = v.w / 2 - (c.x / 100) * v.W // bring the board to the middle as we fly in
            track(panRef.current, [{ transform: `translate3d(${v.x}px,0,0)` }, { transform: `translate3d(${tx}px,0,0)` }], opts)
          }
          const a = track(box(), [{ transform: 'scale(1)' }, { transform: `scale(${DOLLY.scale})` }], opts)
          return a.finished.then(
            () => undefined,
            () => undefined,
          )
        },
        /** Reverse of dollyIn; resolves when the camera is back at rest. */
        dollyOut: async () => {
          pausedRef.current = false
          v.resume?.()
          v.resume = null
          const anims = live.current
          if (!reduce && anims.length) {
            const rate = -(DOLLY.inMs / DOLLY.outMs)
            anims.forEach((a) => {
              a.updatePlaybackRate(rate)
              a.play()
            })
            await Promise.all(anims.map((a) => a.finished)).catch(() => {})
          }
          clearLive()
          v.locked = false
          v.write()
          if (hintsAnim) {
            const h = hintsAnim
            hintsAnim = null
            h.reverse()
            h.finished.catch(() => {}).then(() => h.cancel())
          }
        },
        /** Portrait: pan so the given scene x (percent) is centred. */
        lookAt: (xPct) => v.glide(xPct),
        wave: (who) => (who === 'cart' ? cartApi : vendorApi).current?.wave(),
      }
    },
    [menuBtnRef, reduce],
  )

  // Keyboard focus on a hotspot that is panned off-screen brings it into view.
  const reveal = (r) => {
    const v = viewRef.current
    if (!v?.portrait) return
    const left = v.x + (r.left / 100) * v.W
    const right = left + (r.width / 100) * v.W
    if (left < 12 || right > v.w - 12) v.glide(r.left + r.width / 2)
  }
  const waveVendor = () => vendorApi.current?.wave()
  const waveCart = () => cartApi.current?.wave()
  const talkTruck = () => onTalk('truck')
  const talkCart = () => onTalk('cart')

  const fxOn = !reduce
  const m = HOTSPOTS.menu
  const c = HOTSPOTS.counter
  const k = HOTSPOTS.cart
  const bubbleStyle = (b) => ({ left: pct(b.x), bottom: `calc(${100 - b.y}% + 6px)` })

  return (
    <div
      ref={stageRef}
      className="stage"
      data-fx={desktop && fxOn ? 'full' : 'lite'}
      data-dragged={hintSeen ? '1' : undefined}
      data-talking={talking ? '1' : undefined}
    >
      <TreeFilter enabled={desktop && fxOn} pausedRef={pausedRef} />
      <div className="scene-ambient" aria-hidden="true" style={{ backgroundImage: `url(${IMAGE.tiny})` }} />
      <div ref={panRef} className="pan">
        <div ref={boxRef} className="box">
          <img className="placeholder" src={IMAGE.tiny} alt="" aria-hidden="true" draggable="false" />
          <div ref={introRef} className="intro">
            <div ref={driftRef} className="drift" style={{ perspective: `${DEPTH.perspective}px` }}>
              <div ref={rigRef} className="rig">
                {/* Sky: a full copy of the image at the back, high clouds and birds */}
                <div className="layer" style={layerStyle(DEPTH.sky)}>
                  <SceneImg style={rectStyle(FULL)} />
                  <SeamMirror />
                  <Clouds layer="sky" />
                  <Birds pausedRef={pausedRef} enabled={fxOn} />
                </div>

                {/* Trees: cutouts that sway (and shimmer on desktop) */}
                <div className="layer" style={layerStyle(DEPTH.trees)}>
                  <Cutout rect={TREES_L} poly={POLYGONS.treesLeft} className="tree tree-l" />
                  <Cutout rect={TREES_R} poly={POLYGONS.treesRight} className="tree tree-r" />
                </div>

                {/* Haze: low clouds across the y 14-26% band and the sunset glow */}
                <div className="layer" style={layerStyle(DEPTH.haze)}>
                  <Clouds layer="haze" />
                  <SunsetGlow />
                </div>

                {/* Base: the image minus sky and trees, the window wash and the vendor */}
                <div className="layer" style={layerStyle(DEPTH.base)}>
                  <Cutout rect={FULL} poly={POLYGONS.base} imgRef={baseImgRef} alt={IMAGE.alt} priority />
                  <div className="window" style={rectStyle(WINDOW_INTERIOR)}>
                    <Vendor apiRef={vendorApi} className="vendor-svg" />
                    <div className="window-wash" />
                  </div>
                </div>

                {/* Truck: warm lamp glows */}
                <div className="layer" style={layerStyle(DEPTH.truck)}>
                  {LIGHTS.lamps.map((l, i) => (
                    <div key={i} className={`lamp lamp-${i + 1}`} style={{ left: pct(l.x), top: pct(l.y) }} />
                  ))}
                </div>

                {/* Cart, forward */}
                <div className="layer" style={layerStyle(DEPTH.cart)}>
                  <Cutout rect={RECTS.cart} />
                  <div className="window cart-person" style={rectStyle(CART_PERSON.rect)}>
                    <Vendor apiRef={cartApi} who="woman" className="vendor-svg" />
                    <div className="glass-sheen" />
                  </div>
                  {/* The food boxes in front of her, so she stands behind the case */}
                  <Cutout rect={polygonBounds(CART_PERSON.occluder)} poly={CART_PERSON.occluder} />
                  {fxOn && <Steam />}
                </div>

                {/* Ground, forward, with dust motes */}
                <div className="layer" style={layerStyle(DEPTH.ground)}>
                  <Cutout rect={RECTS.ground} />
                  <Dust enabled={fxOn} phone={!desktop} />
                </div>

                {/* Hotspots and hints, in front so nothing covers them */}
                <div className="layer layer-ui" style={layerStyle(DEPTH.ui)}>
                  <button
                    ref={cartBtnRef}
                    type="button"
                    className="hotspot"
                    style={rectStyle(k)}
                    aria-label={s.cartLabel}
                    onClick={talkCart}
                    onPointerEnter={waveCart}
                    onFocus={() => {
                      waveCart()
                      reveal(k)
                    }}
                  />
                  <button
                    ref={counterBtnRef}
                    type="button"
                    className="hotspot"
                    style={rectStyle(c)}
                    aria-label={s.talkLabel}
                    onClick={talkTruck}
                    onPointerEnter={waveVendor}
                    onFocus={() => {
                      waveVendor()
                      reveal(c)
                    }}
                  />
                  <button
                    ref={menuBtnRef}
                    type="button"
                    className="hotspot"
                    style={rectStyle(m)}
                    aria-label={s.menuLabel}
                    onClick={onOpenMenu}
                    onFocus={() => reveal(m)}
                  />
                  <div ref={hintsRef} className="hints">
                    <span className="bubble-pos" style={bubbleStyle(BUBBLES.cart)} aria-hidden="true">
                      <span className="bubble bubble-cart" onClick={talkCart}>
                        {s.cartBubble}
                      </span>
                    </span>
                    <span className="bubble-pos" style={bubbleStyle(BUBBLES.counter)} aria-hidden="true">
                      <span className="bubble" onClick={talkTruck}>
                        {s.bubble}
                      </span>
                    </span>
                    <span className="bubble-pos" style={bubbleStyle(MENU_TAG)} aria-hidden="true">
                      <span className="menu-tag" onClick={onOpenMenu}>
                        {s.menuTag}
                      </span>
                    </span>
                    <Butterfly board={m} text={s.bflyBubble} onOpen={onOpenMenu} reduce={reduce} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="vignette-top" aria-hidden="true" />
        </div>
      </div>
      <div ref={veilRef} className="veil" aria-hidden="true" />
      {/* First-visit swipe hint (portrait only): a hand that swipes, no words. */}
      <div className="swipe-hint" aria-hidden="true">
        <svg className="swipe-hand" viewBox="0 0 48 56" focusable="false">
          <path
            d="M18 30V11a4 4 0 0 1 8 0v15l3-1.5a4 4 0 0 1 5.4 2.2l.4 1.1 3.2-1a4 4 0 0 1 5 2.8l.3 1.6 2.4-.6a3.6 3.6 0 0 1 4.4 2.9l-1.6 11.6A10 10 0 0 1 38.6 54H24a10 10 0 0 1-8.3-4.4L7.5 37.3a3.8 3.8 0 0 1 5.6-5l4.9 4.4z"
            fill="#fff"
            stroke="#141414"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="swipe-trail" />
      </div>
    </div>
  )
}

export default memo(Scene)
