// The two hero scenes. Edit hotspot rectangles here.
// hotspot values are PERCENT of the image box: left/top are measured from the
// image's top-left corner, width/height are fractions of the image's own size.
// The rectangle should sit exactly on the menu A-frame board in that photo.
//
// glows are decorative light effects painted over the photo (screen blend, non-interactive).
// cx/cy are the CENTRE of the glow and width/height its size, all in percent of the image
// box. kind "neon" flickers, kind "lamp" is static at the given opacity.

import { img } from './imgPath.js'

export const SCENES = [
  {
    id: 'night',
    label: 'Night',
    alt: 'The Pakka Local food truck at night under string lights with a neon open sign and the menu board beside it',
    src: img('hero-night.webp'),
    srcSet: `${img('hero-night-800.webp')} 800w, ${img('hero-night.webp')} 1202w`,
    width: 1202,
    height: 800,
    hotspot: { left: 67, top: 62, width: 8.5, height: 24.5 },
    glows: [
      { id: 'open-sign', kind: 'neon', cx: 43, cy: 43, width: 14, height: 14, color: '#ff4fd8' },
      { id: 'lamp-left', kind: 'lamp', cx: 30, cy: 26, width: 10, height: 10, color: '#ffd27a', opacity: 0.5 },
      { id: 'lamp-right', kind: 'lamp', cx: 64, cy: 26, width: 10, height: 10, color: '#ffd27a', opacity: 0.5 },
    ],
  },
  {
    id: 'day',
    label: 'Day',
    alt: 'The Pakka Local food truck by day, with the Chat Bandi cart on the left and the menu board at the far right',
    src: img('hero-day.webp'),
    srcSet: `${img('hero-day-800.webp')} 800w, ${img('hero-day.webp')} 1200w`,
    width: 1200,
    height: 735,
    hotspot: { left: 82.3, top: 65.3, width: 5.2, height: 12.5 },
    glows: [],
  },
]

export const DEFAULT_SCENE_ID = 'night'

// Must match the `sizes` used by the <img> and the <link rel="preload"> in index.html.
export const HERO_SIZES = '100vw'
