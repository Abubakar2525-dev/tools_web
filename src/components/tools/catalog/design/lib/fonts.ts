/**
 * Curated Google Fonts pairings (our own selection and notes).
 * Weights listed are ones each family actually ships, so the css2 request is valid.
 */

export type Font = { family: string; weights: number[]; fallback: "serif" | "sans-serif" | "monospace" };
export type Pairing = { id: string; heading: Font; body: Font; mood: Mood[]; why: string };
export type Mood = "editorial" | "modern" | "friendly" | "technical" | "classic" | "bold" | "elegant";

export const MOODS: { value: Mood | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "modern", label: "Modern" },
  { value: "editorial", label: "Editorial" },
  { value: "classic", label: "Classic" },
  { value: "friendly", label: "Friendly" },
  { value: "technical", label: "Technical" },
  { value: "bold", label: "Bold" },
  { value: "elegant", label: "Elegant" },
];

const serif = (family: string, weights: number[] = [400, 700]): Font => ({ family, weights, fallback: "serif" });
const sans = (family: string, weights: number[] = [400, 700]): Font => ({ family, weights, fallback: "sans-serif" });
const mono = (family: string, weights: number[] = [400, 700]): Font => ({ family, weights, fallback: "monospace" });

export const PAIRINGS: Pairing[] = [
  { id: "playfair-source", heading: serif("Playfair Display", [700]), body: sans("Source Sans 3"), mood: ["editorial", "elegant"], why: "High-contrast display serif for headlines, a calm humanist sans for paragraphs. The contrast in stroke weight does the work, so keep headings large." },
  { id: "fraunces-inter", heading: serif("Fraunces", [600]), body: sans("Inter"), mood: ["modern", "editorial"], why: "Fraunces adds warmth and a little quirk to headings while Inter stays neutral and very legible at small UI sizes." },
  { id: "dmserif-dmsans", heading: serif("DM Serif Display", [400]), body: sans("DM Sans"), mood: ["modern", "elegant"], why: "Designed side by side, so proportions and x-heights line up. An easy, low-risk pairing for landing pages." },
  { id: "spacegrotesk-inter", heading: sans("Space Grotesk", [700]), body: sans("Inter"), mood: ["technical", "modern"], why: "Space Grotesk's squared details read as technical without being cold; Inter keeps long text effortless." },
  { id: "baskerville-lato", heading: serif("Libre Baskerville", [700]), body: sans("Lato"), mood: ["classic"], why: "A bookish transitional serif over a friendly geometric-humanist sans. Works for firms, schools and publishers." },
  { id: "merriweather-opensans", heading: serif("Merriweather", [700]), body: sans("Open Sans"), mood: ["classic", "editorial"], why: "Merriweather was drawn for screens, so it holds up in bold headings; Open Sans is a dependable reading face." },
  { id: "montserrat-merriweather", heading: sans("Montserrat", [700]), body: serif("Merriweather"), mood: ["editorial", "bold"], why: "Flips the usual order: a wide geometric sans for headings and a sturdy serif for long-form reading." },
  { id: "oswald-sourceserif", heading: sans("Oswald", [600]), body: serif("Source Serif 4"), mood: ["editorial", "bold"], why: "Condensed headings fit long titles in narrow columns, newspaper style. Source Serif 4 gives the body a calm texture." },
  { id: "poppins-lora", heading: sans("Poppins", [600]), body: serif("Lora"), mood: ["friendly"], why: "Round, geometric headings feel approachable; Lora's brushed curves keep the body warm instead of corporate." },
  { id: "raleway-crimson", heading: sans("Raleway", [700]), body: serif("Crimson Pro"), mood: ["elegant"], why: "Raleway's thin elegance in heavier weights suits titles. Crimson Pro is an old-style serif that rewards long reading." },
  { id: "archivoblack-archivo", heading: sans("Archivo Black", [400]), body: sans("Archivo"), mood: ["bold"], why: "One family at two extremes: a heavy grotesque for punchy headings and its regular cut for body copy." },
  { id: "bricolage-figtree", heading: sans("Bricolage Grotesque", [700]), body: sans("Figtree"), mood: ["modern", "friendly"], why: "Bricolage has character in its ink traps and optical sizes; Figtree is clean and friendly enough not to compete." },
  { id: "cormorant-proza", heading: serif("Cormorant Garamond", [600]), body: sans("Proza Libre"), mood: ["elegant"], why: "Cormorant is delicate and needs size, so use it big. Proza Libre's humanist forms complement its calligraphic roots." },
  { id: "ebgaramond-worksans", heading: serif("EB Garamond", [600]), body: sans("Work Sans"), mood: ["classic", "editorial"], why: "A Renaissance serif with a slightly wide grotesque body. Good for literary sites, portfolios and long essays." },
  { id: "sora-nunitosans", heading: sans("Sora", [600]), body: sans("Nunito Sans"), mood: ["modern", "technical"], why: "Sora's geometric shapes look precise for product and finance headings; Nunito Sans softens the body text." },
  { id: "syne-karla", heading: sans("Syne", [700]), body: sans("Karla"), mood: ["bold", "modern"], why: "Syne's stretched bold weight is distinctive for studios and events. Karla is a quiet grotesque that lets it lead." },
  { id: "plexserif-plexsans", heading: serif("IBM Plex Serif", [600]), body: sans("IBM Plex Sans"), mood: ["technical", "classic"], why: "A superfamily: matching metrics across serif and sans make documentation and reports feel consistent." },
  { id: "robotoslab-roboto", heading: serif("Roboto Slab", [700]), body: sans("Roboto"), mood: ["technical", "friendly"], why: "Slab serifs give headings weight without fuss, and Roboto is familiar and very readable in interfaces." },
  { id: "josefin-cardo", heading: sans("Josefin Sans", [700]), body: serif("Cardo"), mood: ["elegant", "classic"], why: "Josefin's vintage geometric look pairs with Cardo's scholarly serif for boutique and hospitality sites." },
  { id: "abril-nunito", heading: serif("Abril Fatface", [400]), body: sans("Nunito"), mood: ["bold", "friendly"], why: "A fat-face display serif for one or two words at large sizes, balanced by a rounded, easy body face." },
  { id: "bebas-montserrat", heading: sans("Bebas Neue", [400]), body: sans("Montserrat"), mood: ["bold"], why: "All-caps condensed headings with a wide geometric body. Strong for posters, sports and event pages." },
  { id: "newsreader-publicsans", heading: serif("Newsreader", [600]), body: sans("Public Sans"), mood: ["editorial", "classic"], why: "Newsreader is built for headlines and articles; Public Sans is plain and trustworthy, suited to civic and news sites." },
  { id: "outfit-mulish", heading: sans("Outfit", [600]), body: sans("Mulish"), mood: ["friendly", "modern"], why: "Two clean geometric sans faces with different rhythm: Outfit tighter for headings, Mulish more open for text." },
  { id: "rubik-hind", heading: sans("Rubik", [600]), body: sans("Hind"), mood: ["friendly"], why: "Rubik's slightly rounded corners feel playful in headings, and Hind keeps body copy compact and clear." },
  { id: "zilla-intertight", heading: serif("Zilla Slab", [600]), body: sans("Inter Tight"), mood: ["technical", "editorial"], why: "A slab with personality on top of a tightly spaced neutral sans. Good for blogs about software and science." },
  { id: "lexend-atkinson", heading: sans("Lexend", [600]), body: sans("Atkinson Hyperlegible"), mood: ["friendly", "modern"], why: "Both faces were designed with readability in mind: Atkinson distinguishes similar letters like I, l and 1." },
  { id: "instrument-pair", heading: serif("Instrument Serif", [400]), body: sans("Instrument Sans"), mood: ["editorial", "elegant"], why: "A condensed display serif and its companion sans. Fashionable, editorial and easy to keep consistent." },
  { id: "jetbrains-inter", heading: mono("JetBrains Mono", [700]), body: sans("Inter"), mood: ["technical"], why: "Monospaced headings signal developer content; keep the body in a proportional sans so paragraphs stay readable." },
  { id: "spectral-manrope", heading: serif("Spectral", [600]), body: sans("Manrope"), mood: ["modern", "elegant"], why: "Spectral was made for screen reading and looks refined in headings; Manrope's modern grotesque keeps things current." },
  { id: "unbounded-albert", heading: sans("Unbounded", [700]), body: sans("Albert Sans"), mood: ["bold", "technical"], why: "Unbounded is wide and loud, best for short headings. Albert Sans gives a neutral, geometric base underneath." },
  { id: "alegreya-pair", heading: serif("Alegreya", [700]), body: sans("Alegreya Sans"), mood: ["classic", "friendly"], why: "Calligraphic serif and humanist sans from one designer, with shared proportions. Lovely for books and long reads." },
];

