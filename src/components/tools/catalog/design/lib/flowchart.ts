/** Flowchart model, layered auto-layout, text/JSON import and scene building (pure). */

import { arrowHead, estimateWidth, firstBaseline, wrap, type Scene, type SceneItem } from "./scene";

export type NodeType = "start" | "end" | "process" | "decision" | "io";
export type FNode = { id: string; type: NodeType; label: string; x: number; y: number };
export type FEdge = { id: string; from: string; to: string; label: string };
export type FDoc = { nodes: FNode[]; edges: FEdge[] };

export const NODE_TYPES: { value: NodeType; label: string }[] = [
  { value: "start", label: "Start" },
  { value: "process", label: "Process" },
  { value: "decision", label: "Decision" },
  { value: "io", label: "Input / output" },
  { value: "end", label: "End" },
];

export const TYPE_LABEL: Record<NodeType, string> = {
  start: "Start",
  end: "End",
  process: "Process",
  decision: "Decision",
  io: "Input / output",
};

export const STYLE: Record<NodeType, { fill: string; stroke: string; text: string }> = {
  start: { fill: "#d9f2e6", stroke: "#1f7a52", text: "#0f3d29" },
  end: { fill: "#fde2e1", stroke: "#b42318", text: "#5c120c" },
  process: { fill: "#ffffff", stroke: "#334155", text: "#0f172a" },
  decision: { fill: "#fff4d6", stroke: "#a15c07", text: "#4a2a03" },
  io: { fill: "#e3ecff", stroke: "#2f54c4", text: "#13265e" },
};

const FONT_SIZE = 14;

/** Width/height and wrapped lines for a node. */
export function nodeSize(n: Pick<FNode, "type" | "label">) {
  const isDec = n.type === "decision";
  const maxText = isDec ? 120 : 150;
  const lines = wrap(n.label || " ", maxText, FONT_SIZE, 500, 4);
  const textW = Math.max(...lines.map((l) => estimateWidth(l, FONT_SIZE, 500)));
  const textH = lines.length * FONT_SIZE * 1.3;
  if (isDec) {
    const w = Math.max(150, textW * 1.7 + 30);
    const h = Math.max(90, textH * 1.8 + 24);
    return { w, h, lines };
  }
  const padX = n.type === "io" ? 44 : 28;
  return { w: Math.max(140, Math.min(220, textW + padX)), h: Math.max(56, textH + 26), lines };
}

/** Point on the node outline in the direction of (tx, ty). */
export function borderPoint(n: FNode, tx: number, ty: number) {
  const { w, h } = nodeSize(n);
  const dx = tx - n.x;
  const dy = ty - n.y;
  if (dx === 0 && dy === 0) return { x: n.x, y: n.y };
  const hw = w / 2;
  const hh = h / 2;
  let t: number;
  if (n.type === "decision") t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  else t = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy));
  return { x: n.x + dx * t, y: n.y + dy * t };
}

export function edgeGeometry(doc: FDoc, e: FEdge) {
  const a = doc.nodes.find((n) => n.id === e.from);
  const b = doc.nodes.find((n) => n.id === e.to);
  if (!a || !b) return null;
  // Offset two-way edges so they don't overlap.
  const reverse = doc.edges.some((o) => o.from === e.to && o.to === e.from);
  let ox = 0;
  let oy = 0;
  if (reverse) {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    ox = (-(b.y - a.y) / len) * 8;
    oy = ((b.x - a.x) / len) * 8;
  }
  const p1 = borderPoint({ ...a, x: a.x + ox, y: a.y + oy }, b.x + ox, b.y + oy);
  const p2 = borderPoint({ ...b, x: b.x + ox, y: b.y + oy }, a.x + ox, a.y + oy);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 };
}

/** Outline shape items for one node (no text). */
export function nodeShape(n: FNode, stroke: string, strokeWidth = 1.6, fill?: string): SceneItem {
  const { w, h } = nodeSize(n);
  const s = STYLE[n.type];
  const f = fill ?? s.fill;
  const x = n.x - w / 2;
  const y = n.y - h / 2;
  switch (n.type) {
    case "start":
    case "end":
      return { kind: "rect", x, y, w, h, rx: h / 2, fill: f, stroke, strokeWidth };
    case "process":
      return { kind: "rect", x, y, w, h, rx: 6, fill: f, stroke, strokeWidth };
    case "decision":
      return {
        kind: "polygon",
        points: [
          [n.x, y],
          [x + w, n.y],
          [n.x, y + h],
          [x, n.y],
        ],
        fill: f,
        stroke,
        strokeWidth,
      };
    case "io": {
      const sk = 16;
      return {
        kind: "polygon",
        points: [
          [x + sk, y],
          [x + w, y],
          [x + w - sk, y + h],
          [x, y + h],
        ],
        fill: f,
        stroke,
        strokeWidth,
      };
    }
  }
}

