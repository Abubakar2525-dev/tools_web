/**
 * Lossless XML tokenizer and tree builder with a pretty printer and a
 * minifier. Text, entities, CDATA, comments, processing instructions and
 * DOCTYPE are kept byte for byte; only insignificant whitespace between
 * tags changes. Elements with xml:space="preserve" and mixed content
 * (text and elements together) are emitted exactly as written.
 */

export type XNode =
  | { type: "element"; name: string; attrs: string; selfClosing: boolean; children: XNode[]; start: number; end: number; preserve: boolean }
  | { type: "text"; raw: string }
  | { type: "cdata"; raw: string }
  | { type: "comment"; raw: string }
  | { type: "pi"; raw: string }
  | { type: "doctype"; raw: string };

export class XmlError extends Error {
  line: number;
  column: number;
  constructor(message: string, src: string, pos: number) {
    const { line, column } = lineCol(src, pos);
    super(message);
    this.line = line;
    this.column = column;
  }
}

export function lineCol(src: string, pos: number) {
  let line = 1;
  let last = -1;
  for (let i = 0; i < pos && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) {
      line++;
      last = i;
    }
  }
  return { line, column: pos - last };
}

const NAME = /^[A-Za-z_:À-￿][\w.\-:·À-￿]*/;

export function parseXml(src: string): XNode[] {
  const root: XNode[] = [];
  const stack: Extract<XNode, { type: "element" }>[] = [];
  const push = (n: XNode) => (stack.length ? stack[stack.length - 1].children : root).push(n);
  let i = 0;
  const n = src.length;
  while (i < n) {
    if (src[i] !== "<") {
      const j = src.indexOf("<", i);
      const end = j < 0 ? n : j;
      push({ type: "text", raw: src.slice(i, end) });
      i = end;
      continue;
    }
    if (src.startsWith("<!--", i)) {
      const j = src.indexOf("-->", i + 4);
      if (j < 0) throw new XmlError("Comment is not closed with -->.", src, i);
      push({ type: "comment", raw: src.slice(i, j + 3) });
      i = j + 3;
    } else if (src.startsWith("<![CDATA[", i)) {
      const j = src.indexOf("]]>", i + 9);
      if (j < 0) throw new XmlError("CDATA section is not closed with ]]>.", src, i);
      push({ type: "cdata", raw: src.slice(i, j + 3) });
      i = j + 3;
    } else if (src.startsWith("<?", i)) {
      const j = src.indexOf("?>", i + 2);
      if (j < 0) throw new XmlError("Processing instruction is not closed with ?>.", src, i);
      push({ type: "pi", raw: src.slice(i, j + 2) });
      i = j + 2;
    } else if (/^<!DOCTYPE/i.test(src.slice(i, i + 9))) {
      let j = i + 9;
      let depth = 0;
      let quote: string | null = null;
      for (; j < n; j++) {
        const c = src[j];
        if (quote) {
          if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) break;
      }
      if (j >= n) throw new XmlError("DOCTYPE is not closed.", src, i);
      push({ type: "doctype", raw: src.slice(i, j + 1) });
      i = j + 1;
    } else if (src[i + 1] === "/") {
      const m = NAME.exec(src.slice(i + 2));
      if (!m) throw new XmlError("Invalid closing tag.", src, i);
      const close = src.indexOf(">", i);
      if (close < 0) throw new XmlError("Closing tag is missing >.", src, i);
      if (src.slice(i + 2 + m[0].length, close).trim()) throw new XmlError("Unexpected characters in closing tag.", src, i);
      const top = stack.pop();
      if (!top) throw new XmlError(`Closing tag </${m[0]}> has no matching opening tag.`, src, i);
      if (top.name !== m[0]) throw new XmlError(`Expected </${top.name}> but found </${m[0]}>.`, src, i);
      top.end = close + 1;
      i = close + 1;
    } else {
      const m = NAME.exec(src.slice(i + 1));
      if (!m) throw new XmlError('A "<" must start a tag. Escape it as &lt; in text.', src, i);
      let j = i + 1 + m[0].length;
      let quote: string | null = null;
      for (; j < n; j++) {
        const c = src[j];
        if (quote) {
          if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if (c === "<") throw new XmlError(`Tag <${m[0]}> is not closed before the next "<".`, src, i);
        else if (c === ">") break;
      }
      if (j >= n) throw new XmlError(`Tag <${m[0]}> is not closed.`, src, i);
      let inner = src.slice(i + 1 + m[0].length, j);
      const selfClosing = inner.endsWith("/");
      if (selfClosing) inner = inner.slice(0, -1);
      const attrs = normalizeAttrs(inner, src, i);
      const parentPreserve = stack.length ? stack[stack.length - 1].preserve : false;
      const sp = /\bxml:space\s*=\s*(["'])(preserve|default)\1/.exec(inner);
      const preserve = sp ? sp[2] === "preserve" : parentPreserve;
      const el: Extract<XNode, { type: "element" }> = { type: "element", name: m[0], attrs, selfClosing, children: [], start: i, end: j + 1, preserve };
      push(el);
      if (!selfClosing) stack.push(el);
      i = j + 1;
    }
  }
  if (stack.length) {
    const top = stack[stack.length - 1];
    throw new XmlError(`Element <${top.name}> is never closed.`, src, top.start);
  }
  return root;
}

/** Collapses whitespace between attributes; values stay untouched. */
function normalizeAttrs(inner: string, src: string, pos: number): string {
  const out: string[] = [];
  const re = /\s*([^\s=]+)\s*=\s*("[^"]*"|'[^']*')/y;
  let k = 0;
  while (k < inner.length) {
    if (/^\s*$/.test(inner.slice(k))) break;
    re.lastIndex = k;
    const m = re.exec(inner);
    if (!m) throw new XmlError("Malformed attribute. Attributes need the form name=\"value\".", src, pos);
    out.push(`${m[1]}=${m[2]}`);
    k = re.lastIndex;
  }
  const names = out.map((a) => a.slice(0, a.indexOf("=")));
  const dup = names.find((x, idx) => names.indexOf(x) !== idx);
  if (dup) throw new XmlError(`Attribute "${dup}" appears twice.`, src, pos);
  return out.length ? " " + out.join(" ") : "";
}

const isWs = (n: XNode) => n.type === "text" && /^\s*$/.test(n.raw);

function hasMixedContent(el: Extract<XNode, { type: "element" }>): boolean {
  const textual = el.children.some((c) => (c.type === "text" && !isWs(c)) || c.type === "cdata");
  const structural = el.children.some((c) => c.type === "element" || c.type === "comment" || c.type === "pi");
  return textual && structural;
}

function rawInner(src: string, el: Extract<XNode, { type: "element" }>): string {
  const openEnd = src.indexOf(">", el.start) + 1;
  // find the open tag end properly (attributes may contain ">"): re-scan respecting quotes
  let j = el.start + 1;
  let quote: string | null = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ">") break;
  }
  const start = Math.max(openEnd, j + 1);
  const closeStart = src.lastIndexOf("</", el.end - 1);
  return src.slice(start, closeStart);
}

export interface FormatOptions {
  indent: string;
  removeComments: boolean;
}

export function formatXml(src: string, o: FormatOptions): string {
  const nodes = parseXml(src);
  const lines: string[] = [];
  const emit = (list: XNode[], depth: number) => {
    const pad = o.indent.repeat(depth);
    for (const n of list) {
      if (isWs(n)) continue;
      if (n.type === "comment" && o.removeComments) continue;
      if (n.type === "text") {
        lines.push(pad + n.raw.trim());
        continue;
      }
      if (n.type !== "element") {
        lines.push(pad + n.raw);
        continue;
      }
      const open = `<${n.name}${n.attrs}`;
      if (n.selfClosing) {
        lines.push(`${pad}${open}/>`);
        continue;
      }
      const close = `</${n.name}>`;
      if (n.preserve || hasMixedContent(n)) {
        lines.push(`${pad}${open}>${rawInner(src, n)}${close}`);
        continue;
      }
      const kids = n.children.filter((c) => !isWs(c) && !(c.type === "comment" && o.removeComments));
      if (kids.length === 0) {
        // keep whitespace-only text if it was the only content
        lines.push(`${pad}${open}>${n.children.length === 1 && n.children[0].type === "text" ? n.children[0].raw : ""}${close}`);
        continue;
      }
      if (kids.every((c) => c.type === "text" || c.type === "cdata")) {
        lines.push(`${pad}${open}>${n.children.map((c) => (c.type === "text" || c.type === "cdata" ? c.raw : "")).join("")}${close}`);
        continue;
      }
      lines.push(`${pad}${open}>`);
      emit(n.children, depth + 1);
      lines.push(`${pad}${close}`);
    }
  };
  emit(nodes, 0);
  return lines.join("\n") + "\n";
}

export function minifyXml(src: string, o: { removeComments: boolean }): string {
  const nodes = parseXml(src);
  const out: string[] = [];
  const emit = (list: XNode[], dropWs: boolean) => {
    for (const n of list) {
      if (n.type === "text") {
        if (dropWs && isWs(n)) continue;
        out.push(n.raw);
        continue;
      }
      if (n.type === "comment") {
        if (!o.removeComments) out.push(n.raw);
        continue;
      }
      if (n.type !== "element") {
        out.push(n.raw);
        continue;
      }
      if (n.selfClosing) {
        out.push(`<${n.name}${n.attrs}/>`);
        continue;
      }
      if (n.preserve) {
        out.push(`<${n.name}${n.attrs}>${rawInner(src, n)}</${n.name}>`);
        continue;
      }
      out.push(`<${n.name}${n.attrs}>`);
      const mixed = hasMixedContent(n) || n.children.every((c) => c.type === "text");
      emit(n.children, !mixed);
      out.push(`</${n.name}>`);
    }
  };
  emit(nodes, true);
  return out.join("");
}

export function xmlStats(src: string) {
  const nodes = parseXml(src);
  let elements = 0;
  let attributes = 0;
  let depth = 0;
  const walk = (list: XNode[], d: number) => {
    for (const n of list) {
      if (n.type !== "element") continue;
      elements++;
      if (d > depth) depth = d;
      attributes += (n.attrs.match(/=["']/g) ?? []).length;
      walk(n.children, d + 1);
    }
  };
  walk(nodes, 1);
  const rootEl = nodes.find((n) => n.type === "element");
  return { elements, attributes, depth, root: rootEl && rootEl.type === "element" ? rootEl.name : "" };
}
