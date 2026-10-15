"use client";

import { useMemo, useRef, useState } from "react";
import {
  Btn,
  CellInput,
  Checkbox,
  Notice,
  PrivacyNote,
  SelectField,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  usePersistentState,
} from "@/components/tools/kit";
import { downloadBlob } from "@/components/tools/engines/files";
import {
  NODE_TYPES,
  TYPE_LABEL,
  autoLayout,
  clampPosition,
  docToJson,
  docToText,
  edgeGeometry,
  flowScene,
  nodeShape,
  parseFlowJson,
  parseFlowText,
  type FDoc,
  type FEdge,
  type FNode,
  type NodeType,
} from "./lib/flowchart";
import { svgToPng } from "./lib/raster";
import { sceneToSvg } from "./lib/scene";
import { SceneSvg, fileBase } from "./shared";

const SAMPLE_TEXT = `[start] Order received
[process] Check stock
[decision] In stock?
[process] Pack and ship
[io] Email supplier
[end] Done
Order received -> Check stock
Check stock -> In stock?
In stock? -> Pack and ship : Yes
In stock? -> Email supplier : No
Email supplier -> Check stock : Restocked
Pack and ship -> Done`;

let seq = 0;
const makeId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

function sampleDoc(): FDoc {
  return autoLayout(parseFlowText(SAMPLE_TEXT, makeId).doc);
}

function isDoc(d: unknown): d is FDoc {
  if (!d || typeof d !== "object") return false;
  const x = d as FDoc;
  return Array.isArray(x.nodes) && Array.isArray(x.edges) && x.nodes.every((n) => n && typeof n.id === "string" && typeof n.x === "number" && typeof n.y === "number" && typeof n.label === "string" && n.type in TYPE_LABEL);
}

type Sel = { kind: "node" | "edge"; id: string } | null;
type Drag = { id: string; ox: number; oy: number; sx: number; sy: number; x: number; y: number; moved: boolean };

const INITIAL = sampleDoc();

