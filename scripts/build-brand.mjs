// Builds every logo file the website and the admin use from ONE master image: assets/brand/logo-original.jpeg
//
//   npm run brand:build
//
// To change the logo later: replace assets/brand/logo-original.jpeg (the artwork on a plain white background) and run the command again.
// The logo keeps its OWN colours (browns and golds): only the white background is removed.
// It writes: public/brand/logo-{mark,wordmark,full}.png, public/brand/og-default.png, src/app/{icon.png,apple-icon.png,favicon.ico}.
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "assets/brand/logo-original.jpeg");
const OUT = join(root, "public/brand");
const APP = join(root, "src/app");
mkdirSync(OUT, { recursive: true });

const CREAM = { r: 251, g: 246, b: 234 };

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

// Remove the white background. How far a pixel is from white (its strongest channel) is how much of it is the artwork:
// near white (JPEG noise, a faint glow) -> transparent; clearly coloured -> opaque; in between -> a soft edge.
// Edge pixels are blended with white, so their colour is "un-blended" to avoid a pale outline on dark or cream backgrounds.
const LOW = 14, HIGH = 56;
const rgba = Buffer.alloc(W * H * 4);
const alpha = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
  const d = 255 - Math.min(r, g, b);
  let a = d <= LOW ? 0 : d >= HIGH ? 1 : (d - LOW) / (HIGH - LOW);
  a = a * a * (3 - 2 * a); // smoothstep
  alpha[i] = a;
  const o = i * 4;
  if (a > 0 && a < 1) {
    rgba[o] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - a)) / a)));
    rgba[o + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - a)) / a)));
    rgba[o + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - a)) / a)));
  } else { rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; }
  rgba[o + 3] = Math.round(a * 255);
}

/** Bounding box of the artwork inside a band of rows. */
function bbox(y0, y1, min = 0.4) {
  let l = W, t = y1, r = 0, b = y0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] >= min) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
  return { l, t, r, b };
}
// Split the artwork into its stacked parts by the empty rows between them: the swan-and-lotus mark, the name with its rule, the subtitle.
const rowInk = Array.from({ length: H }, (_, y) => { for (let x = 0; x < W; x++) if (alpha[y * W + x] > 0.5) return 1; return 0; });
const parts = [];
for (let y = 0, s = -1; y <= H; y++) { const on = y < H && rowInk[y]; if (on && s < 0) s = y; if (!on && s >= 0) { parts.push([s, y - 1]); s = -1; } }
if (parts.length < 3) throw new Error(`Expected the mark, the name and the subtitle, found ${parts.length} parts`);
const mark = bbox(parts[0][0], parts[0][1]);
const text = bbox(parts[1][0], parts[parts.length - 1][1]);
const all = { l: Math.min(mark.l, text.l), t: mark.t, r: Math.max(mark.r, text.r), b: text.b };

/** A transparent PNG of one region in the logo's own colours. */
async function render(box, { width, height, pad = 0.03 } = {}) {
  const bw = box.r - box.l + 1, bh = box.b - box.t + 1;
  const px = Math.round(Math.max(bw, bh) * pad);
  const cw = bw + px * 2, ch = bh + px * 2;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = box.l - px + x, sy = box.t - px + y;
    if (sx < box.l || sx > box.r || sy < box.t || sy > box.b) continue; // only this part: the padding stays empty, so a neighbouring part of the logo cannot leak in
    const s = (sy * W + sx) * 4, o = (y * cw + x) * 4;
    out[o] = rgba[s]; out[o + 1] = rgba[s + 1]; out[o + 2] = rgba[s + 2]; out[o + 3] = rgba[s + 3];
  }
  let img = sharp(out, { raw: { width: cw, height: ch, channels: 4 } });
  if (width || height) img = img.resize({ width, height, fit: "inside", kernel: "lanczos3" });
  return img.png({ compressionLevel: 9, effort: 10 });
}
const write = async (name, pipeline) => { const buf = await pipeline.toBuffer(); writeFileSync(join(OUT, name), buf); const m = await sharp(buf).metadata(); console.log(`  ${name.padEnd(22)} ${m.width}x${m.height}  ${(buf.length / 1024).toFixed(1)} KB`); return buf; };

console.log(`artwork ${W}x${H}: mark ${mark.r - mark.l + 1}x${mark.b - mark.t + 1}, name and subtitle ${text.r - text.l + 1}x${text.b - text.t + 1}`);
await write("logo-mark.png", await render(mark, { height: 400 }));
await write("logo-wordmark.png", await render(text, { width: 900 }));
await write("logo-full.png", await render(all, { width: 1000 }));

// Browser tab, home-screen and social-share images (the colour mark sits on a cream tile so it reads on any tab colour).
const markSquare = async (size, padRatio, bg) => {
  const inner = Math.round(size * (1 - padRatio * 2));
  const m = await (await render(mark, { width: inner, height: inner, pad: 0 })).toBuffer();
  const { width: mw, height: mh } = await sharp(m).metadata();
  const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="rgb(${CREAM.r},${CREAM.g},${CREAM.b})"/></svg>`);
  return sharp({ create: { width: size, height: size, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: tile }, { input: m, left: Math.round((size - mw) / 2), top: Math.round((size - mh) / 2) }]).png({ compressionLevel: 9 });
};
writeFileSync(join(APP, "icon.png"), await (await markSquare(512, 0.1)).toBuffer());
writeFileSync(join(APP, "apple-icon.png"), await (await markSquare(180, 0.12, { ...CREAM, alpha: 1 })).toBuffer());
const png48 = await (await markSquare(48, 0.06)).toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 48; ico[7] = 48; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png48.length, 14); ico.writeUInt32LE(22, 18);
writeFileSync(join(APP, "favicon.ico"), Buffer.concat([ico, png48]));
console.log("  src/app/icon.png, apple-icon.png, favicon.ico");

const logoForOg = await (await render(all, { height: 440 })).toBuffer();
const { width: lw, height: lh } = await sharp(logoForOg).metadata();
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFDF8"/><stop offset="1" stop-color="#F4E7CC"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`);
await write("og-default.png", sharp(bg).composite([{ input: logoForOg, left: Math.round((1200 - lw) / 2), top: Math.round((630 - lh) / 2) }]).png({ compressionLevel: 9 }));
console.log("done");
