import { LegalPage, Section } from "@/components/web/legal";
import { PHOTOS } from "@/content/photos";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Photo credits", "The photographers and licences behind the pictures on this website.", "/photo-credits");

export default function PhotoCreditsPage() {
  return (
    <LegalPage title="Photo credits" intro="Some pictures on this website are free-licence photographs from Wikimedia Commons. We thank the photographers." crumb="Photo credits">
      <Section title="Pictures">
        <ul className="space-y-3">
          {Object.values(PHOTOS).map((p) => (
            <li key={p.src}>
              <a href={p.credit.page} target="_blank" rel="noopener noreferrer" className="font-bold text-gold-700 underline">{p.credit.title}</a>
              {" "}by {p.credit.author}, {p.credit.license}.
            </li>
          ))}
        </ul>
        <p>CC BY-SA and CC BY are Creative Commons licences; the links above lead to each picture and its licence.</p>
      </Section>
    </LegalPage>
  );
}
