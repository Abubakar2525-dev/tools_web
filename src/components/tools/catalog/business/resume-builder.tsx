"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Btn,
  Checkbox,
  Notice,
  PrivacyNote,
  Segmented,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  usePersistentState,
} from "@/components/tools/kit";
import { Spinner, downloadBlob } from "@/components/tools/engines/files";
import { embedUnicodeFonts } from "@/components/tools/engines/pdf";
import { Icon } from "@/components/ui/Icon";
import { PAGE_SIZES, type PageSizeId } from "./lib/pdfText";
import {
  SECTION_LABELS,
  TEMPLATES,
  TEMPLATE_STYLES,
  bandTextCss,
  blankItem,
  contactLine,
  dateRange,
  emptyResume,
  exportResumeJson,
  fileSlug,
  joinParts,
  lines,
  moveItem,
  normalizeResume,
  parseResumeJson,
  readableAccentCss,
  renderResumePdf,
  sampleResume,
  sectionHasContent,
  splitSkills,
  validateResume,
  type ListKey,
  type Resume,
  type SectionId,
  type TemplateId,
} from "./lib/resume";

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function IconBtn({
  label,
  icon,
  onClick,
  disabled = false,
  rotate = false,
  danger = false,
}: {
  label: string;
  icon: "chevron" | "trash";
  onClick: () => void;
  disabled?: boolean;
  rotate?: boolean;
  danger?: boolean;
}) {
  // aria-disabled instead of disabled keeps focus on the button after it moves to an edge.
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-35 ${
        danger ? "text-danger" : "text-ink-2 hover:text-ink"
      }`}
    >
      <Icon name={icon} size={18} className={rotate ? "rotate-180" : ""} />
    </button>
  );
}

function MoveButtons({
  name,
  index,
  count,
  onMove,
}: {
  name: string;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
}) {
  return (
    <>
      <IconBtn label={`Move ${name} up`} icon="chevron" rotate disabled={index === 0} onClick={() => onMove(-1)} />
      <IconBtn label={`Move ${name} down`} icon="chevron" disabled={index === count - 1} onClick={() => onMove(1)} />
    </>
  );
}

function ItemShell({
  title,
  name,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  title: string;
  name: string;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-sunken/60 p-3 shadow-[inset_0_0_0_1px_var(--line)] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-ink-2">{title}</p>
        <div className="flex shrink-0 items-center">
          <MoveButtons name={name} index={index} count={count} onMove={onMove} />
          <IconBtn label={`Remove ${name}`} icon="trash" danger onClick={onRemove} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Preview (React elements, mirrors the PDF layout)                   */
/* ------------------------------------------------------------------ */

function ResumePreview({ r }: { r: Resume }) {
  const st = TEMPLATE_STYLES[r.template];
  const accent = readableAccentCss(r.accent);
  const page = PAGE_SIZES[r.pageSize];
  // 1pt in the PDF = 1/page width of the preview box, via container query units.
  const pt = (v: number) => `calc(${(v / page.w) * 100} * 1cqw)`;
  const ink = "#1a1a1f";
  const muted = "#5c5e66";
  const c = r.contact;
  const name = c.name.trim() || "Your name";
  const contact = contactLine(c);
  const headingStyle: React.CSSProperties = {
    margin: 0,
    fontSize: pt(st.headingSize),
    fontWeight: 700,
    textTransform: st.uppercaseHeadings ? "uppercase" : "none",
    color: st.accentHeadings ? accent : ink,
    borderBottom: st.rule ? `1px solid ${st.accentHeadings ? accent : "#c8c9cc"}` : "none",
    paddingBottom: st.rule ? pt(3) : 0,
    marginBottom: pt(5),
  };
  const body: React.CSSProperties = { fontSize: pt(st.bodySize), lineHeight: st.lineHeight, margin: 0 };
  const small: React.CSSProperties = { fontSize: pt(st.smallSize), color: muted, margin: 0, lineHeight: st.lineHeight };
  const row = (left: string, right: string, bold = true) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: pt(12), alignItems: "baseline" }}>
      <p style={{ ...body, fontSize: pt(st.bodySize + 0.5), fontWeight: bold ? 700 : 400, minWidth: 0 }}>{left}</p>
      {right && <p style={{ ...small, whiteSpace: "nowrap" }}>{right}</p>}
    </div>
  );
  const bulletList = (items: string[]) =>
    items.length > 0 && (
      <ul style={{ ...body, paddingLeft: pt(st.bodySize * 1.2), margin: 0, listStyle: "disc" }}>
        {items.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    );
  const gap = (v: number) => ({ marginTop: pt(v) });

  const sections = r.order.filter((s) => sectionHasContent(r, s));

  const renderSection = (s: SectionId) => {
    switch (s) {
      case "summary":
        return r.summary
          .split(/\n\s*\n/)
          .filter((p) => p.trim())
          .map((p, i) => (
            <p key={i} style={{ ...body, ...(i ? gap(4) : {}) }}>
              {p.trim()}
            </p>
          ));
      case "experience":
        return r.experience
          .filter((e) => e.role.trim() || e.company.trim() || e.bullets.trim())
          .map((e, i) => (
            <div key={e.id} style={i ? gap(st.itemGap) : undefined}>
              {row(e.role.trim() || e.company.trim(), dateRange(e.start, e.end, e.current))}
              {joinParts(e.role.trim() ? e.company : "", e.location) && (
                <p style={small}>{joinParts(e.role.trim() ? e.company : "", e.location)}</p>
              )}
              {bulletList(lines(e.bullets))}
            </div>
          ));
      case "education":
        return r.education
          .filter((e) => e.degree.trim() || e.school.trim())
          .map((e, i) => (
            <div key={e.id} style={i ? gap(st.itemGap) : undefined}>
              {row(e.degree.trim() || e.school.trim(), dateRange(e.start, e.end))}
              {joinParts(e.degree.trim() ? e.school : "", e.location) && (
                <p style={small}>{joinParts(e.degree.trim() ? e.school : "", e.location)}</p>
              )}
              {e.details.trim() && <p style={body}>{e.details.trim()}</p>}
            </div>
          ));
      case "skills":
        return r.skills
          .filter((g) => g.label.trim() || g.items.trim())
          .map((g) => (
            <p key={g.id} style={body}>
              {g.label.trim() && <strong>{g.label.trim()}{g.items.trim() ? ": " : ""}</strong>}
              {splitSkills(g.items).join(", ")}
            </p>
          ));
      case "projects":
        return r.projects
          .filter((p) => p.name.trim() || p.description.trim())
          .map((p, i) => (
            <div key={p.id} style={i ? gap(st.itemGap) : undefined}>
              {row(p.name.trim(), "")}
              {p.link.trim() && <p style={{ ...small, color: accent }}>{p.link.trim()}</p>}
              {bulletList(lines(p.description))}
            </div>
          ));
      case "certifications":
        return r.certifications
          .filter((x) => x.name.trim())
          .map((x) => <div key={x.id}>{row(joinParts(x.name, x.issuer), x.date.trim(), false)}</div>);
      case "links":
        return r.links
          .filter((l) => l.url.trim())
          .map((l) => (
            <p key={l.id} style={body}>
              {l.label.trim() && <strong>{l.label.trim()}: </strong>}
              {l.url.trim()}
            </p>
          ));
    }
  };

  return (
    <div style={{ containerType: "inline-size" }} className="w-full">
      <article
        aria-label="Resume preview"
        style={{
          background: "#ffffff",
          color: ink,
          fontFamily: '"Noto Sans", Helvetica, Arial, sans-serif',
          minHeight: `calc(${(page.h / page.w) * 100} * 1cqw)`,
          padding: st.band ? `0 ${pt(st.margin)} ${pt(st.margin)}` : pt(st.margin),
          overflowWrap: "anywhere",
        }}
        className="rounded-md shadow-[0_0_0_1px_var(--line),0_8px_24px_-12px_rgba(0,0,0,0.25)]"
      >
        {st.band ? (
          <header
            style={{
              background: r.accent,
              color: bandTextCss(r.accent),
              margin: `0 calc(-1 * ${pt(st.margin)})`,
              padding: `${pt(18)} ${pt(st.margin)}`,
            }}
          >
            <p style={{ margin: 0, fontSize: pt(st.nameSize), fontWeight: 700, lineHeight: 1.25 }}>{name}</p>
            {c.title.trim() && <p style={{ margin: 0, fontSize: pt(st.titleSize) }}>{c.title.trim()}</p>}
            {contact && <p style={{ margin: `${pt(4)} 0 0`, fontSize: pt(st.contactSize) }}>{contact}</p>}
          </header>
        ) : (
          <header style={{ textAlign: st.centerHeader ? "center" : "left" }}>
            <p style={{ margin: 0, fontSize: pt(st.nameSize), fontWeight: 700, lineHeight: 1.25, color: st.accentHeadings ? accent : ink }}>
              {name}
            </p>
            {c.title.trim() && <p style={{ margin: 0, fontSize: pt(st.titleSize), color: muted }}>{c.title.trim()}</p>}
            {contact && <p style={{ margin: 0, fontSize: pt(st.contactSize), color: muted }}>{contact}</p>}
          </header>
        )}
        {sections.length === 0 ? (
          <p style={{ ...body, color: muted, marginTop: pt(24) }}>Sections you fill in appear here.</p>
        ) : (
          sections.map((s) => (
            <section key={s} style={{ marginTop: pt(st.sectionGap + 4) }}>
              <h3 style={headingStyle}>{SECTION_LABELS[s]}</h3>
              {renderSection(s)}
            </section>
          ))
        )}
      </article>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "error"; msg: string } | { kind: "done"; msg: string };

const ITEM_NAMES: Record<ListKey, string> = {
  experience: "job",
  education: "education entry",
  skills: "skill group",
  projects: "project",
  certifications: "certification",
  links: "link",
};

export default function Tool() {
  const [stored, setStored] = usePersistentState<Resume>("resume-builder", emptyResume());
  const resume = useMemo(() => {
    const n = normalizeResume(stored);
    return typeof n === "string" ? emptyResume() : n;
  }, [stored]);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [announce, setAnnounce] = useState("");
  const [showNameError, setShowNameError] = useState(false);
  const [backup, setBackup] = useState<{ data: Resume; msg: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const alive = useRef(true);
  const nameWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const issues = validateResume(resume);

  const update = (fn: (r: Resume) => Resume) =>
    setStored((prev) => {
      const n = normalizeResume(prev);
      return fn(typeof n === "string" ? emptyResume() : n);
    });

  const setContact = (k: keyof Resume["contact"], v: string) => update((r) => ({ ...r, contact: { ...r.contact, [k]: v } }));

  function setList<K extends ListKey>(key: K, fn: (items: Resume[K]) => Resume[K]) {
    update((r) => ({ ...r, [key]: fn(r[key]) }) as Resume);
  }
  function patchItem<K extends ListKey>(key: K, id: string, patch: Partial<Resume[K][number]>) {
    setList(key, (items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)) as Resume[K]);
  }
  function addItem<K extends ListKey>(key: K) {
    setList(key, (items) => [...items, blankItem[key]()] as Resume[K]);
    setAnnounce(`New ${ITEM_NAMES[key]} added at the end of ${SECTION_LABELS[key]}.`);
  }
  function removeItem<K extends ListKey>(key: K, id: string) {
    setList(key, (items) => items.filter((it) => it.id !== id) as Resume[K]);
    setAnnounce(`${ITEM_NAMES[key][0].toUpperCase()}${ITEM_NAMES[key].slice(1)} removed.`);
  }
  function moveListItem<K extends ListKey>(key: K, index: number, delta: -1 | 1, count: number) {
    setList(key, (items) => moveItem(items as readonly { id: string }[], index, delta) as Resume[K]);
    setAnnounce(`Moved to position ${index + delta + 1} of ${count}.`);
  }
  const moveSection = (index: number, delta: -1 | 1) => {
    const id = resume.order[index];
    update((r) => ({ ...r, order: moveItem(r.order, index, delta) }));
    setAnnounce(`${SECTION_LABELS[id]} section moved to position ${index + delta + 1} of ${resume.order.length}.`);
  };

  const replaceAll = (next: Resume, msg: string) => {
    setBackup({ data: resume, msg });
    setStored(next);
    setStatus({ kind: "idle" });
    setShowNameError(false);
    setImportError(null);
  };

  const exportPdf = async () => {
    if (issues.name) {
      setShowNameError(true);
      setView("edit");
      setStatus({ kind: "error", msg: "Add your name in Contact details, then export again." });
      nameWrapRef.current?.querySelector("input")?.focus();
      return;
    }
    setStatus({ kind: "busy" });
    try {
      const { PDFDocument, rgb } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const fonts = await embedUnicodeFonts(doc);
      const pages = renderResumePdf(doc, resume, fonts, rgb);
      const bytes = await doc.save();
      if (!alive.current) return;
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${fileSlug(resume.contact.name)}-resume.pdf`);
      setStatus({
        kind: "done",
        msg: `PDF downloaded: ${pages} ${pages === 1 ? "page" : "pages"}, ${PAGE_SIZES[resume.pageSize].label}, ${
          TEMPLATES.find((t) => t.id === resume.template)?.label
        } template.`,
      });
    } catch (e) {
      if (!alive.current) return;
      setStatus({ kind: "error", msg: e instanceof Error ? `Could not create the PDF: ${e.message}` : "Could not create the PDF." });
    }
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setImportError("That file is larger than 1 MB, so it is probably not a resume export.");
      return;
    }
    const result = parseResumeJson(await file.text());
    if (typeof result === "string") {
      setImportError(result);
      return;
    }
    replaceAll(result, `Imported ${file.name}.`);
  };

  const hasContent =
    resume.contact.name.trim() !== "" || resume.order.some((s) => sectionHasContent(resume, s)) || resume.contact.email.trim() !== "";

  /* ---- section editors ---- */

  const sectionBody = (s: SectionId) => {
    switch (s) {
      case "summary":
        return (
          <TextArea
            label="Professional summary"
            hint="Two to four sentences. Leave a blank line to start a new paragraph."
            value={resume.summary}
            onChange={(e) => update((r) => ({ ...r, summary: e.target.value }))}
            rows={4}
          />
        );
      case "experience":
        return (
          <ListEditor count={resume.experience.length} addLabel="Add job" onAdd={() => addItem("experience")} empty="No jobs yet.">
            {resume.experience.map((e, i, arr) => (
              <ItemShell
                key={e.id}
                title={e.role.trim() || e.company.trim() || `Job ${i + 1}`}
                name={`job ${i + 1}${e.role.trim() ? ` (${e.role.trim()})` : ""}`}
                index={i}
                count={arr.length}
                onMove={(d) => moveListItem("experience", i, d, arr.length)}
                onRemove={() => removeItem("experience", e.id)}
              >
                <TextField label="Role" value={e.role} onChange={(ev) => patchItem("experience", e.id, { role: ev.target.value })} />
                <TextField label="Company" value={e.company} onChange={(ev) => patchItem("experience", e.id, { company: ev.target.value })} />
                <TextField label="Location" optional value={e.location} onChange={(ev) => patchItem("experience", e.id, { location: ev.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Start" placeholder="Mar 2023" value={e.start} onChange={(ev) => patchItem("experience", e.id, { start: ev.target.value })} />
                  <TextField
                    label="End"
                    placeholder="Jun 2025"
                    value={e.current ? "" : e.end}
                    disabled={e.current}
                    onChange={(ev) => patchItem("experience", e.id, { end: ev.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Checkbox label="I currently work here (shows Present)" checked={e.current} onChange={(v) => patchItem("experience", e.id, { current: v })} />
                </div>
                <TextArea
                  className="sm:col-span-2"
                  label="Bullet points"
                  hint="One achievement per line. Start with a verb and include a number where you can."
                  value={e.bullets}
                  rows={4}
                  onChange={(ev) => patchItem("experience", e.id, { bullets: ev.target.value })}
                />
              </ItemShell>
            ))}
          </ListEditor>
        );
      case "education":
        return (
          <ListEditor count={resume.education.length} addLabel="Add education" onAdd={() => addItem("education")} empty="No education entries yet.">
            {resume.education.map((e, i, arr) => (
              <ItemShell
                key={e.id}
                title={e.degree.trim() || e.school.trim() || `Education ${i + 1}`}
                name={`education entry ${i + 1}`}
                index={i}
                count={arr.length}
                onMove={(d) => moveListItem("education", i, d, arr.length)}
                onRemove={() => removeItem("education", e.id)}
              >
                <TextField label="Degree or program" value={e.degree} onChange={(ev) => patchItem("education", e.id, { degree: ev.target.value })} />
                <TextField label="School" value={e.school} onChange={(ev) => patchItem("education", e.id, { school: ev.target.value })} />
                <TextField label="Location" optional value={e.location} onChange={(ev) => patchItem("education", e.id, { location: ev.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Start" placeholder="2019" value={e.start} onChange={(ev) => patchItem("education", e.id, { start: ev.target.value })} />
                  <TextField label="End" placeholder="2023" value={e.end} onChange={(ev) => patchItem("education", e.id, { end: ev.target.value })} />
                </div>
                <TextArea
                  className="sm:col-span-2"
                  label="Details"
                  optional
                  hint="Honors, GPA, relevant courses or a thesis title."
                  rows={2}
                  value={e.details}
                  onChange={(ev) => patchItem("education", e.id, { details: ev.target.value })}
                />
              </ItemShell>
            ))}
          </ListEditor>
        );
      case "skills":
        return (
          <ListEditor count={resume.skills.length} addLabel="Add skill group" onAdd={() => addItem("skills")} empty="No skills yet.">
            {resume.skills.map((g, i, arr) => (
              <ItemShell
                key={g.id}
                title={g.label.trim() || `Skill group ${i + 1}`}
                name={`skill group ${i + 1}`}
                index={i}
                count={arr.length}
                onMove={(d) => moveListItem("skills", i, d, arr.length)}
                onRemove={() => removeItem("skills", g.id)}
              >
                <TextField label="Group name" optional placeholder="Languages" value={g.label} onChange={(ev) => patchItem("skills", g.id, { label: ev.target.value })} />
                <TextField label="Skills" hint="Separate with commas." placeholder="Python, SQL, Excel" value={g.items} onChange={(ev) => patchItem("skills", g.id, { items: ev.target.value })} />
              </ItemShell>
            ))}
          </ListEditor>
        );
      case "projects":
        return (
          <ListEditor count={resume.projects.length} addLabel="Add project" onAdd={() => addItem("projects")} empty="No projects yet.">
            {resume.projects.map((p, i, arr) => (
              <ItemShell
                key={p.id}
                title={p.name.trim() || `Project ${i + 1}`}
                name={`project ${i + 1}`}
                index={i}
                count={arr.length}
                onMove={(d) => moveListItem("projects", i, d, arr.length)}
                onRemove={() => removeItem("projects", p.id)}
              >
                <TextField label="Project name" value={p.name} onChange={(ev) => patchItem("projects", p.id, { name: ev.target.value })} />
                <TextField
                  label="Link"
                  optional
                  placeholder="github.com/you/project"
                  value={p.link}
                  error={issues.urls[p.id]}
                  onChange={(ev) => patchItem("projects", p.id, { link: ev.target.value })}
                />
                <TextArea
                  className="sm:col-span-2"
                  label="Description"
                  hint="One point per line."
                  rows={3}
                  value={p.description}
                  onChange={(ev) => patchItem("projects", p.id, { description: ev.target.value })}
                />
              </ItemShell>
            ))}
          </ListEditor>
        );
      case "certifications":
        return (
          <ListEditor count={resume.certifications.length} addLabel="Add certification" onAdd={() => addItem("certifications")} empty="No certifications yet.">
            {resume.certifications.map((c, i, arr) => (
              <ItemShell
                key={c.id}
                title={c.name.trim() || `Certification ${i + 1}`}
                name={`certification ${i + 1}`}
                index={i}
                count={arr.length}
                onMove={(d) => moveListItem("certifications", i, d, arr.length)}
                onRemove={() => removeItem("certifications", c.id)}
              >
                <TextField className="sm:col-span-2" label="Certification" value={c.name} onChange={(ev) => patchItem("certifications", c.id, { name: ev.target.value })} />
                <TextField label="Issuer" optional value={c.issuer} onChange={(ev) => patchItem("certifications", c.id, { issuer: ev.target.value })} />
                <TextField label="Date" optional placeholder="2024" value={c.date} onChange={(ev) => patchItem("certifications", c.id, { date: ev.target.value })} />
              </ItemShell>
            ))}
          </ListEditor>
        );
      case "links":
        return (
          <ListEditor count={resume.links.length} addLabel="Add link" onAdd={() => addItem("links")} empty="No links yet.">
            {resume.links.map((l, i, arr) => (
              <ItemShell
                key={l.id}
                title={l.label.trim() || `Link ${i + 1}`}
                name={`link ${i + 1}`}
                index={i}
                count={arr.length}
                onMove={(d) => moveListItem("links", i, d, arr.length)}
                onRemove={() => removeItem("links", l.id)}
              >
                <TextField label="Label" optional placeholder="LinkedIn" value={l.label} onChange={(ev) => patchItem("links", l.id, { label: ev.target.value })} />
                <TextField
                  label="Address"
                  placeholder="linkedin.com/in/you"
                  value={l.url}
                  error={issues.urls[l.id]}
                  onChange={(ev) => patchItem("links", l.id, { url: ev.target.value })}
                />
              </ItemShell>
            ))}
          </ListEditor>
        );
    }
  };

  const tpl = TEMPLATES.find((t) => t.id === resume.template) ?? TEMPLATES[0];

  return (
    <div className="space-y-5">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <ToolPanel
        title="Resume and CV builder"
        actions={
          <>
            <Btn variant="ghost" icon="file" onClick={() => replaceAll(sampleResume(), "Loaded the sample resume.")}>
              Load sample
            </Btn>
            <Btn variant="subtle" icon="reset" onClick={() => replaceAll(emptyResume(), "Cleared the resume.")} disabled={!hasContent}>
              Clear
            </Btn>
          </>
        }
      >
        {backup && (
          <div className="mb-5">
            <Notice tone="info">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span>{backup.msg} Your previous version can be restored.</span>
                <Btn
                  variant="ghost"
                  icon="reset"
                  onClick={() => {
                    setStored(backup.data);
                    setBackup(null);
                    setAnnounce("Previous version restored.");
                  }}
                >
                  Undo
                </Btn>
                <Btn variant="subtle" onClick={() => setBackup(null)}>
                  Dismiss
                </Btn>
              </span>
            </Notice>
          </div>
        )}

        <div className="mb-5 lg:hidden">
          <Segmented
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: "edit", label: "Edit" },
              { value: "preview", label: "Preview" },
            ]}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Editor */}
          <div className={`min-w-0 space-y-6 ${view === "preview" ? "hidden lg:block" : ""}`}>
            <fieldset className="space-y-4">
              <legend className="mb-3 text-base font-semibold text-ink">Layout</legend>
              <div>
                <p className="mb-2 text-sm font-medium text-ink">
                  Template
                </p>
                <Segmented
                  label="Template"
                  value={resume.template}
                  onChange={(v: TemplateId) => update((r) => ({ ...r, template: v }))}
                  options={TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
                />
                <p className="mt-2 text-[0.8125rem] text-muted">
                  {tpl.description}{" "}
                  {tpl.ats
                    ? "ATS-friendly: one column, real text, standard headings, no tables or graphics."
                    : "Single column with real text; the colored band is decorative, but Classic or Compact are the safest picks for applicant tracking systems."}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-ink">Paper size</p>
                  <Segmented
                    label="Paper size"
                    value={resume.pageSize}
                    onChange={(v: PageSizeId) => update((r) => ({ ...r, pageSize: v }))}
                    options={[
                      { value: "a4", label: "A4" },
                      { value: "letter", label: "US Letter" },
                    ]}
                  />
                </div>
                <div>
                  <label htmlFor="resume-accent" className="mb-2 block text-sm font-medium text-ink">
                    Accent color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="resume-accent"
                      type="color"
                      value={resume.accent}
                      onChange={(e) => update((r) => ({ ...r, accent: e.target.value }))}
                      className="h-10 w-14 cursor-pointer rounded-lg bg-surface p-1 shadow-[inset_0_0_0_1px_var(--line-strong)]"
                    />
                    <span className="font-mono text-sm text-muted">{resume.accent}</span>
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-3 text-base font-semibold text-ink">Contact details</legend>
              <div className="grid gap-3 sm:grid-cols-2" ref={nameWrapRef}>
                <TextField
                  label="Full name"
                  autoComplete="name"
                  value={resume.contact.name}
                  error={showNameError ? issues.name : null}
                  onChange={(e) => setContact("name", e.target.value)}
                />
                <TextField label="Job title" optional placeholder="Data analyst" value={resume.contact.title} onChange={(e) => setContact("title", e.target.value)} />
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={resume.contact.email}
                  error={issues.email}
                  onChange={(e) => setContact("email", e.target.value)}
                />
                <TextField label="Phone" optional type="tel" autoComplete="tel" value={resume.contact.phone} onChange={(e) => setContact("phone", e.target.value)} />
                <TextField
                  className="sm:col-span-2"
                  label="Location"
                  optional
                  placeholder="City, state or country"
                  value={resume.contact.location}
                  onChange={(e) => setContact("location", e.target.value)}
                />
              </div>
            </fieldset>

            <div className="space-y-5">
              <p className="text-[0.8125rem] text-muted">
                Use the arrow buttons to change the order of sections and entries. Empty sections are left out of the
                preview and PDF.
              </p>
              {resume.order.map((s, i) => (
                <section key={s} aria-labelledby={`resume-sec-${s}`} className="rounded-xl p-4 shadow-[inset_0_0_0_1px_var(--line)] sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 id={`resume-sec-${s}`} className="text-base font-semibold text-ink">
                      {SECTION_LABELS[s]}
                    </h3>
                    <div className="flex items-center">
                      <MoveButtons name={`${SECTION_LABELS[s]} section`} index={i} count={resume.order.length} onMove={(d) => moveSection(i, d)} />
                    </div>
                  </div>
                  {sectionBody(s)}
                </section>
              ))}
            </div>
          </div>

          {/* Preview + export */}
          <div className={`min-w-0 ${view === "edit" ? "hidden lg:block" : ""}`}>
            <div className="space-y-4 lg:sticky lg:top-24">
              <div className="flex flex-wrap items-center gap-2">
                <Btn icon="download" onClick={exportPdf} disabled={status.kind === "busy"}>
                  Download PDF
                </Btn>
                <Btn
                  variant="ghost"
                  icon="braces"
                  onClick={() => downloadFile(`${fileSlug(resume.contact.name)}-resume.json`, exportResumeJson(resume), "application/json")}
                >
                  Export JSON
                </Btn>
                <label className="btn btn-sm btn-ghost cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
                  <Icon name="upload" size={16} />
                  Import JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={(e) => {
                      void importJson(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {status.kind === "busy" && <Spinner label="Building your PDF" />}
              {status.kind === "error" && <Notice tone="error">{status.msg}</Notice>}
              {status.kind === "done" && <Notice tone="success">{status.msg}</Notice>}
              {importError && (
                <Notice tone="error" title="Import failed">
                  {importError}
                </Notice>
              )}
              <p className="text-[0.8125rem] text-muted">
                Live preview of the {tpl.label} template. The PDF uses the same layout with selectable text and adds
                pages automatically; page breaks are not shown here. Latin, Greek and Cyrillic text is supported;
                other scripts and emoji will not render in the PDF.
              </p>
              <ResumePreview r={resume} />
            </div>
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}

function ListEditor({
  count,
  addLabel,
  onAdd,
  empty,
  children,
}: {
  count: number;
  addLabel: string;
  onAdd: () => void;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {count === 0 ? <p className="text-sm text-muted">{empty}</p> : children}
      <Btn variant="ghost" icon="plus" onClick={onAdd}>
        {addLabel}
      </Btn>
    </div>
  );
}
