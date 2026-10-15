"use client";

import { useState } from "react";
import { Btn, EmptyState, Notice, PrivacyNote, ResetBtn, ResultCard, StatGrid, TextField, ToolPanel } from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { checkCard, NETWORKS } from "./lib/card";

/** Publicly documented test numbers from card networks and payment processors. */
const TEST_NUMBERS = [
  { label: "Visa test", value: "4111 1111 1111 1111" },
  { label: "Mastercard test", value: "5555 5555 5555 4444" },
  { label: "Amex test", value: "3782 822463 10005" },
  { label: "Invalid example", value: "4111 1111 1111 1112" },
];

export default function Tool() {
  const [text, setText] = useState("");
  const [show, setShow] = useState(false);
  const r = checkCard(text);

  return (
    <div className="space-y-5">
      <Notice tone="warning" title="For testing only">
        Use this with test numbers or to debug a form. Everything runs in your browser: the number is not stored, logged or sent anywhere. Do not paste real card details into any website you do not trust.
      </Notice>
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title="Card number" actions={<ResetBtn onClick={() => setText("")} />}>
          <TextField
            label="Number"
            hint="Spaces and dashes are ignored."
            type={show ? "text" : "password"}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            maxLength={30}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="4111 1111 1111 1111"
            error={r.kind === "invalid-chars" ? "Only digits, spaces and dashes are allowed." : null}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn variant="subtle" icon="eye" onClick={() => setShow((v) => !v)} aria-pressed={show}>
              {show ? "Hide digits" : "Show digits"}
            </Btn>
          </div>
          <div className="mt-5">
            <p className="text-sm font-medium text-ink">Test numbers</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEST_NUMBERS.map((t) => (
                <Btn key={t.label} variant="subtle" onClick={() => setText(t.value)}>
                  {t.label}
                </Btn>
              ))}
            </div>
          </div>
        </ToolPanel>

        <ToolPanel title="Result">
          {r.kind !== "ok" ? (
            <EmptyState icon="lock" title="Enter a card number to check">
              The Luhn check and network detection run as you type.
            </EmptyState>
          ) : (
            <div className="space-y-5">
              <ResultCard
                tone={r.valid ? "accent" : "neutral"}
                label={r.valid ? "Passes the checks" : "Does not pass"}
                value={<span className="break-all font-mono text-[1.375rem] sm:text-[1.625rem]">{r.masked}</span>}
                detail={r.primary ? r.networks.map((n) => n.name).join(" / ") : "Network not recognised"}
              />
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2.5">
                  <Icon name={r.luhnOk ? "check" : "alert"} size={18} className={`mt-px shrink-0 ${r.luhnOk ? "text-accent-strong" : "text-danger"}`} />
                  <span>
                    <span className="font-medium text-ink">Luhn checksum: </span>
                    <span className="text-ink-2">
                      {r.luhnOk ? "passes." : r.length < 8 ? "too short to check." : `fails. The last digit would need to be ${r.expectedCheckDigit}.`}
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Icon name={r.lengthOk ? "check" : "alert"} size={18} className={`mt-px shrink-0 ${r.lengthOk ? "text-accent-strong" : "text-danger"}`} />
                  <span>
                    <span className="font-medium text-ink">Length: </span>
                    <span className="text-ink-2">
                      {r.length} digits{r.primary ? `; ${r.primary.name} uses ${r.primary.lengths.length > 3 ? `${r.primary.lengths[0]} to ${r.primary.lengths[r.primary.lengths.length - 1]}` : r.primary.lengths.join(", ")}` : "; cards use 12 to 19"}.
                    </span>
                  </span>
                </li>
              </ul>
              <StatGrid
                items={[
                  { label: "Network", value: r.primary?.name ?? "Unknown" },
                  { label: "IIN / BIN (first 6)", value: <span className="font-mono">{r.digits.slice(0, 6)}</span> },
                  { label: "Digits", value: r.length },
                ]}
              />
              <p className="text-[0.8125rem] text-muted">
                Passing Luhn only means the number is well formed. It says nothing about whether the card exists, is active, or has funds.
              </p>
            </div>
          )}
          <div className="mt-6">
            <PrivacyNote />
          </div>
        </ToolPanel>
      </div>
      <ToolPanel title="Networks recognised">
        <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Card networks, number prefixes and lengths</caption>
            <thead>
              <tr className="border-b border-line">
                {["Network", "Starts with", "Lengths"].map((c) => (
                  <th key={c} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NETWORKS.map((n) => (
                <tr key={n.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{n.name}</td>
                  <td className="px-3 py-2 font-mono text-[0.8125rem] text-ink-2">{n.ranges.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join(", ")}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-2">{n.lengths.length > 3 ? `${n.lengths[0]}-${n.lengths[n.lengths.length - 1]}` : n.lengths.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ToolPanel>
    </div>
  );
}
