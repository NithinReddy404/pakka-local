import { img } from './imgPath.js'

let pending = null

/**
 * Fetches and decodes the menu board photo once. Called after the hero loads and again
 * when the menu opens, so the first open never flies an empty sheet. Never rejects.
 */
export function warmMenu() {
  if (!pending) {
    const image = new Image()
    image.src = img('menu.webp')
    pending = (image.decode ? image.decode() : Promise.resolve()).catch(() => {})
  }
  return pending
}
