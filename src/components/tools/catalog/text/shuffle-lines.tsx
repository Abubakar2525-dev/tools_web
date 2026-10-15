"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, PrivacyNote, ResetBtn, SplitGrid, TextArea, ToolPanel, downloadFile } from "@/components/tools/kit";
import { newlineOf, shuffle, splitLines } from "./lib/lines";

const SAMPLE = "Alice\nBen\nChioma\nDiego\nEmi\nFarah\nGustav\nHana";

export default function Tool() {
  const [input, setInput] = useState("");
  const [ignoreEmpty, setIgnoreEmpty] = useState(true);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);

  const run = (text = input) => {
    let lines = splitLines(text);
    if (ignoreEmpty) lines = lines.filter((l) => l.trim() !== "");
    if (!text.trim() || lines.length === 0) {
      setError("Add at least one line to shuffle.");
      setOutput("");
      return;
    }
    setError(null);
    setOutput(shuffle(lines).join(newlineOf(text)));
    setRuns((r) => r + 1);
  };

  const count = output ? splitLines(output).length : 0;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Shuffle lines"
        actions={
          <>
            <Btn
              variant="ghost"
              icon="spark"
              onClick={() => {
                setInput(SAMPLE);
                run(SAMPLE);
              }}
            >
              Load sample
            </Btn>
            <ResetBtn
              onClick={() => {
                setInput("");
                setOutput("");
                setError(null);
                setRuns(0);
              }}
            />
          </>
        }
      >
        <SplitGrid>
          <div className="min-w-0 space-y-4">
            <TextArea
              label="Lines to shuffle"
              hint="One item per line."
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError(null);
              }}
              error={error}
              rows={12}
            />
            <Checkbox label="Drop empty lines" checked={ignoreEmpty} onChange={setIgnoreEmpty} />
            <Btn icon="reset" onClick={() => run()}>
              {runs ? "Shuffle again" : "Shuffle"}
            </Btn>
          </div>
          <div className="min-w-0 space-y-3">
            <TextArea label="Shuffled result" readOnly value={output} rows={12} placeholder="Press Shuffle to see the result." />
            <p className="text-[0.8125rem] text-muted" aria-live="polite">
              {output ? `${count.toLocaleString()} lines · shuffle #${runs}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyBtn text={output} />
              <Btn variant="ghost" icon="download" disabled={!output} onClick={() => downloadFile("shuffled.txt", output)}>
                Download
              </Btn>
            </div>
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
