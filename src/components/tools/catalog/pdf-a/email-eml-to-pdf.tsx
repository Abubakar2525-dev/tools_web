"use client";

import { useState } from "react";
import { Btn, Checkbox, Notice, PrivacyNote, SelectField, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, Spinner, baseName, fileToBytes, formatBytes } from "@/components/tools/engines/files";
import { DownloadResult, savePdf, useJob, type Output } from "./shared";
import { TextWriter } from "./textpdf";
import { htmlToTextBasic, parseEml, type ParsedEmail } from "./lib/mime";
import { PAPER, mmToPt, type PaperName } from "./lib/layout";

/** HTML to readable text using the browser's parser (scripts never run in a DOMParser document). */
function htmlToText(html: string): string {
  if (typeof DOMParser === "undefined") return htmlToTextBasic(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,head,title,noscript").forEach((n) => n.remove());
  const out: string[] = [];
  const block = /^(P|DIV|H[1-6]|TR|TABLE|UL|OL|BLOCKQUOTE|SECTION|ARTICLE|HEADER|FOOTER|PRE|HR)$/;
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push((node.textContent ?? "").replace(/\s+/g, " "));
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.tagName;
    if (tag === "BR") return void out.push("\n");
    if (tag === "LI") out.push("\n• ");
    if (block.test(tag)) out.push("\n\n");
    node.childNodes.forEach(walk);
    if (tag === "A") {
      const href = node.getAttribute("href") ?? "";
      const label = (node.textContent ?? "").trim();
      if (/^https?:/i.test(href) && href !== label) out.push(` (${href})`);
    }
    if (tag === "TD" || tag === "TH") out.push("\t");
    if (block.test(tag)) out.push("\n\n");
  };
  walk(doc.body ?? doc.documentElement);
  return out
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [mail, setMail] = useState<ParsedEmail | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [paper, setPaper] = useState<PaperName>("A4");
  const [allHeaders, setAllHeaders] = useState(false);
  const [out, setOut] = useState<Output | null>(null);
  const job = useJob();

  const open = async (f: File) => {
    setOut(null);
    setFile(f);
    setMail(null);
    setParseErr(null);
    try {
      const parsed = parseEml(await fileToBytes(f), htmlToText);
      if (!parsed.headers.length) throw new Error("No email headers were found. Is this an .eml (RFC 822) file?");
      setMail(parsed);
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : "This email could not be read.");
    }
  };

  const run = () =>
    job.run(async ({ alive }) => {
      if (!mail || !file) return;
      setOut(null);
      const p = PAPER[paper];
      const m = mmToPt(18);
      const w = await TextWriter.create(p.w, p.h, { top: m, right: m, bottom: m, left: m });
      const grey = w.rgb(0.4, 0.4, 0.4);
      w.text(mail.subject || "(no subject)", { size: 17, bold: true, lineHeight: 1.25 });
      w.space(6);
      const rows: [string, string][] = allHeaders
        ? mail.headers.map((h) => [h.name, h.value])
        : ([
            ["From", mail.from],
            ["To", mail.to],
            ["Cc", mail.cc],
            ["Date", mail.date],
          ] as [string, string][]).filter(([, v]) => v);
      for (const [k, v] of rows) {
        if (allHeaders) {
          w.text(`${k}: ${v}`, { size: 8.5 });
          continue;
        }
        w.text(`${k}:`, { size: 9.5, bold: true, color: grey });
        w.y += 9.5 * 1.35; // same line: draw value indented
        w.text(v, { size: 9.5, indent: 70 });
      }
      if (mail.attachments.length) {
        w.space(4);
        w.text(`Attachments (${mail.attachments.length}):`, { size: 9.5, bold: true, color: grey });
        for (const a of mail.attachments) w.text(`• ${a.name}  (${formatBytes(a.size)}${a.inline ? ", inline" : ""})`, { size: 9.5, indent: 10 });
      }
      w.rule();
      w.text(mail.text || "(This message has no text body.)", { size: 10.5, lineHeight: 1.45 });
      w.pageNumbers();
      if (mail.subject) w.doc.setTitle(mail.subject);
      if (mail.from) w.doc.setAuthor(mail.from);
      const blob = await savePdf(w.doc);
      if (alive()) setOut({ blob, name: `${baseName(file.name)}.pdf`, detail: `${w.pages.length} ${w.pages.length === 1 ? "page" : "pages"}` });
    });

  return (
    <ToolPanel title="Email to PDF">
      <div className="space-y-5">
        {file ? (
          <FileChip
            file={file}
            onRemove={() => {
              job.cancel();
              setFile(null);
              setMail(null);
              setOut(null);
              setParseErr(null);
            }}
          />
        ) : (
          <FileDrop accept=".eml,message/rfc822" maxSizeMB={50} label="Choose an .eml file or drop it here" hint="Saved emails from Outlook, Thunderbird, Apple Mail or Gmail (Download message). Up to 50 MB." onFiles={(f) => f[0] && open(f[0])} />
        )}
        {parseErr && <Notice tone="error">{parseErr}</Notice>}
        {mail && (
          <>
            <div className="rounded-xl bg-sunken p-4 text-sm">
              <p className="font-semibold text-ink">{mail.subject || "(no subject)"}</p>
              <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[4rem_1fr]">
                {(
                  [
                    ["From", mail.from],
                    ["To", mail.to],
                    ["Cc", mail.cc],
                    ["Date", mail.date],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd className="break-words text-ink">{v}</dd>
                    </div>
                  ))}
              </dl>
              {mail.attachments.length > 0 && (
                <div className="mt-3">
                  <p className="text-muted">Attachments (listed by name only; their contents are not converted)</p>
                  <ul className="mt-1 space-y-0.5">
                    {mail.attachments.map((a, i) => (
                      <li key={`${a.name}-${i}`} className="break-words text-ink">
                        {a.name} <span className="tabular-nums text-muted">· {formatBytes(a.size)}{a.inline ? " · inline" : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 text-[0.8125rem] text-muted">
                Body: {mail.bodySource === "plain" ? "plain-text version" : mail.bodySource === "html" ? "converted from HTML (layout and images are not kept)" : "none found"}
              </p>
            </div>
            <pre tabIndex={0} aria-label="Message body preview" className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg p-4 text-sm text-ink shadow-[inset_0_0_0_1px_var(--line)]">
              {mail.text.slice(0, 20000) || "(empty)"}
            </pre>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Page size"
                value={paper}
                onChange={(e) => { setPaper(e.target.value as PaperName); setOut(null); }}
                options={(["A4", "Letter", "Legal"] as PaperName[]).map((p) => ({ value: p, label: PAPER[p].label }))}
              />
            </div>
            <Checkbox label="Include every header (Received, Message-ID and so on)" checked={allHeaders} onChange={(v) => { setAllHeaders(v); setOut(null); }} />
            <div className="flex flex-wrap items-center gap-3">
              <Btn icon="file" disabled={job.busy} onClick={run}>
                Create PDF
              </Btn>
              {job.busy && <Spinner label="Building PDF" />}
            </div>
          </>
        )}
        {job.error && <Notice tone="error">{job.error}</Notice>}
        {out && <DownloadResult output={out} />}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}
