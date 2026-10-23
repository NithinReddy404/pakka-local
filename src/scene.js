// Every coordinate of the living scene, as data. Edit numbers here, not in the components.
//
// All positions are PERCENT of the full scene image (public/img/scene.webp, 1750x1212):
//   rect  = { left, top, width, height }  (top-left corner + size)
//   point = { x, y }                       (centre of an effect)
//   polygon = [[x, y], ...]                (clockwise, used as a clip-path)
// Rows 0..21% are generated sky and rows 79..100% generated gravel (see
// scripts/prepare-scene.mjs); the real render is 21..79%.

import { img } from './imgPath.js'

export const SCENE_W = 1750
export const SCENE_H = 1212
export const RATIO = SCENE_W / SCENE_H

// One image for the whole site. Every layer copy uses the same src/srcset/sizes so the
// browser decodes it once. `sizes` must match the <link rel="preload"> in index.html.
export const IMAGE = {
  src: img('scene.webp'),
  srcSet: `${img('scene-1200.webp')} 1200w, ${img('scene.webp')} 1750w`,
  sizes: '(max-aspect-ratio: 6/5) 145vh, 100vw',
  tiny: img('scene-tiny.webp'),
  alt: 'Sunset at the Pakka Local food truck: the black Chat Bandi cart with red wheels on the left, the yellow Pakka Local truck with its serving window, and the menu board beside the truck.',
}

// Interactive rectangles (the hotspots). A 44px minimum tap target is added in CSS.
export const HOTSPOTS = {
  menu: { left: 81.3, top: 56.5, width: 4.2, height: 7.8 },
  counter: { left: 64.2, top: 45.1, width: 9.6, height: 7.8 },
  cart: { left: 23.4, top: 48.7, width: 9.4, height: 9.6 }, // the chaat cart's glass case
}

// The woman at the chaat cart stands behind the glass case: her rect starts under the
// canopy (y 48.7) and the food boxes in front of her are a cutout copy of the photo
// (`occluder`) drawn over her, so her edges never show.
export const CART_PERSON = {
  rect: { left: 23.7, top: 48.7, width: 8.6, height: 6.4 },
  occluder: [[23.4, 53.4], [29.2, 53.4], [29.2, 52], [33.2, 52], [33.2, 58.4], [23.4, 58.4]],
  lookAtX: 28, // portrait pan target when she talks
}

// Speech-bubble hints: anchor point (bubble tail) in percent of the scene.
export const BUBBLES = {
  counter: { x: 69, y: 45.1 },
  cart: { x: 29.6, y: 44.2 }, // above the CHAT BANDI canopy sign
}

// The butterfly that roams around the menu board: figure-eight radius in board widths,
// loop time and the pause on the board's top edge (seconds).
export const BUTTERFLY = { radius: 1.5, loopS: 14, perchS: 2 }

// Where the vendor stands: the inside of the serving window. He is clipped to this rect.
export const WINDOW_INTERIOR = { left: 65.8, top: 45.7, width: 6.7, height: 6.6 }

export const RECTS = {
  cart: { left: 16.2, top: 44.6, width: 27.1, height: 26.4 },
  truck: { left: 48.7, top: 40.3, width: 34.6, height: 25.2 },
  ground: { left: 0, top: 60, width: 100, height: 40 }, // everything below y = 60
}

export const POLYGONS = {
  treesLeft: [[0, 21.2], [48.5, 21.2], [48.5, 40], [43.3, 44.5], [16.2, 44.5], [16.2, 59], [0, 59]],
  treesRight: [[83.3, 29], [100, 29], [100, 56], [83.3, 56]],
  sky: [[0, 0], [100, 0], [100, 30], [60, 36], [40, 22], [0, 22]],
  // The base plane is the image minus the sky and the two tree polygons, so the layers
  // behind it (sky at the back, trees in the middle) actually show and can move.
  base: [
    [48.5, 27.95], [60, 36], [83.3, 32.5], [83.3, 56], [100, 56], [100, 100],
    [0, 100], [0, 59], [16.2, 59], [16.2, 44.5], [43.3, 44.5], [48.5, 40],
  ],
}

/** Bounding rect of a polygon, used to size tree cutouts so filters touch only those pixels. */
export const polygonBounds = (poly) => {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
}

// The generated sky band ends at y 21%. The seam mirror reflects the real rows just
// below it upward over `height` percent and fades them out.
export const SEAM = { y: 21.2, height: 10 } // row 256 of 1212 is y 21.12; start just below it

export const LIGHTS = {
  lamps: [
    { x: 64.2, y: 45.1 },
    { x: 73.8, y: 45.1 },
  ],
  sunset: { x: 92, y: 28, width: 16, height: 20 }, // kept narrow so it fades out before the truck edge
  steam: { x: 33, y: 48 }, // the cart's glass food case
}

// Depth of each layer in px (translateZ). Each layer is scaled by (P - z) / P so that at
// rest every copy registers exactly on the base image; only tilt reveals the depth.
export const DEPTH = {
  perspective: 1200,
  sky: -60, // full image copy + high clouds + birds (seen through the sky polygon)
  trees: -24, // tree cutouts (sway + displacement)
  haze: -12, // low clouds crossing the y 14-26% band, sunset glow over the right trees
  base: 0, // base cutout, window wash, vendor
  truck: 18, // window lamp glows
  cart: 40, // cart cutout + steam
  ground: 40, // ground cutout + dust motes
  ui: 44, // hotspots and hint labels (in front, so the ground copy never covers them)
}

export const TILT = { maxY: 2.2, maxX: 1.4 } // degrees

// Layout. Landscape (aspect >= 1.2) covers the viewport; the vertical overflow is cropped
// from the TOP first (generated sky), but never more than CROP_TOP_MAX percent of the scene
// so the truck roof (y 40.3) stays in view. Portrait / narrow viewports fill the height and
// pan horizontally.
export const LANDSCAPE_MIN_ASPECT = 1.2
export const CROP_TOP_MAX = 36
export const PAN_START_X = 69 // initial pan centres the truck window
export const PAN_KEEP_VISIBLE = { right: 87, windowLeft: 64.2 } // nudge so the board shows too

// Camera dolly into the menu board.
export const DOLLY = { scale: 2.6, inMs: 650, outMs: 450, ease: 'cubic-bezier(.65,0,.35,1)' }

// Clouds drift left to right. y/height/width in percent of the scene; duration in s.
// The two "haze" clouds cross the y 14-26% band to soften the generated-sky seam at y 21.
export const CLOUDS = [
  { layer: 'sky', y: 3, height: 9, width: 30, opacity: 0.14, duration: 140, delay: -30, rest: 40 },
  { layer: 'sky', y: 9, height: 7, width: 22, opacity: 0.1, duration: 105, delay: -70, rest: 85 },
  { layer: 'haze', y: 14, height: 11, width: 34, opacity: 0.18, duration: 120, delay: -15, rest: 20 },
  { layer: 'haze', y: 16, height: 9, width: 26, opacity: 0.12, duration: 70, delay: -40, rest: 70 },
]

// Bird flight path (percent of the scene), and the random wait between flights in s.
export const BIRDS = { from: { x: -6, y: 15 }, mid: { y: 8 }, to: { x: 106, y: 12 }, waitMin: 25, waitMax: 45, flightS: 16 }

export const DUST = { desktop: 18, phone: 10, yMin: 63, yMax: 96 }
