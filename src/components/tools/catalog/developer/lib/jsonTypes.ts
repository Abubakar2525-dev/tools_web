/**
 * JSON shape inference shared by the JSON → C# and JSON → TypeScript tools.
 * Pure TypeScript, no DOM, no React.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type StrFormat = "datetime" | "datetime-offset" | "date" | "uuid";

/** Union of everything observed at one position in the document. */
export interface Inferred {
  nullable: boolean;
  bool: boolean;
  int: boolean;
  long: boolean;
  float: boolean;
  string: boolean;
  /** Format shared by every string seen; null when none or mixed. */
  format: StrFormat | null;
  /** True once a string without a shared format was seen. */
  formatMixed: boolean;
  /** Element type for arrays (an empty Inferred when every array was empty). */
  array: Inferred | null;
  object: ObjShape | null;
}

export interface ObjShape {
  /** Insertion-ordered field map. */
  fields: Map<string, { type: Inferred; count: number }>;
  /** Number of objects merged into this shape. */
  samples: number;
}

const INT32_MAX = 2147483647;
const INT32_MIN = -2147483648;

export function emptyType(): Inferred {
  return {
    nullable: false,
    bool: false,
    int: false,
    long: false,
    float: false,
    string: false,
    format: null,
    formatMixed: false,
    array: null,
    object: null,
  };
}

export function isEmptyType(t: Inferred) {
  return !t.nullable && !t.bool && !t.int && !t.long && !t.float && !t.string && !t.array && !t.object;
}

const RE_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const RE_DATETIME = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[T ]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,9})?)?(Z|[+-]([01]\d|2[0-3]):?[0-5]\d)?$/i;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function detectFormat(s: string): StrFormat | null {
  if (RE_UUID.test(s)) return "uuid";
  if (RE_DATE.test(s)) return "date";
  const m = RE_DATETIME.exec(s);
  if (m) return m[7] ? "datetime-offset" : "datetime";
  return null;
}

export function infer(v: Json): Inferred {
  const t = emptyType();
  if (v === null) t.nullable = true;
  else if (typeof v === "boolean") t.bool = true;
  else if (typeof v === "number") {
    if (Number.isInteger(v)) {
      if (v > INT32_MAX || v < INT32_MIN) t.long = true;
      else t.int = true;
    } else t.float = true;
  } else if (typeof v === "string") {
    t.string = true;
    const f = detectFormat(v);
    if (f) t.format = f;
    else t.formatMixed = true;
  } else if (Array.isArray(v)) {
    let item = emptyType();
    for (const x of v) item = mergeTypes(item, infer(x));
    t.array = item;
  } else {
    const fields = new Map<string, { type: Inferred; count: number }>();
    for (const k of Object.keys(v)) fields.set(k, { type: infer(v[k]), count: 1 });
    t.object = { fields, samples: 1 };
  }
  return t;
}

function mergeFormat(a: Inferred, b: Inferred): { format: StrFormat | null; formatMixed: boolean } {
  if (!a.string) return { format: b.format, formatMixed: b.formatMixed };
  if (!b.string) return { format: a.format, formatMixed: a.formatMixed };
  if (a.formatMixed || b.formatMixed) return { format: null, formatMixed: true };
  if (a.format === b.format) return { format: a.format, formatMixed: false };
  // date-time with and without offset: keep the offset variant
  const pair = new Set([a.format, b.format]);
  if (pair.has("datetime") && pair.has("datetime-offset") && pair.size === 2) return { format: "datetime-offset", formatMixed: false };
  return { format: null, formatMixed: true };
}

export function mergeObjects(a: ObjShape, b: ObjShape): ObjShape {
  const fields = new Map<string, { type: Inferred; count: number }>();
  for (const [k, f] of a.fields) fields.set(k, { type: f.type, count: f.count });
  for (const [k, f] of b.fields) {
    const cur = fields.get(k);
    if (cur) fields.set(k, { type: mergeTypes(cur.type, f.type), count: cur.count + f.count });
    else fields.set(k, { type: f.type, count: f.count });
  }
  return { fields, samples: a.samples + b.samples };
}

