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
// Alpha mask fading in from each side by its own length: { l, r, t, b } in px.
const featherMask = (w, h, e) => {
  const f = typeof e === "number" ? { l: e, r: e, t: e, b: e } : { l: 8, r: 8, t: 8, b: 8, ...e };
  const ramp = (d, len) => Math.min(1, (d + 0.5) / Math.max(len, 0.001));
  const buf = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    const vy = Math.min(f.t > 0 ? ramp(y, f.t) : 1, f.b > 0 ? ramp(h - 1 - y, f.b) : 1);
    for (let x = 0; x < w; x++) {
      const vx = Math.min(f.l > 0 ? ramp(x, f.l) : 1, f.r > 0 ? ramp(w - 1 - x, f.r) : 1);
      buf[y * w + x] = Math.round(255 * vx * vy);
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
};
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
async function lay(patch, dst, edges = 8, ref = null) {
  const { width: w, height: h } = await sharp(patch).metadata();
  if (ref) patch = await matchTo(patch, ref);
  // removeAlpha runs after joinChannel in one pipeline (and would strip the mask), so split them.
  const rgb = await sharp(patch).removeAlpha().png().toBuffer();
  const soft = await sharp(rgb).joinChannel(await featherMask(w, h, edges)).png().toBuffer();
  canvas = await sharp(canvas).composite([{ input: soft, left: dst.left, top: dst.top }]).png().toBuffer();
}
const grab = (r) => sharp(SRC).extract(r).png().toBuffer();          // from the untouched render
const raw = async (buf, rect) => {
  const img = rect ? sharp(buf).extract(rect) : sharp(buf);
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};
// Per-row channel means of a raw RGB image.
const rowMeans = ({ data, width, height }) => {
  const out = [];
  for (let y = 0; y < height; y++) {
    const m = [0, 0, 0];
    for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) m[c] += data[(y * width + x) * 3 + c];
    out.push(m.map((v) => v / width));
  }
  return out;
};
// Scale each row of `patch` so its mean follows the reference strip row by row: this keeps the
// truck's top-to-bottom shading (and the shadow under the trailer) when pixels come from other rows.
async function matchRows(patch, refRect, srcRefRect = null) {
  const pr = await raw(patch);
  const refDst = rowMeans(await raw(canvas, refRect));
  const refSrc = srcRefRect ? rowMeans(await raw(canvas, srcRefRect)) : rowMeans(pr);
  const out = Buffer.from(pr.data);
  for (let y = 0; y < pr.height; y++) {
    const d = refDst[Math.min(y, refDst.length - 1)];
    const sgm = refSrc[Math.min(y, refSrc.length - 1)];
    const k = [0, 1, 2].map((c) => Math.min(1.3, Math.max(0.75, d[c] / Math.max(sgm[c], 1))));
    for (let x = 0; x < pr.width; x++) for (let c = 0; c < 3; c++) {
      const i = (y * pr.width + x) * 3 + c;
      out[i] = Math.max(0, Math.min(255, Math.round(pr.data[i] * k[c])));
    }
  }
  return sharp(out, { raw: { width: pr.width, height: pr.height, channels: 3 } }).png().toBuffer();
}
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
const BODY_REF_X = 1046;   // a clean column of body, rows 300..493, for row-by-row shading
const GROUND_REF = { left: 856, top: BODY_BOTTOM, width: 28, height: 76 }; // untouched ground beside the patch

// Patches overlap generously: a feathered edge must always fade over clean pixels or over
// another patch's solid area, never over the object being removed.

// 0. The latch wire on the door ran into the cylinder: cover it from the rows just above.
await lay(await grab({ left: 882, top: 334, width: 34, height: 40 }), { left: 882, top: 372 }, 3);