export default function Tool() {
  const [stored, setDoc, clearStored] = usePersistentState<FDoc>("flowchart-maker", INITIAL);
  const doc = isDoc(stored) ? stored : INITIAL;
  const [past, setPast] = useState<FDoc[]>([]);
  const [future, setFuture] = useState<FDoc[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [newType, setNewType] = useState<NodeType>("process");
  const [autoConnect, setAutoConnect] = useState(true);
  const [connectTo, setConnectTo] = useState("");
  const [connectLabel, setConnectLabel] = useState("");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<{ tone: "error" | "success" | "warning"; text: string } | null>(null);
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState("Flowchart");
  const svgRef = useRef<SVGSVGElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  const commit = (next: FDoc) => {
    setPast((p) => [...p.slice(-49), doc]);
    setFuture([]);
    setDoc(next);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [doc, ...f]);
    setDoc(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setStatus("Undone");
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, doc]);
    setDoc(future[0]);
    setFuture((f) => f.slice(1));
    setStatus("Redone");
  };

  const view: FDoc = useMemo(
    () => (drag ? { ...doc, nodes: doc.nodes.map((n) => (n.id === drag.id ? { ...n, x: drag.x, y: drag.y } : n)) } : doc),
    [doc, drag],
  );
  const scene = useMemo(() => flowScene(view, title || "Flowchart"), [view, title]);
  const node = sel?.kind === "node" ? doc.nodes.find((n) => n.id === sel.id) ?? null : null;
  const edge = sel?.kind === "edge" ? doc.edges.find((e) => e.id === sel.id) ?? null : null;
  const nameOf = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? "?";

  /* ----------------------------- editing ----------------------------- */

  const updateNode = (id: string, patch: Partial<FNode>) => commit({ ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  const updateEdge = (id: string, patch: Partial<FEdge>) => commit({ ...doc, edges: doc.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const removeNode = (id: string) => {
    commit({ nodes: doc.nodes.filter((n) => n.id !== id), edges: doc.edges.filter((e) => e.from !== id && e.to !== id) });
    setSel(null);
    setStatus("Step deleted");
  };
  const removeEdge = (id: string) => {
    commit({ ...doc, edges: doc.edges.filter((e) => e.id !== id) });
    setSel(null);
    setStatus("Connector deleted");
  };
  const addNode = () => {
    const from = node;
    const base = from ?? doc.nodes.reduce<FNode | null>((m, n) => (!m || n.y > m.y ? n : m), null);
    const draft: FNode = { id: makeId(), type: newType, label: TYPE_LABEL[newType], x: base ? base.x : 200, y: base ? base.y + 130 : 80 };
    const pos = clampPosition(draft, draft.x, draft.y);
    const n = { ...draft, ...pos };
    const edges = from && autoConnect ? [...doc.edges, { id: makeId(), from: from.id, to: n.id, label: "" }] : doc.edges;
    commit({ nodes: [...doc.nodes, n], edges });
    setSel({ kind: "node", id: n.id });
    setStatus(`${TYPE_LABEL[newType]} step added`);
    requestAnimationFrame(() => labelRef.current?.select());
  };
  const connect = () => {
    if (!node || !connectTo || connectTo === node.id) return;
    commit({ ...doc, edges: [...doc.edges, { id: makeId(), from: node.id, to: connectTo, label: connectLabel.trim() }] });
    setConnectLabel("");
    setStatus("Connector added");
  };
  const layout = () => {
    commit(autoLayout(doc));
    setStatus("Arranged top to bottom");
  };

  /* ----------------------------- pointer ----------------------------- */

  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * scene.width, y: ((e.clientY - r.top) / r.height) * scene.height };
  };
  const onNodeDown = (e: React.PointerEvent, n: FNode) => {
    e.stopPropagation();
    setSel({ kind: "node", id: n.id });
    const p = toSvg(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ id: n.id, ox: n.x, oy: n.y, sx: p.x, sy: p.y, x: n.x, y: n.y, moved: false });
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const p = toSvg(e);
    const n = doc.nodes.find((x) => x.id === drag.id);
    if (!n) return;
    const c = clampPosition(n, drag.ox + p.x - drag.sx, drag.oy + p.y - drag.sy);
    const moved = drag.moved || Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 3;
    setDrag({ ...drag, x: c.x, y: c.y, moved });
  };
  const onUp = () => {
    if (drag?.moved) updateNode(drag.id, { x: drag.x, y: drag.y });
    setDrag(null);
  };
  const onNodeKey = (e: React.KeyboardEvent, n: FNode) => {
    const step = e.shiftKey ? 50 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      const c = clampPosition(n, n.x + dx, n.y + dy);
      updateNode(n.id, c);
      setSel({ kind: "node", id: n.id });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeNode(n.id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSel({ kind: "node", id: n.id });
      requestAnimationFrame(() => labelRef.current?.focus());
    }
  };

  /* ----------------------------- import / export ----------------------------- */

  const doImport = () => {
    const t = importText.trim();
    if (!t) {
      setImportMsg({ tone: "error", text: "Paste a text outline or JSON first." });
      return;
    }
    if (t.startsWith("{")) {
      const r = parseFlowJson(t, makeId);
      if (typeof r === "string") return setImportMsg({ tone: "error", text: r });
      commit(r.needsLayout ? autoLayout(r.doc) : r.doc);
      setImportMsg({ tone: "success", text: `Imported ${r.doc.nodes.length} steps and ${r.doc.edges.length} connectors from JSON.` });
    } else {
      const r = parseFlowText(t, makeId);
      if (!r.doc.nodes.length) return setImportMsg({ tone: "error", text: r.errors[0] ?? "No steps found." });
      commit(autoLayout(r.doc));
      setImportMsg({
        tone: r.errors.length ? "warning" : "success",
        text: `Imported ${r.doc.nodes.length} steps and ${r.doc.edges.length} connectors.${r.errors.length ? ` Skipped: ${r.errors.join(" ")}` : ""}`,
      });
    }
    setSel(null);
  };
  const exportPng = async () => {
    try {
      const blob = await svgToPng(sceneToSvg(flowScene(doc, title || "Flowchart")), scene.width, scene.height, 2);
      downloadBlob(blob, `${fileBase(title, "flowchart")}.png`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "PNG export failed");
    }
  };

  const others = node ? doc.nodes.filter((n) => n.id !== node.id) : [];

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Flowchart"
        actions={
          <>
            <Btn variant="ghost" onClick={undo} disabled={!past.length} aria-keyshortcuts="Control+Z">
              Undo
            </Btn>
            <Btn variant="ghost" onClick={redo} disabled={!future.length}>
              Redo
            </Btn>
            <Btn variant="ghost" icon="layers" onClick={layout} disabled={!doc.nodes.length}>
              Auto-layout
            </Btn>
          </>
        }
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div
            className="min-w-0"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
              }
            }}
          >
            <p id="fc-help" className="mb-2 text-[0.8125rem] text-muted">
              Drag steps to move them. Keyboard: Tab to a step, arrow keys move it (Shift for larger moves), Enter edits it, Delete removes it.
            </p>
            {doc.nodes.length === 0 ? (
              <div className="grid min-h-[300px] place-items-center rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
                The canvas is empty. Add a step on the right, or import a text outline below.
              </div>
            ) : (
              <SceneSvg scene={scene} svgRef={svgRef} onPointerMove={onMove} onPointerUp={onUp} onPointerDown={() => setSel(null)} maxHeight={620}>
                {view.edges.map((e) => {
                  const g = edgeGeometry(view, e);
                  if (!g) return null;
                  const on = sel?.kind === "edge" && sel.id === e.id;
                  return (
                    <g key={e.id}>
                      {on && <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="var(--accent)" strokeWidth={5} strokeOpacity={0.45} pointerEvents="none" />}
                      <line
                        x1={g.x1}
                        y1={g.y1}
                        x2={g.x2}
                        y2={g.y2}
                        stroke="transparent"
                        strokeWidth={14}
                        style={{ cursor: "pointer" }}
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          setSel({ kind: "edge", id: e.id });
                        }}
                      />
                    </g>
                  );
                })}
                {view.nodes.map((n) => {
                  const on = sel?.kind === "node" && sel.id === n.id;
                  return (
                    <g
                      key={n.id}
                      tabIndex={0}
                      role="button"
                      aria-pressed={on}
                      aria-describedby="fc-help"
                      aria-label={`${TYPE_LABEL[n.type]} step: ${n.label}`}
                      onPointerDown={(e) => onNodeDown(e, n)}
                      onKeyDown={(e) => onNodeKey(e, n)}
                      onFocus={() => setSel({ kind: "node", id: n.id })}
                      style={{ cursor: drag?.id === n.id ? "grabbing" : "grab", outline: "none", touchAction: "none" }}
                      className="group"
                    >
                      <SceneShape n={n} stroke="transparent" fill="transparent" width={1} />
                      {on && <SceneShape n={n} stroke="#2563eb" fill="none" width={3} dash="6 4" />}
                    </g>
                  );
                })}
              </SceneSvg>
            )}
            <p className="sr-only" aria-live="polite">
              {status}
            </p>
          </div>

          <div className="min-w-0 space-y-5">
            <div className="rounded-xl bg-sunken p-4">
              <p className="text-sm font-semibold text-ink">Add a step</p>
              <div className="mt-3 space-y-3">
                <SelectField label="Type" value={newType} onChange={(e) => setNewType(e.target.value as NodeType)} options={NODE_TYPES} />
                {node && <Checkbox label={`Connect from “${node.label}”`} checked={autoConnect} onChange={setAutoConnect} />}
                <Btn icon="plus" onClick={addNode}>
                  Add {TYPE_LABEL[newType].toLowerCase()}
                </Btn>
              </div>
            </div>

            {node && (
              <div className="rounded-xl bg-sunken p-4">
                <p className="text-sm font-semibold text-ink">Selected step</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="fc-label" className="text-sm font-medium text-ink">
                      Text
                    </label>
                    <input
                      id="fc-label"
                      ref={labelRef}
                      key={`${node.id}:${node.label}`}
                      defaultValue={node.label}
                      maxLength={120}
                      onBlur={(e) => e.target.value !== node.label && updateNode(node.id, { label: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="mt-2 block h-11 w-full rounded-lg bg-surface px-3.5 text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]"
                    />
                  </div>
                  <SelectField label="Type" value={node.type} onChange={(e) => updateNode(node.id, { type: e.target.value as NodeType })} options={NODE_TYPES} />
                  {others.length > 0 && (
                    <div className="space-y-2">
                      <SelectField
                        label="Connect to"
                        value={connectTo}
                        onChange={(e) => setConnectTo(e.target.value)}
                        options={[{ value: "", label: "Choose a step…" }, ...others.map((o) => ({ value: o.id, label: o.label }))]}
                      />
                      <CellInput label="Connector label (optional)" placeholder="Label, e.g. Yes" value={connectLabel} maxLength={40} onChange={(e) => setConnectLabel(e.target.value)} />
                      <Btn variant="ghost" icon="arrow" onClick={connect} disabled={!connectTo || connectTo === node.id}>
                        Add connector
                      </Btn>
                    </div>
                  )}
                  <Btn variant="danger" icon="trash" onClick={() => removeNode(node.id)}>
                    Delete step
                  </Btn>
                </div>
              </div>
            )}

            {edge && (
              <div className="rounded-xl bg-sunken p-4">
                <p className="text-sm font-semibold text-ink">
                  Connector: {nameOf(edge.from)} → {nameOf(edge.to)}
                </p>
                <div className="mt-3 space-y-3">
                  <TextField
                    key={`${edge.id}:${edge.label}`}
                    label="Label"
                    defaultValue={edge.label}
                    maxLength={40}
                    onBlur={(e) => e.target.value !== edge.label && updateEdge(edge.id, { label: e.target.value })}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="ghost" icon="swap" onClick={() => updateEdge(edge.id, { from: edge.to, to: edge.from })}>
                      Reverse
                    </Btn>
                    <Btn variant="danger" icon="trash" onClick={() => removeEdge(edge.id)}>
                      Delete
                    </Btn>
                  </div>
                </div>
              </div>
            )}

            {doc.edges.length > 0 && (
              <details className="rounded-xl bg-sunken p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Connectors ({doc.edges.length})</summary>
                <ul className="mt-2 space-y-1">
                  {doc.edges.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        aria-pressed={sel?.kind === "edge" && sel.id === e.id}
                        onClick={() => setSel({ kind: "edge", id: e.id })}
                        className="w-full rounded-md px-2 py-2 text-left text-sm text-ink-2 hover:bg-surface aria-pressed:bg-accent-soft aria-pressed:text-ink"
                      >
                        {nameOf(e.from)} → {nameOf(e.to)}
                        {e.label && <span className="text-muted"> ({e.label})</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </ToolPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title="Export">
          <div className="space-y-4">
            <TextField label="Title" hint="Used as the SVG title and file name." value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Btn icon="download" disabled={!doc.nodes.length} onClick={() => downloadFile(`${fileBase(title, "flowchart")}.svg`, sceneToSvg(flowScene(doc, title || "Flowchart")), "image/svg+xml")}>
                SVG
              </Btn>
              <Btn variant="ghost" icon="download" disabled={!doc.nodes.length} onClick={exportPng}>
                PNG
              </Btn>
              <Btn variant="ghost" icon="braces" onClick={() => downloadFile(`${fileBase(title, "flowchart")}.json`, docToJson(doc), "application/json")}>
                JSON
              </Btn>
              <Btn variant="ghost" icon="text" onClick={() => downloadFile(`${fileBase(title, "flowchart")}.txt`, docToText(doc))}>
                Text outline
              </Btn>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-ink">Text version of this chart</summary>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-sunken p-3 font-mono text-[0.8125rem] text-ink-2">{docToText(doc) || "Empty"}</pre>
            </details>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Btn
                variant="subtle"
                onClick={() => {
                  commit(sampleDoc());
                  setSel(null);
                }}
              >
                Load sample
              </Btn>
              <Btn
                variant="danger"
                icon="trash"
                onClick={() => {
                  commit({ nodes: [], edges: [] });
                  setSel(null);
                }}
                disabled={!doc.nodes.length}
              >
                Clear canvas
              </Btn>
              <Btn
                variant="subtle"
                onClick={() => {
                  clearStored();
                  setPast([]);
                  setFuture([]);
                  setSel(null);
                }}
              >
                Forget saved chart
              </Btn>
            </div>
          </div>
        </ToolPanel>

        <ToolPanel title="Import">
          <TextArea
            label="Text outline or JSON"
            mono
            rows={9}
            hint="One step per line as [start], [process], [decision], [io] or [end] plus its text. Connect with A -> B, add a label with A -> B : Yes. JSON uses the export format."
            value={importText}
            placeholder={SAMPLE_TEXT}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn icon="upload" onClick={doImport}>
              Replace chart with import
            </Btn>
            <Btn variant="ghost" onClick={() => setImportText(docToText(doc))}>
              Edit current chart as text
            </Btn>
          </div>
          {importMsg && (
            <div className="mt-3">
              <Notice tone={importMsg.tone}>{importMsg.text}</Notice>
            </div>
          )}
          <p className="mt-3 text-[0.8125rem] text-muted">Importing runs auto-layout. You can undo it.</p>
        </ToolPanel>
      </div>
      <PrivacyNote stored />
    </div>
  );
}

function SceneShape({ n, stroke, fill, width, dash }: { n: FNode; stroke: string; fill: string; width: number; dash?: string }) {
  const it = nodeShape(n, stroke, width, fill);
  if (it.kind === "rect") return <rect x={it.x} y={it.y} width={it.w} height={it.h} rx={it.rx} fill={fill} stroke={stroke} strokeWidth={width} strokeDasharray={dash} />;
  if (it.kind === "polygon") return <polygon points={it.points.map((p) => p.join(",")).join(" ")} fill={fill} stroke={stroke} strokeWidth={width} strokeDasharray={dash} />;
  return null;
}
