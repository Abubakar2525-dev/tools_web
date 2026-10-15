"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { EmptyState, Notice, PrivacyNote, ResetBtn, Segmented, TextField, ToolPanel, CellSelect } from "@/components/tools/kit";
import { emptySource, formatBlocks, sourceWarnings, type Source, type StyleId } from "../lib/cite";
import { EXAMPLES } from "../lib/cite/examples";
import { EditableCitation, SourceForm } from "./cite-ui";

export interface StyleGuide {
  edition: string;
  points: string[];
}

export function CitationStyleTool({
  styles,
  title,
  titleHint,
  guide,
  locatorHint = "Page number or range for a quotation, e.g. 45 or 45-47.",
}: {
  styles: { value: StyleId; label: string }[];
  title: string;
  titleHint: string;
  guide: StyleGuide;
  locatorHint?: string;
}) {
  const [source, setSource] = useState<Source>(() => emptySource("src", "journal"));
  const [style, setStyle] = useState<StyleId>(styles[0].value);
  const [locator, setLocator] = useState("");
  const [example, setExample] = useState("");
  const dSource = useDeferredValue(source);

  const hasContent = dSource.title.trim() !== "" || dSource.authors.some((a) => a.family.trim() || a.given.trim());
  const blocks = useMemo(() => (hasContent ? formatBlocks(style, dSource, { locator }) : []), [hasContent, style, dSource, locator]);
  const warnings = useMemo(() => (hasContent ? sourceWarnings(dSource) : []), [hasContent, dSource]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title="Source details"
          actions={
            <>
              <CellSelect
                label="Load an example"
                value={example}
                className="w-[13rem]"
                onChange={(e) => {
                  const ex = EXAMPLES.find((x) => x.source.id === e.target.value);
                  setExample(e.target.value);
                  if (ex) setSource(structuredClone(ex.source));
                }}
                options={[{ value: "", label: "Load an example…" }, ...EXAMPLES.map((x) => ({ value: x.source.id, label: x.label }))]}
              />
              <ResetBtn
                onClick={() => {
                  setSource(emptySource("src", source.type));
                  setLocator("");
                  setExample("");
                }}
              />
            </>
          }
        >
          <SourceForm value={source} onChange={setSource} titleHint={titleHint} />
        </ToolPanel>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          <ToolPanel title={title}>
            <div className="space-y-5">
              {styles.length > 1 && <Segmented label="Citation format" value={style} onChange={setStyle} options={styles} />}
              <TextField label="Page or locator for in-text citations" optional hint={locatorHint} value={locator} onChange={(e) => setLocator(e.target.value)} />
              {blocks.length === 0 ? (
                <EmptyState icon="quote" title="Your citation appears here">
                  Fill in an author or title, or load an example to see the format.
                </EmptyState>
              ) : (
                <div className="space-y-5" aria-live="polite">
                  {blocks.map((b) => (
                    <EditableCitation key={b.id} label={b.label} segs={b.segs} hanging={b.id === "ref"} />
                  ))}
                  <p className="text-[0.8125rem] text-muted">
                    Click a citation to edit it before copying. Copy keeps italics when pasted into Word or Google Docs; Plain text drops them.
                  </p>
                </div>
              )}
              {warnings.length > 0 && (
                <Notice tone="warning" title="Check these details">
                  <ul className="list-disc space-y-1 pl-4">
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Notice>
              )}
            </div>
          </ToolPanel>
          <ToolPanel title="Style notes">
            <p className="text-sm text-ink-2">{guide.edition}</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-2">
              {guide.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </ToolPanel>
        </div>
      </div>
      <PrivacyNote />
    </div>
  );
}
