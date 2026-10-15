// Copies worker/WASM assets that tools load at runtime into public/vendor,
// so nothing is fetched from third-party CDNs. Runs on install and before builds.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (p) => join(root, "node_modules", p);
const out = (p) => join(root, "public", "vendor", p);

const copies = [
  ["pdfjs-dist/build/pdf.worker.min.mjs", "pdfjs/pdf.worker.min.mjs"],
  ["pdfjs-dist/cmaps", "pdfjs/cmaps"],
  ["pdfjs-dist/standard_fonts", "pdfjs/standard_fonts"],
  ["sql.js/dist/sql-wasm.wasm", "sqljs/sql-wasm.wasm"],
  ["sql.js/dist/sql-wasm-browser.wasm", "sqljs/sql-wasm-browser.wasm"],
  ["libarchive.js/dist/worker-bundle.js", "libarchive/worker-bundle.js"],
  ["libarchive.js/dist/libarchive.wasm", "libarchive/libarchive.wasm"],
  ["tesseract.js/dist/worker.min.js", "tesseract/worker.min.js"],
];

for (const [from, to] of copies) {
  const src = nm(from);
  if (!existsSync(src)) {
    console.warn(`[copy-vendor] missing ${from}`);
    continue;
  }
  mkdirSync(dirname(out(to)), { recursive: true });
  cpSync(src, out(to), { recursive: true });
}

// tesseract core (all SIMD/non-SIMD variants; the worker picks one at runtime)
const core = nm("tesseract.js-core");
if (existsSync(core)) {
  mkdirSync(out("tesseract-core"), { recursive: true });
  for (const f of readdirSync(core)) if (/^tesseract-core(-simd|-relaxedsimd)?-lstm\.wasm\.js$/.test(f)) cpSync(join(core, f), out(`tesseract-core/${f}`));
}


console.log("[copy-vendor] done");
