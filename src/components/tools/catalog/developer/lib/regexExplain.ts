/**
 * A small parser for JavaScript regular expression syntax that turns a
 * pattern into a nested plain-English explanation tree. It does not execute
 * the pattern. Coverage: alternation, capturing / named / non-capturing
 * groups, lookahead and lookbehind, inline modifiers, character classes
 * (including v-flag nesting, intersection and subtraction), quantifiers
 * (greedy and lazy), anchors, word boundaries, backreferences, escapes and
 * Unicode property escapes.
 */

export interface ExplainNode {
  kind: string;
  /** Source text of this part of the pattern. */
  src: string;
  text: string;
  start: number;
  end: number;
  children?: ExplainNode[];
  /** Literal characters matched (literal and text nodes only). */
  value?: string;
}

export class RegexSyntaxError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}

export const FLAG_INFO: Record<string, string> = {
  d: "d (hasIndices): record start and end positions of each capture group",
  g: "g (global): find every match, not just the first",
  i: "i (ignoreCase): letters match regardless of case",
  m: "m (multiline): ^ and $ match at the start and end of each line",
  s: "s (dotAll): . also matches line breaks",
  u: "u (unicode): treat the pattern as Unicode code points and enable \\u{...} and \\p{...}",
  v: "v (unicodeSets): Unicode mode with set operations and nested classes in [...]",
  y: "y (sticky): match only at the position given by lastIndex",
};

export function parseLiteral(input: string): { pattern: string; flags: string } | null {
  const m = /^\/([\s\S]*)\/([a-z]*)$/.exec(input.trim());
  if (!m) return null;
  return { pattern: m[1], flags: m[2] };
}

