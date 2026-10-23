import { useEffect, useId, useImperativeHandle, useRef } from 'react'
import { useReducedMotion } from '../motion.js'

// A desi couple, flat shaded for the sunset: light comes from the right, so right-hand
// sides get warm highlights and left-hand sides a darker, warmer shade.
const SKIN = '#c98a55'
const SKIN_SHADE = '#a2673a'
const SKIN_LIGHT = '#e3a974'
const HAIR = '#151010'
const BRAND = '#f7b500'
const BRAND_SHADE = '#c98f00'
const BRAND_LIGHT = '#ffd45a'
const INK = '#141414'
const WARM_RIM = '#ffb36b'

const LOOKS = {
  // Truck window: short black hair, neat beard, yellow Pakka Local cap, black apron, white tee.
  man: {
    face: 'M66,34 C66,22 72,17 80,17 C88,17 94,22 94,34 L94,40 C94,50 88,57 80,57 C72,57 66,50 66,40 Z',
    torso: 'M34,101 C34,79 44,69 60,65 L72,62 Q80,67 88,62 L100,65 C116,69 126,79 126,101 Z',
    top: '#f1ede4',
    topShade: '#c9c2b4',
    apron: INK,
    apronEdge: '#2c2c2c',
  },
  // Chaat cart: black hair tied back, bindi, gold studs, yellow-and-black kurta, cream apron.
  woman: {
    face: 'M66.5,34 C66.5,22 72,17.5 80,17.5 C88,17.5 93.5,22 93.5,34 L93.5,40 C93.5,49 87.5,55.5 80,55.5 C72.5,55.5 66.5,49 66.5,40 Z',
    torso: 'M38,101 C38,80 47,70 62,66 L72,63 Q80,68 88,63 L98,66 C113,70 122,80 122,101 Z',
    top: '#f2b21b',
    topShade: '#c98c0c',
    apron: '#f6ead2',
    apronEdge: '#d9c9a8',
  },
}

const VIEWBOX = { window: '0 0 147 100', portrait: '50 5 60 60' }

// SVG transform origins are in viewBox units (transform-box: view-box).
const origin = (x, y) => ({ transformBox: 'view-box', transformOrigin: `${x}px ${y}px` })
const ARM_REST = 'translateY(62px) rotate(0deg)'
const rand = (lo, hi) => lo + Math.random() * (hi - lo)

function ManHead() {
  return (
    <>
      {/* short hair at the sides, under the cap */}
      <path d="M66,30 L70,26 L70.5,38 L66,40.5 Z" fill={HAIR} />
      <path d="M94,30 L90,26 L89.5,38 L94,40.5 Z" fill={HAIR} />
    </>
  )
}

function ManFace() {
  return (
    <>
      {/* neat beard along the jaw, and moustache */}
      <path
        d="M66.6,42 C67,51 72.5,57.6 80,57.6 C87.5,57.6 93,51 93.4,42 L91.6,43 C91,49.6 86.6,54.4 80,54.6 C73.4,54.4 69,49.6 68.4,43 Z"
        fill={HAIR}
        opacity="0.92"
      />
      <path d="M74,50 Q77,47.4 80,48.4 Q83,47.4 86,50 Q83,49.4 80,49.8 Q77,49.4 74,50 Z" fill={HAIR} />
      <path d="M76.6,52.2 Q80,54.2 83.4,52.2" fill="none" stroke="#5a2618" strokeWidth="1" strokeLinecap="round" />
    </>
  )
}

function ManCap() {
  return (
    <>
      <path d="M64,31 C64,19 71,12.5 80,12.5 C89,12.5 96,19 96,31 Z" fill={BRAND} />
      <path d="M86,14 C92,16 95.5,22 96,30 L91,30 C90,23 88,18 84,14.5 Z" fill={BRAND_LIGHT} opacity="0.9" />
      <path d="M64,31 C64,20 69,15 75,13.6 C70,17 68.5,24 69,31 Z" fill={BRAND_SHADE} opacity="0.8" />
      <circle cx="80" cy="22.5" r="4.4" fill={INK} />
      <circle cx="80" cy="22.5" r="2.2" fill={BRAND} />
      <circle cx="80" cy="13.1" r="1.2" fill={BRAND_SHADE} />
      <path d="M62,30 Q80,26 100,28.6 Q107,30.6 104,34 Q82,31 62,34 Q59.5,32 62,30 Z" fill={BRAND_SHADE} />
      <path d="M84,28 Q95,28.4 101,29.6 Q104.5,31.4 102.5,32.8 Q92,30.4 84,29.8 Z" fill={BRAND_LIGHT} />
    </>
  )
}

