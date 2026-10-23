// Prepares the menu board photo and the logo from the original photos in source-photos/.
// (The scene itself is built by scripts/prepare-scene.mjs.) Run: node scripts/crop-images.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "source-photos";
const OUT = "public/img";
mkdirSync(OUT, { recursive: true });

// Logo roundel from the day photo (2.webp) -> favicon (256) and a small mark (96).
const logoCrop = () => sharp(`${SRC}/2.webp`).extract({ left: 855, top: 362, width: 110, height: 110 });
await logoCrop().resize(256).png({ compressionLevel: 9, palette: true }).toFile(`${OUT}/logo-256.png`);
await logoCrop().resize(96).png({ compressionLevel: 9, palette: true }).toFile(`${OUT}/logo.png`);

// Menu board (4.webp, 685x888): drop the watermark strip -> menu.webp (685x825).
await sharp(`${SRC}/4.webp`).extract({ left: 0, top: 0, width: 685, height: 825 }).webp({ quality: 84 }).toFile(`${OUT}/menu.webp`);

console.log("done");