function describeChar(ch: string): string {
  const cp = ch.codePointAt(0) ?? 0;
  if (ch === " ") return "a space";
  if (ch === "\t") return "a tab";
  if (ch === "\n") return "a line feed";
  if (ch === "\r") return "a carriage return";
  if (cp < 32 || cp === 127) return `control character U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
  return `"${ch}"`;
}

const CLASS_ESCAPES: Record<string, string> = {
  d: "a digit (0-9)",
  D: "any character that is not a digit",
  w: "a word character (letter, digit or underscore)",
  W: "any character that is not a word character",
  s: "a whitespace character (space, tab, line break and similar)",
  S: "any character that is not whitespace",
};

const CHAR_ESCAPES: Record<string, [string, string]> = {
  t: ["\t", "a tab"],
  n: ["\n", "a line feed (newline)"],
  r: ["\r", "a carriage return"],
  v: ["\v", "a vertical tab"],
  f: ["\f", "a form feed"],
};

const PROPERTY_NAMES: Record<string, string> = {
  L: "letter",
  Letter: "letter",
  Lu: "uppercase letter",
  Uppercase_Letter: "uppercase letter",
  Ll: "lowercase letter",
  Lowercase_Letter: "lowercase letter",
  N: "number",
  Nd: "decimal digit",
  P: "punctuation",
  S: "symbol",
  Sc: "currency symbol",
  Z: "separator",
  Zs: "space separator",
  Emoji: "emoji",
  Emoji_Presentation: "emoji shown as a picture by default",
  Alphabetic: "alphabetic character",
  White_Space: "whitespace character",
  ASCII: "ASCII character",
  Any: "any code point",
  RGI_Emoji: "recommended emoji (including sequences)",
};

function describeProperty(body: string, negated: boolean): string {
  let text: string;
  const eq = body.indexOf("=");
  if (eq >= 0) {
    const key = body.slice(0, eq);
    const val = body.slice(eq + 1);
    const k = key === "sc" || key === "Script" ? "script" : key === "scx" || key === "Script_Extensions" ? "script (extensions)" : key === "gc" || key === "General_Category" ? "category" : key;
    text = `a character with Unicode ${k} ${val.replace(/_/g, " ")}`;
  } else {
    const nice = PROPERTY_NAMES[body];
    text = nice ? `a Unicode ${nice}` : `a character with the Unicode property ${body.replace(/_/g, " ")}`;
  }
  return negated ? `any character that is not ${text.replace(/^an? /, "a ")}` : text;
}

class Parser {
  pos = 0;
  groups = 0;
  names: string[] = [];
  readonly src: string;
  readonly unicode: boolean;
  readonly sets: boolean;
  readonly multiline: boolean;
  readonly dotAll: boolean;
  readonly ignoreCase: boolean;

  constructor(src: string, flags: string) {
    this.src = src;
    this.unicode = flags.includes("u") || flags.includes("v");
    this.sets = flags.includes("v");
    this.multiline = flags.includes("m");
    this.dotAll = flags.includes("s");
    this.ignoreCase = flags.includes("i");
  }

  peek(n = 0) {
    return this.src[this.pos + n];
  }
  eof() {
    return this.pos >= this.src.length;
  }
  node(kind: string, start: number, text: string, children?: ExplainNode[]): ExplainNode {
    return { kind, src: this.src.slice(start, this.pos), text, start, end: this.pos, children };
  }

  parseDisjunction(): ExplainNode[] {
    const start = this.pos;
    const alts: { start: number; items: ExplainNode[]; end: number }[] = [];
    let s = this.pos;
    alts.push({ start: s, items: this.parseAlternative(), end: this.pos });
    while (this.peek() === "|") {
      this.pos++;
      s = this.pos;
      alts.push({ start: s, items: this.parseAlternative(), end: this.pos });
    }
    if (alts.length === 1) return alts[0].items;
    const children = alts.map((a, i) => ({
      kind: "alternative",
      src: this.src.slice(a.start, a.end),
      text: a.items.length === 0 ? `Option ${i + 1}: nothing (an empty alternative always matches)` : `Option ${i + 1}`,
      start: a.start,
      end: a.end,
      children: a.items,
    }));
    return [this.node("alternation", start, `Match any one of these ${alts.length} options (tried left to right)`, children)];
  }

  parseAlternative(): ExplainNode[] {
    const items: ExplainNode[] = [];
    while (!this.eof() && this.peek() !== "|" && this.peek() !== ")") {
      const atomStart = this.pos;
      const atom = this.parseTerm();
      const q = this.parseQuantifier(atom, atomStart);
      items.push(q ?? atom);
    }
    return mergeLiterals(items);
  }

  parseQuantifier(atom: ExplainNode, atomStart: number): ExplainNode | null {
    const c = this.peek();
    let min: number;
    let max: number | null;
    const save = this.pos;
    if (c === "*") {
      min = 0;
      max = null;
      this.pos++;
    } else if (c === "+") {
      min = 1;
      max = null;
      this.pos++;
    } else if (c === "?") {
      min = 0;
      max = 1;
      this.pos++;
    } else if (c === "{") {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(this.src.slice(this.pos));
      if (!m) return null;
      min = Number(m[1]);
      max = m[2] === undefined ? min : m[3] === "" ? null : Number(m[3]);
      if (max !== null && max < min) throw new RegexSyntaxError("Numbers out of order in {} quantifier: the maximum is smaller than the minimum.", this.pos);
      this.pos += m[0].length;
    } else return null;
    if (atom.kind === "anchor" || atom.kind === "boundary" || atom.kind === "lookbehind" || (this.unicode && atom.kind === "lookahead")) {
      throw new RegexSyntaxError(`Nothing to repeat: "${atom.src}" cannot take a quantifier.`, save);
    }
    let lazy = false;
    if (this.peek() === "?") {
      lazy = true;
      this.pos++;
    }
    let what: string;
    if (max === null) what = min === 0 ? "zero or more times" : min === 1 ? "one or more times" : `${min} or more times`;
    else if (min === max) what = min === 1 ? "exactly once" : `exactly ${min} times`;
    else if (min === 0 && max === 1) what = "optionally (zero or one time)";
    else what = `between ${min} and ${max} times`;
    const mode = min === max ? "" : lazy ? ", as few as possible (lazy)" : ", as many as possible (greedy)";
    return this.node("quantifier", atomStart, `Repeat ${what}${mode}:`, [atom]);
  }

  parseTerm(): ExplainNode {
    const start = this.pos;
    const c = this.src[this.pos];
    switch (c) {
      case "^":
        this.pos++;
        return this.node("anchor", start, this.multiline ? "Start of a line (or of the input)" : "Start of the input");
      case "$":
        this.pos++;
        return this.node("anchor", start, this.multiline ? "End of a line (or of the input)" : "End of the input");
      case ".":
        this.pos++;
        return this.node("dot", start, this.dotAll ? "Any single character, including line breaks" : "Any single character except a line break");
      case "(":
        return this.parseGroup();
      case "[":
        return this.parseClass();
      case "\\":
        return this.parseAtomEscape();
      case ")":
        throw new RegexSyntaxError("Unmatched closing parenthesis.", this.pos);
      case "*":
      case "+":
      case "?":
        throw new RegexSyntaxError(`Nothing to repeat before "${c}".`, this.pos);
      case "{":
        if (/^\{\d+(,\d*)?\}/.test(this.src.slice(this.pos))) throw new RegexSyntaxError("Nothing to repeat before the {} quantifier.", this.pos);
        if (this.unicode) throw new RegexSyntaxError('A literal "{" must be escaped as \\{ in Unicode mode.', this.pos);
        break;
      case "}":
      case "]":
        if (this.unicode) throw new RegexSyntaxError(`A literal "${c}" must be escaped in Unicode mode.`, this.pos);
        break;
    }
    const cp = this.src.codePointAt(this.pos) ?? 0;
    const ch = this.unicode ? String.fromCodePoint(cp) : this.src[this.pos];
    this.pos += ch.length;
    return { ...this.node("literal", start, `The character ${describeChar(ch)}`), value: ch };
  }

  parseGroup(): ExplainNode {
    const start = this.pos;
    this.pos++; // (
    let kind = "group";
    let label: string;
    const rest = this.src.slice(this.pos);
    if (rest.startsWith("?:")) {
      this.pos += 2;
      kind = "noncapture";
      label = "Group without capturing:";
    } else if (rest.startsWith("?=")) {
      this.pos += 2;
      kind = "lookahead";
      label = "Lookahead: the following must match here, without consuming it:";
    } else if (rest.startsWith("?!")) {
      this.pos += 2;
      kind = "lookahead";
      label = "Negative lookahead: the following must NOT match here:";
    } else if (rest.startsWith("?<=")) {
      this.pos += 3;
      kind = "lookbehind";
      label = "Lookbehind: the text just before this point must match:";
    } else if (rest.startsWith("?<!")) {
      this.pos += 3;
      kind = "lookbehind";
      label = "Negative lookbehind: the text just before this point must NOT match:";
    } else if (rest.startsWith("?<")) {
      const m = /^\?<([A-Za-z_$][\w$]*)>/.exec(rest);
      if (!m) throw new RegexSyntaxError("Invalid capture group name.", this.pos);
      if (this.names.includes(m[1])) throw new RegexSyntaxError(`Duplicate capture group name "${m[1]}".`, this.pos);
      this.names.push(m[1]);
      this.pos += m[0].length;
      this.groups++;
      kind = "named";
      label = `Capture group #${this.groups} named "${m[1]}":`;
    } else if (rest.startsWith("?")) {
      const m = /^\?([imsx]*)(?:-([imsx]*))?:/.exec(rest);
      if (!m || (!m[1] && !m[2])) throw new RegexSyntaxError("Invalid group: after (? expect :, =, !, <=, <!, <name> or modifiers like i:.", this.pos);
      this.pos += m[0].length;
      kind = "modifiers";
      const on = m[1] ? `turn on ${m[1].split("").join(", ")}` : "";
      const off = m[2] ? `turn off ${m[2].split("").join(", ")}` : "";
      label = `Group with inline flags (${[on, off].filter(Boolean).join("; ")}):`;
    } else {
      this.groups++;
      label = `Capture group #${this.groups}:`;
    }
    const children = this.parseDisjunction();
    if (this.peek() !== ")") throw new RegexSyntaxError("Missing closing parenthesis for the group.", start);
    this.pos++;
    if (children.length === 0) label += " (empty)";
    return this.node(kind, start, label, children);
  }

  parseAtomEscape(): ExplainNode {
    const start = this.pos;
    this.pos++; // backslash
    const c = this.peek();
    if (c === undefined) throw new RegexSyntaxError("The pattern ends with a lone backslash.", start);
    if (c === "b" || c === "B") {
      this.pos++;
      return this.node("boundary", start, c === "b" ? "A word boundary (between a word character and a non-word character)" : "A position that is not a word boundary");
    }
    if (/[1-9]/.test(c)) {
      const m = /^\d+/.exec(this.src.slice(this.pos)) as RegExpExecArray;
      this.pos += m[0].length;
      return this.node("backref", start, `The same text that capture group #${m[0]} matched (backreference)`);
    }
    if (c === "k" && this.peek(1) === "<") {
      const m = /^k<([A-Za-z_$][\w$]*)>/.exec(this.src.slice(this.pos));
      if (!m) throw new RegexSyntaxError("Invalid named backreference.", start);
      this.pos += m[0].length;
      return this.node("backref", start, `The same text that the group named "${m[1]}" matched (backreference)`);
    }
    return this.parseCharEscape(start, false);
  }

  /** Escapes valid both inside and outside classes. Returns node with `src` set to the escape. */
  parseCharEscape(start: number, inClass: boolean): ExplainNode {
    const c = this.peek();
    if (CLASS_ESCAPES[c]) {
      this.pos++;
      return this.node("classEscape", start, CLASS_ESCAPES[c]);
    }
    if (inClass && c === "b") {
      this.pos++;
      return this.node("char", start, "a backspace character");
    }
    if (CHAR_ESCAPES[c]) {
      this.pos++;
      return this.node("char", start, CHAR_ESCAPES[c][1]);
    }
    if (c === "0" && !/[0-9]/.test(this.peek(1) ?? "")) {
      this.pos++;
      return this.node("char", start, "the NUL character (U+0000)");
    }
    if (c === "c" && /[A-Za-z]/.test(this.peek(1) ?? "")) {
      const letter = (this.peek(1) as string).toUpperCase();
      this.pos += 2;
      return this.node("char", start, `control character Ctrl+${letter} (U+${(letter.charCodeAt(0) % 32).toString(16).toUpperCase().padStart(4, "0")})`);
    }
    if (c === "x") {
      const m = /^x([0-9a-fA-F]{2})/.exec(this.src.slice(this.pos));
      if (m) {
        this.pos += 3;
        return this.node("char", start, `the character ${describeChar(String.fromCharCode(parseInt(m[1], 16)))} (hex ${m[1].toUpperCase()})`);
      }
    }
    if (c === "u") {
      const braced = /^u\{([0-9a-fA-F]{1,6})\}/.exec(this.src.slice(this.pos));
      if (braced && this.unicode) {
        const cp = parseInt(braced[1], 16);
        if (cp > 0x10ffff) throw new RegexSyntaxError("Code point is beyond U+10FFFF.", start);
        this.pos += braced[0].length;
        return this.node("char", start, `the character ${describeChar(String.fromCodePoint(cp))} (U+${braced[1].toUpperCase()})`);
      }
      const m = /^u([0-9a-fA-F]{4})/.exec(this.src.slice(this.pos));
      if (m) {
        this.pos += 5;
        return this.node("char", start, `the character ${describeChar(String.fromCharCode(parseInt(m[1], 16)))} (U+${m[1].toUpperCase()})`);
      }
    }
    if ((c === "p" || c === "P") && this.unicode) {
      const m = /^[pP]\{([A-Za-z0-9_=]+)\}/.exec(this.src.slice(this.pos));
      if (!m) throw new RegexSyntaxError("Invalid Unicode property escape. Use the form \\p{Name}.", start);
      this.pos += m[0].length;
      return this.node("property", start, describeProperty(m[1], c === "P"));
    }
    if (inClass && this.sets && c === "q" && this.peek(1) === "{") {
      const end = this.src.indexOf("}", this.pos);
      if (end < 0) throw new RegexSyntaxError("Unterminated \\q{...}.", start);
      const body = this.src.slice(this.pos + 2, end);
      this.pos = end + 1;
      return this.node("char", start, `one of the strings ${body.split("|").map((s) => `"${s}"`).join(", ")}`);
    }
    if (this.unicode && /[A-Za-z0-9]/.test(c)) throw new RegexSyntaxError(`"\\${c}" is not a valid escape in Unicode mode.`, start);
    // identity escape: the character itself
    const cp = this.src.codePointAt(this.pos) ?? 0;
    const ch = String.fromCodePoint(cp);
    this.pos += ch.length;
    if (inClass) return this.node("char", start, describeChar(ch));
    return { ...this.node("literal", start, `The character ${describeChar(ch)}`), value: ch };
  }

  parseClass(): ExplainNode {
    const start = this.pos;
    this.pos++; // [
    let negated = false;
    if (this.peek() === "^") {
      negated = true;
      this.pos++;
    }
    const parts: string[] = [];
    const children: ExplainNode[] = [];
    let op: string | null = null;
    while (this.peek() !== "]") {
      if (this.eof()) throw new RegexSyntaxError("Missing closing ] for the character class.", start);
      if (this.sets && (this.src.startsWith("&&", this.pos) || this.src.startsWith("--", this.pos))) {
        op = this.src.startsWith("&&", this.pos) ? "intersection" : "subtraction";
        const s = this.pos;
        this.pos += 2;
        children.push(this.node("setop", s, op === "intersection" ? "AND ALSO in (intersection with)" : "BUT NOT in (subtraction of)"));
        parts.push(op === "intersection" ? "\u0000AND" : "\u0000NOT");
        continue;
      }
      if (this.sets && this.peek() === "[") {
        const nested = this.parseClass();
        children.push(nested);
        parts.push(nested.text.replace(/^One character/, "a character").replace(/:$/, ""));
        continue;
      }
      const a = this.classAtom();
      if (this.peek() === "-" && this.peek(1) !== "]" && this.peek(1) !== undefined && !(this.sets && this.peek(1) === "-")) {
        const dashPos = this.pos;
        this.pos++;
        const b = this.classAtom();
        if (a.value === null || b.value === null) {
          if (this.unicode) throw new RegexSyntaxError("A class escape like \\d cannot be a range endpoint.", dashPos);
          children.push(a.node, { kind: "char", src: "-", text: '"-"', start: dashPos, end: dashPos + 1 }, b.node);
          parts.push(a.node.text, '"-"', b.node.text);
          continue;
        }
        if (b.value < a.value) throw new RegexSyntaxError("Range out of order in character class.", dashPos);
        const n: ExplainNode = {
          kind: "range",
          src: this.src.slice(a.node.start, this.pos),
          text: `a character from ${a.node.text} to ${b.node.text}`,
          start: a.node.start,
          end: this.pos,
        };
        children.push(n);
        parts.push(rangeLabel(a.node.text, b.node.text));
      } else {
        children.push(a.node);
        parts.push(a.node.text);
      }
    }
    this.pos++; // ]
    let text: string;
    if (children.length === 0) text = negated ? "Any single character (an empty negated class matches everything)" : "Nothing (an empty class never matches)";
    else text = `${negated ? "One character that is NOT" : "One character that is"} ${joinParts(parts)}`;
    if (this.ignoreCase) text += " (case-insensitive)";
    return this.node("class", start, text, children);
  }

  classAtom(): { node: ExplainNode; value: number | null } {
    const start = this.pos;
    if (this.peek() === "\\") {
      this.pos++;
      const n = this.parseCharEscape(start, true);
      return { node: n, value: escapeValue(n.src) };
    }
    const cp = this.src.codePointAt(this.pos) ?? 0;
    const ch = this.unicode ? String.fromCodePoint(cp) : this.src[this.pos];
    this.pos += ch.length;
    return { node: { kind: "char", src: ch, text: describeChar(ch), start, end: this.pos }, value: ch.codePointAt(0) ?? 0 };
  }
}

