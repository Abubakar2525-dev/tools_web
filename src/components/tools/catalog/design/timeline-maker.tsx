"use client";

import { useMemo, useState } from "react";
import {
  Btn,
  CellInput,
  CellSelect,
  Checkbox,
  EmptyState,
  PrivacyNote,
  Segmented,
  TextField,
  ToolPanel,
  downloadFile,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { downloadBlob } from "@/components/tools/engines/files";
import { svgToPng } from "./lib/raster";
import { sceneToSvg } from "./lib/scene";
import { EVENT_COLORS, parseDate, sortEvents, timelineScene, type TEvent, type TimelineOpts } from "./lib/timeline";
import { SceneSvg, fileBase } from "./shared";

type Saved = { events: TEvent[]; opts: TimelineOpts };

const SAMPLE: TEvent[] = [
  { id: "s1", date: "2025-01", title: "Research", description: "Interviews with twelve customers and a review of support tickets.", color: "#0f766e" },
  { id: "s2", date: "2025-03-15", title: "Prototype", description: "Clickable prototype tested with five users.", color: "#1d4ed8" },
  { id: "s3", date: "2025-06-02", title: "Private beta", description: "Invite-only release to 200 accounts.", color: "#6d28d9" },
  { id: "s4", date: "2025-09-10", title: "Public launch", description: "Pricing page live and onboarding emails switched on.", color: "#be185d" },
  { id: "s5", date: "2026", title: "Version 2", description: "Team plans and integrations.", color: "#c2410c" },
];
const INITIAL: Saved = { events: SAMPLE, opts: { title: "Product roadmap", layout: "vertical", spacing: "even", alternate: true, dateStyle: "long" } };

function valid(s: unknown): s is Saved {
  if (!s || typeof s !== "object") return false;
  const x = s as Saved;
  return Array.isArray(x.events) && !!x.opts && typeof x.opts.title === "string";
}

export default function Tool() {
  const [raw, setSaved, clear] = usePersistentState<Saved>("timeline-maker", INITIAL);
  const saved = valid(raw) ? raw : INITIAL;
  const { events, opts } = saved;
  const [error, setError] = useState<string | null>(null);

  const update = (p: Partial<Saved>) => setSaved((s) => ({ ...(valid(s) ? s : INITIAL), ...p }));
  const setOpt = <K extends keyof TimelineOpts>(k: K, v: TimelineOpts[K]) => update({ opts: { ...opts, [k]: v } });
  const setEvent = (id: string, p: Partial<TEvent>) => update({ events: events.map((e) => (e.id === id ? { ...e, ...p } : e)) });

  const scene = useMemo(() => timelineScene(events, opts), [events, opts]);
  const shown = events.filter((e) => e.title.trim() || e.date.trim());
  const name = fileBase(opts.title, "timeline");

  const exportPng = async () => {
    setError(null);
    try {
      downloadBlob(await svgToPng(sceneToSvg(scene), scene.width, scene.height, 2), `${name}.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PNG export failed.");
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title={`Events (${events.length})`}
        actions={
          <>
            <Btn
              variant="ghost"
              icon="plus"
              disabled={events.length >= 60}
              onClick={() =>
                update({
                  events: [...events, { id: uid(), date: new Date().toISOString().slice(0, 10), title: "", description: "", color: EVENT_COLORS[events.length % EVENT_COLORS.length].value }],
                })
              }
            >
              Add event
            </Btn>
            <Btn variant="subtle" onClick={() => update({ events: sortEvents(events) })}>
              Sort by date
            </Btn>
          </>
        }
      >
        <p className="mb-3 text-[0.8125rem] text-muted">Dates can be a year (2026), a month (2026-03) or a day (2026-03-14). The chart always shows events in date order.</p>
        {events.length === 0 ? (
          <EmptyState icon="calendar" title="No events yet">Add an event to start your timeline.</EmptyState>
        ) : (
          <ol className="space-y-3">
            {events.map((e, i) => {
              const bad = e.date.trim() !== "" && !parseDate(e.date);
              return (
                <li key={e.id} className="grid gap-2 rounded-xl bg-sunken p-3 sm:grid-cols-[140px_minmax(0,1fr)_120px_auto] sm:items-start">
                  <div>
                    <CellInput label={`Event ${i + 1} date`} value={e.date} invalid={bad} placeholder="YYYY-MM-DD" onChange={(ev) => setEvent(e.id, { date: ev.target.value })} />
                    {bad && <p className="mt-1 text-xs text-danger" role="alert">Use YYYY, YYYY-MM or YYYY-MM-DD.</p>}
                  </div>
                  <div className="space-y-2">
                    <CellInput label={`Event ${i + 1} title`} value={e.title} maxLength={80} placeholder="Title" onChange={(ev) => setEvent(e.id, { title: ev.target.value })} />
                    <textarea
                      aria-label={`Event ${i + 1} description`}
                      value={e.description}
                      maxLength={300}
                      rows={2}
                      placeholder="Description (optional)"
                      onChange={(ev) => setEvent(e.id, { description: ev.target.value })}
                      className="block w-full resize-y rounded-lg bg-surface px-2.5 py-2 text-[0.95rem] text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]"
                    />
                  </div>
                  <CellSelect label={`Event ${i + 1} color`} value={e.color} onChange={(ev) => setEvent(e.id, { color: ev.target.value })} options={EVENT_COLORS} />
                  <div className="flex gap-1">
                    <Btn variant="subtle" disabled={i === 0} aria-label={`Move event ${i + 1} up`} onClick={() => update({ events: swap(events, i, i - 1) })}>
                      ↑
                    </Btn>
                    <Btn variant="subtle" disabled={i === events.length - 1} aria-label={`Move event ${i + 1} down`} onClick={() => update({ events: swap(events, i, i + 1) })}>
                      ↓
                    </Btn>
                    <Btn variant="danger" icon="trash" aria-label={`Delete event ${i + 1}`} onClick={() => update({ events: events.filter((x) => x.id !== e.id) })} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </ToolPanel>

      <ToolPanel title="Timeline">
        <div className="mb-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <TextField label="Title" value={opts.title} maxLength={80} onChange={(e) => setOpt("title", e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Segmented label="Orientation" value={opts.layout} onChange={(v) => setOpt("layout", v)} options={[{ value: "vertical", label: "Vertical" }, { value: "horizontal", label: "Horizontal" }]} />
            <Segmented label="Spacing" value={opts.spacing} onChange={(v) => setOpt("spacing", v)} options={[{ value: "even", label: "Even" }, { value: "proportional", label: "To scale" }]} />
            <Segmented label="Date format" value={opts.dateStyle} onChange={(v) => setOpt("dateStyle", v)} options={[{ value: "long", label: "March 14, 2026" }, { value: "short", label: "Mar 14, 2026" }, { value: "iso", label: "2026-03-14" }]} />
          </div>
        </div>
        <div className="mb-4">
          <Checkbox label="Alternate sides" checked={opts.alternate} onChange={(v) => setOpt("alternate", v)} />
        </div>
        {shown.length === 0 ? (
          <EmptyState icon="calendar" title="Nothing to draw yet">Add at least one event with a date or title.</EmptyState>
        ) : (
          <SceneSvg scene={scene} maxHeight={720} fit={opts.layout === "vertical"} />
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn icon="download" disabled={!shown.length} onClick={() => downloadFile(`${name}.svg`, sceneToSvg(scene), "image/svg+xml")}>
            SVG
          </Btn>
          <Btn variant="ghost" icon="download" disabled={!shown.length} onClick={exportPng}>
            PNG
          </Btn>
          <Btn variant="subtle" onClick={() => update({ events: SAMPLE })}>
            Load sample
          </Btn>
          <Btn variant="danger" icon="trash" onClick={() => clear()}>
            Reset everything
          </Btn>
        </div>
        {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
        <p className="mt-3 text-[0.8125rem] text-muted">“To scale” places events by real time between them, with a minimum gap so cards never overlap.</p>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}

function swap<T>(arr: T[], i: number, j: number) {
  const n = [...arr];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}
