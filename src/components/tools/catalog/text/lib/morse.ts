/**
 * International Morse code (ITU-R M.1677-1) plus timing for audio playback.
 * Self-contained for direct Node testing.
 */

export const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--", "/": "-..-.", "(": "-.--.", ")": "-.--.-",
  "&": ".-...", ":": "---...", ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", _: "..--.-", '"': ".-..-.", $: "...-..-", "@": ".--.-.",
};

const REVERSE: Record<string, string> = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

/** Common accented letters mapped to their base letter before encoding. */
function fold(ch: string): string {
  return ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function textToMorse(text: string): { output: string; unknown: string[] } {
  const unknown = new Set<string>();
  const words = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      Array.from(w.toUpperCase())
        .map((ch) => {
          const code = MORSE[ch] ?? MORSE[fold(ch)];
          if (!code) unknown.add(ch);
          return code ?? "";
        })
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean);
  return { output: words.join(" / "), unknown: [...unknown] };
}

export function morseToText(morse: string): { output: string; unknown: string[] } {
  const unknown = new Set<string>();
  const norm = morse
    .replace(/[•·∙]/g, ".")
    .replace(/[−–—_]/g, "-")
    .trim();
  if (/[^.\-\s/|]/.test(norm)) throw new Error("Morse input may contain only dots, dashes, spaces and / between words.");
  const words = norm.split(/\s*[/|]\s*|\s{3,}/).filter((w) => w.trim());
  const output = words
    .map((w) =>
      w
        .trim()
        .split(/\s+/)
        .map((code) => {
          const ch = REVERSE[code];
          if (!ch) unknown.add(code);
          return ch ?? "�";
        })
        .join(""),
    )
    .join(" ");
  return { output, unknown: [...unknown] };
}

/** A tone or silence with a duration in seconds. */
export type Segment = { on: boolean; seconds: number };

/**
 * Builds a playback schedule. The dot length is 1.2 / wpm seconds (PARIS
 * standard). With Farnsworth timing (effective wpm below character wpm),
 * characters keep full speed and only the gaps between characters and words
 * stretch: ta = (60c − 37.2s) / (s·c), char gap = 3ta/19, word gap = 7ta/19.
 */
export function morseSchedule(morse: string, wpm: number, effectiveWpm?: number): Segment[] {
  const c = Math.max(1, wpm);
  const s = effectiveWpm && effectiveWpm < c ? Math.max(1, effectiveWpm) : c;
  const dot = 1.2 / c;
  let charGap = 3 * dot;
  let wordGap = 7 * dot;
  if (s < c) {
    const ta = (60 * c - 37.2 * s) / (s * c);
    charGap = (3 * ta) / 19;
    wordGap = (7 * ta) / 19;
  }
  const out: Segment[] = [];
  const words = morse.trim().split(/\s*\/\s*/).filter(Boolean);
  words.forEach((w, wi) => {
    if (wi > 0) out.push({ on: false, seconds: wordGap });
    const letters = w.split(/\s+/).filter(Boolean);
    letters.forEach((l, li) => {
      if (li > 0) out.push({ on: false, seconds: charGap });
      Array.from(l).forEach((sym, si) => {
        if (si > 0) out.push({ on: false, seconds: dot });
        out.push({ on: true, seconds: sym === "-" ? 3 * dot : dot });
      });
    });
  });
  return out;
}

export function scheduleDuration(seg: Segment[]): number {
  return seg.reduce((a, b) => a + b.seconds, 0);
}
