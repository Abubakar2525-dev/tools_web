"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Btn, Checkbox, Notice, PrivacyNote, SelectField, TextArea, TextField, ToolPanel } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { embedUnicodeFonts, getPdfLib } from "@/components/tools/engines/pdf";
import { PdfPicker, ResultBar, outName, type PdfSource } from "./shared";
import { loadForEdit } from "./lib/write";

type FieldDesc =
  | { kind: "text"; name: string; value: string; multiline: boolean; maxLength?: number; readOnly: boolean }
  | { kind: "check"; name: string; value: boolean; readOnly: boolean }
  | { kind: "radio"; name: string; value: string; options: string[]; readOnly: boolean }
  | { kind: "dropdown"; name: string; value: string; options: string[]; readOnly: boolean }
  | { kind: "list"; name: string; value: string[]; options: string[]; multi: boolean; readOnly: boolean }
  | { kind: "other"; name: string; type: string };

type Value = string | boolean | string[];

async function readFields(bytes: Uint8Array) {
  const L = await getPdfLib();
  const doc = await loadForEdit(L, bytes);
  const form = doc.getForm();
  const hasXfa = form.hasXFA();
  const out: FieldDesc[] = [];
  for (const f of form.getFields()) {
    const name = f.getName();
    const readOnly = f.isReadOnly();
    try {
      if (f instanceof L.PDFTextField) {
        out.push({ kind: "text", name, value: f.getText() ?? "", multiline: f.isMultiline(), maxLength: f.getMaxLength(), readOnly });
      } else if (f instanceof L.PDFCheckBox) {
        out.push({ kind: "check", name, value: f.isChecked(), readOnly });
      } else if (f instanceof L.PDFRadioGroup) {
        out.push({ kind: "radio", name, value: f.getSelected() ?? "", options: f.getOptions(), readOnly });
      } else if (f instanceof L.PDFDropdown) {
        out.push({ kind: "dropdown", name, value: f.getSelected()[0] ?? "", options: f.getOptions(), readOnly });
      } else if (f instanceof L.PDFOptionList) {
        out.push({ kind: "list", name, value: f.getSelected(), options: f.getOptions(), multi: f.isMultiselect(), readOnly });
      } else {
        out.push({ kind: "other", name, type: f instanceof L.PDFSignature ? "signature field" : f instanceof L.PDFButton ? "push button" : "unsupported field" });
      }
    } catch {
      out.push({ kind: "other", name, type: "field that could not be read" });
    }
  }
  return { fields: out, hasXfa };
}

async function fillPdf(bytes: Uint8Array, values: Record<string, Value>, flatten: boolean, dropXfa: boolean) {
  const L = await getPdfLib();
  const build = async (unicode: boolean) => {
    const doc = await loadForEdit(L, bytes);
    const form = doc.getForm();
    if (dropXfa && form.hasXFA()) form.deleteXFA();
    for (const f of form.getFields()) {
      const v = values[f.getName()];
      if (v === undefined || f.isReadOnly()) continue;
      if (f instanceof L.PDFTextField && typeof v === "string") {
        const max = f.getMaxLength();
        f.setText(max !== undefined ? v.slice(0, max) : v);
      } else if (f instanceof L.PDFCheckBox && typeof v === "boolean") {
        if (v) f.check();
        else f.uncheck();
      } else if (f instanceof L.PDFRadioGroup && typeof v === "string") {
        if (v) f.select(v);
        else f.clear();
      } else if (f instanceof L.PDFDropdown && typeof v === "string") {
        if (v) f.select(v);
        else f.clear();
      } else if (f instanceof L.PDFOptionList && Array.isArray(v)) {
        if (v.length) f.select(v);
        else f.clear();
      }
    }
    if (unicode) {
      const { regular } = await embedUnicodeFonts(doc);
      form.updateFieldAppearances(regular);
    }
    if (flatten) form.flatten({ updateFieldAppearances: !unicode });
    return doc.save({ updateFieldAppearances: !unicode });
  };
  try {
    return await build(false);
  } catch (e) {
    // Standard PDF fonts only cover Western European characters; retry with an embedded Unicode font.
    if (e instanceof Error && /encode|WinAnsi|character/i.test(e.message)) return build(true);
    throw e;
  }
}