function rangeLabel(a: string, b: string) {
  return `${a} to ${b}`;
}

/** Joins class parts; "\u0000AND"/"\u0000NOT" markers split v-flag set operations. */
function joinParts(parts: string[]) {
  const segs: string[][] = [[]];
  const ops: string[] = [];
  for (const p of parts) {
    if (p === "\u0000AND" || p === "\u0000NOT") {
      ops.push(p === "\u0000AND" ? "and also" : "but not");
      segs.push([]);
    } else segs[segs.length - 1].push(p);
  }
  let out = segs[0].length ? joinOr(segs[0]) : "";
  for (let i = 0; i < ops.length; i++) out += ` ${ops[i]} ${segs[i + 1].length ? joinOr(segs[i + 1]) : "nothing"}`;
  return out;
}

function joinOr(parts: string[]) {
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " or " + parts[parts.length - 1];
}

/** Code point of a single-character escape (for ranges), or null for class escapes. */
function escapeValue(src: string): number | null {
  const body = src.slice(1);
  if (/^[dDwWsSpP]/.test(body)) return null;
  const map: Record<string, number> = { t: 9, n: 10, v: 11, f: 12, r: 13, b: 8, "0": 0 };
  if (body in map) return map[body];
  let m = /^x([0-9a-fA-F]{2})$/.exec(body);
  if (m) return parseInt(m[1], 16);
  m = /^u\{?([0-9a-fA-F]+)\}?$/.exec(body);
  if (m) return parseInt(m[1], 16);
  m = /^c([A-Za-z])$/.exec(body);
  if (m) return m[1].toUpperCase().charCodeAt(0) % 32;
  if (body.startsWith("q{")) return null;
  return body.codePointAt(0) ?? null;
}

