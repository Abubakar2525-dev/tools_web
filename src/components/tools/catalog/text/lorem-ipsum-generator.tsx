"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, NumberField, OutputBlock, PrivacyNote, Segmented, ToolPanel, downloadFile, parseNum } from "@/components/tools/kit";
import { generateLorem, type LoremKind } from "./lib/lorem";

/** Fixed seed for the first render so server and client output match. */
function seeded(seed: number) {
  let x = seed;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

const LIMITS: Record<LoremKind, number> = { paragraphs: 100, sentences: 500, words: 5000, list: 200 };

export default function Tool() {
  const [kind, setKind] = useState<LoremKind>("paragraphs");
  const [count, setCount] = useState("3");
  const [start, setStart] = useState(true);
  const [html, setHtml] = useState(false);
  const [output, setOutput] = useState(() => generateLorem("paragraphs", 3, { startWithLorem: true }, seeded(7)));

  const n = parseNum(count);
  const err = n === null || !Number.isInteger(n) || n < 1 || n > LIMITS[kind] ? `Enter a whole number from 1 to ${LIMITS[kind]}.` : null;

  const generate = () => {
    if (err || n === null) return;
    setOutput(generateLorem(kind, n, { startWithLorem: start, html }));
  };

  const words = output.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <ToolPanel title="Generate placeholder text">
        <div className="space-y-5">
          <Segmented
            label="Generate"
            value={kind}
            onChange={setKind}
            options={[
              { value: "paragraphs", label: "Paragraphs" },
              { value: "sentences", label: "Sentences" },
              { value: "words", label: "Words" },
              { value: "list", label: "List items" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="How many" value={count} onChange={(e) => setCount(e.target.value)} error={err} />
            <div className="self-end pb-2">
              <Checkbox label='Start with "Lorem ipsum dolor sit amet"' checked={start} onChange={setStart} />
            </div>
            <div className="self-end pb-2">
              <Checkbox label="Wrap in HTML tags" hint="<p> for paragraphs, <ul><li> for lists." checked={html} onChange={setHtml} />
            </div>
          </div>
          <Btn icon="spark" onClick={generate} disabled={!!err}>
            Generate
          </Btn>
        </div>
      </ToolPanel>
      <ToolPanel
        title="Result"
        actions={
          <>
            <Btn variant="ghost" icon="download" disabled={!output} onClick={() => downloadFile(html ? "lorem.html" : "lorem.txt", output, html ? "text/html" : "text/plain")}>
              Download
            </Btn>
            <CopyBtn text={output} />
          </>
        }
      >
        <OutputBlock label="Generated text">
          <code className="whitespace-pre-wrap">{output}</code>
        </OutputBlock>
        <p className="mt-2 text-[0.8125rem] text-muted" aria-live="polite">
          {words.toLocaleString()} words · {output.length.toLocaleString()} characters
        </p>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
