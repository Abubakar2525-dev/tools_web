"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import type { ZxcvbnFactory, ZxcvbnResult } from "@zxcvbn-ts/core";
import { Btn, EmptyState, Notice, PrivacyNote, StatGrid, TextField, ToolPanel, fmt, inputCls } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { StrengthMeter, TableWrap, errorText, tdCls, thCls } from "./shared";

const SCENARIOS: { key: keyof ZxcvbnResult["crackTimes"]; label: string; detail: string }[] = [
  { key: "onlineThrottlingXPerHour", label: "Online, rate limited", detail: "100 guesses per hour against a login form with lockouts" },
  { key: "onlineNoThrottlingXPerSecond", label: "Online, no rate limit", detail: "10 guesses per second against a poorly protected service" },
  { key: "offlineSlowHashingXPerSecond", label: "Offline, slow hash", detail: "10,000 guesses per second against a stolen bcrypt or Argon2 database" },
  { key: "offlineFastHashingXPerSecond", label: "Offline, fast hash", detail: "10 billion guesses per second against stolen MD5 or SHA-1 hashes" },
];

const PATTERN_NAMES: Record<string, string> = {
  dictionary: "Dictionary word",
  spatial: "Keyboard pattern",
  repeat: "Repeat",
  sequence: "Sequence",
  regex: "Recognized format",
  date: "Date",
  bruteforce: "Random characters",
  separator: "Separator",
  wordSequence: "Word sequence",
};

let factoryPromise: Promise<ZxcvbnFactory> | null = null;
function loadFactory() {
  if (!factoryPromise) {
    factoryPromise = Promise.all([import("@zxcvbn-ts/core"), import("@zxcvbn-ts/language-common"), import("@zxcvbn-ts/language-en")]).then(
      ([core, common, en]) =>
        new core.ZxcvbnFactory({
          translations: en.translations,
          graphs: common.adjacencyGraphs,
          dictionary: { ...common.dictionary, ...en.dictionary },
          useLevenshteinDistance: true,
        }),
    );
    factoryPromise.catch(() => {
      factoryPromise = null;
    });
  }
  return factoryPromise;
}

export default function Tool() {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [userWords, setUserWords] = useState("");
  const [zx, setZx] = useState<ZxcvbnFactory | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loading = useRef(false);

  const ensure = () => {
    if (zx || loading.current) return;
    loading.current = true;
    loadFactory()
      .then((f) => setZx(f))
      .catch((e) => setLoadError(errorText(e, "The strength checker could not load.")))
      .finally(() => {
        loading.current = false;
      });
  };

  const deferred = useDeferredValue(pw);
  const deferredWords = useDeferredValue(userWords);
  const result = useMemo(() => {
    if (!zx || !deferred) return null;
    const inputs = deferredWords.split(/[\s,;]+/).filter(Boolean);
    return zx.check(deferred.slice(0, 256), inputs);
  }, [zx, deferred, deferredWords]);

  return (
    <div className="space-y-5">
      <ToolPanel title="Password strength checker">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-5">
            <div>
              <label htmlFor="psc-input" className="text-sm font-medium text-ink">
                Password to test
              </label>
              <p id="psc-hint" className="mt-1 text-[0.8125rem] text-muted">
                Checked on this device only. It is never stored or sent anywhere.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  id="psc-input"
                  type={show ? "text" : "password"}
                  className={`${inputCls} h-11 font-mono`}
                  value={pw}
                  onFocus={ensure}
                  onChange={(e) => {
                    ensure();
                    setPw(e.target.value);
                  }}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-describedby="psc-hint"
                />
                <Btn variant="ghost" icon="eye" onClick={() => setShow((s) => !s)} aria-pressed={show}>
                  {show ? "Hide" : "Show"}
                </Btn>
              </div>
            </div>
            <TextField
              label="Personal words to penalize"
              optional
              hint="Your name, username, email or company. Passwords built from them score lower."
              value={userWords}
              onChange={(e) => setUserWords(e.target.value)}
              autoComplete="off"
            />
            {pw.length > 256 && <Notice tone="info">Only the first 256 characters are analyzed. Anything that long is strong against guessing.</Notice>}
          </div>
          <div className="min-w-0 space-y-5" aria-live="polite">
            {loadError ? (
              <Notice tone="error">{loadError}</Notice>
            ) : !pw ? (
              <EmptyState icon="shield" title="Type a password to test it">
                The estimate updates as you type and looks for dictionary words, names, dates, keyboard walks and common substitutions.
              </EmptyState>
            ) : !result ? (
              <Spinner label="Loading the password dictionaries" />
            ) : (
              <>
                <StrengthMeter level={result.score} detail={`about 10^${fmt(result.guessesLog10, 1)} guesses`} />
                {(result.feedback.warning || result.feedback.suggestions.length > 0) && (
                  <Notice tone={result.score >= 3 ? "info" : "warning"} title={result.feedback.warning ?? "Suggestions"}>
                    {result.feedback.suggestions.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5">
                        {result.feedback.suggestions.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </Notice>
                )}
                <div>
                  <h3 className="mb-2 text-sm font-medium text-ink">Estimated time to crack</h3>
                  <StatGrid items={SCENARIOS.map((s) => ({ label: s.label, value: result.crackTimes[s.key].display }))} />
                  <ul className="mt-2 space-y-0.5 text-[0.8125rem] text-muted">
                    {SCENARIOS.map((s) => (
                      <li key={s.key}>
                        <span className="text-ink-2">{s.label}:</span> {s.detail}.
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-ink">What the estimator found</h3>
                  <TableWrap label="Patterns found in the password">
                    <thead>
                      <tr>
                        <th className={thCls}>Part</th>
                        <th className={thCls}>Pattern</th>
                        <th className={thCls}>Guesses (log10)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.sequence.map((m, i) => (
                        <tr key={`${m.i}-${m.j}-${i}`}>
                          <td className={`${tdCls} font-mono`}>{show ? m.token : "•".repeat(m.token.length)}</td>
                          <td className={tdCls}>
                            {PATTERN_NAMES[m.pattern] ?? m.pattern}
                            {typeof m.dictionaryName === "string" ? ` (${String(m.dictionaryName)})` : ""}
                            {m.l33t ? ", with substitutions" : ""}
                          </td>
                          <td className={`${tdCls} tabular-nums`}>{typeof m.guessesLog10 === "number" ? fmt(m.guessesLog10, 1) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </div>
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