export function flowScene(doc: FDoc, title = "Flowchart"): Scene {
  const items: SceneItem[] = [];
  const PAD = 40;
  const size = canvasSize(doc, PAD);
  for (const e of doc.edges) {
    const g = edgeGeometry(doc, e);
    if (!g) continue;
    items.push({ kind: "line", x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, stroke: "#475569", strokeWidth: 1.6 });
    items.push({ kind: "polygon", points: arrowHead(g.x1, g.y1, g.x2, g.y2, 11), fill: "#475569" });
  }
  for (const e of doc.edges) {
    const g = edgeGeometry(doc, e);
    if (!g || !e.label.trim()) continue;
    const lines = wrap(e.label, 120, 12, 500, 2);
    const w = Math.max(...lines.map((l) => estimateWidth(l, 12, 500))) + 12;
    const h = lines.length * 15.6 + 6;
    items.push({ kind: "rect", x: g.mx - w / 2, y: g.my - h / 2, w, h, rx: 4, fill: "#ffffff", stroke: "#cbd5e1", strokeWidth: 1 });
    items.push({ kind: "text", x: g.mx, y: firstBaseline(g.my, lines.length, 12, 15.6), lines, size: 12, weight: 500, fill: "#334155", anchor: "middle", lineHeight: 15.6 });
  }
  for (const n of doc.nodes) {
    const s = STYLE[n.type];
    items.push(nodeShape(n, s.stroke));
    const { lines } = nodeSize(n);
    items.push({ kind: "text", x: n.x, y: firstBaseline(n.y, lines.length, FONT_SIZE), lines, size: FONT_SIZE, weight: 500, fill: s.text, anchor: "middle" });
  }
  return { width: size.w, height: size.h, background: "#ffffff", title, desc: describe(doc), items };
}

/** Plain-language description of the chart (text alternative). */
export function describe(doc: FDoc) {
  if (!doc.nodes.length) return "Empty flowchart.";
  const name = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? "?";
  const steps = doc.nodes.map((n) => `${TYPE_LABEL[n.type]}: ${n.label}`).join("; ");
  const links = doc.edges.map((e) => `${name(e.from)} to ${name(e.to)}${e.label ? ` (${e.label})` : ""}`).join("; ");
  return `Flowchart with ${doc.nodes.length} steps and ${doc.edges.length} connectors. Steps: ${steps}.${links ? ` Connectors: ${links}.` : ""}`;
}

