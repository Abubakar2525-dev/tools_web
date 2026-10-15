/** Flatten nested JSON into dotted keys for CSV, and rebuild it again. */

type J = null | boolean | number | string | J[] | { [k: string]: J };

export interface FlattenOptions {
  separator: string;
  /** "index": items.0.name keys; "json": arrays stay as a JSON string in one cell. */
  arrays: "index" | "json";
}

export function flattenObject(value: J, o: FlattenOptions, prefix = "", out: Record<string, string | number | boolean | null> = {}) {
  if (value === null || typeof value !== "object") {
    out[prefix || "value"] = value;
    return out;
  }
  if (Array.isArray(value)) {
    if (o.arrays === "json" && prefix) {
      out[prefix] = JSON.stringify(value);
      return out;
    }
    if (value.length === 0 && prefix) out[prefix] = "[]";
    value.forEach((v, i) => flattenObject(v, o, prefix ? `${prefix}${o.separator}${i}` : String(i), out));
    return out;
  }
  const keys = Object.keys(value);
  if (keys.length === 0 && prefix) out[prefix] = "{}";
  for (const k of keys) flattenObject(value[k], o, prefix ? `${prefix}${o.separator}${k}` : k, out);
  return out;
}

/** Turns JSON into a list of flat rows plus the union of columns in first-seen order. */
export function toRows(data: J, o: FlattenOptions): { rows: Record<string, string | number | boolean | null>[]; columns: string[] } {
  const items: J[] = Array.isArray(data) ? data : [data];
  const rows = items.map((it) => (it !== null && typeof it === "object" && !Array.isArray(it) ? flattenObject(it, o) : { value: typeof it === "object" && it !== null ? JSON.stringify(it) : it }));
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }
    }
  }
  return { rows, columns };
}

/** Rebuilds nesting from dotted keys. Numeric segments become array indexes. */
export function unflatten(row: Record<string, unknown>, separator: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    const parts = separator ? key.split(separator) : [key];
    let cur: Record<string, unknown> | unknown[] = root;
    parts.forEach((p, i) => {
      const last = i === parts.length - 1;
      const nextIsIndex = !last && /^\d+$/.test(parts[i + 1]);
      const k: string | number = Array.isArray(cur) && /^\d+$/.test(p) ? Number(p) : p;
      const container = cur as Record<string | number, unknown>;
      if (last) container[k] = val;
      else {
        if (container[k] === undefined || typeof container[k] !== "object" || container[k] === null) container[k] = nextIsIndex ? [] : {};
        cur = container[k] as Record<string, unknown> | unknown[];
      }
    });
  }
  return root;
}
