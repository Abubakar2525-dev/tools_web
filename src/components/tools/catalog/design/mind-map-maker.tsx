"use client";

import { useMemo, useState } from "react";
import { Btn, EmptyState, PrivacyNote, Segmented, TextArea, ToolPanel, downloadFile, usePersistentState } from "@/components/tools/kit";
import { downloadBlob } from "@/components/tools/engines/files";
import { allIds, countNodes, layoutHorizontal, layoutRadial, mindScene, parseOutline, treeToOutline, type MNode } from "./lib/mindmap";
import { svgToPng } from "./lib/raster";
import { sceneToSvg } from "./lib/scene";
import { SceneSvg, fileBase } from "./shared";

const SAMPLE = `Launch a newsletter
  Audience
    Early-career designers
    Hiring managers
  Content
    Weekly critique
    Tool roundups
    Reader questions
  Channels
    Website signup
    Social posts
    Partner swaps
  Metrics
    Open rate
    Replies
    Unsubscribes`;

type Saved = { outline: string; collapsed: string[]; layout: "horizontal" | "radial" };
const INITIAL: Saved = { outline: SAMPLE, collapsed: [], layout: "horizontal" };

function depthOneWithKids(root: MNode) {
  return root.children.filter((c) => c.children.length).map((c) => c.id);
}

export default function Tool() {
  const [raw, setSaved, clear] = usePersistentState<Saved>("mind-map-maker", INITIAL);
  const saved: Saved = raw && typeof raw.outline === "string" && Array.isArray(raw.collapsed) ? raw : INITIAL;
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => parseOutline(saved.outline), [saved.outline]);
  const collapsed = useMemo(() => new Set(saved.collapsed), [saved.collapsed]);
  const layout = useMemo(() => (tree ? (saved.layout === "radial" ? layoutRadial(tree, collapsed) : layoutHorizontal(tree, collapsed)) : null), [tree, collapsed, saved.layout]);
  const title = tree?.label ?? "Mind map";
  const scene = useMemo(() => (layout ? mindScene(layout, title, tree) : null), [layout, title, tree]);

  const patch = (p: Partial<Saved>) => setSaved((s) => ({ ...(s && typeof s.outline === "string" ? s : INITIAL), ...p }));
  const toggle = (id: string) => {
    const next = collapsed.has(id) ? saved.collapsed.filter((x) => x !== id) : [...saved.collapsed, id];
    patch({ collapsed: next });
    setStatus(collapsed.has(id) ? "Branch expanded" : "Branch collapsed");
  };

  const exportSvg = () => {
    if (!scene) return;
    downloadFile(`${fileBase(title, "mind-map")}.svg`, sceneToSvg(scene), "image/svg+xml");
  };
  const exportPng = async () => {
    if (!scene) return;
    setError(null);
    try {
      downloadBlob(await svgToPng(sceneToSvg(scene), scene.width, scene.height, 2), `${fileBase(title, "mind-map")}.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PNG export failed.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <ToolPanel title="Outline">
          <TextArea
            label="Topics"
            mono
            rows={18}
            hint="First line is the central topic. Indent with spaces or tabs to nest. Bullets (-, *, 1.) and Markdown headings also work."
            value={saved.outline}
            onChange={(e) => patch({ outline: e.target.value })}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn variant="subtle" onClick={() => patch({ outline: SAMPLE, collapsed: [] })}>
              Load sample
            </Btn>
            <Btn variant="subtle" onClick={() => tree && patch({ outline: treeToOutline(tree) })} disabled={!tree}>
              Tidy indentation
            </Btn>
            <Btn variant="danger" icon="trash" onClick={() => clear()}>
              Reset
            </Btn>
          </div>
          {tree && <p className="mt-3 text-[0.8125rem] text-muted">{countNodes(tree)} topics. The outline itself is the text version of the map.</p>}
        </ToolPanel>

        <ToolPanel
          title="Map"
          actions={
            <Segmented
              label="Layout"
              value={saved.layout}
              onChange={(v) => patch({ layout: v })}
              options={[
                { value: "horizontal", label: "Horizontal" },
                { value: "radial", label: "Radial" },
              ]}
            />
          }
        >
          {!tree || !scene || !layout ? (
            <EmptyState icon="workflow" title="No topics yet">
              Type a central topic on the first line, then indented subtopics below it.
            </EmptyState>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                <Btn variant="ghost" onClick={() => patch({ collapsed: [] })} disabled={!saved.collapsed.length}>
                  Expand all
                </Btn>
                <Btn variant="ghost" onClick={() => patch({ collapsed: depthOneWithKids(tree) })}>
                  Collapse to main branches
                </Btn>
              </div>
              <p id="mm-help" className="mb-2 text-[0.8125rem] text-muted">
                Click a topic that has subtopics to collapse or expand it. With the keyboard, Tab to it and press Enter.
              </p>
              <SceneSvg scene={scene} maxHeight={680}>
                {layout.nodes
                  .filter((n) => n.childCount > 0)
                  .map((n) => (
                    <rect
                      key={n.id}
                      x={n.x - n.w / 2}
                      y={n.y - n.h / 2}
                      width={n.w}
                      height={n.h}
                      rx={8}
                      fill="transparent"
                      tabIndex={0}
                      role="button"
                      aria-expanded={!n.collapsed}
                      aria-describedby="mm-help"
                      aria-label={`${n.label}, ${n.childCount} subtopic${n.childCount === 1 ? "" : "s"}`}
                      className="cursor-pointer outline-none focus-visible:stroke-[#2563eb] focus-visible:[stroke-width:3px] hover:stroke-[#94a3b8] hover:[stroke-width:2px]"
                      onClick={() => toggle(n.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(n.id);
                        }
                      }}
                    />
                  ))}
              </SceneSvg>
              <p className="sr-only" aria-live="polite">
                {status}
              </p>
            </>
          )}
        </ToolPanel>
      </div>

      <ToolPanel title="Export">
        <div className="flex flex-wrap gap-2">
          <Btn icon="download" onClick={exportSvg} disabled={!scene}>
            SVG
          </Btn>
          <Btn variant="ghost" icon="download" onClick={exportPng} disabled={!scene}>
            PNG
          </Btn>
          <Btn variant="ghost" icon="markdown" onClick={() => tree && downloadFile(`${fileBase(title, "mind-map")}.md`, treeToOutline(tree) + "\n", "text/markdown")} disabled={!tree}>
            Outline (.md)
          </Btn>
        </div>
        <p className="mt-3 text-[0.8125rem] text-muted">
          Exports match what is on screen, including collapsed branches. Expand all first for a complete picture.
          {tree && collapsed.size > 0 && ` ${allIds(tree).filter((id) => collapsed.has(id)).length} branch(es) are collapsed now.`}
        </p>
        {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}
