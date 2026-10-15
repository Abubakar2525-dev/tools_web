"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Btn, Notice, PrivacyNote, SelectField, Segmented, TextArea, ToolPanel } from "@/components/tools/kit";
import { ProgressBar, downloadBlob, zipFiles } from "@/components/tools/engines/files";
import { ColorField, RangeField, dataUrlToBlob, errMsg } from "./shared";
import { safeFileName } from "./lib/bytes";
import { parseBulk, qrColorWarning } from "./lib/qr";

type Ecc = "L" | "M" | "Q" | "H";
type Out = "png" | "svg" | "both";

const SAMPLE_LINES = "https://example.com\nhttps://example.com/menu\nhttps://example.com/contact";
const SAMPLE_CSV = "name,content\nTable 1,https://example.com/order?table=1\nTable 2,https://example.com/order?table=2\nWi-Fi card,\"WIFI:T:WPA;S:Cafe;P:espresso42;;\"";

export default function Tool() {
  const [mode, setMode] = useState<"lines" | "csv">("lines");
  const [input, setInput] = useState(SAMPLE_LINES);
  const [ecc, setEcc] = useState<Ecc>("M");
  const [fg, setFg] = useState("#111111");
  const [bg, setBg] = useState("#ffffff");
  const [margin, setMargin] = useState(4);
  const [size, setSize] = useState(512);
  const [out, setOut] = useState<Out>("png");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);
  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  const rows = useMemo(() => {
    const parsed = parseBulk(input, mode);
    return parsed.map((r, i) => {
      let problem: string | null = null;
      if (!r.content) problem = "No content";
      else {
        try {
          QRCode.create(r.content, { errorCorrectionLevel: ecc });
        } catch {
          problem = "Too long for one QR code";
        }
      }
      const fallback = `qr-${String(i + 1).padStart(3, "0")}`;
      return { ...r, file: safeFileName(r.name || (mode === "lines" ? fallback : ""), fallback), problem };
    });
  }, [input, mode, ecc]);
  const valid = rows.filter((r) => !r.problem);
  const bad = rows.filter((r) => r.problem);
  const colorWarn = qrColorWarning(fg, bg);

  const generate = async () => {
    cancelled.current = false;
    setError(null);
    setProgress(0);
    try {
      const entries: { name: string; data: Blob | string }[] = [];
      const opts = { errorCorrectionLevel: ecc, margin, color: { dark: fg, light: bg } };
      for (let i = 0; i < valid.length; i++) {
        if (cancelled.current) return;
        const r = valid[i];
        if (out !== "svg") entries.push({ name: `${r.file}.png`, data: dataUrlToBlob(await QRCode.toDataURL(r.content, { ...opts, width: size })) });
        if (out !== "png") entries.push({ name: `${r.file}.svg`, data: await QRCode.toString(r.content, { ...opts, type: "svg" }) });
        setProgress((i + 1) / valid.length);
        if (i % 20 === 19) await new Promise((res) => setTimeout(res, 0));
      }
      const index = ["file,content", ...valid.map((r) => `"${r.file.replace(/"/g, '""')}","${r.content.replace(/"/g, '""')}"`)].join("\n");
      entries.push({ name: "index.csv", data: index });
      downloadBlob(await zipFiles(entries, 6), "qr-codes.zip");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Bulk QR codes">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <Segmented
              label="Input format"
              value={mode}
              onChange={(m) => {
                setMode(m);
                if (input === SAMPLE_LINES || input === SAMPLE_CSV || !input.trim()) setInput(m === "csv" ? SAMPLE_CSV : SAMPLE_LINES);
              }}
              options={[
                { value: "lines", label: "One per line" },
                { value: "csv", label: "CSV: name,content" },
              ]}
            />
            <TextArea
              label={mode === "lines" ? "Links or text, one per line" : "CSV rows"}
              mono
              rows={12}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              hint={mode === "lines" ? "Files are named qr-001, qr-002 and so on." : "The name becomes the file name. Quote content that contains commas. A first row of name,content is skipped."}
            />
            <p className="text-sm text-ink-2" aria-live="polite">
              {valid.length} code{valid.length === 1 ? "" : "s"} ready{bad.length ? `, ${bad.length} row${bad.length === 1 ? "" : "s"} skipped` : ""}.
            </p>
            {bad.length > 0 && (
              <Notice tone="warning" title="Rows that will be skipped">
                <ul className="space-y-0.5">
                  {bad.slice(0, 8).map((r) => (
                    <li key={r.line}>
                      Line {r.line}: {r.problem}
                    </li>
                  ))}
                  {bad.length > 8 && <li>…and {bad.length - 8} more</li>}
                </ul>
              </Notice>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            <SelectField
              label="Error correction"
              value={ecc}
              onChange={(e) => setEcc(e.target.value as Ecc)}
              options={[
                { value: "L", label: "Low (7%)" },
                { value: "M", label: "Medium (15%)" },
                { value: "Q", label: "Quartile (25%)" },
                { value: "H", label: "High (30%)" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Code color" value={fg} onChange={setFg} />
              <ColorField label="Background" value={bg} onChange={setBg} />
            </div>
            {colorWarn && <Notice tone="warning">{colorWarn}</Notice>}
            <RangeField label="Quiet zone" value={margin} onChange={setMargin} min={0} max={10} unit=" modules" />
            <RangeField label="PNG size" value={size} onChange={setSize} min={128} max={2048} step={32} unit=" px" />
            <Segmented
              label="File type"
              value={out}
              onChange={setOut}
              options={[
                { value: "png", label: "PNG" },
                { value: "svg", label: "SVG" },
                { value: "both", label: "Both" },
              ]}
            />
            {progress !== null ? (
              <div className="space-y-2">
                <ProgressBar value={progress} label="Generating codes" />
                <Btn
                  variant="ghost"
                  onClick={() => {
                    cancelled.current = true;
                  }}
                >
                  Cancel
                </Btn>
              </div>
            ) : (
              <Btn icon="download" disabled={!valid.length} onClick={generate}>
                Download {valid.length} as ZIP
              </Btn>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            {valid.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink">First codes</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {valid.slice(0, 6).map((r) => (
                    <li key={r.line} className="truncate rounded-md bg-sunken px-2 py-1">
                      <span className="font-mono">{r.file}</span>: {r.content}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