function WomanHairBack() {
  // Bun, tied back, peeking out behind the head.
  return (
    <>
      <circle cx="67" cy="17" r="7.5" fill={HAIR} />
    </>
  )
}

function WomanHair() {
  return (
    <>
      <path d="M64.6,38 C62.5,19 71.5,12 80,12 C88.5,12 97.5,19 95.4,38 C94,29 89,23.5 81,23 L80,21.6 L79,23 C71,23.5 66,29 64.6,38 Z" fill={HAIR} />
      <path d="M86,13.5 C92,16 95.6,23 95.4,34 C94.4,27 91,21 85,17 Z" fill="#3a2a22" opacity="0.7" />
    </>
  )
}

function WomanFace() {
  return (
    <>
      <circle cx="80" cy="32.6" r="0.95" fill="#c4161c" />
      <path d="M76,51.2 Q80,54.6 84,51.2 Q80,52.4 76,51.2 Z" fill="#a8443a" />
      <path d="M77.4,52.4 Q80,53.4 82.6,52.4" fill="none" stroke="#f3e9dc" strokeWidth="0.5" opacity="0.6" />
    </>
  )
}

/**
 * The man at the truck window or the woman at the chaat cart (`who`), head and shoulders,
 * flat shaded for the sunset. Idle life (breathing, blinking, an occasional head turn) runs
 * on the Web Animations API; `apiRef.current.wave()` raises a hand and waves. Nothing
 * animates under reduced motion, and nothing here re-renders React while it moves.
 */