/** Canvas big enough for all nodes (nodes never go above/left of 0 after clampPositions). */
export function canvasSize(doc: FDoc, pad = 40) {
  let w = 640;
  let h = 420;
  for (const n of doc.nodes) {
    const s = nodeSize(n);
    w = Math.max(w, n.x + s.w / 2 + pad);
    h = Math.max(h, n.y + s.h / 2 + pad);
  }
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

/** Keeps every node fully inside the positive canvas area. */
export function clampPosition(n: FNode, x: number, y: number) {
  const s = nodeSize(n);
  return { x: Math.max(s.w / 2 + 10, Math.round(x)), y: Math.max(s.h / 2 + 10, Math.round(y)) };
}

/* ------------------------------------------------------------------ */
/* Layered (top-down) auto layout                                      */
/* ------------------------------------------------------------------ */

export function autoLayout(doc: FDoc, opts: { gapX?: number; gapY?: number; pad?: number } = {}): FDoc {
  const gapX = opts.gapX ?? 50;
  const gapY = opts.gapY ?? 70;
  const pad = opts.pad ?? 40;
  const ids = doc.nodes.map((n) => n.id);
  if (!ids.length) return doc;
  const out = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of doc.edges) if (out.has(e.from) && out.has(e.to) && e.from !== e.to) out.get(e.from)!.push(e.to);

  // 1. Remove cycles: DFS, ignore back edges. Prefer start nodes as roots.
  const order = [...doc.nodes].sort((a, b) => (a.type === "start" ? -1 : 0) - (b.type === "start" ? -1 : 0)).map((n) => n.id);
  const state = new Map<string, 0 | 1 | 2>();
  const dag = new Map<string, string[]>(ids.map((i) => [i, []]));
  const visit = (u: string) => {
    state.set(u, 1);
    for (const v of out.get(u)!) {
      const s = state.get(v) ?? 0;
      if (s === 1) continue; // back edge
      dag.get(u)!.push(v);
      if (s === 0) visit(v);
    }
    state.set(u, 2);
  };
  for (const u of order) if (!state.get(u)) visit(u);

  // 2. Longest-path ranks.
  const indeg = new Map<string, number>(ids.map((i) => [i, 0]));
  for (const [, vs] of dag) for (const v of vs) indeg.set(v, (indeg.get(v) ?? 0) + 1);
  const rank = new Map<string, number>(ids.map((i) => [i, 0]));
  const queue = ids.filter((i) => indeg.get(i) === 0);
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of dag.get(u)!) {
      rank.set(v, Math.max(rank.get(v)!, rank.get(u)! + 1));
      indeg.set(v, indeg.get(v)! - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  // End nodes sink to the bottom-most rank.
  const maxRank = Math.max(...rank.values());
  for (const n of doc.nodes) if (n.type === "end" && dag.get(n.id)!.length === 0) rank.set(n.id, Math.max(rank.get(n.id)!, maxRank));

  // 3. Layers, ordered by barycenter sweeps.
  const R = Math.max(...rank.values());
  const layers: string[][] = Array.from({ length: R + 1 }, () => []);
  for (const id of order) layers[rank.get(id)!].push(id);
  const preds = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const [u, vs] of dag) for (const v of vs) preds.get(v)!.push(u);
  const posIn = () => {
    const m = new Map<string, number>();
    layers.forEach((l) => l.forEach((id, i) => m.set(id, i)));
    return m;
  };
  for (let sweep = 0; sweep < 6; sweep++) {
    const down = sweep % 2 === 0;
    const pos = posIn();
    const range = down ? layers.map((_, i) => i).slice(1) : layers.map((_, i) => i).slice(0, -1).reverse();
    for (const li of range) {
      const bary = (id: string) => {
        const nb = down ? preds.get(id)! : dag.get(id)!;
        if (!nb.length) return pos.get(id)!;
        return nb.reduce((s, x) => s + pos.get(x)!, 0) / nb.length;
      };
      layers[li] = [...layers[li]].map((id) => ({ id, b: bary(id) })).sort((a, b) => a.b - b.b).map((x) => x.id);
    }
  }

  // 4. Coordinates: each layer centered on the widest one.
  const size = new Map(doc.nodes.map((n) => [n.id, nodeSize(n)]));
  const widths = layers.map((l) => l.reduce((s, id) => s + size.get(id)!.w, 0) + gapX * Math.max(0, l.length - 1));
  const maxW = Math.max(...widths);
  const heights = layers.map((l) => Math.max(0, ...l.map((id) => size.get(id)!.h)));
  const pos = new Map<string, { x: number; y: number }>();
  let y = pad;
  layers.forEach((l, li) => {
    let x = pad + (maxW - widths[li]) / 2;
    const cy = y + heights[li] / 2;
    for (const id of l) {
      const s = size.get(id)!;
      pos.set(id, { x: Math.round(x + s.w / 2), y: Math.round(cy) });
      x += s.w + gapX;
    }
    y += heights[li] + gapY;
  });
  return { ...doc, nodes: doc.nodes.map((n) => ({ ...n, ...pos.get(n.id)! })) };
}

/* ------------------------------------------------------------------ */
/* Text outline and JSON                                               */
/* ------------------------------------------------------------------ */

const TYPE_ALIASES: Record<string, NodeType> = {
  start: "start",
  begin: "start",
  end: "end",
  stop: "end",
  process: "process",
  step: "process",
  decision: "decision",
  if: "decision",
  io: "io",
  input: "io",
  output: "io",
  data: "io",
};

/**
 * Parses the text outline format:
 *   [start] Begin
 *   [decision] In stock?
 *   Begin -> In stock?
 *   In stock? -> Ship order : Yes
 * Plain lines become process steps; unknown names in connectors are created.
 */
