"use client";

/**
 * Text-in / text-out engine: input area, options, live output, stats,
 * copy, download, swap and reset. The transform must be pure.
 */

import { useDeferredValue, useId, useMemo, useState } from "react";
import { Btn, Checkbox, CopyBtn, Notice, PrivacyNote, ResetBtn, Segmented, ToolPanel, downloadFile, inputCls, monoAreaCls } from "../kit";
import { Icon } from "@/components/ui/Icon";

export type TextOption =
  | { id: string; label: string; type: "checkbox"; default: boolean; hint?: string }
  | { id: string; label: string; type: "select"; options: { value: string; label: string }[]; default: string; hint?: string }
  | { id: string; label: string; type: "text"; default: string; placeholder?: string; hint?: string; mono?: boolean }
  | { id: string; label: string; type: "number"; default: string; hint?: string };

export type TextOptions = Record<string, string | boolean>;

const NO_OPTIONS: TextOption[] = [];

export type TransformResult = string | { output: string; summary?: string; error?: string; warning?: string };

export function TextTransformTool({
  transform,
  options = NO_OPTIONS,
  modes,
  sample = "",
  inputLabel = "Input",
  outputLabel = "Output",
  inputPlaceholder = "Paste or type text here",
  downloadName = "output.txt",
  mono = false,
  allowSwap = false,
  outputRender,
}: {
  transform: (input: string, opts: TextOptions) => TransformResult;
  options?: TextOption[];
  /** Segmented modes, passed as opts.mode. */
  modes?: { value: string; label: string }[];
  sample?: string;
  inputLabel?: string;
  outputLabel?: string;
  inputPlaceholder?: string;
  downloadName?: string;
  mono?: boolean;
  /** Show "use output as input" button (for reversible conversions). */
  allowSwap?: boolean;
  /** Optional custom rendering of the output (e.g. a highlighted diff). */
  outputRender?: (output: string) => React.ReactNode;
}) {
  const initialOpts = useMemo(() => {
    const o: TextOptions = Object.fromEntries(options.map((x) => [x.id, x.default]));
    if (modes?.length) o.mode = modes[0].value;
    return o;
  }, [options, modes]);
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<TextOptions>(initialOpts);
  const dInput = useDeferredValue(input);
  const dOpts = useDeferredValue(opts);
  const inId = useId();
  const outId = useId();

  const res = useMemo(() => {
    if (!dInput) return null;
    try {
      const r = transform(dInput, dOpts);
      return typeof r === "string" ? { output: r } : r;
    } catch (e) {
      return { output: "", error: e instanceof Error ? e.message : "Could not process this text." };
    }
  }, [dInput, dOpts, transform]);

  const output = res?.output ?? "";
  const lines = (s: string) => (s ? s.split(/\r\n|\r|\n/).length : 0);

  return (
    <div className="space-y-5">
      {(modes || options.length > 0) && (
        <ToolPanel title="Options">
          <div className="space-y-5">
            {modes && (
              <Segmented label="Mode" value={String(opts.mode)} onChange={(m) => setOpts((o) => ({ ...o, mode: m }))} options={modes} />
            )}
            {options.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {options.map((o) => (
                  <OptionControl key={o.id} opt={o} value={opts[o.id]} onChange={(v) => setOpts((s) => ({ ...s, [o.id]: v }))} />
                ))}
              </div>
            )}
          </div>
        </ToolPanel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title={inputLabel}
          actions={
            <>
              {sample && (
                <Btn variant="ghost" icon="spark" onClick={() => setInput(sample)}>
                  Load sample
                </Btn>
              )}
              <ResetBtn
                onClick={() => {
                  setInput("");
                  setOpts(initialOpts);
                }}
              />
            </>
          }
        >
          <label htmlFor={inId} className="sr-only">
            {inputLabel}
          </label>
          <textarea
            id={inId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={inputPlaceholder}
            spellCheck={mono ? false : undefined}
            className={mono ? `${monoAreaCls} min-h-[300px]` : `${inputCls} min-h-[300px] resize-y py-3 leading-relaxed`}
          />
          <p className="mt-2 text-[0.8125rem] tabular-nums text-muted">
            {input.length.toLocaleString()} characters · {lines(input).toLocaleString()} lines
          </p>
        </ToolPanel>

        <ToolPanel
          title={outputLabel}
          actions={
            <>
              {allowSwap && (
                <Btn variant="subtle" icon="swap" disabled={!output} onClick={() => setInput(output)}>
                  Use as input
                </Btn>
              )}
              <Btn variant="ghost" icon="download" disabled={!output} onClick={() => downloadFile(downloadName, output)}>
                Download
              </Btn>
              <CopyBtn text={output} />
            </>
          }
        >
          {res?.error ? (
            <Notice tone="error">{res.error}</Notice>
          ) : outputRender && output ? (
            <div className="min-h-[300px] overflow-auto rounded-lg bg-surface p-3 shadow-[inset_0_0_0_1px_var(--line-strong)]">{outputRender(output)}</div>
          ) : (
            <>
              <label htmlFor={outId} className="sr-only">
                {outputLabel}
              </label>
              <textarea
                id={outId}
                readOnly
                value={output}
                placeholder="The result appears here as you type."
                className={`${mono ? monoAreaCls : `${inputCls} resize-y py-3 leading-relaxed`} min-h-[300px] bg-sunken`}
              />
            </>
          )}
          {res?.warning && (
            <div className="mt-3">
              <Notice tone="warning">{res.warning}</Notice>
            </div>
          )}
          <p className="mt-2 text-[0.8125rem] tabular-nums text-muted" aria-live="polite">
            {res?.summary ?? (output ? `${output.length.toLocaleString()} characters · ${lines(output).toLocaleString()} lines` : "")}
          </p>
        </ToolPanel>
      </div>
      <PrivacyNote />
    </div>
  );
}

function OptionControl({ opt, value, onChange }: { opt: TextOption; value: string | boolean | undefined; onChange: (v: string | boolean) => void }) {
  const id = useId();
  if (opt.type === "checkbox") return <Checkbox label={opt.label} hint={opt.hint} checked={value === true} onChange={onChange} />;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {opt.label}
      </label>
      {opt.hint && <p className="mt-1 text-[0.8125rem] text-muted">{opt.hint}</p>}
      <div className="relative mt-2">
        {opt.type === "select" ? (
          <>
            <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className={`${inputCls} h-11 appearance-none pr-10`}>
              {opt.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          </>
        ) : (
          <input
            id={id}
            value={String(value ?? "")}
            inputMode={opt.type === "number" ? "numeric" : undefined}
            placeholder={opt.type === "text" ? opt.placeholder : undefined}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} h-11 ${opt.type === "text" && opt.mono ? "font-mono text-[0.9rem]" : ""}`}
          />
        )}
      </div>
    </div>
  );
}
