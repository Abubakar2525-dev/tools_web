"use client";

/** Shared UI for the HTML, CSS and JavaScript formatter/minifier tools. */

import { useState } from "react";
import { Btn, Checkbox, EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, SelectField, SplitGrid, TextArea, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { CodeResult, ParseError, SizeStats, byteLen, errorMessage, useRunGuard } from "./shared";

export interface FormatOpts {
  printWidth: number;
  tabWidth: number;
  useTabs: boolean;
  singleQuote: boolean;
  semi: boolean;
}

export interface MinifyOpts {
  removeComments: boolean;
  mangle: boolean;
  dropConsole: boolean;
  restructure: boolean;
}

export interface FormatterConfig {
  inputLabel: string;
  languages: { value: string; label: string; ext: string; mime: string }[];
  samples: Record<string, string>;
  format: (code: string, lang: string, o: FormatOpts) => Promise<string>;
  minify: (code: string, lang: string, o: MinifyOpts) => Promise<string>;
  /** Returns a reason when minifying is not available for this language. */
  minifyUnsupported?: (lang: string) => string | null;
  formatOptions: ("quotes" | "semi")[];
  minifyOptions: ("removeComments" | "mangle" | "dropConsole" | "restructure")[];
  minifyNote: string;
}

type Out =
  | { kind: "ok"; mode: "format" | "minify"; text: string; before: number }
  | { kind: "error"; message: string; line: number | null; column: number | null; source: string };

/** Pulls a 1-based line/column out of Prettier, Terser or CSSO errors. */
function locate(e: unknown): { line: number | null; column: number | null } {
  if (e && typeof e === "object") {
    const x = e as { loc?: { start?: { line?: number; column?: number } }; line?: number; col?: number; column?: number };
    if (x.loc?.start?.line) return { line: x.loc.start.line, column: x.loc.start.column ?? null };
    if (typeof x.line === "number") return { line: x.line, column: typeof x.col === "number" ? x.col + 1 : typeof x.column === "number" ? x.column : null };
  }
  const m = /\((\d+):(\d+)\)/.exec(errorMessage(e));
  return m ? { line: Number(m[1]), column: Number(m[2]) } : { line: null, column: null };
}

export function FormatterShell({ config }: { config: FormatterConfig }) {
  const [lang, setLang] = useState(config.languages[0].value);
  const [input, setInput] = useState("");
  const [fo, setFo] = useState<FormatOpts>({ printWidth: 80, tabWidth: 2, useTabs: false, singleQuote: false, semi: true });
  const [mo, setMo] = useState<MinifyOpts>({ removeComments: true, mangle: true, dropConsole: false, restructure: true });
  const [out, setOut] = useState<Out | null>(null);
  const [busy, setBusy] = useState<"format" | "minify" | null>(null);
  const [emptyErr, setEmptyErr] = useState(false);
  const guard = useRunGuard();
  const language = config.languages.find((l) => l.value === lang) ?? config.languages[0];
  const unsupported = config.minifyUnsupported?.(lang) ?? null;

  const run = async (mode: "format" | "minify", code = input) => {
    if (!code.trim()) {
      setEmptyErr(true);
      return;
    }
    setEmptyErr(false);
    const token = guard.start();
    setBusy(mode);
    try {
      const text = mode === "format" ? await config.format(code, lang, fo) : await config.minify(code, lang, mo);
      if (guard.isCurrent(token)) setOut({ kind: "ok", mode, text, before: byteLen(code) });
    } catch (e) {
      if (guard.isCurrent(token)) {
        const loc = locate(e);
        setOut({ kind: "error", message: errorMessage(e).split("\n")[0].replace(/\s*\(\d+:\d+\)\s*$/, ""), ...loc, source: code });
      }
    } finally {
      if (guard.isCurrent(token)) setBusy(null);
    }
  };

  const setF = <K extends keyof FormatOpts>(k: K, v: FormatOpts[K]) => setFo((p) => ({ ...p, [k]: v }));
  const setM = <K extends keyof MinifyOpts>(k: K, v: MinifyOpts[K]) => setMo((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <ToolPanel title="Options">
        <div className="space-y-5">
          {config.languages.length > 1 && (
            <Segmented
              label="Language"
              value={lang}
              onChange={(v) => {
                setLang(v);
                setOut(null);
              }}
              options={config.languages}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label="Line width"
              value={String(fo.printWidth)}
              onChange={(e) => setF("printWidth", Number(e.target.value))}
              options={["80", "100", "120", "160"].map((v) => ({ value: v, label: `${v} characters` }))}
            />
            <SelectField
              label="Indent"
              value={fo.useTabs ? "tab" : String(fo.tabWidth)}
              onChange={(e) => (e.target.value === "tab" ? setFo((p) => ({ ...p, useTabs: true })) : setFo((p) => ({ ...p, useTabs: false, tabWidth: Number(e.target.value) })))}
              options={[
                { value: "2", label: "2 spaces" },
                { value: "4", label: "4 spaces" },
                { value: "tab", label: "Tabs" },
              ]}
            />
            <div className="space-y-3 pt-1 sm:col-span-2">
              {config.formatOptions.includes("quotes") && <Checkbox label="Prefer single quotes" checked={fo.singleQuote} onChange={(v) => setF("singleQuote", v)} />}
              {config.formatOptions.includes("semi") && <Checkbox label="Semicolons at statement ends" checked={fo.semi} onChange={(v) => setF("semi", v)} />}
            </div>
          </div>
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm font-medium text-ink">Minify options</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {config.minifyOptions.includes("removeComments") && <Checkbox label="Remove comments" hint="License comments (/*! … */) are kept." checked={mo.removeComments} onChange={(v) => setM("removeComments", v)} />}
              {config.minifyOptions.includes("mangle") && <Checkbox label="Shorten local variable names" checked={mo.mangle} onChange={(v) => setM("mangle", v)} />}
              {config.minifyOptions.includes("dropConsole") && <Checkbox label="Remove console.* calls" checked={mo.dropConsole} onChange={(v) => setM("dropConsole", v)} />}
              {config.minifyOptions.includes("restructure") && <Checkbox label="Merge and restructure rules" hint="Smaller output; turn off if rule order matters for overrides." checked={mo.restructure} onChange={(v) => setM("restructure", v)} />}
            </div>
            <p className="text-[0.8125rem] text-muted">{config.minifyNote}</p>
          </div>
        </div>
      </ToolPanel>
      <SplitGrid>
        <ToolPanel
          title={`${language.label} input`}
          actions={
            <>
              <Btn
                variant="ghost"
                icon="code"
                onClick={() => {
                  const s = config.samples[lang] ?? "";
                  setInput(s);
                  void run("format", s);
                }}
              >
                Load sample
              </Btn>
              <ResetBtn
                onClick={() => {
                  setInput("");
                  setOut(null);
                  setEmptyErr(false);
                }}
              />
            </>
          }
        >
          <div className="space-y-4">
            <TextArea
              label={config.inputLabel}
              mono
              rows={16}
              value={input}
              error={emptyErr ? "Paste some code first." : null}
              hint="Ctrl or Cmd + Enter formats."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void run("format");
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Btn icon="code" disabled={busy !== null} onClick={() => void run("format")}>
                Format
              </Btn>
              <Btn variant="ghost" disabled={busy !== null || unsupported !== null} onClick={() => void run("minify")}>
                Minify
              </Btn>
              {busy && <Spinner label={busy === "format" ? "Formatting (loading the formatter the first time)" : "Minifying"} />}
            </div>
            {unsupported && <Notice>{unsupported}</Notice>}
          </div>
        </ToolPanel>
        <ToolPanel title="Result">
          {!out ? (
            <EmptyState icon="code" title="No result yet">
              Paste code and choose Format or Minify.
            </EmptyState>
          ) : out.kind === "error" ? (
            <ParseError title="Could not parse the code" message={out.message} line={out.line} column={out.column} source={out.source} />
          ) : (
            <div className="space-y-4">
              <SizeStats before={out.before} after={byteLen(out.text)} />
              <CodeResult code={out.text} filename={`${out.mode === "minify" ? "min" : "formatted"}.${language.ext}`} mime={language.mime} label={out.mode === "minify" ? "Minified code" : "Formatted code"} />
            </div>
          )}
        </ToolPanel>
      </SplitGrid>
      <PrivacyNote />
    </div>
  );
}