export default function Tool() {
  const [source, setSource] = useState<PdfSource | null>(null);
  const [state, setState] = useState<{ bytes: Uint8Array; fields: FieldDesc[]; hasXfa: boolean } | { bytes: Uint8Array; error: string } | null>(null);
  const [values, setValues] = useState<Record<string, Value>>({});
  const [flatten, setFlatten] = useState(false);
  const [dropXfa, setDropXfa] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; values: Record<string, Value>; flatten: boolean } | null>(null);

  useEffect(() => {
    if (!source) return;
    let alive = true;
    readFields(source.bytes)
      .then((r) => {
        if (!alive) return;
        setState({ bytes: source.bytes, ...r });
        const init: Record<string, Value> = {};
        for (const f of r.fields) if (f.kind !== "other") init[f.name] = f.value;
        setValues(init);
      })
      .catch((e: unknown) => {
        if (alive) setState({ bytes: source.bytes, error: e instanceof Error ? e.message : "Could not read this PDF." });
      });
    return () => {
      alive = false;
    };
  }, [source]);

  const current = source && state && state.bytes === source.bytes ? state : null;
  const loading = !!source && !current;
  const fields = current && "fields" in current ? current.fields : [];
  const fillable = fields.filter((f) => f.kind !== "other" && !f.readOnly);
  const fresh = result && result.values === values && result.flatten === flatten ? result : null;

  const set = (name: string, v: Value) => setValues((x) => ({ ...x, [name]: v }));

  async function save() {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await fillPdf(source.bytes, values, flatten, dropXfa);
      setResult({ bytes, values, flatten });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The form could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolPanel title={source ? undefined : "Choose a PDF form"}>
      <div className="space-y-5">
        <PdfPicker
          source={source}
          onChange={(s) => {
            setSource(s);
            setResult(null);
            setError(null);
          }}
          label="Choose a PDF form or drop it here"
        />
        {loading && <Spinner label="Reading form fields" />}
        {current && "error" in current && <Notice tone="error">{current.error}</Notice>}
        {current && "fields" in current && (
          <>
            {current.hasXfa && (
              <Notice tone="warning" title="This PDF contains an XFA form">
                XFA is an older Adobe form technology that browsers and most PDF libraries cannot render.{" "}
                {fields.length
                  ? "This file also has standard form fields, which you can fill below. Removing the XFA data makes other readers show these standard fields instead of the XFA layer."
                  : "It has no standard form fields, so it cannot be filled here. Open it in Adobe Acrobat or Reader to fill it."}
              </Notice>
            )}
            {fields.length === 0 && !current.hasXfa && (
              <Notice tone="info" title="No fillable fields found">
                This PDF has no interactive form fields. To type onto it anyway, use{" "}
                <Link href="/tools/add-text-to-pdf" className="link">
                  Add text to PDF
                </Link>
                .
              </Notice>
            )}
            {fields.length > 0 && (
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <p className="text-sm text-ink-2">
                  {fields.length} field{fields.length === 1 ? "" : "s"} found, {fillable.length} fillable. Labels show each field&apos;s internal name.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((f) => {
                    const ro = f.kind !== "other" && f.readOnly ? " (read-only)" : "";
                    switch (f.kind) {
                      case "text":
                        return f.multiline ? (
                          <TextArea key={f.name} label={f.name + ro} value={String(values[f.name] ?? "")} disabled={f.readOnly} maxLength={f.maxLength} rows={3} onChange={(e) => set(f.name, e.target.value)} />
                        ) : (
                          <TextField
                            key={f.name}
                            label={f.name + ro}
                            value={String(values[f.name] ?? "")}
                            disabled={f.readOnly}
                            maxLength={f.maxLength}
                            hint={f.maxLength !== undefined ? `Up to ${f.maxLength} characters.` : undefined}
                            onChange={(e) => set(f.name, e.target.value)}
                          />
                        );
                      case "check":
                        return (
                          <div key={f.name} className="flex items-center rounded-lg bg-sunken px-3 py-2">
                            <Checkbox label={f.name + ro} checked={values[f.name] === true} onChange={(v) => !f.readOnly && set(f.name, v)} />
                          </div>
                        );
                      case "radio":
                      case "dropdown":
                        return (
                          <SelectField
                            key={f.name}
                            label={`${f.name}${ro}${f.kind === "radio" ? " (choice)" : ""}`}
                            value={String(values[f.name] ?? "")}
                            disabled={f.readOnly}
                            onChange={(e) => set(f.name, e.target.value)}
                            options={[{ value: "", label: "Nothing selected" }, ...f.options.map((o) => ({ value: o, label: o }))]}
                          />
                        );
                      case "list": {
                        const sel = Array.isArray(values[f.name]) ? (values[f.name] as string[]) : [];
                        return (
                          <fieldset key={f.name} className="rounded-lg bg-sunken p-3">
                            <legend className="px-1 text-sm font-medium text-ink">
                              {f.name}
                              {ro} {f.multi ? "(choose any)" : "(choose one)"}
                            </legend>
                            <div className="mt-1 max-h-40 space-y-1 overflow-auto">
                              {f.options.map((o) => (
                                <Checkbox
                                  key={o}
                                  label={o}
                                  checked={sel.includes(o)}
                                  onChange={(v) => {
                                    if (f.readOnly) return;
                                    set(f.name, v ? (f.multi ? [...sel, o] : [o]) : sel.filter((x) => x !== o));
                                  }}
                                />
                              ))}
                            </div>
                          </fieldset>
                        );
                      }
                      default:
                        return (
                          <p key={f.name} className="rounded-lg bg-sunken px-3 py-2 text-sm text-muted">
                            <span className="font-medium text-ink-2">{f.name}</span>: {f.type}, not editable here.
                          </p>
                        );
                    }
                  })}
                </div>
                <div className="space-y-3 rounded-xl bg-sunken p-4">
                  <Checkbox label="Flatten the form" checked={flatten} onChange={setFlatten} hint="Turns the filled fields into plain page content so they can no longer be edited." />
                  {current.hasXfa && <Checkbox label="Remove XFA form data" checked={dropXfa} onChange={setDropXfa} hint="Recommended, so other readers display the fields you filled." />}
                </div>
                <Btn type="submit" icon="check" disabled={busy || fillable.length === 0}>
                  {busy ? "Saving…" : "Save filled PDF"}
                </Btn>
              </form>
            )}
            {busy && <Spinner label="Filling form" />}
            {error && <Notice tone="error">{error}</Notice>}
            {fresh && source && <ResultBar bytes={fresh.bytes} name={outName(source, flatten ? "filled-flat" : "filled")} message={flatten ? "Form filled and flattened." : "Form filled; fields remain editable."} />}
          </>
        )}
        <PrivacyNote />
      </div>
    </ToolPanel>
  );
}
