/**
 * PDF helpers. pdf.js (rendering/text extraction) and pdf-lib (editing) are
 * both loaded on demand so they never weigh on pages that don't use them.
 * Worker, character maps and standard fonts are self-hosted in /public/vendor.
 */

export const VENDOR = {
  pdfWorker: "/vendor/pdfjs/pdf.worker.min.mjs",
  pdfCMaps: "/vendor/pdfjs/cmaps/",
  pdfFonts: "/vendor/pdfjs/standard_fonts/",
  sqlWasm: "/vendor/sqljs/sql-wasm-browser.wasm",
  libarchiveWorker: "/vendor/libarchive/worker-bundle.js",
  tesseractWorker: "/vendor/tesseract/worker.min.js",
  tesseractCore: "/vendor/tesseract-core",
  ortWasm: "/vendor/ort/",
} as const;

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

/**
 * pdf.js 6 calls newer built-ins (Uint8Array#toHex, Map#getOrInsertComputed…)
 * that older Safari/Chrome lack. Patch the ones it needs before loading it.
 */
function polyfillForPdfjs() {
  const u8 = Uint8Array.prototype as Uint8Array & { toHex?: () => string };
  if (typeof u8.toHex !== "function") {
    Object.defineProperty(Uint8Array.prototype, "toHex", {
      configurable: true,
      writable: true,
      value(this: Uint8Array) {
        let s = "";
        for (let i = 0; i < this.length; i++) s += this[i].toString(16).padStart(2, "0");
        return s;
      },
    });
  }
  const mp = Map.prototype as Map<unknown, unknown> & { getOrInsertComputed?: unknown };
  if (typeof mp.getOrInsertComputed !== "function") {
    Object.defineProperty(Map.prototype, "getOrInsertComputed", {
      configurable: true,
      writable: true,
      value(this: Map<unknown, unknown>, key: unknown, cb: (k: unknown) => unknown) {
        if (!this.has(key)) this.set(key, cb(key));
        return this.get(key);
      },
    });
  }
}

/** Loads pdf.js once and points it at the self-hosted worker. */
export function getPdfjs(): Promise<PdfJs> {
  polyfillForPdfjs();
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = VENDOR.pdfWorker;
      return m;
    });
  }
  return pdfjsPromise;
}

/** Opens a PDF for rendering/reading. Throws a friendly error for encrypted or broken files. */
export async function openPdf(data: ArrayBuffer | Uint8Array, password?: string) {
  const pdfjs = await getPdfjs();
  // pdf.js transfers the buffer to its worker; pass a copy so callers can reuse theirs.
  const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0));
  try {
    return await pdfjs.getDocument({
      data: bytes,
      password,
      cMapUrl: VENDOR.pdfCMaps,
      cMapPacked: true,
      standardFontDataUrl: VENDOR.pdfFonts,
    }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "PasswordException") throw new Error("This PDF is password-protected. Remove its password protection in a trusted PDF reader, then try again.");
    if (name === "InvalidPDFException") throw new Error("This file is not a valid PDF or is damaged.");
    throw e instanceof Error ? e : new Error("Could not open this PDF.");
  }
}

/** Renders one page (1-based) to a canvas at the given scale (1 = 72 DPI). */
export async function renderPage(
  doc: Awaited<ReturnType<typeof openPdf>>,
  pageNumber: number,
  scale = 1.5,
  background = "#ffffff",
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  page.cleanup();
  return canvas;
}

/** Loads pdf-lib on demand. */
export const getPdfLib = () => import("pdf-lib");

/**
 * Parses page ranges like "1-3, 5, 8-" against a page count.
 * Returns 1-based page numbers in the given order, or an error message.
 */
export function parsePageRanges(input: string, pageCount: number): number[] | string {
  const s = input.trim();
  if (!s) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: number[] = [];
  for (const part of s.split(",").map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)?\s*(-)?\s*(\d+)?$/);
    if (!m || (!m[1] && !m[3])) return `"${part}" is not a page or range (use forms like 3, 2-5 or 8-).`;
    const a = m[1] ? Number(m[1]) : 1;
    const b = m[2] ? (m[3] ? Number(m[3]) : pageCount) : a;
    if (a < 1 || b < 1 || a > pageCount || b > pageCount) return `Page ${Math.max(a, b)} doesn't exist; this PDF has ${pageCount} pages.`;
    const step = a <= b ? 1 : -1;
    for (let p = a; step > 0 ? p <= b : p >= b; p += step) out.push(p);
  }
  return out;
}

const fontCache = new Map<string, Promise<ArrayBuffer>>();
function fetchFont(path: string) {
  if (!fontCache.has(path)) fontCache.set(path, fetch(path).then((r) => {
    if (!r.ok) throw new Error("Could not load the PDF font.");
    return r.arrayBuffer();
  }));
  return fontCache.get(path)!;
}

/**
 * Embeds Noto Sans (regular + bold, SIL OFL, self-hosted in /public/fonts) so
 * generated PDFs can render accented and non-Latin (Greek, Cyrillic) text.
 * pdf-lib's standard fonts only cover WinAnsi. Fonts are subset to the glyphs used.
 */
export async function embedUnicodeFonts(doc: import("pdf-lib").PDFDocument) {
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  doc.registerFontkit(fontkit);
  const [reg, bold] = await Promise.all([fetchFont("/fonts/NotoSans-Regular.ttf"), fetchFont("/fonts/NotoSans-Bold.ttf")]);
  const [regular, boldFont] = await Promise.all([doc.embedFont(reg, { subset: true }), doc.embedFont(bold, { subset: true })]);
  return { regular, bold: boldFont };
}
