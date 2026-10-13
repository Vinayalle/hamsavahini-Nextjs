// Builds every logo file the website and the admin use from ONE master image: assets/brand/logo-original.png
//
//   npm run brand:build
//
// To change the logo later: replace assets/brand/logo-original.png (single colour artwork on a white background) and run the command again.
// It writes: public/brand/logo-{mark,wordmark,full}.png, public/brand/og-default.png, src/app/{icon.png,apple-icon.png,favicon.ico}.
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "assets/brand/logo-original.png");
const OUT = join(root, "public/brand");
const APP = join(root, "src/app");
mkdirSync(OUT, { recursive: true });

const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("");
/** The logo is drawn in its own gold only; no other colour version is made. */
const TONES = { gold: { r: 185, g: 134, b: 38 } };
const CREAM = { r: 251, g: 246, b: 233 };

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

// The artwork is one colour on white, so how much "ink" a pixel carries is how far its blue channel is below white.
// Measure the real gold from fully inked pixels, then use that as the 100% point.
let sr = 0, sg = 0, sb = 0, sn = 0;
for (let i = 0; i < W * H; i++) { if (data[i * 3 + 2] < 90) { sr += data[i * 3]; sg += data[i * 3 + 1]; sb += data[i * 3 + 2]; sn++; } }
const sampled = { r: Math.round(sr / sn), g: Math.round(sg / sn), b: Math.round(sb / sn) };
const inkBlue = sb / sn;
const coverage = new Float32Array(W * H);
// Generated artwork has faint noise in its "white" background: ignore the faintest 6% so the background is truly transparent.
const FLOOR = 0.06;
for (let i = 0; i < W * H; i++) {
  const c = (255 - data[i * 3 + 2]) / (255 - inkBlue);
  coverage[i] = c <= FLOOR ? 0 : Math.min(1, (c - FLOOR) / (0.96 - FLOOR));
}

/** Bounding box of the ink inside a region. */
function bbox(x0, y0, x1, y1, min = 0.35) {
  let l = x1, t = y1, r = x0, b = y0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (coverage[y * W + x] >= min) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
  return { l, t, r, b };
}
// Split the artwork into its stacked parts by the empty rows between them.
const rowInk = Array.from({ length: H }, (_, y) => { for (let x = 0; x < W; x++) if (coverage[y * W + x] > 0.35) return 1; return 0; });
const parts = [];
for (let y = 0, s = -1; y <= H; y++) { const on = y < H && rowInk[y]; if (on && s < 0) s = y; if (!on && s >= 0) { parts.push([s, y - 1]); s = -1; } }
if (parts.length < 4) throw new Error(`Expected mark, wordmark, rule and subtitle, found ${parts.length} parts`);
const [markRows, wordRows, , subRows] = parts;
const mark = bbox(0, markRows[0], W - 1, markRows[1]);
const text = bbox(0, wordRows[0], W - 1, subRows[1]);
const all = { l: Math.min(mark.l, text.l), t: mark.t, r: Math.max(mark.r, text.r), b: text.b };

/** A transparent PNG of one region, drawn in `tone`. */
async function render(box, tone, { width, height, pad = 0.03 } = {}) {
  const bw = box.r - box.l + 1, bh = box.b - box.t + 1;
  const px = Math.round(Math.max(bw, bh) * pad);
  const cw = bw + px * 2, ch = bh + px * 2;
  const rgba = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = box.l - px + x, sy = box.t - px + y;
    const a = sx >= 0 && sy >= 0 && sx < W && sy < H ? coverage[sy * W + sx] : 0;
    const o = (y * cw + x) * 4;
    rgba[o] = tone.r; rgba[o + 1] = tone.g; rgba[o + 2] = tone.b; rgba[o + 3] = Math.round(a * 255);
  }
  let img = sharp(rgba, { raw: { width: cw, height: ch, channels: 4 } });
  if (width || height) img = img.resize({ width, height, fit: "inside", kernel: "lanczos3" });
  return img.png({ compressionLevel: 9, effort: 10 });
}
const write = async (name, pipeline) => { const buf = await pipeline.toBuffer(); writeFileSync(join(OUT, name), buf); console.log(`  ${name.padEnd(28)} ${(buf.length / 1024).toFixed(1)} KB`); return buf; };

console.log(`sampled logo gold: ${hex(sampled)}  (brand token --brand: ${hex(TONES.gold)})`);
console.log(`artwork ${W}x${H}: mark ${mark.r - mark.l + 1}x${mark.b - mark.t + 1}, text block ${text.r - text.l + 1}x${text.b - text.t + 1}`);
for (const [name, tone] of Object.entries(TONES)) {
  await write(`logo-mark.png`, await render(mark, tone, { height: 400 }));
  await write(`logo-wordmark.png`, await render(text, tone, { width: 900 }));
  await write(`logo-full.png`, await render(all, tone, { width: 1000 }));
}

// Browser tab, home-screen and social-share images.
const markSquare = async (size, padRatio, bg) => {
  const inner = Math.round(size * (1 - padRatio * 2));
  const m = await (await render(mark, TONES.gold, { width: inner, height: inner, pad: 0 })).toBuffer();
  const { width: mw, height: mh } = await sharp(m).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: m, left: Math.round((size - mw) / 2), top: Math.round((size - mh) / 2) }]).png({ compressionLevel: 9 });
};
writeFileSync(join(APP, "icon.png"), await (await markSquare(512, 0.06)).toBuffer());
writeFileSync(join(APP, "apple-icon.png"), await (await markSquare(180, 0.14, { ...CREAM, alpha: 1 })).toBuffer());
const png48 = await (await markSquare(48, 0.04)).toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 48; ico[7] = 48; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png48.length, 14); ico.writeUInt32LE(22, 18);
writeFileSync(join(APP, "favicon.ico"), Buffer.concat([ico, png48]));
console.log("  src/app/icon.png, apple-icon.png, favicon.ico");

const logoForOg = await (await render(all, TONES.gold, { height: 400 })).toBuffer();
const { width: lw, height: lh } = await sharp(logoForOg).metadata();
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFDF8"/><stop offset="1" stop-color="#F5EACB"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><rect x="24" y="24" width="1152" height="582" rx="18" fill="none" stroke="#B98626" stroke-opacity="0.35" stroke-width="2"/></svg>`);
await write("og-default.png", sharp(bg).composite([{ input: logoForOg, left: Math.round((1200 - lw) / 2), top: Math.round((630 - lh) / 2) }]).png({ compressionLevel: 9 }));
console.log("done");
