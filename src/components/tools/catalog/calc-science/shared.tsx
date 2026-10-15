import { num, type FormulaOutput } from "@/components/tools/engines/FormulaTool";
import { fromBase, unitLabel, type Unit } from "./lib/units";

/** "12.5 km" from a base-unit value. */
export function inUnit(v: number, list: Unit[], unit: string, sig = 8): string {
  return `${num(fromBase(v, list, unit), sig)} ${unitLabel(list, unit)}`;
}

/** One output per unit, e.g. outputs for "Speed" in m/s, km/h, mph. */
export function unitOutputs(label: string, v: number, list: Unit[], units: string[]): FormulaOutput[] {
  return units.map((u) => ({ label: `${label} (${unitLabel(list, u)})`, value: num(fromBase(v, list, u), 8) }));
}

/** Short display with a unit label appended, skipping the label for "no unit". */
export function withU(n: number, u: string, sig = 8): string {
  return u ? `${num(n, sig)} ${u}` : num(n, sig);
}

export const deg = (rad: number) => (rad * 180) / Math.PI;

/** Accessible SVG figure: role="img" with a text alternative, scales to its box. */
export function Figure({
  label,
  viewBox,
  children,
  caption,
  maxHeight = 280,
}: {
  label: string;
  viewBox: string;
  children: React.ReactNode;
  caption?: string;
  maxHeight?: number;
}) {
  return (
    <figure className="rounded-xl bg-sunken p-3">
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={label}
        className="mx-auto block h-auto w-full"
        style={{ maxHeight }}
        preserveAspectRatio="xMidYMid meet"
      >
        {children}
      </svg>
      {caption && <figcaption className="mt-2 text-center text-[0.8125rem] text-muted">{caption}</figcaption>}
    </figure>
  );
}

export const stroke = { stroke: "var(--accent-strong)", strokeWidth: 2, fill: "color-mix(in oklch, var(--accent) 14%, transparent)" } as const;
export const textStyle = { fill: "var(--ink)", fontSize: 13, fontFamily: "var(--font-sans)" } as const;
export const mutedText = { fill: "var(--muted)", fontSize: 12, fontFamily: "var(--font-sans)" } as const;
