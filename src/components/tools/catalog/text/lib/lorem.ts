/** Lorem ipsum generator with an injectable random source. Self-contained. */

/** Pseudo-Latin vocabulary in the style of the traditional printer's filler text. */
export const LOREM_WORDS = `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore
magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure
in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui
officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc vitae ligula mauris viverra porta augue
suscipit varius neque maecenas faucibus mollis interdum donec ullamcorper nulla non metus auctor fringilla vestibulum morbi
blandit cursus risus at ultrices integer posuere erat a ante venenatis dapibus aenean lacinia bibendum quam pellentesque ornare
sem lacinia quam venenatis vestibulum etiam porta malesuada magna mollis euismod cras mattis consectetur purus fermentum
massa justo sit amet risus praesent commodo cursus nibh ultricies vehicula elementum nullam quis risus eget urna mollis
sollicitudin felis sagittis tellus ac cursus commodo tortor mauris condimentum fusce dapibus tellus tristique senectus netus
habitant volutpat odio facilisis arcu dictum gravida pulvinar sapien eleifend accumsan lectus proin libero nam placerat`
  .split(/\s+/)
  .filter(Boolean);

export const LOREM_START = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";

export type LoremKind = "paragraphs" | "sentences" | "words" | "list";

type Rand = () => number;

const pick = <T,>(arr: readonly T[], r: Rand) => arr[Math.floor(r() * arr.length)];
const between = (min: number, max: number, r: Rand) => min + Math.floor(r() * (max - min + 1));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function words(n: number, r: Rand): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let w = pick(LOREM_WORDS, r);
    while (out.length && w === out[out.length - 1]) w = pick(LOREM_WORDS, r);
    out.push(w);
  }
  return out;
}

export function sentence(r: Rand, min = 6, max = 14): string {
  const ws = words(between(min, max, r), r);
  // Add a comma in longer sentences for a natural rhythm.
  if (ws.length > 8) ws[between(3, ws.length - 4, r)] += ",";
  return cap(ws.join(" ")) + (r() < 0.08 ? "?" : ".");
}

function paragraph(r: Rand): string {
  return Array.from({ length: between(4, 7, r) }, () => sentence(r)).join(" ");
}

export function generateLorem(kind: LoremKind, count: number, o: { startWithLorem?: boolean; html?: boolean }, r: Rand = Math.random): string {
  const n = Math.max(1, Math.min(kind === "words" ? 5000 : 500, Math.floor(count)));
  let items: string[];
  switch (kind) {
    case "words": {
      const ws = words(n, r);
      if (o.startWithLorem) {
        const start = LOREM_START.replace(",", "").toLowerCase().split(" ");
        for (let i = 0; i < Math.min(n, start.length); i++) ws[i] = start[i];
      }
      items = [cap(ws.join(" ")) + "."];
      break;
    }
    case "sentences":
      items = [Array.from({ length: n }, () => sentence(r)).join(" ")];
      break;
    case "list":
      items = Array.from({ length: n }, () => sentence(r, 3, 8).replace(/[.?]$/, ""));
      break;
    default:
      items = Array.from({ length: n }, () => paragraph(r));
  }
  if (o.startWithLorem && kind !== "words") {
    // Replace the opening of the first item with the classic phrase.
    const first = items[0];
    const rest = first.replace(/^[^.?]*[.?]\s*/, "");
    items[0] = kind === "list" ? "Lorem ipsum dolor sit amet" : `${LOREM_START}. ${rest}`.trim();
  }
  if (kind === "list") {
    return o.html ? `<ul>\n${items.map((i) => `  <li>${i}</li>`).join("\n")}\n</ul>` : items.map((i) => `- ${i}`).join("\n");
  }
  if (o.html) return items.map((p) => `<p>${p}</p>`).join("\n");
  return items.join("\n\n");
}
