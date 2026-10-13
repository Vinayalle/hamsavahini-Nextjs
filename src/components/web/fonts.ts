import { Aldrich, Play, Roboto } from "next/font/google";

// Website typography, taken from the reference site and self-hosted at build time by next/font (no external font request at runtime).
// Put `fontVars` on a wrapper element, then use font-[family-name:var(--font-hero-title)] / --font-hero-text / --font-hero-button.
export const aldrich = Aldrich({ subsets: ["latin"], weight: "400", display: "swap", variable: "--font-hero-title" });
export const play = Play({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-hero-text" });
export const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--font-hero-button" });

export const fontVars = `${aldrich.variable} ${play.variable} ${roboto.variable}`;
