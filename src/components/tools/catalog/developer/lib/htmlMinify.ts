/**
 * Conservative HTML minifier. It never removes whitespace that could be
 * visible: runs of whitespace in text collapse to one space, and whitespace-
 * only text is dropped only when both neighbours are block-level tags (or the
 * start/end of the document). Contents of pre, textarea, script and style
 * are kept verbatim. Attribute values are untouched.
 */

const BLOCK = new Set(
  "html head body title meta link base script style noscript template address article aside blockquote details dialog dd div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr li main nav ol p pre section summary table thead tbody tfoot tr td th caption colgroup col ul option optgroup select iframe video audio canvas svg source track picture area map".split(
    " ",
  ),
);
const RAW = new Set(["pre", "textarea", "script", "style"]);

type Tok = { t: "text"; v: string } | { t: "tag"; v: string; name: string; close: boolean } | { t: "comment"; v: string } | { t: "other"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("<!--", i)) {
      const j = src.indexOf("-->", i + 4);
      const end = j < 0 ? src.length : j + 3;
      out.push({ t: "comment", v: src.slice(i, end) });
      i = end;
      continue;
    }
    if (src[i] === "<" && /[!?]/.test(src[i + 1] ?? "")) {
      const j = src.indexOf(">", i);
      const end = j < 0 ? src.length : j + 1;
      out.push({ t: "other", v: src.slice(i, end) });
      i = end;
      continue;
    }
    const m = /^<(\/?)([A-Za-z][A-Za-z0-9:-]*)/.exec(src.slice(i, i + 64));
    if (m) {
      // scan to the closing ">" while respecting quoted attribute values
      let j = i + m[0].length;
      let q: string | null = null;
      for (; j < src.length; j++) {
        const c = src[j];
        if (q) {
          if (c === q) q = null;
        } else if (c === '"' || c === "'") q = c;
        else if (c === ">") break;
      }
      const end = Math.min(src.length, j + 1);
      const name = m[2].toLowerCase();
      out.push({ t: "tag", v: src.slice(i, end), name, close: m[1] === "/" });
      i = end;
      if (!m[1] && RAW.has(name) && !src.slice(i - 2, i).startsWith("/")) {
        const closeRe = new RegExp(`</${name}\\s*>`, "i");
        const rest = src.slice(i);
        const cm = closeRe.exec(rest);
        const k = cm ? i + cm.index : src.length;
        if (k > i) out.push({ t: "other", v: src.slice(i, k) });
        i = k;
      }
      continue;
    }
    const j = src.indexOf("<", i + 1);
    const end = j < 0 ? src.length : j;
    out.push({ t: "text", v: src.slice(i, end) });
    i = end;
  }
  return out;
}

/** Collapses whitespace inside a tag outside quoted values: <a   href="x"  > → <a href="x">. */
function tidyTag(tag: string): string {
  let out = "";
  let q: string | null = null;
  for (let i = 0; i < tag.length; i++) {
    const c = tag[i];
    if (q) {
      out += c;
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") {
      q = c;
      out += c;
      continue;
    }
    if (/\s/.test(c)) {
      const nextNon = /^\s*(\S)/.exec(tag.slice(i))?.[1];
      if (out.endsWith("=") || nextNon === "=") continue;
      if (!/\s$/.test(out)) out += " ";
      continue;
    }
    out += c;
  }
  return out.replace(/\s+(\/?>)$/, "$1");
}

export function minifyHtml(src: string, o: { removeComments: boolean }): string {
  const toks = tokenize(src);
  const isBlockTok = (t: Tok | undefined) => !t || (t.t === "tag" && BLOCK.has(t.name)) || t.t === "other" || t.t === "comment";
  const out: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === "comment") {
      if (o.removeComments && !/^<!--\[if|^<!--\s*\[endif/i.test(t.v)) continue;
      out.push(t.v);
    } else if (t.t === "tag") out.push(tidyTag(t.v));
    else if (t.t === "other") out.push(t.v);
    else {
      const prev = toks[i - 1];
      const next = toks[i + 1];
      // text directly inside a raw element was emitted as "other"; this is normal text
      let v = t.v.replace(/[ \t\n\r\f]+/g, " ");
      if (v === " " && isBlockTok(prev) && isBlockTok(next)) continue;
      if (isBlockTok(prev)) v = v.replace(/^ /, "");
      if (isBlockTok(next)) v = v.replace(/ $/, "");
      if (v) out.push(v);
    }
  }
  return out.join("");
}
