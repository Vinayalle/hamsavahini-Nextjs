import Hero from "@/components/web/Hero";
import { getHeroSlides, type HeroSlide } from "@/server/services/site";

// Editors change banners in the admin dashboard; the website always shows the current published set.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let slides: HeroSlide[] = [];
  try {
    slides = await getHeroSlides();
  } catch (e) {
    // A database outage must not take the public website down: show the default hero instead.
    console.error("[site] hero banners unavailable", e instanceof Error ? e.name : "unknown");
  }
  return <Hero slides={slides} />;
}
