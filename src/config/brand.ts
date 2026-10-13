/**
 * THE ONE PLACE the logo files and brand colours are named. The website, the admin, the sign-in pages, the e-mails and the metadata
 * all read from here, so moving or replacing a logo means changing this file only.
 *
 * Source artwork:   assets/brand/logo-original.png          (not served; replace it to change the logo)
 * Generated files:  public/brand/*                           (served at /brand/*; made by `npm run brand:build`)
 *                   src/app/icon.png, apple-icon.png, favicon.ico   (browser tab and home-screen icons)
 */
export const BRAND = {
  name: "Hamsavahin Aarth Mines",
  short: "Hamsavahin",
  /** One colour only: the logo's own gold. Each file is a transparent PNG. */
  logo: {
    mark: { src: "/brand/logo-mark.png", width: 503, height: 400 },
    wordmark: { src: "/brand/logo-wordmark.png", width: 900, height: 196 },
    full: { src: "/brand/logo-full.png", width: 1000, height: 611 },
  },
  /** 1200x630 picture used when a page is shared on social media. */
  shareImage: "/brand/og-default.png",
  colors: {
    /** The logo's own gold. Fills, icons and large graphics. */
    gold: "#B98626",
    /** Gold for text on light backgrounds (6.4:1 on white). */
    goldText: "#7E5818",
    /** Gold for text on dark backgrounds. */
    goldOnDark: "#DEBB66",
    ink: "#1C1710",
    cream: "#FBF6E9",
    /** Admin button colour (white text passes AA). */
    adminButton: "#8F6418",
  },
} as const;
