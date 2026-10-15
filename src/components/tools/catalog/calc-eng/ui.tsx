"use client";

/** Small presentational helpers shared by the calc-eng tools. */

export function Figure({ title, desc, children, viewBox, maxWidth = 560 }: { title: string; desc: string; children: React.ReactNode; viewBox: string; maxWidth?: number }) {
  return (
    <figure className="overflow-x-auto rounded-xl bg-surface p-3 shadow-[0_0_0_1px_var(--line)]">
      <svg viewBox={viewBox} role="img" aria-label={title} className="mx-auto block h-auto w-full" style={{ maxWidth }}>
        <title>{title}</title>
        <desc>{desc}</desc>
        {children}
      </svg>
      <figcaption className="mt-2 text-center text-[0.8125rem] text-muted">{desc}</figcaption>
    </figure>
  );
}

/** Scrollable table with row headers. */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption?: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
      <table className="w-full text-left text-sm">
        {caption && <caption className="px-4 pt-3 text-left text-[0.8125rem] text-muted">{caption}</caption>}
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="whitespace-nowrap px-4 py-2 font-medium text-ink">
                    {c}
                  </th>
                ) : (
                  <td key={j} className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