/** Joins runs of plain literal characters into one "match the text" node. */
function mergeLiterals(items: ExplainNode[]): ExplainNode[] {
  const out: ExplainNode[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (it.kind === "literal" && prev && (prev.kind === "literal" || prev.kind === "text")) {
      const value = (prev.value ?? "") + (it.value ?? "");
      out[out.length - 1] = {
        kind: "text",
        src: prev.src + it.src,
        text: `The text "${value}"`,
        start: prev.start,
        end: it.end,
        value,
      };
    } else out.push(it);
  }
  // single literals keep a friendlier label
  return out;
}

export interface Explanation {
  nodes: ExplainNode[];
  groups: number;
  names: string[];
}

export function explainRegex(pattern: string, flags: string): Explanation {
  const bad = flags.replace(/[dgimsuvy]/g, "");
  if (bad) throw new RegexSyntaxError(`Unknown flag "${bad[0]}". Valid flags are d, g, i, m, s, u, v and y.`, -1);
  if (new Set(flags).size !== flags.length) throw new RegexSyntaxError("A flag is repeated.", -1);
  if (flags.includes("u") && flags.includes("v")) throw new RegexSyntaxError("The u and v flags cannot be combined.", -1);
  const p = new Parser(pattern, flags);
  const nodes = p.parseDisjunction();
  if (!p.eof()) throw new RegexSyntaxError("Unmatched closing parenthesis.", p.pos);
  return { nodes, groups: p.groups, names: p.names };
}

/** Plain-text rendering of the tree (for copy). */
export function explanationToText(nodes: ExplainNode[], depth = 0): string {
  return nodes
    .map((n) => `${"  ".repeat(depth)}${n.src ? `${n.src}  ` : ""}→ ${n.text}${n.children?.length ? "\n" + explanationToText(n.children, depth + 1) : ""}`)
    .join("\n");
}
