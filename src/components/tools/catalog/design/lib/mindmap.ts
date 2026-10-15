/** Outline-driven mind map: parsing, tidy horizontal and radial layouts, scene building (pure). */

import { bounds, estimateWidth, firstBaseline, translate, wrap, type Scene, type SceneItem } from "./scene";

export type MNode = { id: string; label: string; children: MNode[] };

/** Branch colors, each with ≥ 4.5:1 contrast against white text. */
export const BRANCH_COLORS = ["#0f766e", "#6d28d9", "#c2410c", "#be185d", "#1d4ed8", "#4d7c0f", "#a16207", "#0e7490"];

const BULLET = /^(?:[-*+•]\s+|\d+[.)]\s+)/;

/**
 * Parses an indented outline. The first line is the central topic; deeper
 * indentation makes children. Tabs count as 4 spaces. Leading bullets ("- ",
 * "* ", "1. ") and Markdown heading marks ("## ") are stripped; heading level
 * also sets depth.
 */
export function parseOutline(text: string): MNode | null {
  const rows: { indent: number; label: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const ws = /^[\t ]*/.exec(raw)![0];
    let indent = 0;
    for (const ch of ws) indent += ch === "\t" ? 4 : 1;
    let label = raw.trim();
    const h = /^(#{1,6})\s+(.*)$/.exec(label);
    if (h) {
      indent += (h[1].length - 1) * 100;
      label = h[2];
    }
    label = label.replace(BULLET, "").trim();
    if (label) rows.push({ indent, label: label.slice(0, 160) });
  }
  if (!rows.length) return null;
  const root: MNode = { id: "0", label: rows[0].label, children: [] };
  const stack: { indent: number; node: MNode }[] = [{ indent: rows[0].indent, node: root }];
  for (const r of rows.slice(1)) {
    while (stack.length > 1 && stack[stack.length - 1].indent >= r.indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    const node: MNode = { id: `${parent.id}.${parent.children.length}`, label: r.label, children: [] };
    parent.children.push(node);
    stack.push({ indent: Math.max(r.indent, stack[stack.length - 1].indent + 1), node });
  }
  return root;
}

export function treeToOutline(n: MNode, depth = 0): string {
  return [`${"  ".repeat(depth)}${depth === 0 ? "" : "- "}${n.label}`, ...n.children.map((c) => treeToOutline(c, depth + 1))].join("\n");
}

export function countNodes(n: MNode): number {
  return 1 + n.children.reduce((s, c) => s + countNodes(c), 0);
}

export function allIds(n: MNode, out: string[] = []): string[] {
  out.push(n.id);
  n.children.forEach((c) => allIds(c, out));
  return out;
}

export type Placed = {
  id: string;
  label: string;
  lines: string[];
  x: number; // center
  y: number; // center
  w: number;
  h: number;
  depth: number;
  branch: number;
  childCount: number;
  hiddenCount: number;
  collapsed: boolean;
  parentId: string | null;
};

function measure(label: string, depth: number) {
  const size = depth === 0 ? 17 : depth === 1 ? 15 : 14;
  const weight = depth <= 1 ? 600 : 400;
  const lines = wrap(label, depth === 0 ? 200 : 170, size, weight, 3);
  const w = Math.max(...lines.map((l) => estimateWidth(l, size, weight))) + (depth === 0 ? 36 : 24);
  const h = lines.length * size * 1.3 + (depth === 0 ? 22 : 16);
  return { lines, w: Math.max(depth === 0 ? 110 : 60, w), h, size, weight };
}

type Visible = { node: MNode; depth: number; branch: number; parent: Visible | null; kids: Visible[]; hidden: number; collapsed: boolean };

function visibleTree(root: MNode, collapsed: Set<string>) {
  const build = (n: MNode, depth: number, branch: number, parent: Visible | null): Visible => {
    const isCollapsed = collapsed.has(n.id) && n.children.length > 0;
    const v: Visible = { node: n, depth, branch, parent, kids: [], hidden: isCollapsed ? countNodes(n) - 1 : 0, collapsed: isCollapsed };
    if (!isCollapsed) v.kids = n.children.map((c, i) => build(c, depth + 1, depth === 0 ? i : branch, v));
    return v;
  };
  return build(root, 0, -1, null);
}

function flatten(v: Visible, out: Visible[] = []) {
  out.push(v);
  v.kids.forEach((k) => flatten(k, out));
  return out;
}

function toPlaced(v: Visible, x: number, y: number, m: ReturnType<typeof measure>): Placed {
  return {
    id: v.node.id,
    label: v.node.label,
    lines: m.lines,
    x,
    y,
    w: m.w,
    h: m.h,
    depth: v.depth,
    branch: v.branch,
    childCount: v.node.children.length,
    hiddenCount: v.hidden,
    collapsed: v.collapsed,
    parentId: v.parent?.node.id ?? null,
  };
}

export type MindLayout = { nodes: Placed[]; width: number; height: number; mode: "horizontal" | "radial" };

/** Root on the left, branches to the right; leaves get one row each. */
export function layoutHorizontal(root: MNode, collapsed: Set<string>): MindLayout {
  const tree = visibleTree(root, collapsed);
  const all = flatten(tree);
  const ms = new Map(all.map((v) => [v, measure(v.node.label, v.depth)]));
  const maxDepth = Math.max(...all.map((v) => v.depth));
  const colW: number[] = Array.from({ length: maxDepth + 1 }, (_, d) => Math.max(...all.filter((v) => v.depth === d).map((v) => ms.get(v)!.w)));
  const colX: number[] = [];
  let x = 0;
  for (let d = 0; d <= maxDepth; d++) {
    colX.push(x);
    x += colW[d] + 56;
  }
  const GAP = 12;
  let cursor = 0;
  const yOf = new Map<Visible, number>();
  const place = (v: Visible): void => {
    if (!v.kids.length) {
      const h = ms.get(v)!.h;
      yOf.set(v, cursor + h / 2);
      cursor += h + GAP;
      return;
    }
    v.kids.forEach(place);
    const first = yOf.get(v.kids[0])!;
    const last = yOf.get(v.kids[v.kids.length - 1])!;
    yOf.set(v, (first + last) / 2);
  };
  place(tree);
  const nodes = all.map((v) => {
    const m = ms.get(v)!;
    return toPlaced(v, colX[v.depth] + m.w / 2, yOf.get(v)!, m);
  });
  return normalize(nodes, "horizontal");
}

/** Root in the middle; each subtree gets an angular wedge proportional to its leaf count. */
export function layoutRadial(root: MNode, collapsed: Set<string>): MindLayout {
  const tree = visibleTree(root, collapsed);
  const all = flatten(tree);
  const ms = new Map(all.map((v) => [v, measure(v.node.label, v.depth)]));
  const leaves = new Map<Visible, number>();
  const countLeaves = (v: Visible): number => {
    const c = v.kids.length ? v.kids.reduce((s, k) => s + countLeaves(k), 0) : 1;
    leaves.set(v, c);
    return c;
  };
  countLeaves(tree);
  const maxW = Math.max(...all.map((v) => ms.get(v)!.w));
  const maxDepth = Math.max(1, ...all.map((v) => v.depth));
  const total = leaves.get(tree)!;
  // Ring spacing: wide enough for the widest label, and the outer ring long enough for ~56px per leaf.
  const ring = Math.max(160, maxW * 0.75 + 40, (total * 56) / (2 * Math.PI * maxDepth));
  const nodes: Placed[] = [];
  const radiusFor = (d: number) => d * ring;
  const place = (v: Visible, a0: number, a1: number) => {
    const m = ms.get(v)!;
    const mid = (a0 + a1) / 2;
    const r = radiusFor(v.depth);
    nodes.push(toPlaced(v, r * Math.cos(mid), r * Math.sin(mid), m));
    let a = a0;
    for (const k of v.kids) {
      const span = ((a1 - a0) * leaves.get(k)!) / leaves.get(v)!;
      place(k, a, a + span);
      a += span;
    }
  };
  place(tree, -Math.PI / 2, (3 * Math.PI) / 2);
  return normalize(nodes, "radial");
}

function normalize(nodes: Placed[], mode: MindLayout["mode"]): MindLayout {
  const PAD = 30;
  const b = bounds(nodes.map((n) => ({ x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h })), PAD);
  return {
    mode,
    width: Math.ceil(b.w),
    height: Math.ceil(b.h),
    nodes: nodes.map((n) => ({ ...n, x: n.x - b.x, y: n.y - b.y })),
  };
}

export function nodeColor(n: Pick<Placed, "depth" | "branch">) {
  if (n.depth === 0) return "#0f172a";
  return BRANCH_COLORS[((n.branch % BRANCH_COLORS.length) + BRANCH_COLORS.length) % BRANCH_COLORS.length];
}

export function mindScene(layout: MindLayout, title: string, root: MNode | null): Scene {
  const items: SceneItem[] = [];
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  for (const n of layout.nodes) {
    if (!n.parentId) continue;
    const p = byId.get(n.parentId)!;
    const color = nodeColor(n);
    if (layout.mode === "horizontal") {
      const x1 = p.x + p.w / 2;
      const y1 = p.y;
      const x2 = n.x - n.w / 2;
      const y2 = n.y;
      const mx = (x1 + x2) / 2;
      items.push({ kind: "path", d: `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, fill: "none", stroke: color, strokeWidth: n.depth === 1 ? 2.5 : 1.6 });
    } else {
      const mx = (p.x + n.x) / 2;
      const my = (p.y + n.y) / 2;
      const cx = mx + (p.x - mx) * 0.1;
      const cy = my + (n.y - my) * 0.3;
      items.push({ kind: "path", d: `M${p.x} ${p.y} Q${cx} ${cy} ${n.x} ${n.y}`, fill: "none", stroke: color, strokeWidth: n.depth === 1 ? 2.5 : 1.6 });
    }
  }
  for (const n of layout.nodes) {
    const color = nodeColor(n);
    const m = { size: n.depth === 0 ? 17 : n.depth === 1 ? 15 : 14, weight: n.depth <= 1 ? 600 : 400 };
    const solid = n.depth <= 1;
    items.push({ kind: "rect", x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h, rx: n.depth === 0 ? n.h / 2 : 8, fill: solid ? color : "#ffffff", stroke: color, strokeWidth: solid ? 0 : 1.5 });
    items.push({ kind: "text", x: n.x, y: firstBaseline(n.y, n.lines.length, m.size), lines: n.lines, size: m.size, weight: m.weight, fill: solid ? "#ffffff" : "#0f172a", anchor: "middle" });
    if (n.collapsed && n.hiddenCount > 0) {
      const bx = layout.mode === "horizontal" ? n.x + n.w / 2 + 2 : n.x + n.w / 2 - 6;
      const by = layout.mode === "horizontal" ? n.y - 9 : n.y - n.h / 2 - 9;
      const label = `+${n.hiddenCount}`;
      const bw = estimateWidth(label, 11, 600) + 10;
      items.push({ kind: "rect", x: bx, y: by, w: bw, h: 18, rx: 9, fill: "#ffffff", stroke: color, strokeWidth: 1.2 });
      items.push({ kind: "text", x: bx + bw / 2, y: by + 13, lines: [label], size: 11, weight: 600, fill: "#0f172a", anchor: "middle" });
    }
  }
  return {
    width: layout.width + 24,
    height: layout.height,
    background: "#ffffff",
    title,
    desc: root ? `Mind map. Outline: ${treeToOutline(root).replace(/\n\s*/g, "; ")}` : "Empty mind map.",
    items: translate(items, 0, 0),
  };
}
