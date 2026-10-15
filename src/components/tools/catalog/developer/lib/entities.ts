/**
 * HTML entity encoding and decoding. The named table covers the 253 entities
 * of HTML 4.01 plus &apos; (with HTML5 code points for &lang; and &rang;).
 * Decoding of other HTML5 names is delegated to an optional resolver.
 */

const LATIN1 =
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml";

const OTHER =
  "quot:34 amp:38 apos:39 lt:60 gt:62 OElig:338 oelig:339 Scaron:352 scaron:353 Yuml:376 fnof:402 circ:710 tilde:732 " +
  "Alpha:913 Beta:914 Gamma:915 Delta:916 Epsilon:917 Zeta:918 Eta:919 Theta:920 Iota:921 Kappa:922 Lambda:923 Mu:924 Nu:925 Xi:926 Omicron:927 Pi:928 Rho:929 Sigma:931 Tau:932 Upsilon:933 Phi:934 Chi:935 Psi:936 Omega:937 " +
  "alpha:945 beta:946 gamma:947 delta:948 epsilon:949 zeta:950 eta:951 theta:952 iota:953 kappa:954 lambda:955 mu:956 nu:957 xi:958 omicron:959 pi:960 rho:961 sigmaf:962 sigma:963 tau:964 upsilon:965 phi:966 chi:967 psi:968 omega:969 thetasym:977 upsih:978 piv:982 " +
  "ensp:8194 emsp:8195 thinsp:8201 zwnj:8204 zwj:8205 lrm:8206 rlm:8207 ndash:8211 mdash:8212 lsquo:8216 rsquo:8217 sbquo:8218 ldquo:8220 rdquo:8221 bdquo:8222 dagger:8224 Dagger:8225 bull:8226 hellip:8230 permil:8240 prime:8242 Prime:8243 lsaquo:8249 rsaquo:8250 oline:8254 frasl:8260 euro:8364 " +
  "image:8465 weierp:8472 real:8476 trade:8482 alefsym:8501 larr:8592 uarr:8593 rarr:8594 darr:8595 harr:8596 crarr:8629 lArr:8656 uArr:8657 rArr:8658 dArr:8659 hArr:8660 " +
  "forall:8704 part:8706 exist:8707 empty:8709 nabla:8711 isin:8712 notin:8713 ni:8715 prod:8719 sum:8721 minus:8722 lowast:8727 radic:8730 prop:8733 infin:8734 ang:8736 and:8743 or:8744 cap:8745 cup:8746 int:8747 there4:8756 sim:8764 cong:8773 asymp:8776 ne:8800 equiv:8801 le:8804 ge:8805 sub:8834 sup:8835 nsub:8836 sube:8838 supe:8839 oplus:8853 otimes:8855 perp:8869 sdot:8901 " +
  "lceil:8968 rceil:8969 lfloor:8970 rfloor:8971 lang:10216 rang:10217 loz:9674 spades:9824 clubs:9827 hearts:9829 diams:9830";

export const NAMED: Record<string, number> = (() => {
  const t: Record<string, number> = {};
  LATIN1.split(" ").forEach((name, i) => (t[name] = 160 + i));
  for (const pair of OTHER.split(" ")) {
    const [name, cp] = pair.split(":");
    t[name] = Number(cp);
  }
  return t;
})();

const BY_CODE: Map<number, string> = (() => {
  const m = new Map<number, string>();
  for (const [name, cp] of Object.entries(NAMED)) if (!m.has(cp)) m.set(cp, name);
  return m;
})();

/** Names browsers also decode without a trailing semicolon (legacy subset used here). */
const LEGACY = new Set(["amp", "lt", "gt", "quot", "nbsp", "copy", "reg", ...LATIN1.split(" ")]);

/** HTML spec: numeric references 0x80-0x9F map through windows-1252. */
const C1: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

function fromNumeric(n: number): string {
  if (n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return "�";
  if (C1[n]) return String.fromCodePoint(C1[n]);
  return String.fromCodePoint(n);
}

export interface DecodeResult {
  text: string;
  decoded: number;
  unknown: string[];
}

/**
 * Decodes character references. `resolve` receives an unknown "&name;" and
 * may return its expansion (for the full HTML5 table) or null.
 */
export function decodeEntities(input: string, resolve?: (ref: string) => string | null): DecodeResult {
  let decoded = 0;
  const unknown = new Set<string>();
  const text = input.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([A-Za-z][A-Za-z0-9]*))(;?)/g, (m, dec: string, hex: string, name: string, semi: string) => {
    if (dec !== undefined || hex !== undefined) {
      decoded++;
      const n = dec !== undefined ? parseInt(dec, 10) : parseInt(hex, 16);
      return fromNumeric(Number.isFinite(n) ? n : 0);
    }
    if (name in NAMED && (semi || LEGACY.has(name))) {
      decoded++;
      return String.fromCodePoint(NAMED[name]) + (semi ? "" : "");
    }
    if (semi && resolve) {
      const r = resolve(m);
      if (r !== null && r !== m) {
        decoded++;
        return r;
      }
    }
    if (semi) unknown.add(m);
    return m;
  });
  return { text, decoded, unknown: [...unknown] };
}

export type EncodeMode = "minimal" | "numeric" | "named";

export interface EncodeOptions {
  mode: EncodeMode;
  hex: boolean;
  /** Also escape " and ' (needed inside attribute values). */
  quotes: boolean;
  /** Encode line breaks and tabs too (numeric). */
  whitespace: boolean;
}

export function encodeEntities(input: string, o: EncodeOptions): { text: string; encoded: number } {
  let encoded = 0;
  const num = (cp: number) => (o.hex ? `&#x${cp.toString(16).toUpperCase()};` : `&#${cp};`);
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0) as number;
    let rep: string | null = null;
    if (ch === "&") rep = "&amp;";
    else if (ch === "<") rep = "&lt;";
    else if (ch === ">") rep = "&gt;";
    else if (ch === '"' && o.quotes) rep = o.mode === "numeric" ? num(cp) : "&quot;";
    else if (ch === "'" && o.quotes) rep = "&#39;";
    else if (o.whitespace && (ch === "\n" || ch === "\t" || ch === "\r")) rep = num(cp);
    else if (cp > 126 && o.mode !== "minimal") {
      if (o.mode === "named" && BY_CODE.has(cp)) rep = `&${BY_CODE.get(cp)};`;
      else rep = num(cp);
    }
    if (rep !== null) {
      encoded++;
      out += rep;
    } else out += ch;
  }
  return { text: out, encoded };
}