// 1. Door face behind the cylinder: the door's own clean columns on the SAME rows, tiled
//    sideways (alternate tiles mirrored), so the door keeps its natural shading.
//    The door is smooth painted metal, so the fill is each row's average colour of the door's
//    clean columns (smoothed down the rows) with a trace of noise: the vertical shading stays,
//    and there are no tiles to band.
{
  const TOP = 324;                 // the door is clean above the cylinder's valve
  const SAMPLE_BOTTOM = 476;       // below this the sample column meets the black tongue box
  const h = BODY_BOTTOM - TOP;
  const w = 96;
  const sampled = rowMeans(await raw(canvas, { left: 886, top: TOP, width: 18, height: SAMPLE_BOTTOM - TOP }));
  const means = Array.from({ length: h }, (_, y) => sampled[Math.min(y, sampled.length - 1)]);
  const smooth = means.map((_, y) => {
    const acc = [0, 0, 0];
    let n = 0;
    for (let k = -9; k <= 9; k++) {
      const r = means[Math.min(h - 1, Math.max(0, y + k))];
      for (let c = 0; c < 3; c++) acc[c] += r[c];
      n++;
    }
    return acc.map((v) => v / n);
  });
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = rnd() * 1.6;
    for (let c = 0; c < 3; c++) buf[(y * w + x) * 3 + c] = Math.max(0, Math.min(255, Math.round(smooth[y][c] + n)));
  }
  const doorFill = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  await lay(doorFill, { left: 900, top: TOP }, { l: 12, r: 10, t: 8, b: 0 }); // crisp bottom: the door ends at the ground line
}

// 2. The door/body seam, cloned from above the cylinder and tiled downward.
const seamBlock = await grab({ left: 982, top: 292, width: 18, height: 44 });
await lay(await tiled(seamBlock, 18, BODY_BOTTOM - 336), { left: 982, top: 336 }, { l: 2, r: 2, t: 2, b: 0 });

// 3. Body behind the trash can: the clean body above it, shaded row by row to its new rows.
{
  const src = { left: 988, top: 388, width: 70, height: 62 };
  const dst = { left: 988, top: 446 };
  const patch = await matchRows(await grab(src),
    { left: BODY_REF_X, top: dst.top, width: 16, height: Math.min(src.height, 493 - dst.top) },
    { left: BODY_REF_X, top: src.top, width: 16, height: Math.min(src.height, 493 - dst.top) });
  await lay(patch, dst, 8);
}

// 4. Body behind the chair, same treatment.
{
  const src = { left: 1052, top: 334, width: 88, height: 82 };
  const dst = { left: 1052, top: 414 };
  const patch = await matchRows(await grab(src),
    { left: BODY_REF_X, top: dst.top, width: 16, height: 79 },
    { left: BODY_REF_X, top: src.top, width: 16, height: 79 });
  await lay(patch, dst, 8);
}

// 5. Gravel in front, from two clean stretches on the same rows, shaded row by row to the
//    ground beside it (keeps the shadow under the trailer and the debris line).
const gravelA = await grab({ left: 1500, top: BODY_BOTTOM, width: 200, height: 76 });
const gravelB = await grab({ left: 1300, top: BODY_BOTTOM, width: 120, height: 76 });
const gravelBsoft = await sharp(await sharp(gravelB).removeAlpha().png().toBuffer())
  .joinChannel(await featherMask(120, 76, 24)).png().toBuffer();
const gravel = await sharp({ create: { width: 282, height: 76, channels: 3, background: "#000" } })
  .composite([{ input: gravelA, left: 0, top: 0 }, { input: gravelA, left: 170, top: 0 }, { input: gravelBsoft, left: 150, top: 0 }]).png().toBuffer();
await lay(await matchRows(gravel, GROUND_REF), { left: 886, top: BODY_BOTTOM }, { l: 14, r: 14, t: 0, b: 14 }); // crisp top: the door and body end here

// 6. Lower trim band across the body (the door part has none).
const trimBlock = await grab({ left: 1049, top: TRIM.top, width: 12, height: TRIM.height });
await lay(await tiled(trimBlock, 1136 - 986, TRIM.height), { left: 986, top: TRIM.top }, 3);

// 7. Cooler face where the chair legs crossed it (its own right side, tiled).
const coolerStrip = await grab({ left: 1150, top: 476, width: 8, height: 70 });
await lay(await tiled(coolerStrip, 46, 70), { left: 1114, top: 476 }, 3);

await sharp(canvas).png().toFile(OUT);
console.log("wrote", OUT);