export function parseFlowText(text: string, makeId: () => string): { doc: FDoc; errors: string[] } {
  const nodes: FNode[] = [];
  const edges: FEdge[] = [];
  const errors: string[] = [];
  const byLabel = new Map<string, FNode>();
  const ensure = (label: string, type: NodeType = "process") => {
    const key = label.trim();
    let n = byLabel.get(key);
    if (!n) {
      n = { id: makeId(), type, label: key, x: 0, y: 0 };
      byLabel.set(key, n);
      nodes.push(n);
    }
    return n;
  };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) return;
    const arrow = line.indexOf("->");
    if (arrow >= 0) {
      const left = line.slice(0, arrow).trim();
      let right = line.slice(arrow + 2).trim();
      let label = "";
      const colon = right.indexOf(":");
      if (colon >= 0) {
        label = right.slice(colon + 1).trim();
        right = right.slice(0, colon).trim();
      }
      if (!left || !right) {
        errors.push(`Line ${i + 1}: a connector needs a step name on both sides of "->".`);
        return;
      }
      const a = ensure(stripType(left).label, stripType(left).type);
      const b = ensure(stripType(right).label, stripType(right).type);
      if (a === b) {
        errors.push(`Line ${i + 1}: a step cannot connect to itself.`);
        return;
      }
      edges.push({ id: makeId(), from: a.id, to: b.id, label });
      return;
    }
    const { label, type, explicit } = stripType(line);
    if (!label) {
      errors.push(`Line ${i + 1}: missing step text.`);
      return;
    }
    const n = ensure(label, type);
    if (explicit) n.type = type;
  });
  return { doc: { nodes, edges }, errors };
}

function stripType(s: string): { label: string; type: NodeType; explicit: boolean } {
  const m = /^\[([a-z/ ]+)\]\s*(.*)$/i.exec(s.trim());
  if (m) {
    const t = TYPE_ALIASES[m[1].toLowerCase().replace(/[\s/]+/g, "")] ?? TYPE_ALIASES[m[1].toLowerCase().split(/[\s/]/)[0]];
    if (t) return { label: m[2].trim(), type: t, explicit: true };
  }
  return { label: s.trim(), type: "process", explicit: false };
}

export function docToText(doc: FDoc) {
  const name = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? "";
  const lines = doc.nodes.map((n) => `[${n.type}] ${n.label}`);
  if (doc.edges.length) lines.push("");
  for (const e of doc.edges) lines.push(`${name(e.from)} -> ${name(e.to)}${e.label ? ` : ${e.label}` : ""}`);
  return lines.join("\n");
}

/** Validates JSON in the export format. Missing positions are flagged for auto-layout. */
export function parseFlowJson(text: string, makeId: () => string): { doc: FDoc; needsLayout: boolean } | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return "That is not valid JSON.";
  }
  if (!data || typeof data !== "object") return "Expected an object with nodes and edges.";
  const d = data as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(d.nodes)) return "Missing a nodes array.";
  const nodes: FNode[] = [];
  let needsLayout = false;
  const idMap = new Map<string, string>();
  for (const raw of d.nodes) {
    if (!raw || typeof raw !== "object") return "Each node must be an object.";
    const r = raw as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label : "";
    const type = typeof r.type === "string" && r.type in STYLE ? (r.type as NodeType) : "process";
    const oldId = typeof r.id === "string" || typeof r.id === "number" ? String(r.id) : makeId();
    const id = makeId();
    idMap.set(oldId, id);
    const x = typeof r.x === "number" && Number.isFinite(r.x) ? r.x : NaN;
    const y = typeof r.y === "number" && Number.isFinite(r.y) ? r.y : NaN;
    if (Number.isNaN(x) || Number.isNaN(y)) needsLayout = true;
    nodes.push({ id, type, label: label.slice(0, 200), x: Number.isNaN(x) ? 0 : x, y: Number.isNaN(y) ? 0 : y });
  }
  const edges: FEdge[] = [];
  if (Array.isArray(d.edges)) {
    for (const raw of d.edges) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const from = idMap.get(String(r.from));
      const to = idMap.get(String(r.to));
      if (!from || !to || from === to) continue;
      edges.push({ id: makeId(), from, to, label: typeof r.label === "string" ? r.label.slice(0, 120) : "" });
    }
  }
  const doc = { nodes, edges };
  return { doc: { ...doc, nodes: doc.nodes.map((n) => ({ ...n, ...clampPosition(n, n.x, n.y) })) }, needsLayout };
}

export function docToJson(doc: FDoc) {
  return JSON.stringify(
    {
      nodes: doc.nodes.map(({ id, type, label, x, y }) => ({ id, type, label, x, y })),
      edges: doc.edges.map(({ from, to, label }) => ({ from, to, label })),
    },
    null,
    2,
  );
}
