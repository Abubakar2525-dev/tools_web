"use client";

import { useState } from "react";
import { Btn, CopyBtn, Notice, OutputBlock, PrivacyNote, ResetBtn, SelectField, TextArea, TextField, ToolPanel, downloadFile, CellInput, inputCls } from "@/components/tools/kit";
import { SPECS, specFor, toJsonLd, validate, type Row, type SchemaType, type Values } from "./lib/schema";

const SAMPLES: Partial<Record<SchemaType, { values: Values; rows?: Row[] }>> = {
  Organization: { values: { name: "Example Studio", url: "https://example.com", logo: "https://example.com/logo.png", sameAs: "https://www.linkedin.com/company/example\nhttps://github.com/example" } },
  FAQPage: {
    values: {},
    rows: [
      { q: "Do you ship internationally?", a: "Yes, to most countries. Delivery takes 5 to 10 business days." },
      { q: "Can I return an item?", a: "Unused items can be returned within 30 days for a full refund." },
    ],
  },
  BreadcrumbList: {
    values: {},
    rows: [
      { name: "Home", url: "https://example.com/" },
      { name: "Guides", url: "https://example.com/guides/" },
      { name: "Composting basics", url: "" },
    ],
  },
  Article: { values: { subtype: "BlogPosting", headline: "Composting basics for small gardens", authorName: "Sam Rivera", datePublished: "2026-03-14", url: "https://example.com/guides/composting", image: "https://example.com/img/compost.jpg" } },
  Product: { values: { name: "Ceramic pour-over coffee dripper", brand: "Example Goods", price: "34.00", priceCurrency: "USD", availability: "InStock", condition: "NewCondition", url: "https://example.com/shop/dripper" } },
  Event: { values: { name: "Community repair café", startDate: "2026-05-16T10:00", endDate: "2026-05-16T14:00", offset: "+01:00", locationName: "Town hall", streetAddress: "1 Market Square", addressLocality: "Exampleton", addressCountry: "GB" } },
  LocalBusiness: { values: { subtype: "CafeOrCoffeeShop", name: "Corner Bean", streetAddress: "12 High Street", addressLocality: "Exampleton", postalCode: "EX1 2AB", addressCountry: "GB", telephone: "+44 20 7946 0000", openingHours: "Mo-Fr 07:30-17:00\nSa 09:00-15:00" } },
  Person: { values: { name: "Dana Okafor", jobTitle: "Data engineer", worksFor: "Example Studio", url: "https://example.com/team/dana" } },
  WebSite: { values: { name: "Example Studio", url: "https://example.com", search: "https://example.com/search?q={search_term_string}" } },
};

