/**
 * THE ONE PLACE the logo files and brand colours are named. The website, the admin, the sign-in pages, the e-mails and the metadata
 * all read from here, so moving or replacing a logo means changing this file only.
 *
 * Source artwork:   assets/brand/logo-original.jpeg          (not served; replace it to change the logo)
 * Generated files:  public/brand/*                           (served at /brand/*; made by `npm run brand:build`)
 *                   src/app/icon.png, apple-icon.png, favicon.ico   (browser tab and home-screen icons)
 */
export const BRAND = {
  name: "Hamsavahin Aarth Mines",
  short: "Hamsavahin",
  /** The logo keeps its own colours (browns and golds). Each file is a transparent PNG; on a dark surface it sits on a cream tile (see Logo.tsx). */
  logo: {
    mark: { src: "/brand/logo-mark.png", width: 560, height: 400 },
    wordmark: { src: "/brand/logo-wordmark.png", width: 900, height: 222 },
    full: { src: "/brand/logo-full.png", width: 1000, height: 637 },
  },
  /** 1200x630 picture used when a page is shared on social media. */
  shareImage: "/brand/og-default.png",
  colors: {
    /** The logo's mid gold. Fills, icons and large graphics. */
    gold: "#B08040",
    /** Gold for text on light backgrounds (6.4:1 on white). */
    goldText: "#7A5026",
    /** Gold for text on dark backgrounds. */
    goldOnDark: "#D8B574",
    ink: "#2A1A0E",
    cream: "#FBF5EA",
    /** Admin button colour (white text passes AA). */
    adminButton: "#8A5C2C",
  },
} as const;
