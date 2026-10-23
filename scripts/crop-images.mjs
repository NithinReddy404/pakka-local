// Prepares the web assets from the original Google Maps screenshots in source-photos/.
// Removes the Maps chrome (info card, map thumbnail, watermark) by cropping and by
// mirroring an adjacent patch of sky over the info card. Run: node scripts/crop-images.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "source-photos";
const OUT = "public/img";
mkdirSync(OUT, { recursive: true });

// Copy the strip right of `box`, mirror it, and lay it over `box`.
async function mirrorPatch(img, box) {
  const { left, top, width, height } = box;
  const patch = await img.clone()
    .extract({ left: left + width, top, width, height })
    .flop().png().toBuffer();
  return sharp(await img.clone().composite([{ input: patch, left, top }]).png().toBuffer());
}

async function write(img, name, widths) {
  for (const w of widths) {
    const suffix = w ? `-${w}` : "";
    await img.clone().resize(w ? { width: w, withoutEnlargement: true } : undefined)
      .webp({ quality: 84 }).toFile(`${OUT}/${name}${suffix}.webp`);
  }
}

// Night hero (1.webp, 1202x882)
let night = sharp(`${SRC}/1.webp`);
night = await mirrorPatch(night, { left: 0, top: 0, width: 215, height: 135 });
night = await mirrorPatch(night, { left: 0, top: 720, width: 45, height: 80 });
night = sharp(await night.extract({ left: 0, top: 0, width: 1202, height: 800 }).png().toBuffer());
await write(night, "hero-night", [null, 800]);

// Day hero (2.webp, 1242x908)
let day = sharp(`${SRC}/2.webp`);
day = await mirrorPatch(day, { left: 0, top: 0, width: 232, height: 138 });
day = sharp(await day.extract({ left: 0, top: 0, width: 1212, height: 735 }).png().toBuffer());
await write(day, "hero-day", [null, 800]);

// Logo roundel from the day photo -> favicon (256) and brand mark (96)
// logo-256.png is the favicon; logo.png (96px) is the small brand mark in the hero.
const logoCrop = () => sharp(`${SRC}/2.webp`).extract({ left: 855, top: 362, width: 110, height: 110 });
await logoCrop().resize(256).png({ compressionLevel: 9, palette: true }).toFile(`${OUT}/logo-256.png`);
await logoCrop().resize(96).png({ compressionLevel: 9, palette: true }).toFile(`${OUT}/logo.png`);

// Menu board (4.webp, 685x888): drop the watermark strip
await write(sharp(`${SRC}/4.webp`).extract({ left: 0, top: 0, width: 685, height: 825 }), "menu", [null]);

// Food and cart photos for the strip below the hero
await write(sharp(`${SRC}/3.webp`).extract({ left: 230, top: 60, width: 970, height: 760 }), "food-noodles", [800]);
await write(sharp(`${SRC}/6.webp`).extract({ left: 45, top: 110, width: 1156, height: 685 }), "food-sandwich", [800]);
await write(sharp(`${SRC}/7.webp`).extract({ left: 0, top: 0, width: 1006, height: 695 }), "chat-cart-night", [800]);
await write(sharp(`${SRC}/8.webp`).extract({ left: 0, top: 0, width: 705, height: 820 }), "chat-bandi", [800]);
console.log("done");
