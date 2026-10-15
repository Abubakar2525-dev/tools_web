import { Breadcrumbs, Container } from "./primitives";

export function LegalPage({
  title,
  path,
  updated,
  children,
}: {
  title: string;
  path: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="page-hero">
        <Container className="pb-10 pt-10 sm:pt-14">
          <Breadcrumbs items={[{ name: title, path }]} />
          <div className="mx-auto mt-12 max-w-[44rem] sm:mt-16">
            <h1 className="display !text-[clamp(2.2rem,1.6rem+2.4vw,3.25rem)]">{title}</h1>
            <p className="mt-4 text-sm text-muted">Last updated {updated}</p>
          </div>
        </Container>
      </section>
      <Container className="pb-28">
        <div className="prose-article mx-auto max-w-[44rem]">{children}</div>
      </Container>
    </>
  );
}