/** Google Fonts css2 URL for one or more families (display=swap). */
export function googleFontsUrl(fonts: Font[]) {
  const seen = new Map<string, Set<number>>();
  for (const f of fonts) {
    const s = seen.get(f.family) ?? new Set<number>();
    f.weights.forEach((w) => s.add(w));
    seen.set(f.family, s);
  }
  const fam = [...seen.entries()].map(([family, ws]) => {
    const list = [...ws].sort((a, b) => a - b);
    const name = family.replace(/ /g, "+");
    return list.length === 1 && list[0] === 400 ? `family=${name}` : `family=${name}:wght@${list.join(";")}`;
  });
  return `https://fonts.googleapis.com/css2?${fam.join("&")}&display=swap`;
}

export const stack = (f: Font) => `"${f.family}", ${f.fallback}`;

export function embedHtml(p: Pairing) {
  const url = googleFontsUrl([p.heading, p.body]);
  return [
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link rel="stylesheet" href="${url}">`,
  ].join("\n");
}

export function pairingCss(p: Pairing) {
  return [
    `:root {`,
    `  --font-heading: ${stack(p.heading)};`,
    `  --font-body: ${stack(p.body)};`,
    `}`,
    ``,
    `body {`,
    `  font-family: var(--font-body);`,
    `  font-weight: 400;`,
    `  line-height: 1.6;`,
    `}`,
    ``,
    `h1, h2, h3 {`,
    `  font-family: var(--font-heading);`,
    `  font-weight: ${p.heading.weights[0]};`,
    `  line-height: 1.15;`,
    `}`,
  ].join("\n");
}
