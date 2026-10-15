"use client";

import { useState } from "react";
import { Btn, Checkbox, Notice, NumberField, PrivacyNote, Segmented, SelectField, TextArea, TextField, ToolPanel, parseNum } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { getPdfLib, embedUnicodeFonts } from "@/components/tools/engines/pdf";
import { isoWeek, keyOf, monthMatrix, parseHolidays } from "./lib/dates";
import { PrintArea, useToday } from "./shared";

type Mode = "month" | "months" | "year";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_SUN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const dayNames = (ws: 0 | 1) => Array.from({ length: 7 }, (_, i) => DAYS_SUN[(ws + i) % 7]);
const weekNo = (year: number, month0: number, row: (number | null)[]) => {
  const d = row.find((x) => x !== null)!;
  return isoWeek(keyOf(year, month0, d)).week;
};

interface Opts {
  year: number;
  month0: number;
  ws: 0 | 1;
  weekNums: boolean;
  holidays: Record<string, string[]>;
  title: string;
}

function MonthGrid({ o, month0, size }: { o: Opts; month0: number; size: "big" | "small" }) {
  const rows = monthMatrix(o.year, month0, o.ws);
  const names = dayNames(o.ws);
  const big = size === "big";
  const showWk = o.weekNums && o.ws === 1;
  return (
    <table className={`w-full table-fixed border-collapse ${big ? "text-sm" : "text-[0.75rem]"}`}>
      <caption className={`text-left font-display font-semibold text-ink ${big ? "mb-3 text-[1.5rem]" : "mb-1.5 text-[0.95rem]"}`}>
        {MONTHS[month0]} {big ? o.year : ""}
      </caption>
      <thead>
        <tr>
          {showWk && (
            <th scope="col" className="w-8 py-1 text-center font-medium text-muted">
              <abbr title="ISO week number">Wk</abbr>
            </th>
          )}
          {names.map((n) => (
            <th key={n} scope="col" className="py-1 text-center font-medium text-muted">
              <abbr title={n}>{big ? n.slice(0, 3) : n.slice(0, 2)}</abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {showWk && <td className="text-center text-[0.7rem] tabular-nums text-muted">{weekNo(o.year, month0, row)}</td>}
            {row.map((d, ci) => {
              if (d === null) return <td key={ci} className={big ? "border border-line bg-sunken/50" : ""} />;
              const k = keyOf(o.year, month0, d);
              const hol = o.holidays[k];
              const weekend = (o.ws + ci) % 7 === 0 || (o.ws + ci) % 7 === 6;
              return big ? (
                <td key={ci} className="h-20 border border-line p-1.5 align-top">
                  <span className={`text-[0.95rem] font-semibold tabular-nums ${hol ? "text-danger" : weekend ? "text-ink-2" : "text-ink"}`}>{d}</span>
                  {hol && <span className="mt-0.5 block break-words text-[0.68rem] leading-tight text-danger">{hol.join(", ")}</span>}
                </td>
              ) : (
                <td key={ci} className="py-0.5 text-center">
                  <span
                    className={`tabular-nums ${hol ? "font-bold text-danger underline" : weekend ? "text-ink-2" : "text-ink"}`}
                    title={hol?.join(", ")}
                  >
                    {d}
                  </span>
                  {hol && <span className="sr-only"> ({hol.join(", ")})</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function YearGrid({ o }: { o: Opts }) {
  const list = Object.entries(o.holidays)
    .filter(([k]) => k.startsWith(`${o.year}-`))
    .sort(([a], [b]) => a.localeCompare(b));
  return (
    <div>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {MONTHS.map((_, m) => (
          <MonthGrid key={m} o={o} month0={m} size="small" />
        ))}
      </div>
      {list.length > 0 && (
        <ul className="mt-5 columns-1 gap-6 text-[0.8rem] text-ink-2 sm:columns-2">
          {list.map(([k, names]) => (
            <li key={k}>
              <span className="tabular-nums text-ink">{new Date(`${k}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> {names.join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

async function buildPdf(o: Opts, mode: Mode): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await getPdfLib();
  const doc = await PDFDocument.create();
  const { regular, bold } = await embedUnicodeFonts(doc);
  doc.setTitle(o.title || `${mode === "month" ? `${MONTHS[o.month0]} ` : ""}${o.year} calendar`);
  doc.setCreator("Nuvella Promo Code calendar generator");
  const ink = rgb(0.1, 0.12, 0.13);
  const muted = rgb(0.45, 0.47, 0.48);
  const red = rgb(0.72, 0.12, 0.1);
  const line = rgb(0.75, 0.77, 0.78);
  const names = dayNames(o.ws);
  const showWk = o.weekNums && o.ws === 1;

  const fit = (text: string, size: number, maxW: number, font = regular) => {
    if (font.widthOfTextAtSize(text, size) <= maxW) return text;
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxW) t = t.slice(0, -1);
    return `${t}…`;
  };

  const bigMonth = (m: number) => {
    const page = doc.addPage([841.89, 595.28]); // A4 landscape
    const M = 36;
    const W = page.getWidth() - M * 2;
    let y = page.getHeight() - M;
    const heading = `${MONTHS[m]} ${o.year}`;
    page.drawText(heading, { x: M, y: y - 24, size: 26, font: bold, color: ink });
    if (o.title) page.drawText(fit(o.title, 11, W / 2), { x: M + W - regular.widthOfTextAtSize(fit(o.title, 11, W / 2), 11), y: y - 18, size: 11, font: regular, color: muted });
    y -= 50;
    const wkW = showWk ? 26 : 0;
    const cw = (W - wkW) / 7;
    names.forEach((n, i) => page.drawText(n, { x: M + wkW + i * cw + 4, y: y - 12, size: 10, font: bold, color: muted }));
    y -= 20;
    const rows = monthMatrix(o.year, m, o.ws);
    const rh = (y - M) / rows.length;
    rows.forEach((row, ri) => {
      const top = y - ri * rh;
      if (showWk) page.drawText(String(weekNo(o.year, m, row)), { x: M + 4, y: top - 14, size: 8, font: regular, color: muted });
      row.forEach((d, ci) => {
        const x = M + wkW + ci * cw;
        page.drawRectangle({ x, y: top - rh, width: cw, height: rh, borderColor: line, borderWidth: 0.6, color: d === null ? rgb(0.96, 0.965, 0.965) : undefined });
        if (d === null) return;
        const hol = o.holidays[keyOf(o.year, m, d)];
        page.drawText(String(d), { x: x + 5, y: top - 16, size: 13, font: bold, color: hol ? red : ink });
        hol?.slice(0, 3).forEach((h, hi) => page.drawText(fit(h, 7.5, cw - 10), { x: x + 5, y: top - 28 - hi * 9, size: 7.5, font: regular, color: red }));
      });
    });
  };

  if (mode === "month") bigMonth(o.month0);
  else if (mode === "months") for (let m = 0; m < 12; m++) bigMonth(m);
  else {
    const page = doc.addPage([595.28, 841.89]); // A4 portrait
    const M = 34;
    const W = page.getWidth() - M * 2;
    page.drawText(String(o.year), { x: M, y: page.getHeight() - M - 28, size: 32, font: bold, color: ink });
    if (o.title) page.drawText(fit(o.title, 11, W - 120), { x: M + 110, y: page.getHeight() - M - 22, size: 11, font: regular, color: muted });
    const gx = 18;
    const gy = 16;
    const bw = (W - gx * 2) / 3;
    const top0 = page.getHeight() - M - 52;
    const bh = 150;
    for (let m = 0; m < 12; m++) {
      const bx = M + (m % 3) * (bw + gx);
      const by = top0 - Math.floor(m / 3) * (bh + gy);
      page.drawText(MONTHS[m], { x: bx, y: by - 12, size: 11.5, font: bold, color: ink });
      const wkW = showWk ? 16 : 0;
      const cw = (bw - wkW) / 7;
      names.forEach((n, i) => page.drawText(n.slice(0, 2), { x: bx + wkW + i * cw + cw / 2 - regular.widthOfTextAtSize(n.slice(0, 2), 7) / 2, y: by - 26, size: 7, font: bold, color: muted }));
      monthMatrix(o.year, m, o.ws).forEach((row, ri) => {
        const ry = by - 40 - ri * 17;
        if (showWk) page.drawText(String(weekNo(o.year, m, row)), { x: bx, y: ry, size: 6.5, font: regular, color: muted });
        row.forEach((d, ci) => {
          if (d === null) return;
          const hol = o.holidays[keyOf(o.year, m, d)];
          const t = String(d);
          const f = hol ? bold : regular;
          page.drawText(t, { x: bx + wkW + ci * cw + cw / 2 - f.widthOfTextAtSize(t, 8.5) / 2, y: ry, size: 8.5, font: f, color: hol ? red : ink });
        });
      });
    }
    const list = Object.entries(o.holidays)
      .filter(([k]) => k.startsWith(`${o.year}-`))
      .sort(([a], [b]) => a.localeCompare(b));
    let ly = top0 - 4 * (bh + gy) - 6;
    const colW = W / 2;
    list.forEach(([k, n], i) => {
      const col = i % 2;
      if (col === 0 && i > 0) ly -= 11;
      if (ly < M) return;
      const label = `${MONTHS[Number(k.slice(5, 7)) - 1].slice(0, 3)} ${Number(k.slice(8))}  ${n.join(", ")}`;
      page.drawText(fit(label, 8, colW - 10), { x: M + col * colW, y: ly, size: 8, font: regular, color: ink });
    });
  }
  return doc.save();
}

export default function Tool() {
  const today = useToday();
  const [mode, setMode] = useState<Mode>("month");
  const [yearRaw, setYearRaw] = useState<string | null>(null);
  const [monthSel, setMonthSel] = useState<string | null>(null);
  const [ws, setWs] = useState<0 | 1>(1);
  const [weekNums, setWeekNums] = useState(false);
  const [title, setTitle] = useState("");
  const [holText, setHolText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const defYear = today ? Number(today.slice(0, 4)) : 2026;
  const defMonth = today ? Number(today.slice(5, 7)) - 1 : 0;
  const yNum = yearRaw === null ? defYear : parseNum(yearRaw);
  const yearError = yNum === null || !Number.isInteger(yNum) || yNum < 1583 || yNum > 9999 ? "Enter a year from 1583 to 9999 (Gregorian calendar)." : null;
  const year = yearError ? defYear : yNum!;
  const month0 = monthSel === null ? defMonth : Number(monthSel);
  const hol = parseHolidays(holText, [year]);
  const o: Opts = { year, month0, ws, weekNums, holidays: hol.byDay, title: title.trim() };

  const download = async () => {
    setBusy(true);
    setErr(null);
    try {
      const bytes = await buildPdf(o, mode);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = mode === "month" ? `calendar-${year}-${String(month0 + 1).padStart(2, "0")}.pdf` : `calendar-${year}${mode === "months" ? "-monthly" : ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The PDF could not be created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Calendar options">
        <div className="space-y-5">
          <Segmented
            label="Layout"
            value={mode}
            onChange={setMode}
            options={[
              { value: "month", label: "One month" },
              { value: "months", label: "12 monthly pages" },
              { value: "year", label: "Year on one page" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="Year" value={yearRaw ?? String(defYear)} error={yearError} onChange={(e) => setYearRaw(e.target.value)} />
            {mode !== "year" && (
              <SelectField label={mode === "month" ? "Month" : "Preview month"} value={String(month0)} onChange={(e) => setMonthSel(e.target.value)} options={MONTHS.map((m, i) => ({ value: String(i), label: m }))} />
            )}
            <SelectField
              label="Week starts on"
              value={String(ws)}
              onChange={(e) => setWs(e.target.value === "0" ? 0 : 1)}
              options={[
                { value: "1", label: "Monday" },
                { value: "0", label: "Sunday" },
              ]}
            />
            <TextField label="Title on the page" optional placeholder="Family calendar" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Checkbox
            label="Show ISO week numbers"
            hint={ws === 0 ? "Available when weeks start on Monday, as ISO 8601 weeks do." : "Week 1 is the week with the year's first Thursday."}
            checked={weekNums && ws === 1}
            onChange={(v) => setWeekNums(v)}
          />
          <TextArea
            label="Holidays and special days"
            optional
            hint="One per line: 12-25 Christmas repeats every year, 2026-07-04 Party is a single date."
            placeholder={"01-01 New Year's Day\n12-25 Christmas Day\n2026-09-14 Term starts"}
            value={holText}
            onChange={(e) => setHolText(e.target.value)}
            mono
          />
          {hol.errors.length > 0 && (
            <Notice tone="warning" title="Some lines were skipped">
              <ul className="list-disc pl-4">
                {hol.errors.slice(0, 6).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Notice>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Btn icon="download" onClick={download} disabled={busy || !!yearError}>
              {busy ? "Building PDF…" : "Download PDF"}
            </Btn>
            <Btn variant="ghost" icon="file" onClick={() => window.print()} disabled={!!yearError}>
              Print
            </Btn>
            {busy && <Spinner />}
          </div>
          {err && <Notice tone="error">{err}</Notice>}
          <PrivacyNote />
        </div>
      </ToolPanel>

      <ToolPanel title="Preview">
        <div className="overflow-x-auto" role="region" aria-label="Calendar preview" tabIndex={0}>
          <div className="min-w-[340px]">
            {o.title && <p className="mb-2 text-sm text-muted">{o.title}</p>}
            {mode === "year" ? (
              <>
                <p className="mb-4 font-display text-[1.75rem] font-semibold text-ink">{year}</p>
                <YearGrid o={o} />
              </>
            ) : (
              <MonthGrid o={o} month0={month0} size="big" />
            )}
            {mode === "months" && <p className="mt-3 text-sm text-muted">Showing {MONTHS[month0]}. The PDF and print contain all 12 months, one per page.</p>}
          </div>
        </div>
      </ToolPanel>

      <PrintArea>
        <style>{`@media print { @page { size: ${mode === "year" ? "A4 portrait" : "A4 landscape"}; margin: 10mm; } .dtb-print-root td { height: auto; } .dtb-cal-big td { height: 22mm; } .dtb-cal-small td, .dtb-cal-small th { border: none !important; padding: 1pt !important; text-align: center !important; font-size: 8pt; } }`}</style>
        {(mode === "year" ? [] : mode === "month" ? [month0] : MONTHS.map((_, i) => i)).map((m) => (
          <div key={m} className="page dtb-cal-big">
            {o.title && <p className="meta">{o.title}</p>}
            <h2>
              {MONTHS[m]} {year}
            </h2>
            <PrintMonth o={o} month0={m} />
          </div>
        ))}
        {mode === "year" && (
          <div className="page">
            <h2>
              {year}
              {o.title ? ` · ${o.title}` : ""}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10pt 14pt" }} className="dtb-cal-small">
              {MONTHS.map((name, m) => (
                <div key={m}>
                  <strong>{name}</strong>
                  <PrintMonth o={o} month0={m} small />
                </div>
              ))}
            </div>
            {Object.keys(o.holidays).length > 0 && (
              <p style={{ marginTop: "10pt", fontSize: "8.5pt" }}>
                {Object.entries(o.holidays)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([k, n]) => `${MONTHS[Number(k.slice(5, 7)) - 1].slice(0, 3)} ${Number(k.slice(8))}: ${n.join(", ")}`)
                  .join(" · ")}
              </p>
            )}
          </div>
        )}
      </PrintArea>
    </div>
  );
}

function PrintMonth({ o, month0, small = false }: { o: Opts; month0: number; small?: boolean }) {
  const showWk = o.weekNums && o.ws === 1;
  return (
    <table>
      <thead>
        <tr>
          {showWk && <th>Wk</th>}
          {dayNames(o.ws).map((n) => (
            <th key={n}>{small ? n.slice(0, 2) : n}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {monthMatrix(o.year, month0, o.ws).map((row, ri) => (
          <tr key={ri}>
            {showWk && <td className="muted">{weekNo(o.year, month0, row)}</td>}
            {row.map((d, ci) => {
              const hol = d === null ? undefined : o.holidays[keyOf(o.year, month0, d)];
              return (
                <td key={ci}>
                  {d !== null && (hol ? <strong style={{ color: "#b0201a" }}>{d}</strong> : d)}
                  {!small && hol && <div style={{ fontSize: "7.5pt", color: "#b0201a" }}>{hol.join(", ")}</div>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
