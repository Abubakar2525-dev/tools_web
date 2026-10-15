"use client";

import { useMemo, useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, NumberField, PrivacyNote, ResetBtn, Segmented, StatGrid, TextArea, ToolPanel, downloadFile, parseNum } from "@/components/tools/kit";
import { UlidGenerator, UuidV7Generator, formatUuid, inspectId, uuidV4 } from "./lib/ids";

type Kind = "v4" | "v7" | "ulid";
const MAX = 10000;

export default function Tool() {
  const [kind, setKind] = useState<Kind>("v4");
  const [count, setCount] = useState("10");
  const [upper, setUpper] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [braces, setBraces] = useState(false);
  const [monotonic, setMonotonic] = useState(true);
  const [ids, setIds] = useState<string[]>([]);
  const [check, setCheck] = useState("");
  const [gens] = useState(() => ({ v7: new UuidV7Generator(), ulid: new UlidGenerator() }));

  const n = parseNum(count);
  const countErr = n === null || !Number.isInteger(n) || n < 1 || n > MAX ? `Enter a whole number from 1 to ${MAX.toLocaleString()}.` : null;

  const generate = () => {
    if (countErr || n === null) return;
    const out: string[] = new Array(n);
    for (let i = 0; i < n; i++) {
      if (kind === "v4") out[i] = formatUuid(uuidV4(), { upper, hyphens, braces });
      else if (kind === "v7") out[i] = formatUuid(gens.v7.next(Date.now(), monotonic), { upper, hyphens, braces });
      else {
        const u = gens.ulid.next(Date.now(), monotonic);
        out[i] = upper ? u : u.toLowerCase();
      }
    }
    setIds(out);
  };

  const text = ids.join("\n");
  const inspected = useMemo(
    () =>
      check
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 50)
        .map((l) => ({ raw: l, info: inspectId(l) })),
    [check],
  );

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Generate"
        actions={
          <ResetBtn
            onClick={() => {
              setIds([]);
              setCount("10");
            }}
          />
        }
      >
        <div className="space-y-5">
          <Segmented
            label="ID type"
            value={kind}
            onChange={(k) => {
              setKind(k);
              setUpper(k === "ulid");
            }}
            options={[
              { value: "v4", label: "UUID v4 (random)" },
              { value: "v7", label: "UUID v7 (time-ordered)" },
              { value: "ulid", label: "ULID" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="How many" value={count} error={countErr} hint={`Up to ${MAX.toLocaleString()}.`} onChange={(e) => setCount(e.target.value)} />
            <div className="space-y-3 pt-1 lg:col-span-3">
              <Checkbox label="Uppercase" checked={upper} onChange={setUpper} />
              {kind !== "ulid" && (
                <>
                  <Checkbox label="Include hyphens" checked={hyphens} onChange={setHyphens} />
                  <Checkbox label="Wrap in braces {…}" checked={braces} onChange={setBraces} />
                </>
              )}
              {kind !== "v4" && (
                <Checkbox label="Monotonic within the same millisecond" hint="IDs made in the same millisecond still sort in creation order." checked={monotonic} onChange={setMonotonic} />
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn icon="spark" onClick={generate} disabled={!!countErr}>
              Generate
            </Btn>
            <CopyBtn text={text} label="Copy all" />
            <Btn variant="ghost" icon="download" disabled={!ids.length} onClick={() => downloadFile(`${kind}-ids.txt`, text + "\n")}>
              Download .txt
            </Btn>
          </div>
          {ids.length === 0 ? (
            <EmptyState icon="hash" title="No IDs yet">
              Choose a type and press Generate. Everything uses your browser&apos;s cryptographic random generator.
            </EmptyState>
          ) : (
            <TextArea label={`${ids.length.toLocaleString()} generated IDs`} mono rows={Math.min(14, ids.length + 1)} readOnly value={text} />
          )}
        </div>
      </ToolPanel>

      <ToolPanel title="Validate and inspect" actions={<ResetBtn onClick={() => setCheck("")} label="Clear" />}>
        <div className="space-y-4">
          <TextArea label="IDs to check (one per line)" mono rows={4} placeholder="017f22e2-79b0-7cc3-98c4-dc0c0c07398f" value={check} onChange={(e) => setCheck(e.target.value)} />
          {inspected.length > 0 && (
            <ul className="space-y-3">
              {inspected.map(({ raw, info }, i) => (
                <li key={`${raw}-${i}`} className="rounded-lg bg-sunken p-4 text-sm">
                  <p className="break-all font-mono text-[0.85rem] text-ink">{raw}</p>
                  {info.valid ? (
                    <div className="mt-2 space-y-2">
                      <StatGrid
                        items={[
                          { label: "Type", value: info.kind === "ulid" ? "ULID" : info.version !== undefined ? `UUID v${info.version}` : "UUID" },
                          ...(info.variant ? [{ label: "Variant", value: info.variant }] : []),
                          ...(info.timestamp ? [{ label: "Timestamp (UTC)", value: info.timestamp.toISOString().replace("T", " ").replace("Z", "") }] : []),
                        ]}
                      />
                      {info.notes.map((n) => (
                        <p key={n} className="text-ink-2">
                          {n}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <Notice tone="error">{info.error}</Notice>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
