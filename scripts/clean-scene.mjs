// Removes the propane cylinder, the trash can and the folding chair that stood in front of
// the truck in source-photos/scene.webp. Clean truck body, the door/body seam, the lower
// trim and clean gravel are cloned over them from the same image (same rows or same columns
// keep perspective, lighting and reflections consistent). Patches are colour-matched to a
// reference region beside their destination and laid with feathered (raster) alpha masks.
// Writes source-photos/scene-clean.png, which prepare-scene.mjs prefers when present.
// Run: node scripts/clean-scene.mjs
import sharp from "sharp";

const SRC = "source-photos/scene.webp";
const OUT = "source-photos/scene-clean.png";
let canvas = await sharp(SRC).png().toBuffer();

// --- helpers -------------------------------------------------------------------------
const gradient = (w, h, f, horizontal) => {
  const n = horizontal ? w : h;
  const line = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    const d = Math.min(i, n - 1 - i);
    line[i] = Math.round(255 * Math.min(1, (d + 0.5) / Math.max(f, 1)));
  }
  const buf = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) buf[y * w + x] = horizontal ? line[x] : line[y];
  return sharp(buf, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
};
// Vertical gradient with different fade lengths at the top and the bottom.
const gradientTB = (w, h, ft, fb) => {
  const buf = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    const v = Math.round(255 * Math.min(1, (y + 0.5) / Math.max(ft, 1), (h - 1 - y + 0.5) / Math.max(fb, 1)));
    buf.fill(v, y * w, (y + 1) * w);
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
};
async function featherMask(w, h, f, topF = f) {
  const gx = await gradient(w, h, f, true);
  const gy = topF === f ? await gradient(w, h, f, false) : await gradientTB(w, h, topF, f);
  return sharp(gx).composite([{ input: gy, blend: "multiply" }]).toColourspace("b-w").png().toBuffer();
}
async function meanRGB(buf, rect) {
  const { channels } = await sharp(buf).extract(rect).removeAlpha().stats();
  return channels.slice(0, 3).map((c) => c.mean);
}
// Multiply each channel so the patch's mean matches the reference region's mean.
async function matchTo(patch, ref) {
  const pm = await meanRGB(patch, { left: 0, top: 0, width: (await sharp(patch).metadata()).width, height: (await sharp(patch).metadata()).height });
  const rm = await meanRGB(canvas, ref);
  const k = pm.map((m, i) => Math.min(1.35, Math.max(0.7, rm[i] / Math.max(m, 1))));
  return sharp(patch).removeAlpha().linear(k, [0, 0, 0]).png().toBuffer();
}
async function lay(patch, dst, f = 8, ref = null, topF = f) {
  const { width: w, height: h } = await sharp(patch).metadata();
  if (ref) patch = await matchTo(patch, ref);
  // removeAlpha runs after joinChannel in one pipeline (and would strip the mask), so split them.
  const rgb = await sharp(patch).removeAlpha().png().toBuffer();
  const soft = await sharp(rgb).joinChannel(await featherMask(w, h, f, topF)).png().toBuffer();
  canvas = await sharp(canvas).composite([{ input: soft, left: dst.left, top: dst.top }]).png().toBuffer();
}
const grab = (r) => sharp(SRC).extract(r).png().toBuffer();
// Tile a block over w x h, alternating flips so repeats do not line up.
async function tiled(block, w, h) {
  const { width: bw, height: bh } = await sharp(block).metadata();
  const flop = await sharp(block).flop().png().toBuffer();
  const flip = await sharp(block).flip().png().toBuffer();
  const both = await sharp(flop).flip().png().toBuffer();
  const tiles = [];
  for (let y = 0, j = 0; y < h; y += bh, j++)
    for (let x = 0, i = 0; x < w; x += bw, i++)
      tiles.push({ input: [[block, flop], [flip, both]][j % 2][i % 2], left: x, top: y });
  // sharp applies extract before composite in one pipeline, so composite first, then crop.
  const full = await sharp({ create: { width: w + bw, height: h + bh, channels: 3, background: "#000" } })
    .composite(tiles).png().toBuffer();
  return sharp(full).extract({ left: 0, top: 0, width: w, height: h }).png().toBuffer();
}

// --- measurements on the original (1750x700) ------------------------------------------
const BODY_BOTTOM = 494;   // lower edge of the yellow body on these rows
const TRIM = { top: 494, height: 14 }; // silver lower trim band, body only (x >= 986)

// Patches overlap generously: a feathered edge must always fade over clean pixels or over
// another patch's solid area, never over the object being removed.

// 1. Door face behind the cylinder (its own surface tiled; no colour match needed). Runs over
//    the seam, which step 2 paints back on top.
const doorBlock = await grab({ left: 884, top: 300, width: 22, height: 76 });
await lay(await tiled(doorBlock, 96, BODY_BOTTOM + 12 - 336), { left: 900, top: 336 }, 10);

// 2. The door/body seam, cloned from above the cylinder and tiled downward.
const seamBlock = await grab({ left: 982, top: 292, width: 18, height: 44 });
await lay(await tiled(seamBlock, 18, BODY_BOTTOM + 8 - 336), { left: 982, top: 336 }, 2);

// 3. Body behind the trash can: the clean body directly above it (vertical shift).
await lay(await grab({ left: 996, top: 392, width: 62, height: 62 }), { left: 996, top: 448 }, 8);

// 4. Body behind the chair: the clean body above it.
await lay(await grab({ left: 1052, top: 338, width: 82, height: 82 }), { left: 1052, top: 416 }, 8);

// 5. Gravel in front, one patch from two different clean stretches (no flips, no symmetry).
const gravelA = await grab({ left: 1500, top: BODY_BOTTOM, width: 200, height: 76 });
const gravelB = await grab({ left: 1300, top: BODY_BOTTOM, width: 120, height: 76 });
const gravelBsoft = await sharp(await sharp(gravelB).removeAlpha().png().toBuffer())
  .joinChannel(await featherMask(120, 76, 24)).png().toBuffer();
const gravel = await sharp({ create: { width: 282, height: 76, channels: 3, background: "#000" } })
  .composite([{ input: gravelA, left: 0, top: 0 }, { input: gravelA, left: 170, top: 0 }, { input: gravelBsoft, left: 150, top: 0 }]).png().toBuffer();
// Match the patch to the untouched gravel immediately left of it, so the join is invisible.
await lay(gravel, { left: 886, top: BODY_BOTTOM }, 14, { left: 856, top: 520, width: 28, height: 44 }, 1); // crisp top: the door and body end here

// 6. Lower trim band across the body (the door part has none).
const trimBlock = await grab({ left: 1049, top: TRIM.top, width: 12, height: TRIM.height });
await lay(await tiled(trimBlock, 1136 - 986, TRIM.height), { left: 986, top: TRIM.top }, 3);

// 7. Cooler face where the chair legs crossed it (its own right side, tiled).
const coolerStrip = await grab({ left: 1150, top: 476, width: 8, height: 70 });
await lay(await tiled(coolerStrip, 46, 70), { left: 1114, top: 476 }, 3);

await sharp(canvas).png().toFile(OUT);
console.log("wrote", OUT);
