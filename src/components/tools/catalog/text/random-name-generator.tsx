"use client";

import { useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, NumberField, PrivacyNote, SelectField, ToolPanel, downloadFile, parseNum } from "@/components/tools/kit";
import { REGIONS, cryptoInt, generateNames, namesCsv, type GeneratedName, type Gender, type NameOptions } from "./lib/generators";

const GENDERS: { id: Gender; label: string }[] = [
  { id: "feminine", label: "Feminine" },
  { id: "masculine", label: "Masculine" },
  { id: "neutral", label: "Unisex" },
];

export default function Tool() {
  const [regions, setRegions] = useState<string[]>([]);
  const [genders, setGenders] = useState<Gender[]>(["feminine", "masculine", "neutral"]);
  const [format, setFormat] = useState<NameOptions["format"]>("full");
  const [mix, setMix] = useState(false);
  const [localOrder, setLocalOrder] = useState(false);
  const [count, setCount] = useState("10");
  const [names, setNames] = useState<GeneratedName[]>([]);

  const n = parseNum(count);
  const nErr = n === null || !Number.isInteger(n) || n < 1 || n > 200 ? "1 to 200" : null;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const generate = () => {
    if (nErr || !genders.length) return;
    setNames(generateNames(n as number, { regions, genders, format, mixRegions: mix, localOrder }, cryptoInt));
  };

  const list = names.map((x) => x.display).join("\n");

  return (
    <div className="space-y-5">
      <ToolPanel title="Name options">
        <div className="space-y-5">
          <fieldset>
            <legend className="text-sm font-medium">Name origins</legend>
            <p className="mt-1 text-[0.8125rem] text-muted">Leave all unchecked to draw from every list.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {REGIONS.map((r) => (
                <Checkbox key={r.id} label={r.label} checked={regions.includes(r.id)} onChange={() => setRegions((s) => toggle(s, r.id))} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">First name style</legend>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
              {GENDERS.map((g) => (
                <Checkbox key={g.id} label={g.label} checked={genders.includes(g.id)} onChange={() => setGenders((s) => toggle(s, g.id))} />
              ))}
            </div>
            {!genders.length && <p className="mt-2 text-sm text-danger" role="alert">Pick at least one style.</p>}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Format"
              value={format}
              onChange={(e) => setFormat(e.target.value as NameOptions["format"])}
              options={[
                { value: "full", label: "First and last" },
                { value: "full-middle", label: "First, middle and last" },
                { value: "first", label: "First name only" },
                { value: "last", label: "Last name only" },
              ]}
            />
            <NumberField label="How many" value={count} onChange={(e) => setCount(e.target.value)} error={nErr} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Checkbox label="Mix first and last names across origins" checked={mix} onChange={setMix} />
            <Checkbox label="Family name first where customary" hint="Chinese, Japanese and Korean names." checked={localOrder} onChange={setLocalOrder} />
          </div>
          <Btn icon="spark" onClick={generate} disabled={!!nErr || !genders.length}>
            {names.length ? "Generate again" : "Generate names"}
          </Btn>
        </div>
      </ToolPanel>
      <ToolPanel
        title="Names"
        actions={
          <>
            <Btn variant="ghost" icon="download" disabled={!names.length} onClick={() => downloadFile("names.csv", namesCsv(names), "text/csv")}>
              CSV
            </Btn>
            <CopyBtn text={list} label="Copy list" />
            <CopyBtn text={names.length ? namesCsv(names) : ""} label="Copy CSV" />
          </>
        }
      >
        {!names.length ? (
          <EmptyState icon="pen" title="No names yet">
            Choose origins and press Generate.
          </EmptyState>
        ) : (
          <>
            {names.length < (n ?? 0) && <Notice tone="warning">Only {names.length} distinct names were available with these filters.</Notice>}
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
              {names.map((x, i) => (
                <li key={`${x.display}-${i}`} className="rounded-lg bg-sunken px-3 py-2">
                  <span className="text-[0.95rem] text-ink">{x.display}</span>
                  <span className="block text-[0.8125rem] text-muted">{x.region}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-4 text-[0.8125rem] text-muted">
          Names come from built-in lists of common given and family names and are combined at random, so any match to a real person is a coincidence.
        </p>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
