import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Scene from './components/Scene.jsx'
import Dialogue from './components/Dialogue.jsx'
import MenuPanel from './components/MenuPanel.jsx'
import LangSwitch from './components/LangSwitch.jsx'
import { pauseWhileHidden, prefersReducedMotion, wait } from './motion.js'
import { CART_PERSON, PAN_START_X } from './scene.js'
import { LangContext, STRINGS, initialLang, saveLang } from './i18n.js'

// The menu panel mounts part-way through the camera dolly and grows out of the board.
const PANEL_DELAY_MS = 380

export default function App() {
  const [lang, setLangState] = useState(initialLang)
  const [menuOpen, setMenuOpen] = useState(false)
  const [speaker, setSpeaker] = useState(null) // null | 'truck' | 'cart'
  const sceneApi = useRef(null)
  const menuBtnRef = useRef(null)
  const counterBtnRef = useRef(null)
  const cartBtnRef = useRef(null)
  const busy = useRef(false)
  const afterDialogue = useRef(null)

  useEffect(() => pauseWhileHidden(), [])
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const i18n = useMemo(
    () => ({
      lang,
      s: STRINGS[lang] ?? STRINGS.en,
      setLang: (code) => {
        if (!STRINGS[code]) return
        saveLang(code)
        setLangState(code)
      },
    }),
    [lang],
  )

  const openMenu = useCallback(() => {
    if (busy.current) return
    busy.current = true
    // Inert from the first click so nothing in the scene changes mid-dolly; the panel's
    // own cleanup lifts it again.
    const root = document.getElementById('root')
    if (root) root.inert = true
    sceneApi.current?.dollyIn()
    wait(prefersReducedMotion() ? 0 : PANEL_DELAY_MS).then(() => setMenuOpen(true))
  }, [])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    busy.current = false
  }, [])

  const talk = useCallback((who) => {
    if (busy.current) return
    sceneApi.current?.lookAt(who === 'cart' ? CART_PERSON.lookAtX : PAN_START_X)
    setSpeaker(who)
  }, [])

  const endTalk = useCallback(
    (reason) => {
      if (reason === 'menu') afterDialogue.current = openMenu
      setSpeaker(null)
    },
    [openMenu],
  )
  const speakerRef = useRef(null)
  useEffect(() => {
    if (speaker) speakerRef.current = speaker
  }, [speaker])
  const bye = useCallback(() => sceneApi.current?.wave(speakerRef.current), [])

  // Runs after the dialogue has unmounted (and handed focus back), e.g. to open the menu.
  useEffect(() => {
    if (speaker || !afterDialogue.current) return
    const next = afterDialogue.current
    afterDialogue.current = null
    next()
  }, [speaker])

  return (
    <LangContext value={i18n}>
      <main className="app">
        <h1 className="sr-only">Pakka Local food truck, Chantilly, Virginia</h1>
        <Scene
          apiRef={sceneApi}
          onOpenMenu={openMenu}
          onTalk={talk}
          menuBtnRef={menuBtnRef}
          counterBtnRef={counterBtnRef}
          cartBtnRef={cartBtnRef}
          talking={!!speaker}
        />
        <LangSwitch />
      </main>
      {speaker && (
        <Dialogue
          key={speaker}
          speaker={speaker}
          onClose={endTalk}
          onBye={bye}
          returnFocusRef={speaker === 'cart' ? cartBtnRef : counterBtnRef}
        />
      )}
      {menuOpen && <MenuPanel onClose={closeMenu} sceneApi={sceneApi} returnFocusRef={menuBtnRef} />}
    </LangContext>
  )
}
