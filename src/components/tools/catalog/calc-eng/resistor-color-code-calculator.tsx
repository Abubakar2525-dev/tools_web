"use client";

import { useMemo, useState } from "react";
import { CopyBtn, Notice, PrivacyNote, ResetBtn, ResultCard, Segmented, SelectField, StatGrid, TextField, ToolPanel } from "@/components/tools/kit";
import { DataTable, Figure } from "./ui";
import {
  colorForDigit,
  colorForExp,
  colorForTol,
  colorInfo,
  decodeBands,
  digitColors,
  encodeValue,
  formatOhms,
  multiplierColors,
  nearestStandard,
  parseOhms,
  tempcoColors,
  toleranceColors,
  type BandCount,
  type ColorInfo,
  type ColorName,
  type SeriesName,
} from "./lib/resistor";

type Mode = "decode" | "encode";

const DEFAULT_BANDS: Record<BandCount, ColorName[]> = {
  4: ["yellow", "violet", "red", "gold"],
  5: ["brown", "black", "black", "brown", "brown"],
  6: ["brown", "black", "black", "brown", "brown", "brown"],
};

function roleOf(i: number, count: BandCount): { label: string; options: ColorInfo[] } {
  const nDigits = count === 4 ? 2 : 3;
  if (i < nDigits) return { label: `Band ${i + 1}: digit ${i + 1}`, options: digitColors };
  if (i === nDigits) return { label: `Band ${i + 1}: multiplier`, options: multiplierColors };
  if (i === nDigits + 1) return { label: `Band ${i + 1}: tolerance`, options: toleranceColors };
  return { label: `Band ${i + 1}: temperature coefficient`, options: tempcoColors };
}

function describe(c: ColorInfo, role: string): string {
  if (role.includes("digit")) return String(c.digit);
  if (role.includes("multiplier")) return `×${formatMult(c.exp ?? 0)}`;
  if (role.includes("tolerance")) return `±${c.tol}%`;
  return `${c.tempco} ppm/K`;
}

function formatMult(exp: number) {
  const v = 10 ** exp;
  if (exp >= 9) return "1G";
  if (exp >= 6) return `${v / 1e6}M`;
  if (exp >= 3) return `${v / 1e3}k`;
  return String(Number(v.toPrecision(3)));
}

function ResistorDrawing({ bands, count }: { bands: ColorName[]; count: BandCount }) {
  const bodyX = 80,
    bodyW = 300;
  const n = bands.length;
  // Last band (tolerance or tempco group) sits apart from the value bands.
  const positions = bands.map((_, i) => {
    const valueBands = count === 4 ? 3 : 4;
    if (i < valueBands) return bodyX + 50 + i * 38;
    return bodyX + bodyW - 70 + (i - valueBands) * 30;
  });
  const roles = bands.map((_, i) => roleOf(i, count).label);
  const text = bands.map((b, i) => `${roles[i]}: ${colorInfo(b).label}`).join("; ");
  return (
    <Figure viewBox="0 0 460 170" title={`Resistor with ${n} bands`} desc={text}>
      <line x1={10} y1={70} x2={450} y2={70} className="stroke-muted" strokeWidth={5} strokeLinecap="round" />
      <rect x={bodyX} y={36} width={bodyW} height={68} rx={30} fill="#e7d3a8" stroke="#b39a68" strokeWidth={2} />
      {bands.map((b, i) => {
        const c = colorInfo(b);
        const x = positions[i];
        return (
          <g key={i}>
            {b === "none" ? (
              <rect x={x} y={38} width={16} height={64} fill="none" stroke="#9c8a63" strokeDasharray="3 3" />
            ) : (
              <rect x={x} y={37} width={16} height={66} fill={c.hex} stroke="rgba(0,0,0,0.25)" />
            )}
            <text x={x + 8} y={128} textAnchor="middle" className="fill-ink text-[12px] font-medium">
              {i + 1}
            </text>
            <text x={x + 8} y={146} textAnchor="middle" className="fill-ink-2 text-[10px]">
              {c.name === "none" ? "none" : c.label}
            </text>
          </g>
        );
      })}
      <text x={230} y={22} textAnchor="middle" className="fill-muted text-[11px]">
        Read from the end with bands grouped together; tolerance band sits apart
      </text>
    </Figure>
  );
}

const SERIES_LIST: SeriesName[] = ["E12", "E24", "E48", "E96"];

function StandardTable({ ohms }: { ohms: number }) {
  return (
    <DataTable
      caption="Nearest preferred values (IEC 60063)"
      columns={["Series", "Next lower", "Next higher", "Closest", "Error"]}
      rows={SERIES_LIST.map((s) => {
        const n = nearestStandard(ohms, s);
        const exact = Math.abs(n.errorPct) < 1e-9;
        return [s, formatOhms(n.below), formatOhms(n.above), exact ? `${formatOhms(n.nearest)} (exact)` : formatOhms(n.nearest), `${n.errorPct >= 0 ? "+" : ""}${n.errorPct.toFixed(2)}%`];
      })}
    />
  );
}

