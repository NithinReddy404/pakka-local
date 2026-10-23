// Builds the single scene image from source-photos/scene.webp.
// Adds a soft sky gradient above and tiled gravel below so the scene can cover any
// viewport without cropping the truck or the cart. Run: node scripts/prepare-scene.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

import { existsSync } from "node:fs";
// Prefer the cleaned render (scripts/clean-scene.mjs removes the clutter in front of the truck).
const SRC = existsSync("source-photos/scene-clean.png") ? "source-photos/scene-clean.png" : "source-photos/scene.webp";
const OUT = "public/img";
const PAD = 256;
mkdirSync(OUT, { recursive: true });

const { width: W, height: H } = await sharp(SRC).metadata();

// Sky: average the topmost rows into a smooth gradient (tiny downsample, then upsample),
// then deepen it toward the top so it reads as higher sky.
const skyAvg = await sharp(SRC).extract({ left: 0, top: 0, width: W, height: 14 })
  .resize({ width: 10, height: 2, fit: "fill" }).png().toBuffer();
const skyBase = await sharp(skyAvg).resize({ width: W, height: PAD, fit: "fill", kernel: "cubic" }).blur(40).png().toBuffer();
const skyShade = Buffer.from(`<svg width="${W}" height="${PAD}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#141a2c" stop-opacity="0.55"/><stop offset="1" stop-color="#141a2c" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${PAD}" fill="url(#g)"/></svg>`);
// Seam blend: the real top rows, blurred, fading upward over the gradient so the edge softens.
// (A mirrored band was tried and rejected: it duplicates wires and transformers.)
const SEAM = 130;
const seamRows = await sharp(SRC).extract({ left: 0, top: 0, width: W, height: SEAM }).blur(14).png().toBuffer();
const seamMask = Buffer.from(`<svg width="${W}" height="${SEAM}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient></defs>
  <rect width="${W}" height="${SEAM}" fill="url(#g)"/></svg>`);
const seam = await sharp(seamRows).ensureAlpha().composite([{ input: seamMask, blend: "dest-in" }]).png().toBuffer();
// The left utility pole leaves the real image through its top edge: continue it to the top.
const POLE = { left: 1015, width: 12 };
const poleSample = await sharp(SRC).extract({ left: POLE.left + 2, top: 6, width: POLE.width - 4, height: 24 })
  .resize({ width: 1, height: 1, fit: "fill" }).raw().toBuffer();
const poleColor = `rgb(${poleSample[0]},${poleSample[1]},${poleSample[2]})`;
const pole = Buffer.from(`<svg width="${W}" height="${PAD}"><rect x="${POLE.left}" y="0" width="${POLE.width}" height="${PAD}" fill="${poleColor}"/></svg>`);
const top = await sharp(skyBase)
  .composite([{ input: skyShade, left: 0, top: 0 }, { input: pole, left: 0, top: 0 }, { input: seam, left: 0, top: PAD - SEAM }]).png().toBuffer();

// Ground: tile clean gravel rows with horizontal offsets so no symmetry shows, then darken toward the bottom.
const G = 80;
const gravel = await sharp(SRC).extract({ left: 0, top: H - G, width: W, height: G }).png().toBuffer();
const shifted = async (dx) => sharp({ create: { width: W, height: G, channels: 3, background: "#6b6760" } })
  .composite([{ input: gravel, left: dx - W, top: 0 }, { input: gravel, left: dx, top: 0 }]).png().toBuffer();
const tiles = [];
const offsets = [0, 611, 1187, 433];
for (let y = 0, i = 0; y < PAD; y += G, i++) tiles.push({ input: await shifted(offsets[i % offsets.length]), left: 0, top: y });
const groundShade = Buffer.from(`<svg width="${W}" height="${PAD}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></linearGradient></defs>
  <rect width="${W}" height="${PAD}" fill="url(#g)"/></svg>`);
const bottom = await sharp({ create: { width: W, height: PAD + G, channels: 3, background: "#6b6760" } })
  .composite(tiles).extract({ left: 0, top: 0, width: W, height: PAD }).blur(0.7).png().toBuffer()
  .then((b) => sharp(b).composite([{ input: groundShade, left: 0, top: 0 }]).png().toBuffer());

const body = await sharp(SRC).png().toBuffer();
const buf = await sharp({ create: { width: W, height: H + 2 * PAD, channels: 3, background: "#1a1c24" } })
  .composite([{ input: top, left: 0, top: 0 }, { input: body, left: 0, top: PAD }, { input: bottom, left: 0, top: PAD + H }])
  .png().toBuffer();
await sharp(buf).webp({ quality: 86 }).toFile(`${OUT}/scene.webp`);
await sharp(buf).resize({ width: 1200 }).webp({ quality: 84 }).toFile(`${OUT}/scene-1200.webp`);
await sharp(buf).resize({ width: 40 }).blur(2).webp({ quality: 50 }).toFile(`${OUT}/scene-tiny.webp`);
console.log({ W, H, outW: W, outH: H + 2 * PAD, pad: PAD });
