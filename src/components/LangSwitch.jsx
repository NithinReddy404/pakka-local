import { useEffect, useId, useRef, useState } from 'react'
import { LANGS, useI18n } from '../i18n.js'

/** Small glass pill at the top-right of the scene ("EN ⌄") that opens the language list. */
export default function LangSwitch() {
  const { lang, s, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const btnRef = useRef(null)
  const listId = useId()
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]

  useEffect(() => {
    if (!open) return undefined
    rootRef.current?.querySelector('[aria-current="true"]')?.focus({ preventScroll: true })
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        btnRef.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="lang" onPointerDown={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        className="lang-btn glass"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${s.language}: ${current.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{current.short}</span>
        <span aria-hidden="true" className="lang-caret">
          ⌄
        </span>
      </button>
      {open && (
        <ul id={listId} className="lang-list" aria-label={s.language}>
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                lang={l.code}
                aria-current={l.code === lang ? 'true' : undefined}
                onClick={() => {
                  setLang(l.code)
                  setOpen(false)
                  btnRef.current?.focus({ preventScroll: true })
                }}
              >
                {l.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
