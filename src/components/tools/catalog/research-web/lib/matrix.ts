/** Literature matrix data model and CSV import/export validation. */

export const MATRIX_COLS = [
  { key: "author", label: "Author(s)", wide: false },
  { key: "year", label: "Year", wide: false },
  { key: "title", label: "Title", wide: true },
  { key: "aim", label: "Aim / question", wide: true },
  { key: "method", label: "Method / sample", wide: true },
  { key: "findings", label: "Key findings", wide: true },
  { key: "gaps", label: "Gaps / limitations", wide: true },
  { key: "notes", label: "Notes / relevance", wide: true },
] as const;

export type MatrixKey = (typeof MATRIX_COLS)[number]["key"];
export type MatrixRow = { id: string } & Record<MatrixKey, string>;

export const emptyRow = (id: string): MatrixRow => ({ id, author: "", year: "", title: "", aim: "", method: "", findings: "", gaps: "", notes: "" });

const ALIASES: Record<string, MatrixKey> = {
  author: "author", authors: "author", "author(s)": "author", creator: "author",
  year: "year", date: "year", "publication year": "year",
  title: "title", source: "title", "article title": "title",
  aim: "aim", aims: "aim", "aim / question": "aim", question: "aim", "research question": "aim", purpose: "aim", objective: "aim",
  method: "method", methods: "method", methodology: "method", "method / sample": "method", design: "method", sample: "method",
  findings: "findings", "key findings": "findings", results: "findings", finding: "findings",
  gaps: "gaps", gap: "gaps", "gaps / limitations": "gaps", limitations: "gaps", limitation: "gaps",
  notes: "notes", note: "notes", "notes / relevance": "notes", relevance: "notes", comments: "notes",
};

/** Guards against spreadsheet formula injection when the CSV is opened in Excel/Sheets. */
const safeCell = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export function toCsv(rows: MatrixRow[]): string {
  const esc = (v: string) => {
    const s = safeCell(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = MATRIX_COLS.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => MATRIX_COLS.map((c) => esc(r[c.key] ?? "")).join(","));
  return [head, ...body].join("\r\n") + "\r\n";
}

export interface ImportResult {
  rows: Omit<MatrixRow, "id">[];
  mapped: { header: string; key: MatrixKey }[];
  ignored: string[];
  skipped: number;
  error?: string;
}

/** Maps parsed CSV cells (first row = headers) to matrix rows. */
export function fromCsvCells(cells: string[][]): ImportResult {
  const res: ImportResult = { rows: [], mapped: [], ignored: [], skipped: 0 };
  const nonEmpty = cells.filter((r) => r.some((c) => c.trim()));
  if (!nonEmpty.length) return { ...res, error: "The file is empty." };
  const headers = nonEmpty[0].map((h) => h.trim());
  const map: (MatrixKey | null)[] = headers.map((h) => {
    const k = ALIASES[h.toLowerCase().replace(/\s+/g, " ")] ?? null;
    if (k) res.mapped.push({ header: h, key: k });
    else if (h) res.ignored.push(h);
    return k;
  });
  if (!res.mapped.length) return { ...res, error: "No recognised columns. The first row must contain headers such as Author, Year, Title, Aim, Method, Findings, Gaps, Notes." };
  // When several headers map to one column, their values are joined with "; ".
  for (const r of nonEmpty.slice(1)) {
    const row = emptyRow("x");
    let any = false;
    r.forEach((cell, i) => {
      const k = map[i];
      const v = cell.trim().replace(/^'(?=[=+\-@])/, "");
      if (!k || !v) return;
      row[k] = row[k] ? `${row[k]}; ${v}` : v;
      any = true;
    });
    if (!any) {
      res.skipped++;
      continue;
    }
    res.rows.push({
      author: row.author, year: row.year, title: row.title, aim: row.aim,
      method: row.method, findings: row.findings, gaps: row.gaps, notes: row.notes,
    });
  }
  if (!res.rows.length) return { ...res, error: "The file has headers but no data rows." };
  return res;
}
