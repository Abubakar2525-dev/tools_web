/** Timeline model, date handling and vertical/horizontal scene layouts (pure). */

import { wrap, type Scene, type SceneItem } from "./scene";

export type TEvent = { id: string; date: string; title: string; description: string; color: string };
export type TimelineOpts = {
  title: string;
  layout: "vertical" | "horizontal";
  spacing: "even" | "proportional";
  alternate: boolean;
  dateStyle: "long" | "short" | "iso";
};

export const EVENT_COLORS = [
  { value: "#0f766e", label: "Teal" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#6d28d9", label: "Violet" },
  { value: "#be185d", label: "Pink" },
  { value: "#c2410c", label: "Orange" },
  { value: "#4d7c0f", label: "Green" },
  { value: "#334155", label: "Slate" },
];

/** Accepts YYYY, YYYY-MM or YYYY-MM-DD (years 1-9999). Returns UTC ms or null. */
export function parseDate(s: string): { t: number; precision: "year" | "month" | "day" } | null {
  const m = /^(\d{1,4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = m[2] ? Number(m[2]) : 1;
  const d = m[3] ? Number(m[3]) : 1;
  if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(2000, mo - 1, d));
  dt.setUTCFullYear(y);
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { t: dt.getTime(), precision: m[3] ? "day" : m[2] ? "month" : "year" };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDate(s: string, style: TimelineOpts["dateStyle"]): string {
  const p = parseDate(s);
  if (!p) return s;
  const d = new Date(p.t);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  if (style === "iso") return s.trim();
  const mName = style === "long" ? MONTHS[mo] : MONTHS[mo].slice(0, 3);
  if (p.precision === "year") return String(y);
  if (p.precision === "month") return `${mName} ${y}`;
  return `${mName} ${day}, ${y}`;
}

export function sortEvents(events: TEvent[]) {
  return [...events]
    .map((e, i) => ({ e, i, t: parseDate(e.date)?.t ?? Infinity }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.e);
}

type Card = { e: TEvent; date: string; titleLines: string[]; descLines: string[]; w: number; h: number };

function card(e: TEvent, width: number, style: TimelineOpts["dateStyle"]): Card {
  const inner = width - 28;
  const titleLines = wrap(e.title || "Untitled", inner, 15, 600, 3);
  const descLines = e.description.trim() ? wrap(e.description, inner, 13, 400, 8) : [];
  const h = 14 + 16 + 6 + titleLines.length * 19.5 + (descLines.length ? 6 + descLines.length * 17.5 : 0) + 14;
  return { e, date: formatDate(e.date, style), titleLines, descLines, w: width, h };
}

function cardItems(c: Card, x: number, y: number): SceneItem[] {
  const items: SceneItem[] = [
    { kind: "rect", x, y, w: c.w, h: c.h, rx: 10, fill: "#ffffff", stroke: "#e2e8f0", strokeWidth: 1 },
    { kind: "rect", x, y: y + 10, w: 4, h: c.h - 20, rx: 2, fill: c.e.color },
    { kind: "text", x: x + 16, y: y + 14 + 12, lines: [c.date], size: 12.5, weight: 700, fill: c.e.color },
    { kind: "text", x: x + 16, y: y + 14 + 16 + 6 + 15, lines: c.titleLines, size: 15, weight: 600, fill: "#0f172a", lineHeight: 19.5 },
  ];
  if (c.descLines.length) {
    items.push({
      kind: "text",
      x: x + 16,
      y: y + 14 + 16 + 6 + c.titleLines.length * 19.5 + 6 + 13,
      lines: c.descLines,
      size: 13,
      fill: "#475569",
      lineHeight: 17.5,
    });
  }
  return items;
}

function describe(events: TEvent[], o: TimelineOpts) {
  if (!events.length) return "Empty timeline.";
  return `${o.title || "Timeline"}: ${events.map((e) => `${formatDate(e.date, "long")}, ${e.title}${e.description ? ` (${e.description})` : ""}`).join("; ")}.`;
}

/** Converts timestamps to positions keeping order, with at least `minGap` between items. */
function positions(ts: number[], start: number, span: number, spacing: TimelineOpts["spacing"], minGap: number[]) {
  const out: number[] = [];
  const finite = ts.filter(Number.isFinite);
  const t0 = Math.min(...finite);
  const t1 = Math.max(...finite);
  ts.forEach((t, i) => {
    let p: number;
    if (spacing === "proportional" && Number.isFinite(t) && t1 > t0) p = start + ((t - t0) / (t1 - t0)) * span;
    else p = i === 0 ? start : out[i - 1] + minGap[i - 1];
    if (i > 0) p = Math.max(p, out[i - 1] + minGap[i - 1]);
    out.push(p);
  });
  return out;
}

export function timelineScene(raw: TEvent[], o: TimelineOpts): Scene {
  const events = sortEvents(raw).filter((e) => e.title.trim() || e.date.trim());
  const items: SceneItem[] = [];
  const titleH = o.title.trim() ? 56 : 16;
  const ts = events.map((e) => parseDate(e.date)?.t ?? NaN);

  if (o.layout === "vertical") {
    const W = o.alternate ? 860 : 620;
    const axisX = o.alternate ? W / 2 : 120;
    const cardW = o.alternate ? W / 2 - 56 : W - axisX - 64;
    const cards = events.map((e) => card(e, cardW, o.dateStyle));
    const gaps = cards.map((c, i) => {
      if (!o.alternate) return c.h + 22;
      const next = cards[i + 1];
      // Alternating cards may overlap vertically with the opposite side.
      return next ? Math.max(48, Math.min(c.h, next.h) * 0.55 + 22) : c.h;
    });
    const span = Math.max(cards.length * 90, 400);
    const ys = positions(ts.map((t) => (Number.isFinite(t) ? t : Infinity)), titleH + 24, span, o.spacing, gaps);
    // Make sure same-side cards never overlap.
    if (o.alternate) {
      for (let i = 2; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 2] + cards[i - 2].h + 22);
      for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + 40);
    }
    const H = (cards.length ? Math.max(...cards.map((c, i) => ys[i] + c.h)) : titleH + 80) + 32;
    items.push({ kind: "line", x1: axisX, y1: titleH + 8, x2: axisX, y2: H - 16, stroke: "#cbd5e1", strokeWidth: 3 });
    cards.forEach((c, i) => {
      const left = o.alternate && i % 2 === 1;
      const x = o.alternate ? (left ? axisX - 28 - c.w : axisX + 28) : axisX + 32;
      const dotY = ys[i] + 26;
      items.push({ kind: "line", x1: axisX, y1: dotY, x2: left ? x + c.w : x, y2: dotY, stroke: c.e.color, strokeWidth: 1.5 });
      items.push(...cardItems(c, x, ys[i]));
      items.push({ kind: "circle", cx: axisX, cy: dotY, r: 8, fill: c.e.color, stroke: "#ffffff", strokeWidth: 3 });
      if (!o.alternate) {
        items.push({ kind: "text", x: axisX - 18, y: dotY + 4, lines: [shortLabel(c.e.date)], size: 12, weight: 600, fill: "#475569", anchor: "end" });
      }
    });
    if (o.title.trim()) items.push({ kind: "text", x: 24, y: 38, lines: [o.title.trim()], size: 22, weight: 700, fill: "#0f172a" });
    return { width: W, height: H, background: "#f8fafc", title: o.title || "Timeline", desc: describe(events, o), items };
  }

  // Horizontal
  const cardW = 220;
  const cards = events.map((e) => card(e, cardW, o.dateStyle));
  const step = o.alternate ? cardW / 2 + 24 : cardW + 24;
  const gaps = cards.map(() => step);
  const span = Math.max((cards.length - 1) * step, 0);
  const xs = positions(ts.map((t) => (Number.isFinite(t) ? t : Infinity)), 40 + cardW / 2, span, o.spacing, gaps);
  if (o.alternate) for (let i = 2; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 2] + cardW + 24);
  const maxAbove = Math.max(0, ...cards.filter((_, i) => !o.alternate || i % 2 === 0).map((c) => c.h));
  const maxBelow = o.alternate ? Math.max(0, ...cards.filter((_, i) => i % 2 === 1).map((c) => c.h)) : 0;
  const axisY = titleH + 24 + maxAbove + 40;
  const W = Math.max(600, (xs.length ? xs[xs.length - 1] : 0) + cardW / 2 + 40);
  const H = axisY + (o.alternate ? 40 + maxBelow + 32 : 64);
  items.push({ kind: "line", x1: 20, y1: axisY, x2: W - 20, y2: axisY, stroke: "#cbd5e1", strokeWidth: 3 });
  cards.forEach((c, i) => {
    const below = o.alternate && i % 2 === 1;
    const cx = xs[i];
    const y = below ? axisY + 40 : axisY - 40 - c.h;
    items.push({ kind: "line", x1: cx, y1: axisY, x2: cx, y2: below ? y : y + c.h, stroke: c.e.color, strokeWidth: 1.5 });
    items.push(...cardItems(c, cx - c.w / 2, y));
    items.push({ kind: "circle", cx, cy: axisY, r: 8, fill: c.e.color, stroke: "#ffffff", strokeWidth: 3 });
    if (!o.alternate) items.push({ kind: "text", x: cx, y: axisY + 30, lines: [shortLabel(c.e.date)], size: 12, weight: 600, fill: "#475569", anchor: "middle" });
  });
  if (o.title.trim()) items.push({ kind: "text", x: 24, y: 38, lines: [o.title.trim()], size: 22, weight: 700, fill: "#0f172a" });
  return { width: W, height: H, background: "#f8fafc", title: o.title || "Timeline", desc: describe(events, o), items };
}

function shortLabel(date: string) {
  const p = parseDate(date);
  if (!p) return date.slice(0, 10);
  return String(new Date(p.t).getUTCFullYear());
}
