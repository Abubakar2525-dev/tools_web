"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, Notice, PrivacyNote, Segmented, TextArea, TextField, ToolPanel, usePersistentState } from "@/components/tools/kit";
import { MOODS, PAIRINGS, embedHtml, googleFontsUrl, pairingCss, stack, type Mood } from "./lib/fonts";
import { CodeOutput, Slider } from "./shared";

export default function Tool() {
  const [consent, setConsent] = usePersistentState<boolean>("font-pairing-google-fonts", false);
  const [mood, setMood] = useState<Mood | "all">("all");
  const [id, setId] = useState(PAIRINGS[0].id);
  const [heading, setHeading] = useState("Make the page feel like you meant it");
  const [body, setBody] = useState(
    "Good type pairs share proportions but differ in voice. One face carries the headline, the other carries the reading. Change this text to try your own copy, and adjust the sizes to match your layout.",
  );
  const [hSize, setHSize] = useState(40);
  const [bSize, setBSize] = useState(17);

  const list = useMemo(() => PAIRINGS.filter((p) => mood === "all" || p.mood.includes(mood)), [mood]);
  const pair = PAIRINGS.find((p) => p.id === id) ?? PAIRINGS[0];

  useEffect(() => {
    if (!consent) return;
    const url = googleFontsUrl([pair.heading, pair.body]);
    if (document.querySelector(`link[data-font-pair="${pair.id}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.fontPair = pair.id;
    document.head.appendChild(link);
  }, [consent, pair]);

  return (
    <div className="space-y-5">
      {!consent && (
        <Notice tone="info" title="Font previews load from Google Fonts">
          <p>
            To show these typefaces, your browser downloads them from fonts.googleapis.com and fonts.gstatic.com, which means Google sees your IP
            address. Nothing you type is sent. Until you allow it, previews use fallback fonts.
          </p>
          <div className="mt-3">
            <Btn onClick={() => setConsent(true)}>Load font previews</Btn>
          </div>
        </Notice>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <ToolPanel title={`Pairings (${list.length})`}>
          <div className="mb-4 overflow-x-auto">
            <Segmented label="Filter by mood" value={mood} onChange={setMood} options={MOODS} />
          </div>
          <ul className="max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={p.id === pair.id}
                  onClick={() => setId(p.id)}
                  className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-accent-soft"
                >
                  <span className="block text-[0.95rem] font-semibold text-ink">{p.heading.family}</span>
                  <span className="block text-sm text-ink-2">with {p.body.family}</span>
                </button>
              </li>
            ))}
          </ul>
        </ToolPanel>

        <div className="min-w-0 space-y-5">
          <ToolPanel title={`${pair.heading.family} + ${pair.body.family}`}>
            <div className="rounded-xl bg-sunken p-5 sm:p-7">
              <p style={{ fontFamily: stack(pair.heading), fontWeight: pair.heading.weights[0], fontSize: hSize, lineHeight: 1.15 }} className="break-words text-ink">
                {heading || "Heading"}
              </p>
              <p style={{ fontFamily: stack(pair.body), fontSize: bSize, lineHeight: 1.6 }} className="mt-4 whitespace-pre-line break-words text-ink-2">
                {body || "Body text"}
              </p>
              <p style={{ fontFamily: stack(pair.body), fontSize: bSize, lineHeight: 1.6, fontWeight: 700 }} className="mt-3 text-ink">
                Bold body text for emphasis, 0123456789
              </p>
            </div>
            <p className="mt-4 text-sm text-ink-2">
              <span className="font-medium text-ink">Why it works: </span>
              {pair.why}
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Heading weight {pair.heading.weights.join(", ")}; body weights {pair.body.weights.join(", ")}. Moods: {pair.mood.join(", ")}.
            </p>
          </ToolPanel>

          <ToolPanel title="Your text">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Heading" value={heading} maxLength={120} onChange={(e) => setHeading(e.target.value)} />
              <Slider label="Heading size" value={hSize} onChange={setHSize} min={20} max={80} unit="px" />
              <TextArea label="Body text" value={body} maxLength={800} onChange={(e) => setBody(e.target.value)} className="sm:col-span-2" />
              <Slider label="Body size" value={bSize} onChange={setBSize} min={12} max={24} unit="px" />
            </div>
          </ToolPanel>

          <ToolPanel title="Use it">
            <div className="space-y-5">
              <CodeOutput code={embedHtml(pair)} label="HTML <head> embed" />
              <CodeOutput code={pairingCss(pair)} label="CSS" filename="fonts.css" />
            </div>
            <p className="mt-3 text-[0.8125rem] text-muted">
              For stricter privacy or performance, download the families and self-host them with @font-face instead of linking to Google.
            </p>
          </ToolPanel>
        </div>
      </div>
      <PrivacyNote />
    </div>
  );
}
