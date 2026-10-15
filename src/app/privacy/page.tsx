import Link from "next/link";
import { LegalPage } from "@/components/ui/LegalPage";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy policy",
  description: `How ${site.name} handles information submitted through this website, including contact form inquiries.`,
  path: "/privacy",
});

/** EDIT ME: template policy. Have it reviewed for your jurisdiction before launch. */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" path="/privacy" updated="October 12, 2026">
      <p>
        This policy explains what information {site.legalName} (&ldquo;we&rdquo;) collects through this website and how
        it is used. It should be read alongside our <Link href="/terms" className="link">terms of use</Link>.
      </p>
      <h2 id="what-we-collect">What we collect</h2>
      <ul>
        <li>
          <strong>Inquiries.</strong> When you submit the contact form we receive your name, email address, optional
          company name and budget range, the service you selected and the project details you write.
        </li>
        <li>
          <strong>Technical data.</strong> Our hosting provider may process standard server logs (such as IP address,
          browser type and requested pages) to operate and secure the site.
        </li>
      </ul>
      <p>This site does not use advertising cookies or third-party tracking scripts.</p>
      <h2 id="how-we-use-it">How we use it</h2>
      <p>
        We use inquiry details only to respond to you and to discuss a potential engagement. We do not sell personal
        information or use it for unrelated marketing.
      </p>
      <h2 id="retention">Retention and sharing</h2>
      <p>
        Inquiries are kept for as long as needed to handle the conversation and any resulting work, then deleted. They
        may be processed by service providers that deliver email or notifications on our behalf, under their own
        security commitments.
      </p>
      <h2 id="your-rights">Your choices</h2>
      <p>
        You can ask us to access, correct or delete the information you sent by replying to any message from us or by
        using the <Link href="/contact" className="link">contact form</Link>.
      </p>
    </LegalPage>
  );
}