export default function Vendor({ apiRef, who = 'man', variant = 'window', className }) {
  const uid = useId().replace(/:/g, '')
  const reduce = useReducedMotion()
  const look = LOOKS[who] ?? LOOKS.man
  const figRef = useRef(null)
  const headRef = useRef(null)
  const featuresRef = useRef(null)
  const lidsRef = useRef(null)
  const armRef = useRef(null)
  const waving = useRef(null)

  useImperativeHandle(
    apiRef,
    () => ({
      wave() {
        const arm = armRef.current
        if (!arm || reduce || waving.current || document.hidden) return
        const t = (y, r) => ({ transform: `translateY(${y}px) rotate(${r}deg)` })
        waving.current = arm.animate(
          [
            { ...t(62, 0), offset: 0 },
            { ...t(0, -8), offset: 0.2 },
            { ...t(0, 12), offset: 0.34 },
            { ...t(0, -10), offset: 0.48 },
            { ...t(0, 12), offset: 0.62 },
            { ...t(0, -4), offset: 0.8 },
            { ...t(62, 0), offset: 1 },
          ],
          { duration: 1900, easing: 'ease-in-out' },
        )
        headRef.current?.animate(
          [{ transform: 'rotate(0deg)' }, { transform: 'rotate(5deg)', offset: 0.3 }, { transform: 'rotate(5deg)', offset: 0.75 }, { transform: 'rotate(0deg)' }],
          { duration: 1900, easing: 'ease-in-out' },
        )
        waving.current.finished
          .catch(() => {})
          .then(() => {
            waving.current = null
          })
      },
    }),
    [reduce],
  )

  // Idle life.
  useEffect(() => {
    if (reduce) return undefined
    const fig = figRef.current
    const head = headRef.current
    const features = featuresRef.current
    const lids = lidsRef.current
    const breathe = fig.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.015)' }], {
      duration: 2000,
      direction: 'alternate',
      iterations: Infinity,
      easing: 'ease-in-out',
    })
    let blinkTimer = 0
    let turnTimer = 0
    const blink = () => {
      if (!document.hidden) {
        lids.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)', offset: 0.45 }, { transform: 'scaleY(0)' }], {
          duration: 170,
          easing: 'ease-in-out',
        })
      }
      blinkTimer = window.setTimeout(blink, rand(3000, 6000))
    }
    const turn = () => {
      if (!document.hidden && !waving.current) {
        const dir = Math.random() < 0.5 ? -1 : 1
        const opts = { duration: 2600, easing: 'ease-in-out' }
        head.animate(
          [{ transform: 'rotate(0deg)' }, { transform: `rotate(${dir * 4}deg)`, offset: 0.25 }, { transform: `rotate(${dir * 4}deg)`, offset: 0.7 }, { transform: 'rotate(0deg)' }],
          opts,
        )
        features.animate(
          [{ transform: 'translateX(0px)' }, { transform: `translateX(${dir * 1.6}px)`, offset: 0.25 }, { transform: `translateX(${dir * 1.6}px)`, offset: 0.7 }, { transform: 'translateX(0px)' }],
          opts,
        )
      }
      turnTimer = window.setTimeout(turn, rand(6000, 11000))
    }
    blinkTimer = window.setTimeout(blink, rand(1500, 4000))
    turnTimer = window.setTimeout(turn, rand(4000, 8000))
    return () => {
      breathe.cancel()
      window.clearTimeout(blinkTimer)
      window.clearTimeout(turnTimer)
    }
  }, [reduce])

  const faceClip = `${uid}-face`
  const torsoClip = `${uid}-torso`
  const isMan = who !== 'woman'

  return (
    <svg className={className} viewBox={VIEWBOX[variant]} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={faceClip}>
          <path d={look.face} />
        </clipPath>
        <clipPath id={torsoClip}>
          <path d={look.torso} />
        </clipPath>
      </defs>

      <g ref={figRef} style={origin(80, 100)}>
        {!isMan && <WomanHairBack />}

        {/* Shoulders, top and apron */}
        <path d={look.torso} fill={look.top} />
        <g clipPath={`url(#${torsoClip})`}>
          <path d="M30,101 L30,60 L66,60 L60,101 Z" fill={look.topShade} opacity="0.7" />
          {!isMan && (
            <g fill={INK} opacity="0.85">
              <path d="M44,84 l2,-2 l2,2 l-2,2 Z M110,86 l2,-2 l2,2 l-2,2 Z M50,95 l2,-2 l2,2 l-2,2 Z M106,96 l2,-2 l2,2 l-2,2 Z" />
            </g>
          )}
          <path d="M60,77 L100,77 L102,101 L58,101 Z" fill={look.apron} />
          <path d="M60,77 L100,77 L100.3,79.4 L59.8,79.4 Z" fill={look.apronEdge} />
          <path d="M60,77 L69,77 L66.5,101 L58,101 Z" fill="#000" opacity="0.16" />
          <path d="M93,79 L100,79 L102,101 L96,101 Z" fill={WARM_RIM} opacity="0.18" />
          <path d="M62,78 L70,63 L74,63 L66,79 Z" fill={look.apronEdge} />
          <path d="M98,78 L90,63 L86,63 L94,79 Z" fill={look.apron} />
          {isMan && (
            <>
              <circle cx="80" cy="90" r="4.4" fill={BRAND} />
              <circle cx="80" cy="90" r="2.4" fill={INK} />
            </>
          )}
        </g>
        {isMan ? (
          <path d="M72.5,62 Q80,69 87.5,62 L86,61.2 Q80,66.4 74,61.2 Z" fill={look.topShade} />
        ) : (
          <path d="M72,63 Q80,71 88,63 L89.6,64.6 Q80,74.6 70.4,64.6 Z" fill={INK} />
        )}
        <path d="M98,65.5 C113,70 122,80 123,101" fill="none" stroke={WARM_RIM} strokeWidth="1.1" opacity="0.45" />

        {/* Neck */}
        <path d="M74,52 L86,52 L87,64 Q80,67 73,64 Z" fill={SKIN_SHADE} />
        <path d="M83,53 L86,53 L87,63.5 L84,64.6 Z" fill={SKIN} opacity="0.8" />

        {/* Head: turns about the neck */}
        <g ref={headRef} style={origin(80, 56)}>
          <ellipse cx="65.6" cy="40" rx="2.6" ry="4.2" fill={SKIN_SHADE} />
          <ellipse cx="94.4" cy="40" rx="2.6" ry="4.2" fill={SKIN} />
          {!isMan && (
            <>
              <circle cx="65.4" cy="44.2" r="1.15" fill="#f2c14e" />
              <circle cx="94.6" cy="44.2" r="1.15" fill="#ffd978" />
            </>
          )}
          <path d={look.face} fill={SKIN} />
          <g clipPath={`url(#${faceClip})`}>
            <path d="M60,15 L76,15 C72,30 72,45 75,60 L60,60 Z" fill={SKIN_SHADE} opacity="0.38" />
            <ellipse cx="89.5" cy="42" rx="3.8" ry="6.5" fill={SKIN_LIGHT} opacity="0.55" />
            {isMan && <path d="M66,34 Q80,31.5 94,34 L94,36.4 Q80,33.8 66,36.4 Z" fill="#000" opacity="0.18" />}
            {isMan && <ManHead />}
          </g>

          {/* Features: shift sideways when the head turns */}
          <g ref={featuresRef}>
            <ellipse cx="74.5" cy="39" rx="2.7" ry="1.7" fill="#f3e9dc" />
            <ellipse cx="85.5" cy="39" rx="2.7" ry="1.7" fill="#f3e9dc" />
            <circle cx="75" cy="39.2" r="1.4" fill="#24140c" />
            <circle cx="86" cy="39.2" r="1.4" fill="#24140c" />
            <circle cx="75.5" cy="38.7" r="0.42" fill="#fff" />
            <circle cx="86.5" cy="38.7" r="0.42" fill="#fff" />
            {!isMan && (
              <path d="M71.6,38 Q74.5,36.4 77.4,37.6 M82.6,37.6 Q85.5,36.4 88.4,38" fill="none" stroke={HAIR} strokeWidth="0.8" strokeLinecap="round" />
            )}
            <g ref={lidsRef} style={{ ...origin(80, 36.9), transform: 'scaleY(0)' }}>
              <ellipse cx="74.5" cy="39" rx="3.1" ry="2.2" fill={SKIN_SHADE} />
              <ellipse cx="85.5" cy="39" rx="3.1" ry="2.2" fill={SKIN} />
            </g>
            <path
              d="M71,34.6 Q74.5,33 78,34.7 M82,34.7 Q85.5,33 89,34.6"
              fill="none"
              stroke={HAIR}
              strokeWidth={isMan ? 1.4 : 1}
              strokeLinecap="round"
            />
            <path d="M80.5,39 Q79,45 79.5,46.5 Q81,47.6 83,46.6" fill="none" stroke="#8a4f2c" strokeWidth="1" strokeLinecap="round" />
            <path d="M82.2,41 Q83.2,44 82.8,45.6" fill="none" stroke={SKIN_LIGHT} strokeWidth="0.7" opacity="0.7" />
            {isMan ? <ManFace /> : <WomanFace />}
          </g>

          {isMan ? <ManCap /> : <WomanHair />}
        </g>

        {/* Waving arm: rests below the counter, rises on wave() */}
        <g ref={armRef} style={{ ...origin(124, 96), transform: ARM_REST }}>
          <path d="M124,101 L124,86" stroke={look.top} strokeWidth="10" strokeLinecap="round" />
          <path d="M124,88 L125,62" stroke={SKIN} strokeWidth="7" strokeLinecap="round" />
          <path d="M121.4,86 L122,63" stroke={SKIN_SHADE} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <path d="M122,50 L121.4,45.5 M124.3,49.2 L124.1,44.2 M126.6,49.3 L127,44.6 M128.6,50.6 L129.6,46.6" stroke={SKIN} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M120.6,55 L118,51.5" stroke={SKIN} strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="125.4" cy="55" rx="5.2" ry="6.2" fill={SKIN} />
          <ellipse cx="128" cy="55" rx="1.8" ry="4" fill={SKIN_LIGHT} opacity="0.6" />
          {!isMan && <path d="M119.6,66 L130.4,66" stroke="#f2c14e" strokeWidth="1.6" strokeLinecap="round" />}
        </g>
      </g>
    </svg>
  )
}
