import { useCallback, useRef, useState } from 'react'
import Hero from './components/Hero.jsx'
import Gallery from './components/Gallery.jsx'
import Footer from './components/Footer.jsx'
import MenuOverlay from './components/MenuOverlay.jsx'
import { warmMenu } from './warmMenu.js'

const OVERLAY_DELAY_MS = 220
const MENU_DECODE_TIMEOUT_MS = 1500
const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  // The hotspot button lives in <Hero>; focus returns here when the menu closes.
  const hotspotRef = useRef(null)
  const heroApi = useRef(null) // imperative camera controls exposed by <Hero>
  const busy = useRef(false) // ignore clicks while the open / close transition runs

  // Open: the camera starts dollying into the board right away; the overlay mounts 220ms
  // later (immediately under reduced motion) and takes over the zoom.
  const openMenu = useCallback(() => {
    if (busy.current) return
    busy.current = true
    // Page behind is inert from the first click, so nothing (a scene switch, say) can
    // change mid-dolly. The overlay's own cleanup lifts it again on close.
    const root = document.getElementById('root')
    if (root) root.inert = true
    heroApi.current?.dollyIn()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Mount once the camera has started AND the menu photo is decoded (capped), so the
    // first open flies a real photo instead of an empty sheet.
    Promise.all([
      Promise.race([warmMenu(), delay(MENU_DECODE_TIMEOUT_MS)]),
      delay(reduce ? 0 : OVERLAY_DELAY_MS),
    ]).then(() => setMenuOpen(true))
  }, [])
  // Called by the overlay once its close transition (and the camera pull-out) is done.
  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    busy.current = false
  }, [])

  return (
    <>
      <main>
        <Hero onOpenMenu={openMenu} hotspotRef={hotspotRef} apiRef={heroApi} />
        <Gallery />
      </main>
      <Footer />
      {menuOpen && <MenuOverlay onClose={closeMenu} returnFocusRef={hotspotRef} heroApi={heroApi} />}
    </>
  )
}