export function mergeTypes(a: Inferred, b: Inferred): Inferred {
  const fmt = mergeFormat(a, b);
  return {
    nullable: a.nullable || b.nullable,
    bool: a.bool || b.bool,
    int: a.int || b.int,
    long: a.long || b.long,
    float: a.float || b.float,
    string: a.string || b.string,
    format: fmt.format,
    formatMixed: fmt.formatMixed,
    array: a.array && b.array ? mergeTypes(a.array, b.array) : (a.array ?? b.array),
    object: a.object && b.object ? mergeObjects(a.object, b.object) : (a.object ?? b.object),
  };
}

/** Families present, ignoring null. Numbers count as one family. */
export function families(t: Inferred): ("bool" | "number" | "string" | "array" | "object")[] {
  const out: ("bool" | "number" | "string" | "array" | "object")[] = [];
  if (t.bool) out.push("bool");
  if (t.int || t.long || t.float) out.push("number");
  if (t.string) out.push("string");
  if (t.array) out.push("array");
  if (t.object) out.push("object");
  return out;
}

/* ------------------------------------------------------------------ */
/* Naming                                                              */
/* ------------------------------------------------------------------ */

function words(raw: string): string[] {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

export function pascalCase(raw: string): string {
  const w = words(raw);
  let s = w.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join("");
  if (!s) s = "Field";
  if (/^\d/.test(s)) s = `_${s}`;
  return s;
}

export function camelCase(raw: string): string {
  const p = pascalCase(raw);
  return p.startsWith("_") ? p : p.charAt(0).toLowerCase() + p.slice(1);
}

/** Naive English singular for array item type names ("users" → "User"). */
export function singular(name: string): string {
  if (/ies$/i.test(name) && name.length > 4) return name.slice(0, -3) + "y";
  if (/(ss|us|is)$/i.test(name)) return name;
  if (/(xes|ches|shes|sses)$/i.test(name)) return name.slice(0, -2);
  if (/s$/i.test(name) && name.length > 2) return name.slice(0, -1);
  return name;
}

/** Hands out unique type names; same base name for a different shape gets a numeric suffix. */
export class NameRegistry {
  private used = new Set<string>();
  constructor(reserved: string[] = []) {
    for (const r of reserved) this.used.add(r.toLowerCase());
  }
  take(base: string): string {
    let name = base;
    let i = 2;
    while (this.used.has(name.toLowerCase())) name = `${base}${i++}`;
    this.used.add(name.toLowerCase());
    return name;
  }
}

/* ------------------------------------------------------------------ */
/* C#                                                                  */
/* ------------------------------------------------------------------ */

export interface CSharpOptions {
  rootName: string;
  namespace: string;
  style: "class" | "record";
  nullableRefs: boolean;
  collection: "List" | "array" | "IReadOnlyList";
  attributes: "when-needed" | "always" | "never";
  detectFormats: boolean;
}

const CS_KEYWORDS = new Set(
  "abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while".split(
    " ",
  ),
);

/** Mirrors System.Text.Json's JsonNamingPolicy.CamelCase conversion. */
export function dotnetCamel(name: string): string {
  const c = name.split("");
  const up = (ch: string | undefined) => !!ch && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
  for (let i = 0; i < c.length; i++) {
    if (i === 1 && !up(c[i])) break;
    const hasNext = i + 1 < c.length;
    if (i > 0 && hasNext && !up(c[i + 1])) {
      if (c[i + 1] === " ") c[i] = c[i].toLowerCase();
      break;
    }
    c[i] = c[i].toLowerCase();
  }
  return c.join("");
}

interface CsClass {
  name: string;
  props: { name: string; json: string; type: string; init: string }[];
}

export function jsonToCSharp(value: Json, o: CSharpOptions): string {
  const rootBase = pascalCase(o.rootName || "Root");
  const reg = new NameRegistry();
  const classes: CsClass[] = [];
  let usesTextJson = false;


  const typeOf = (t: Inferred, nameHint: string, optional: boolean): { type: string; init: string } => {
    const fam = families(t);
    const nullable = t.nullable || optional;
    const q = (base: string, isValue: boolean) => {
      if (nullable && (isValue || o.nullableRefs)) return `${base}?`;
      return base;
    };
    if (fam.length === 0) {
      // only null seen, or nothing at all (empty array item)
      return { type: o.nullableRefs ? "object?" : "object", init: "" };
    }
    if (fam.length > 1) {
      usesTextJson = true;
      return { type: q("JsonElement", true), init: "" };
    }
    switch (fam[0]) {
      case "bool":
        return { type: q("bool", true), init: "" };
      case "number":
        if (t.float) return { type: q("double", true), init: "" };
        if (t.long) return { type: q("long", true), init: "" };
        return { type: q("int", true), init: "" };
      case "string": {
        if (o.detectFormats && !t.formatMixed && t.format) {
          const base =
            t.format === "uuid" ? "Guid" : t.format === "date" ? "DateOnly" : t.format === "datetime-offset" ? "DateTimeOffset" : "DateTime";
          return { type: q(base, true), init: "" };
        }
        const isNull = nullable && o.nullableRefs;
        return { type: q("string", false), init: isNull || !o.nullableRefs ? "" : "string.Empty" };
      }
      case "array": {
        const item = t.array as Inferred;
        const inner = typeOf(item, singular(nameHint), false).type;
        const base = o.collection === "array" ? `${inner}[]` : `${o.collection}<${inner}>`;
        const isNull = nullable && o.nullableRefs;
        const init = isNull || !o.nullableRefs ? "" : o.collection === "List" ? "new()" : o.collection === "array" ? "[]" : "[]";
        return { type: q(base, false), init };
      }
      case "object": {
        const cls = emitClass(t.object as ObjShape, nameHint);
        const isNull = nullable && o.nullableRefs;
        return { type: q(cls, false), init: isNull || !o.nullableRefs ? "" : o.style === "record" ? "new()" : "new()" };
      }
    }
  };

  const emitClass = (shape: ObjShape, nameHint: string): string => {
    const name = reg.take(pascalCase(nameHint));
    const cls: CsClass = { name, props: [] };
    classes.push(cls);
    const usedProps = new Set<string>([name.toLowerCase()]);
    for (const [key, f] of shape.fields) {
      let prop = pascalCase(key);
      if (prop === name) prop = `${prop}Value`;
      if (CS_KEYWORDS.has(prop)) prop = `@${prop}`;
      let unique = prop;
      let i = 2;
      while (usedProps.has(unique.toLowerCase())) unique = `${prop}${i++}`;
      usedProps.add(unique.toLowerCase());
      const optional = f.count < shape.samples;
      const t = typeOf(f.type, key, optional);
      cls.props.push({ name: unique, json: key, type: t.type, init: t.init });
    }
    return name;
  };

  let rootDecl = "";
  const root = infer(value);
  const fam = families(root);
  if (fam.length === 1 && fam[0] === "object") {
    emitClass(root.object as ObjShape, rootBase);
  } else if (fam.length === 1 && fam[0] === "array" && root.array && families(root.array).length === 1 && root.array.object) {
    const item = emitClass(root.array.object, singular(rootBase) === rootBase ? `${rootBase}Item` : singular(rootBase));
    const coll = o.collection === "array" ? `${item}[]` : `${o.collection}<${item}>`;
    rootDecl = `// Deserialize the root array as ${coll}, for example:\n// var items = JsonSerializer.Deserialize<${coll}>(json);\n`;
  } else {
    throw new Error("The JSON root must be an object, or an array of objects, to generate classes.");
  }

  const needsAttr = (p: { name: string; json: string }) =>
    o.attributes === "always" || (o.attributes === "when-needed" && dotnetCamel(p.name.replace(/^@/, "")) !== p.json);
  const anyAttr = o.attributes !== "never" && classes.some((c) => c.props.some(needsAttr));

  const usings: string[] = [];
  if (anyAttr || usesTextJson) usings.push("using System.Text.Json.Serialization;");
  if (usesTextJson) usings.unshift("using System.Text.Json;");
  if (o.collection !== "array" && classes.some((c) => c.props.some((p) => /\b(List|IReadOnlyList)</.test(p.type)))) {
    usings.unshift("using System.Collections.Generic;");
  }
  if (classes.some((c) => c.props.some((p) => /\b(DateTime|DateTimeOffset|DateOnly|Guid)\b/.test(p.type)))) usings.unshift("using System;");

  const lines: string[] = [];
  if (usings.length) lines.push(...usings, "");
  const ns = o.namespace.trim();
  if (ns) lines.push(`namespace ${ns};`, "");
  if (rootDecl) lines.push(rootDecl);
  const acc = o.style === "record" ? "{ get; init; }" : "{ get; set; }";
  classes.forEach((c, ci) => {
    lines.push(`public ${o.style === "record" ? "record" : "class"} ${c.name}`, "{");
    c.props.forEach((p, pi) => {
      if (o.attributes !== "never" && needsAttr(p)) lines.push(`    [JsonPropertyName("${p.json.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")]`);
      lines.push(`    public ${p.type} ${p.name} ${acc}${p.init ? ` = ${p.init};` : ""}`);
      if (pi < c.props.length - 1 && o.attributes !== "never" && c.props.some(needsAttr)) lines.push("");
    });
    lines.push("}");
    if (ci < classes.length - 1) lines.push("");
  });
  return lines.join("\n") + "\n";
}

/* ------------------------------------------------------------------ */
/* TypeScript                                                          */
/* ------------------------------------------------------------------ */

export interface TsOptions {
  rootName: string;
  declaration: "interface" | "type";
  readonly: boolean;
  exported: boolean;
  /** Treat null as "optional" (`?`) instead of `| null`. */
  nullAsOptional: boolean;
  arrayStyle: "brackets" | "generic";
}

const TS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function jsonToTypeScript(value: Json, o: TsOptions): string {
  const reg = new NameRegistry();
  const decls: string[] = [];
  const exp = o.exported ? "export " : "";
  const ro = o.readonly ? "readonly " : "";

  const arr = (inner: string) => {
    if (o.arrayStyle === "generic") return `${o.readonly ? "ReadonlyArray" : "Array"}<${inner}>`;
    const needParens = /[|&]/.test(inner) || inner.startsWith("readonly ");
    return `${o.readonly ? "readonly " : ""}${needParens ? `(${inner})` : inner}[]`;
  };

  const typeOf = (t: Inferred, nameHint: string, dropNull: boolean): string => {
    const parts: string[] = [];
    if (t.bool) parts.push("boolean");
    if (t.int || t.long || t.float) parts.push("number");
    if (t.string) parts.push("string");
    if (t.array) parts.push(arr(isEmptyType(t.array) ? "unknown" : typeOf(t.array, singular(nameHint), false)));
    if (t.object) parts.push(emitObject(t.object, nameHint));
    if (t.nullable && !dropNull) parts.push("null");
    if (parts.length === 0) return t.nullable ? "null" : "unknown";
    return parts.join(" | ");
  };

  const emitObject = (shape: ObjShape, nameHint: string): string => {
    const name = reg.take(pascalCase(nameHint));
    const idx = decls.length;
    decls.push(""); // reserve slot so parents print before children
    const body: string[] = [];
    for (const [key, f] of shape.fields) {
      const missing = f.count < shape.samples;
      const nullOnlyOptional = o.nullAsOptional && f.type.nullable;
      const optional = missing || nullOnlyOptional;
      const t = typeOf(f.type, key, o.nullAsOptional);
      const k = TS_IDENT.test(key) ? key : JSON.stringify(key);
      body.push(`  ${ro}${k}${optional ? "?" : ""}: ${t === "unknown" && nullOnlyOptional ? "null" : t};`);
    }
    decls[idx] =
      o.declaration === "interface"
        ? `${exp}interface ${name} {\n${body.join("\n")}${body.length ? "\n" : ""}}`
        : `${exp}type ${name} = {\n${body.join("\n")}${body.length ? "\n" : ""}};`;
    return name;
  };

  const rootName = pascalCase(o.rootName || "Root");
  const root = infer(value);
  if (root.object && families(root).length === 1 && !root.nullable) {
    emitObject(root.object, rootName);
  } else {
    // arrays and primitives become a type alias pointing at generated item types
    const idx = decls.length;
    decls.push("");
    const reserved = reg.take(rootName);
    const t = root.array && families(root).length === 1 ? arr(isEmptyType(root.array) ? "unknown" : typeOf(root.array, `${reserved}Item`, false)) : typeOf(root, `${reserved}Value`, false);
    decls[idx] = `${exp}type ${reserved} = ${t};`;
  }
  return decls.join("\n\n") + "\n";
}
