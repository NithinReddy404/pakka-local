import { memo } from 'react'
import { PHONE_DISPLAY, PHONE_HREF, SITE_URL } from '../menuData.js'

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink px-4 py-10 text-sm text-paper/80 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
        <span className="font-semibold text-paper">Pakka Local Food Truck</span>
        <span>Chantilly, VA</span>
        <a href={PHONE_HREF} className="underline underline-offset-4 hover:text-paper">
          {PHONE_DISPLAY}
        </a>
        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-paper"
        >
          pakkalocalfoodtruck.netlify.app
        </a>
        <span className="text-paper/60 sm:ml-auto">Photos of the actual truck</span>
      </div>
    </footer>
  )
}

export default memo(Footer)
