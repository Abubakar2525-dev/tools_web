import { Breadcrumbs, Container } from "./primitives";

export function PageHero({
  crumbs,
  title,
  intro,
  aside,
  children,
}: {
  crumbs: { name: string; path: string }[];
  title: React.ReactNode;
  intro?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="page-hero relative border-b border-line">
      <Container className="relative pb-16 pt-10 sm:pb-20 sm:pt-14">
        <div className="hero-in">
          <Breadcrumbs items={crumbs} />
        </div>
        <div className={`mt-12 grid gap-8 sm:mt-16 ${aside ? "lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16" : ""}`}>
          <div>
            <h1 className="display hero-in max-w-[18ch] !text-[clamp(2.4rem,1.5rem+3.4vw,4.25rem)]" style={{ "--i": 1 } as React.CSSProperties}>
              {title}
            </h1>
            {intro && (
              <p className="lead hero-in mt-6 max-w-[56ch]" style={{ "--i": 2 } as React.CSSProperties}>
                {intro}
              </p>
            )}
            {children && (
              <div className="hero-in mt-8" style={{ "--i": 3 } as React.CSSProperties}>
                {children}
              </div>
            )}
          </div>
          {aside && (
            <div className="hero-in" style={{ "--i": 3 } as React.CSSProperties}>
              {aside}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
