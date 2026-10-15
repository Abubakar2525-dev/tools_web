"use client";

import { useDeferredValue, useState } from "react";
import { CopyBtn, EmptyState, Notice, NumberField, PrivacyNote, ResetBtn, StatGrid, TextField, ToolPanel, parseNum } from "@/components/tools/kit";
import { groupPlain, parseSig, roundSig, toENotation, toEngineering, toPlain, toScientific, type SigInfo } from "./lib/numbers";

/** Explains which digits count, following the usual textbook rules. */
function explain(raw: string, info: SigInfo): string[] {
  const s = raw.trim().replace(/[,\s_]/g, "").split(/[eE×x*·]/)[0].replace(/^[-+]/, "");
  const notes: string[] = [];
  if (info.dec.digits === "0") {
    notes.push("A zero value: only zeros written after the decimal point count, with a minimum of one.");
    return notes;
  }
  const [i = "", f = ""] = s.split(".");
  const all = i + f;
  const lead = (all.match(/^0+/) ?? [""])[0].length;
  if (lead) notes.push(`${lead} leading zero${lead > 1 ? "s are" : " is"} only a placeholder and not significant.`);
  const core = all.slice(lead).replace(/0+$/, "");
  const captive = (core.match(/0/g) ?? []).length;
  if (captive) notes.push(`${captive} zero${captive > 1 ? "s" : ""} between nonzero digits ${captive > 1 ? "are" : "is"} significant.`);
  const trailing = all.length - lead - core.length;
  if (trailing) {
    if (s.includes(".")) notes.push(`${trailing} trailing zero${trailing > 1 ? "s" : ""} after a decimal point ${trailing > 1 ? "are" : "is"} significant.`);
    else notes.push(`${trailing} trailing zero${trailing > 1 ? "s" : ""} in a whole number without a decimal point ${trailing > 1 ? "are" : "is"} ambiguous.`);
  }
  notes.push("All nonzero digits are significant.");
  return notes;
}

export default function Tool() {
  const [input, setInput] = useState("0.0045600");
  const [sigRaw, setSigRaw] = useState("");
  const v = useDeferredValue(input);

  const info = v.trim() ? parseSig(v) : null;
  const ok = info && typeof info !== "string" ? info : null;
  const n = parseNum(sigRaw);
  const sigErr = sigRaw.trim() && (n === null || !Number.isInteger(n) || n < 1 || n > 100) ? "Use a whole number from 1 to 100." : null;

  const target = ok ? (n !== null && !sigErr ? n : ok.sig) : 0;
  const d = ok ? roundSig(ok.dec, target) : null;
  const eng = d ? toEngineering(d) : null;
  const sci = d ? toScientific(d) : "";

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Convert"
        actions={
          <>
            <CopyBtn text={sci} label="Copy scientific" />
            <ResetBtn
              onClick={() => {
                setInput("0.0045600");
                setSigRaw("");
              }}
            />
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <TextField
            label="Number"
            hint="Standard (0.00456), E notation (4.56e-3) or × 10^ form (4.56 × 10^-3)."
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            error={typeof info === "string" ? info : null}
          />
          <NumberField
            label="Round to significant figures"
            optional
            hint="Leave blank to keep the number's own precision."
            value={sigRaw}
            onChange={(e) => setSigRaw(e.target.value)}
            error={sigErr}
          />
        </div>

        <div className="mt-6 space-y-5" aria-live="polite">
          {!v.trim() ? (
            <EmptyState icon="sigma" title="Type a number to convert" />
          ) : ok && d && eng ? (
            <>
              <div className="rounded-xl bg-accent-soft p-5">
                <p className="text-sm text-ink-2">Scientific notation ({target} significant figure{target === 1 ? "" : "s"})</p>
                <p className="mt-1 break-all font-display text-[2rem] font-semibold leading-tight tabular-nums text-ink">
                  {sci.replace(/ × 10\^(-?\d+)$/, " × 10")}
                  <sup>{sci.match(/\^(-?\d+)$/)?.[1]}</sup>
                </p>
              </div>
              <StatGrid
                items={[
                  { label: "E notation", value: <span className="break-all">{toENotation(d)}</span> },
                  { label: "Engineering", value: <span className="break-all">{eng.text}</span> },
                  { label: "SI prefix form", value: eng.prefix !== undefined ? `${eng.mantissa} ${eng.prefix || "(none)"}` : "n/a" },
                  { label: "Standard form", value: <span className="break-all">{groupPlain(toPlain(d))}</span> },
                  { label: "Significant figures in input", value: ok.ambiguous ? `${ok.sig} to ${ok.sigMax}` : String(ok.sig) },
                  { label: "Order of magnitude", value: `10^${d.exp + d.digits.length - 1}` },
                ]}
              />
              {ok.ambiguous && (
                <Notice tone="warning" title="Trailing zeros are ambiguous">
                  A whole number like this could have anywhere from {ok.sig} to {ok.sigMax} significant figures. The conversion uses {ok.sig}. Add a decimal point
                  (for example 1200.) or set the significant figures above if the zeros were measured.
                </Notice>
              )}
              <div className="rounded-xl bg-sunken p-4">
                <p className="text-sm font-medium text-ink">Why {ok.ambiguous ? `${ok.sig} to ${ok.sigMax}` : ok.sig} significant figures</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {explain(v, ok).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              {n !== null && !sigErr && n > ok.sigMax && (
                <Notice>Padding with zeros adds digits the original number did not have. Only do this if the extra precision is real.</Notice>
              )}
            </>
          ) : null}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
