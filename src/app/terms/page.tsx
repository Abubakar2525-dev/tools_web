import Link from "next/link";
import { LegalPage } from "@/components/ui/LegalPage";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of use",
  description: `Terms governing use of the ${site.name} website and its published content.`,
  path: "/terms",
});

/** EDIT ME: template terms. Have them reviewed for your jurisdiction before launch. */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" path="/terms" updated="October 12, 2026">
      <p>
        By using this website you agree to these terms. If you do not agree, please do not use the site. Client
        engagements are governed by separate written agreements, not by these terms.
      </p>
      <h2 id="content">Content</h2>
      <p>
        Articles and reference builds are published for general information. They describe approaches and are not
        professional advice for your specific situation. Reference builds are illustrative scenarios, not descriptions
        of client work.
      </p>
      <h2 id="code">Code samples</h2>
      <p>
        Code snippets in our articles are provided as-is, without warranty, for educational use. Review and test them
        before using them in production.
      </p>
      <h2 id="ip">Intellectual property</h2>
      <p>
        The site&rsquo;s design, text and graphics belong to {site.legalName} unless stated otherwise. You may quote
        short excerpts with attribution and a link back.
      </p>
      <h2 id="liability">Liability</h2>
      <p>
        To the extent permitted by law, we are not liable for losses arising from use of this website or reliance on its
        content.
      </p>
      <h2 id="contact">Questions</h2>
      <p>
        Questions about these terms can be sent through the <Link href="/contact" className="link">contact form</Link>.
      </p>
    </LegalPage>
  );
}
