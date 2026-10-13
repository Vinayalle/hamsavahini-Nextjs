import { LegalPage, Section } from "@/components/web/legal";
import { COMPANY } from "@/content/site";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Terms of use", "The terms for using the Hamsavahin Aarth Mines website.", "/terms");

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" intro={`By using this website you agree to the terms below. They apply to the ${COMPANY.name} website only.`} crumb="Terms of use">
      <Section title="Information on this website">
        <p>We work to keep the information on this website accurate and current, but it is provided for general information. Descriptions of minerals, uses and processes are general; specific grades, quantities, prices and delivery terms are only binding when confirmed by us in a written quotation or contract.</p>
      </Section>
      <Section title="Prices and availability">
        <p>Prices and trade opportunities shown on the commodity desk are indicative, change with the market and may be withdrawn at any time. A request for quotation is an invitation to us to make an offer and does not create a contract.</p>
      </Section>
      <Section title="Using the forms">
        <p>Please give accurate details and use the forms only for genuine enquiries, quotation requests and job applications. Automated, abusive or misleading submissions may be blocked.</p>
      </Section>
      <Section title="Intellectual property">
        <p>The text, design and other content of this website belong to {COMPANY.name} or its licensors. You may view and print pages for your own business use, but you may not copy or republish them without our written permission.</p>
      </Section>
      <Section title="Links to other websites">
        <p>This website may link to websites run by others. We are not responsible for their content or their privacy practices.</p>
      </Section>
      <Section title="Limits of liability">
        <p>To the extent the law allows, we are not liable for loss arising from your use of, or reliance on, the general information on this website. Nothing here limits liability that cannot be limited by law.</p>
      </Section>
      <Section title="Changes">
        <p>We may update these terms from time to time. Continued use of the website after a change means you accept the updated terms.</p>
      </Section>
    </LegalPage>
  );
}
