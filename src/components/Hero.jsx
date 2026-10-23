import { memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { DEFAULT_SCENE_ID, HERO_SIZES, SCENES } from '../scenes.js'
import { img } from '../imgPath.js'
import { PHONE_DISPLAY, PHONE_HREF } from '../menuData.js'

const byId = (id) => SCENES.find((s) => s.id === id) ?? SCENES[0]
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const DOLLY_SCALE = 2.6
export const DOLLY_IN_MS = 650
export const DOLLY_OUT_MS = 450
export const DOLLY_EASE = 'cubic-bezier(.65,0,.35,1)'

const PARALLAX_PHOTO_PX = 8
const PARALLAX_LABEL_NET_PX = 14 // net label travel; the photo layer already supplies 8 of it
const SCROLL_FACTOR = 0.3
// Vignettes are painted at black/70 and rest at 45/70 opacity (= black/45); the dolly
// fades them to full black/70 using opacity only.
const VIGNETTE_REST = 0.45 / 0.7

/**
 * First screen. Owns the scene choice and every hero motion effect, all written through
 * refs (transform/opacity only), so hovering, scrolling or the menu transition never
 * re-renders it. <App> drives the menu zoom through `apiRef`.
 */
function Hero({ onOpenMenu, hotspotRef, apiRef }) {
  const [sceneId, setSceneId] = useState(DEFAULT_SCENE_ID) // image on screen
  const [requestedId, setRequestedId] = useState(DEFAULT_SCENE_ID) // control highlight
  const preloaded = useRef(new Map())
  const requestToken = useRef(0)

  const stageRef = useRef(null)
  const scrollRef = useRef(null)
  const mouseRef = useRef(null)
  const boxRef = useRef(null)
  const labelRef = useRef(null)
  const vignetteRefs = useRef([])
  const sceneRef = useRef(byId(DEFAULT_SCENE_ID))
  const parallaxLocked = useRef(false)
  const live = useRef([]) // fill-forwards dolly animations
  const labelAnim = useRef(null)
  const wiggleReset = useRef(null)

  const scene = byId(sceneId)
  useEffect(() => {
    sceneRef.current = scene
  }, [scene])

  const preload = useCallback((s) => {
    let image = preloaded.current.get(s.id)
    if (!image) {
      image = new Image()
      image.sizes = HERO_SIZES
      image.srcset = s.srcSet
      image.src = s.src
      preloaded.current.set(s.id, image) // keep a reference so the decoded image stays warm
    }
    return image
  }, [])

  // After the page has loaded, fetch and decode every scene in the background.
  useEffect(() => {
    let timer
    const run = () => {
      timer = window.setTimeout(() => {
        for (const s of SCENES) preload(s).decode?.().catch(() => {})
      }, 300)
    }
    if (document.readyState === 'complete') run()
    else window.addEventListener('load', run, { once: true })
    return () => {
      window.removeEventListener('load', run)
      window.clearTimeout(timer)
    }
  }, [preload])

  const selectScene = useCallback(
    (id) => {
      setRequestedId(id)
      const token = ++requestToken.current
      const image = preload(byId(id))
      // Keep the previous photo until the new one has decoded: no flash.
      const ready = image.decode ? image.decode() : Promise.resolve()
      ready
        .catch(() => {})
        .then(() => {
          if (token === requestToken.current) setSceneId(id)
        })
    },
    [preload],
  )

  // Mouse parallax (fine pointers only) and scroll depth. No React state involved.
  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    const stage = stageRef.current
    const cleanups = []

    if (window.matchMedia('(pointer: fine)').matches) {
      let raf = 0
      let nx = 0
      let ny = 0
      const write = () => {
        raf = 0
        const photoX = -nx * PARALLAX_PHOTO_PX
        const photoY = -ny * PARALLAX_PHOTO_PX
        if (mouseRef.current) {
          mouseRef.current.style.transform = `translate3d(${photoX.toFixed(2)}px, ${photoY.toFixed(2)}px, 0)`
        }
        if (labelRef.current) {
          const extra = PARALLAX_LABEL_NET_PX - PARALLAX_PHOTO_PX
          labelRef.current.style.transform = `translate3d(${(-nx * extra).toFixed(2)}px, ${(-ny * extra).toFixed(2)}px, 0)`
        }
      }
      const schedule = () => {
        if (!raf) raf = requestAnimationFrame(write)
      }
      const onMove = (e) => {
        if (parallaxLocked.current || e.pointerType === 'touch') return
        const r = stage.getBoundingClientRect()
        nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1)
        ny = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1)
        schedule()
      }
      const recentre = () => {
        nx = 0
        ny = 0
        schedule()
      }
      wiggleReset.current = recentre
      stage.addEventListener('pointermove', onMove, { passive: true })
      stage.addEventListener('pointerleave', recentre)
      cleanups.push(() => {
        stage.removeEventListener('pointermove', onMove)
        stage.removeEventListener('pointerleave', recentre)
        cancelAnimationFrame(raf)
        wiggleReset.current = null
      })
    }

    // Scroll depth: the photo lags the page (0.3x) while the hero is on screen.
    {
      let raf = 0
      let off = false
      const write = () => {
        raf = 0
        if (scrollRef.current) {
          scrollRef.current.style.transform = `translate3d(0, ${(window.scrollY * SCROLL_FACTOR).toFixed(1)}px, 0)`
        }
      }
      const onScroll = () => {
        const past = window.scrollY > stage.offsetHeight
        if (past !== off) {
          off = past
          if (past) stage.dataset.offscreen = '1' // also pauses the endless animations
          else delete stage.dataset.offscreen
        }
        if (!past && !raf) raf = requestAnimationFrame(write)
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      onScroll()
      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll)
        cancelAnimationFrame(raf)
      })
    }

    return () => cleanups.forEach((fn) => fn())
  }, [])

  // Imperative API used by <App> and <MenuOverlay> for the zoom-into-the-menu sequence.
  useImperativeHandle(
    apiRef,
    () => {
      const currentScale = () => {
        const t = getComputedStyle(boxRef.current).transform
        return t === 'none' ? 1 : new DOMMatrix(t).a
      }
      const clearLive = () => {
        live.current.forEach((a) => a.cancel())
        live.current = []
      }
      const track = (el, keyframes, options) => {
        const a = el.animate(keyframes, { fill: 'forwards', ...options })
        live.current.push(a)
        return a
      }

      return {
        /** Current on-screen rectangle of the menu board (the hotspot button). */
        getBoardRect: () => hotspotRef.current.getBoundingClientRect(),

        /**
         * Rectangle the board occupies when the camera is at rest. The dolly scales about
         * the board's centre, so the centre is unchanged and only the size is undone.
         */
        getRestRect: () => {
          const r = hotspotRef.current.getBoundingClientRect()
          const s = currentScale()
          const w = r.width / s
          const h = r.height / s
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          return { left: cx - w / 2, top: cy - h / 2, width: w, height: h }
        },

        /** Camera dollies into the board: photo scales about the board, label hides. */
        dollyIn: () => {
          const h = sceneRef.current.hotspot
          const box = boxRef.current
          const label = labelRef.current
          const vignettes = vignetteRefs.current
          parallaxLocked.current = true
          wiggleReset.current?.()
          box.style.transformOrigin = `${h.left + h.width / 2}% ${h.top + h.height / 2}%`
          clearLive()
          labelAnim.current?.cancel()
          if (prefersReducedMotion()) {
            box.style.transform = `scale(${DOLLY_SCALE})`
            label.style.opacity = '0'
            vignettes.forEach((v) => v && (v.style.opacity = '1'))
            return Promise.resolve()
          }
          labelAnim.current = label.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 120,
            fill: 'forwards',
          })
          vignettes.forEach((v) => v && track(v, [{ opacity: VIGNETTE_REST }, { opacity: 1 }], { duration: DOLLY_IN_MS, easing: DOLLY_EASE }))
          const a = track(
            box,
            [{ transform: 'scale(1)' }, { transform: `scale(${DOLLY_SCALE})` }],
            { duration: DOLLY_IN_MS, easing: DOLLY_EASE },
          )
          return a.finished.then(() => undefined, () => undefined)
        },

        /** Reverse: camera returns to rest, then the label reappears. */
        dollyOut: async () => {
          const box = boxRef.current
          const label = labelRef.current
          const vignettes = vignetteRefs.current
          const reset = () => {
            box.style.transform = ''
            label.style.opacity = ''
            vignettes.forEach((v) => v && (v.style.opacity = ''))
            parallaxLocked.current = false
          }
          if (prefersReducedMotion()) {
            reset()
            return
          }
          const from = currentScale()
          const vFrom = vignettes[0] ? parseFloat(getComputedStyle(vignettes[0]).opacity) : VIGNETTE_REST
          clearLive()
          const a = track(box, [{ transform: `scale(${from})` }, { transform: 'scale(1)' }], {
            duration: DOLLY_OUT_MS,
            easing: DOLLY_EASE,
          })
          vignettes.forEach((v) => v && track(v, [{ opacity: vFrom }, { opacity: VIGNETTE_REST }], { duration: DOLLY_OUT_MS, easing: DOLLY_EASE }))
          await a.finished.catch(() => {})
          clearLive()
          parallaxLocked.current = false
          const fade = label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 })
          labelAnim.current?.cancel()
          labelAnim.current = null
          await fade.finished.catch(() => {})
        },
      }
    },
    [hotspotRef],
  )

  const h = scene.hotspot
  const hotspotVars = {
    '--hl': `${h.left}%`,
    '--ht': `${h.top}%`,
    '--hw': `${h.width}%`,
    '--hh': `${h.height}%`,
  }

  return (
    <section ref={stageRef} className="stage" aria-label="Pakka Local food truck">
      {/* Phones and tablets: blurred copy of the photo fills the letterbox area. */}
      <img
        className="scene-ambient"
        src={scene.src}
        srcSet={scene.srcSet}
        sizes={HERO_SIZES}
        alt=""
        aria-hidden="true"
        draggable="false"
      />

      <div ref={scrollRef} className="scene-layer">
        <div ref={mouseRef} className="scene-layer scene-mouse">
          <div className="scene-layer scene-intro">
            <div className="scene-layer scene-drift">
              <div
                ref={boxRef}
                className="scene-box"
                style={{ '--ratio': scene.width / scene.height }}
              >
                <img
                  className="scene-img"
                  src={scene.src}
                  srcSet={scene.srcSet}
                  sizes={HERO_SIZES}
                  width={scene.width}
                  height={scene.height}
                  alt={scene.alt}
                  fetchPriority="high"
                  decoding="async"
                  draggable="false"
                />

                {scene.glows.map((g) => (
                  <div
                    key={`${scene.id}-${g.id}`}
                    aria-hidden="true"
                    className={g.kind === 'neon' ? 'glow glow-neon' : 'glow'}
                    style={{
                      '--gx': `${g.cx}%`,
                      '--gy': `${g.cy}%`,
                      '--gw': `${g.width}%`,
                      '--gh': `${g.height}%`,
                      '--glow': g.color,
                      ...(g.opacity != null ? { opacity: g.opacity } : null),
                    }}
                  />
                ))}

                <div className="hotspot-layer" style={hotspotVars}>
                  <button
                    ref={hotspotRef}
                    type="button"
                    className="hotspot"
                    aria-label="Open the full menu"
                    onClick={onOpenMenu}
                  />
                  <span
                    ref={labelRef}
                    className="hotspot-label"
                    aria-hidden="true"
                    onClick={onOpenMenu}
                  >
                    <span className="pulse-dot" />
                    Click on the menu to view the full menu.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Entrance: black veil fades out, like the lights coming up. */}
      <div aria-hidden="true" className="scene-veil" />

      {/* Subtle edge vignettes: black/45 at the very edge, clear by 30% of the height. */}
      <div
        ref={(el) => {
          vignetteRefs.current[0] = el
        }}
        aria-hidden="true"
        style={{ opacity: VIGNETTE_REST }}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[30%] bg-gradient-to-b from-black/70 to-transparent"
      />
      <div
        ref={(el) => {
          vignetteRefs.current[1] = el
        }}
        aria-hidden="true"
        style={{ opacity: VIGNETTE_REST }}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[30%] bg-gradient-to-t from-black/70 to-transparent"
      />

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
        <h1 className="hero-text m-0 flex items-center gap-3 text-lg font-semibold tracking-wide text-white sm:text-xl">
          <img
            src={img('logo.png')}
            width="40"
            height="40"
            alt=""
            className="h-10 w-10 rounded-full ring-1 ring-white/30"
          />
          Pakka Local
        </h1>
        <div role="group" aria-label="Choose scene" className="glass flex gap-1 rounded-full p-1">
          {SCENES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="seg-btn"
              aria-pressed={requestedId === s.id}
              onClick={() => selectScene(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hero-text absolute bottom-0 left-0 z-20 flex flex-col gap-1 px-4 pb-4 text-sm text-white sm:px-8 sm:pb-6">
        <span className="font-medium">Indian street food · Chantilly, Virginia</span>
        <a
          href={PHONE_HREF}
          className="w-fit font-semibold underline decoration-white/50 underline-offset-4 hover:decoration-white"
        >
          {PHONE_DISPLAY}
        </a>
      </div>
    </section>
  )
}

export default memo(Hero)
