import { LegalPage, Section } from "@/components/web/legal";
import { COMPANY } from "@/content/site";
import { pageMeta } from "@/content/seo";
import { getSiteSettings } from "@/server/services/public";

export const metadata = pageMeta("Privacy policy", "How Hamsavahin Aarth Mines collects, uses and protects the personal information you send through this website.", "/privacy-policy");

export default async function PrivacyPage() {
  const s = await getSiteSettings();
  return (
    <LegalPage title="Privacy policy" intro={`This policy explains what personal information ${COMPANY.name} collects through this website, why, and the choices you have.`} crumb="Privacy policy">
      <Section title="What we collect">
        <p>We only collect what you choose to send us through our forms: your name, email address, phone number, company, country, the details of your enquiry or quotation request, and, for job applications, your experience, a cover note and an optional resume.</p>
        <p>Like most websites, our servers also keep basic technical logs (such as the time of a request and the page requested) to keep the site secure and working.</p>
      </Section>
      <Section title="How we use it">
        <ul>
          <li>To reply to your enquiry or prepare the quotation you asked for.</li>
          <li>To consider your job application for the position you applied to.</li>
          <li>To keep the website secure and to prevent spam and abuse.</li>
        </ul>
        <p>We do not sell your personal information, and we do not use it for unrelated marketing without asking you first.</p>
      </Section>
      <Section title="Who can see it">
        <p>Your submission is available to the members of our team who need it to answer you. We may share the details needed to carry out your request with the producers, logistics partners or inspectors involved, and only for that purpose. We may also disclose information where the law requires it.</p>
      </Section>
      <Section title="Consent">
        <p>Each form asks you to confirm that you agree to your details being used as described here. We record that confirmation with your submission.</p>
      </Section>
      <Section title="Keeping it safe">
        <p>Forms are sent over an encrypted connection where the website is served over HTTPS, access to submissions is limited to authorised staff, and uploaded resumes are stored privately.</p>
      </Section>
      <Section title="Your choices">
        <p>You can ask us what we hold about you, to correct it, or to delete it, by writing to us{s.email ? <> at <a href={`mailto:${s.email}`}>{s.email}</a></> : <> through the <a href="/contact-us">contact page</a></>}. We will respond within a reasonable time.</p>
      </Section>
      <Section title="Changes to this policy">
        <p>We may update this policy from time to time. The current version is always the one on this page.</p>
      </Section>
    </LegalPage>
  );
}