export default function Tool() {
  const [mode, setMode] = useState<Mode>("decode");
  const [count, setCount] = useState<BandCount>(4);
  const [bands, setBands] = useState<ColorName[]>(DEFAULT_BANDS[4]);
  const [valueStr, setValueStr] = useState("4.7k");
  const [tol, setTol] = useState("5");
  const [tempco, setTempco] = useState("brown");

  const changeCount = (c: BandCount) => {
    setCount(c);
    setBands(DEFAULT_BANDS[c]);
    if (c === 4 && !["5", "10", "20"].includes(tol)) setTol("5");
    if (c !== 4 && ["10", "20"].includes(tol)) setTol("1");
  };

  const decoded = useMemo(() => decodeBands(bands, count), [bands, count]);

  const encoded = useMemo(() => {
    const ohms = parseOhms(valueStr);
    if (ohms === null) return valueStr.trim() ? "Enter a value like 4.7k, 4k7, 220, 1M or 0.47." : null;
    const nDigits = count === 4 ? 2 : 3;
    const e = encodeValue(ohms, nDigits);
    if (typeof e === "string") return e;
    const tolColor = colorForTol(Number(tol)) ?? "gold";
    const bandList: ColorName[] = [...e.digits.map(colorForDigit), colorForExp(e.exp), tolColor];
    if (count === 6) bandList.push(tempco as ColorName);
    return { ohms, e, bandList };
  }, [valueStr, count, tol, tempco]);

  const shownBands = mode === "decode" ? bands : encoded && typeof encoded !== "string" ? encoded.bandList : null;
  const resultOhms = mode === "decode" ? (typeof decoded === "string" ? null : decoded.ohms) : encoded && typeof encoded !== "string" ? encoded.e.ohms : null;

  const copyText =
    mode === "decode" && typeof decoded !== "string"
      ? `${formatOhms(decoded.ohms)} ±${decoded.tolerance}%${decoded.tempco !== null ? `, ${decoded.tempco} ppm/K` : ""} (${bands.map((b) => colorInfo(b).label).join(", ")})`
      : shownBands
        ? `${formatOhms(resultOhms ?? 0)}: ${shownBands.map((b) => colorInfo(b).label).join(", ")}`
        : "";

  const reset = () => {
    setMode("decode");
    setCount(4);
    setBands(DEFAULT_BANDS[4]);
    setValueStr("4.7k");
    setTol("5");
    setTempco("brown");
  };

  const tolOptions = (count === 4 ? toleranceColors.filter((c) => (c.tol ?? 0) >= 5) : toleranceColors.filter((c) => c.name !== "none")).map((c) => ({
    value: String(c.tol),
    label: `±${c.tol}% (${c.label.replace(" (no band)", "")})`,
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <ToolPanel title="Inputs" actions={<ResetBtn onClick={reset} />}>
        <div className="space-y-5">
          <Segmented
            label="Direction"
            value={mode}
            onChange={setMode}
            options={[
              { value: "decode", label: "Colors to value" },
              { value: "encode", label: "Value to colors" },
            ]}
          />
          <Segmented
            label="Number of bands"
            value={String(count) as "4" | "5" | "6"}
            onChange={(v) => changeCount(Number(v) as BandCount)}
            options={[
              { value: "4", label: "4 bands" },
              { value: "5", label: "5 bands" },
              { value: "6", label: "6 bands" },
            ]}
          />
          {mode === "decode" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {bands.map((b, i) => {
                const role = roleOf(i, count);
                return (
                  <SelectField
                    key={`${count}-${i}`}
                    label={role.label}
                    value={b}
                    onChange={(e) => setBands((prev) => prev.map((x, j) => (j === i ? (e.target.value as ColorName) : x)))}
                    options={role.options.map((c) => ({ value: c.name, label: `${c.label.replace(" (no band)", "")}: ${describe(c, role.label)}` }))}
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Resistance"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                hint="Examples: 4.7k, 4k7, 220, 1M, 0.47"
                className="sm:col-span-2"
                error={typeof encoded === "string" ? encoded : null}
              />
              <SelectField label="Tolerance" value={tol} onChange={(e) => setTol(e.target.value)} options={tolOptions} />
              {count === 6 && (
                <SelectField
                  label="Temperature coefficient"
                  value={tempco}
                  onChange={(e) => setTempco(e.target.value)}
                  options={tempcoColors.map((c) => ({ value: c.name, label: `${c.tempco} ppm/K (${c.label})` }))}
                />
              )}
            </div>
          )}
        </div>
      </ToolPanel>

      <ToolPanel title="Result" actions={copyText ? <CopyBtn text={copyText} label="Copy result" /> : undefined}>
        <div className="space-y-5">
          {mode === "decode" && typeof decoded === "string" && <Notice tone="error">{decoded}</Notice>}
          {mode === "decode" && typeof decoded !== "string" && (
            <>
              <ResultCard label="Resistance" value={formatOhms(decoded.ohms)} detail={`±${decoded.tolerance}% tolerance`} />
              <StatGrid
                items={[
                  { label: "Minimum", value: formatOhms(decoded.min) },
                  { label: "Maximum", value: formatOhms(decoded.max) },
                  { label: "Digits × multiplier", value: `${decoded.digits.join("")} × ${formatMult(decoded.exp)}` },
                  ...(decoded.tempco !== null ? [{ label: "Temp. coefficient", value: `${decoded.tempco} ppm/K` }] : []),
                ]}
              />
            </>
          )}
          {mode === "encode" && encoded && typeof encoded !== "string" && (
            <>
              <ResultCard label="Bands" value={formatOhms(encoded.e.ohms)} detail={encoded.bandList.map((b) => colorInfo(b).label).join(" · ")} />
              {!encoded.e.exact && (
                <Notice tone="warning">
                  {formatOhms(encoded.ohms)} needs more significant digits than {count === 4 ? "two" : "three"} bands allow, so it was rounded to {formatOhms(encoded.e.ohms)}.
                </Notice>
              )}
            </>
          )}
          {shownBands && <ResistorDrawing bands={shownBands} count={count} />}
          {resultOhms !== null && resultOhms > 0 && <StandardTable ohms={resultOhms} />}
          {mode === "encode" && !encoded && <Notice>Enter a resistance to see its color bands.</Notice>}
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}