export default function Tool() {
  const [type, setType] = useState<SchemaType>("Organization");
  const [values, setValues] = useState<Values>({});
  const [rows, setRows] = useState<Row[]>([{}]);
  const spec = specFor(type);
  const issues = validate(spec, values, rows);
  const fieldError = (key: string) => issues.find((i) => i.field === key)?.message ?? null;
  const touched = Object.values(values).some((v) => v.trim()) || rows.some((r) => Object.values(r).some((v) => v?.trim()));
  const code = toJsonLd(spec, values, rows);

  const changeType = (t: SchemaType) => {
    setType(t);
    setValues({});
    setRows([{}]);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title="Structured data"
          actions={
            <>
              <Btn
                variant="ghost"
                icon="spark"
                onClick={() => {
                  const s = SAMPLES[type];
                  if (s) {
                    setValues({ ...s.values });
                    setRows(s.rows ? s.rows.map((r) => ({ ...r })) : [{}]);
                  }
                }}
              >
                Load sample
              </Btn>
              <ResetBtn
                onClick={() => {
                  setValues({});
                  setRows([{}]);
                }}
              />
            </>
          }
        >
          <div className="space-y-4">
            <SelectField label="Schema type" value={type} onChange={(e) => changeType(e.target.value as SchemaType)} options={SPECS.map((s) => ({ value: s.type, label: `${s.label} (${s.type})` }))} />
            {spec.note && <Notice tone="info">{spec.note}</Notice>}
            {spec.fields.map((f) => {
              const common = {
                label: f.label,
                hint: f.hint,
                optional: !f.required,
                value: values[f.key] ?? "",
                error: touched ? fieldError(f.key) : null,
              };
              if (f.kind === "select")
                return (
                  <SelectField
                    key={f.key}
                    {...common}
                    optional={false}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    options={[{ value: "", label: "Not set" }, ...(f.options ?? [])]}
                  />
                );
              if (f.kind === "textarea" || f.kind === "lines")
                return <TextArea key={f.key} {...common} rows={f.kind === "lines" ? 3 : 3} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />;
              return (
                <TextField
                  key={f.key}
                  {...common}
                  placeholder={f.placeholder}
                  type={f.kind === "date" ? "date" : f.kind === "datetime" ? "datetime-local" : "text"}
                  inputMode={f.kind === "number" ? "decimal" : f.kind === "url" ? "url" : undefined}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              );
            })}
            {spec.rows && (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-ink">{spec.rows.title}</legend>
                {rows.map((r, i) => (
                  <div key={i} className="space-y-2 rounded-lg bg-sunken p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[0.8125rem] font-medium text-ink-2">
                        {spec.rows!.itemLabel} {i + 1}
                      </p>
                      <div className="flex gap-1">
                        <Btn
                          variant="subtle"
                          aria-label={`Move ${spec.rows!.itemLabel.toLowerCase()} ${i + 1} up`}
                          disabled={i === 0}
                          onClick={() =>
                            setRows((list) => {
                              const n = [...list];
                              [n[i - 1], n[i]] = [n[i], n[i - 1]];
                              return n;
                            })
                          }
                        >
                          ↑
                        </Btn>
                        <Btn variant="danger" icon="trash" aria-label={`Remove ${spec.rows!.itemLabel.toLowerCase()} ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((list) => list.filter((_, j) => j !== i))} />
                      </div>
                    </div>
                    {spec.rows!.cols.map((c) =>
                      c.kind === "textarea" ? (
                        <textarea
                          key={c.key}
                          aria-label={`${c.label} ${i + 1}`}
                          placeholder={c.label}
                          rows={3}
                          value={r[c.key] ?? ""}
                          onChange={(e) => setRows((list) => list.map((x, j) => (j === i ? { ...x, [c.key]: e.target.value } : x)))}
                          className={`${inputCls} resize-y py-2 text-[0.95rem]`}
                        />
                      ) : (
                        <CellInput
                          key={c.key}
                          label={`${c.label} ${i + 1}`}
                          placeholder={c.kind === "url" ? "https://…" : c.label}
                          value={r[c.key] ?? ""}
                          onChange={(e) => setRows((list) => list.map((x, j) => (j === i ? { ...x, [c.key]: e.target.value } : x)))}
                        />
                      ),
                    )}
                  </div>
                ))}
                <Btn variant="subtle" icon="plus" onClick={() => setRows((list) => [...list, {}])}>
                  Add {spec.rows.itemLabel.toLowerCase()}
                </Btn>
              </fieldset>
            )}
          </div>
        </ToolPanel>
        <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          <ToolPanel
            title="JSON-LD"
            actions={
              <>
                <CopyBtn text={code} />
                <Btn variant="ghost" icon="download" onClick={() => downloadFile(`${type.toLowerCase()}-schema.html`, code + "\n", "text/html")}>
                  Download
                </Btn>
              </>
            }
          >
            <div className="space-y-4">
              {touched && issues.length > 0 ? (
                <Notice tone="warning" title={`${issues.length} ${issues.length === 1 ? "issue" : "issues"} to fix`}>
                  <ul className="list-disc space-y-1 pl-4">
                    {issues.map((i) => (
                      <li key={i.message}>{i.message}</li>
                    ))}
                  </ul>
                </Notice>
              ) : touched ? (
                <Notice tone="success">Required properties are filled and the output is valid JSON-LD.</Notice>
              ) : null}
              <OutputBlock label="JSON-LD script">
                <code>{code}</code>
              </OutputBlock>
              <p className="text-[0.8125rem] text-muted">
                Paste into the page’s &lt;head&gt; or &lt;body&gt;. Markup must describe content visible on the page. Test the live page with a rich results testing tool before relying on it.
              </p>
            </div>
          </ToolPanel>
        </div>
      </div>
      <PrivacyNote />
    </div>
  );
}
