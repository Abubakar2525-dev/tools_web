import { ContactForm } from "@/components/contact/ContactForm";
import { Breadcrumbs, Container } from "@/components/ui/primitives";
import { site } from "@/content/site";
import { serviceOptions } from "@/lib/service-options";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Discuss your AI project",
  description:
    "Tell us about the AI application, agent, RAG system or automation you have in mind. We reply with a candid view of feasibility and a sensible first step.",
  path: "/contact",
});

const steps = [
  { title: "We read it properly", body: "A senior engineer reviews your message, not an auto-responder." },
  { title: "A short call", body: "We ask about the workflow, the data and what success would look like." },
  { title: "A written next step", body: "A recommendation and first milestone, or an honest note if AI is not the right fit." },
];

export default function ContactPage() {
  return (
    <section className="page-hero relative">
      <Container className="relative pb-24 pt-10 sm:pb-32 sm:pt-14">
        <div className="hero-in">
          <Breadcrumbs items={[{ name: "Contact", path: "/contact" }]} />
        </div>
        <div className="mt-12 grid gap-14 sm:mt-16 lg:grid-cols-[0.85fr_1.25fr] lg:gap-16">
          <div>
            <h1 className="display hero-in !text-[clamp(2.4rem,1.5rem+3.2vw,4rem)]" style={{ "--i": 1 } as React.CSSProperties}>
              Let&rsquo;s talk about what you&rsquo;re building.
            </h1>
            <p className="lead hero-in mt-6 max-w-[44ch]" style={{ "--i": 2 } as React.CSSProperties}>
              Share as much or as little as you know. Early ideas are welcome; so are half-built systems that need a
              second pair of eyes.
            </p>
            <ol className="hero-in mt-12 space-y-6" style={{ "--i": 3 } as React.CSSProperties}>
              {steps.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[32px_1fr] gap-4">
                  <span className="grid h-8 w-8 place-items-center rounded-full font-mono text-xs text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]">
                    {i + 1}
                  </span>
                  <div>
                    <h2 className="font-sans text-[1rem] font-semibold tracking-normal">{s.title}</h2>
                    <p className="mt-1 text-[0.95rem] text-ink-2">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {site.contact.email && (
              <p className="mt-12 text-ink-2">
                Prefer email?{" "}
                <a href={`mailto:${site.contact.email}`} className="link">
                  {site.contact.email}
                </a>
              </p>
            )}
          </div>
          <div className="hero-in" style={{ "--i": 2 } as React.CSSProperties}>
            <ContactForm serviceOptions={serviceOptions} fallbackEmail={site.contact.email} />
          </div>
        </div>
      </Container>
    </section>
  );
}
