# Brief for tool batch implementers

You are implementing one batch of the `/tools` catalog for a Next.js 16 + React 19 + TypeScript + Tailwind v4 site (brand "Nuvella Promo Code", an AI engineering studio). Every tool must **really work** in the browser, look consistent with the site, and ship original, useful supporting content. You work in parallel with other agents, each owning a different batch.

## Read first (fully)
- `docs/tool-inventory.md` — every tool, its slug, batch and the functionality to implement. Your batch's rows are your scope.
- `src/components/tools/kit.tsx` — shared UI kit (ToolPanel, fields, Btn, CopyBtn, ResetBtn, ResultCard, StatGrid, Notice, EmptyState, OutputBlock, PrivacyNote, Segmented, Checkbox, CellInput/CellSelect, parseNum, fmt, uid, downloadFile, usePersistentState).
- `src/components/tools/engines/FormulaTool.tsx` — declarative calculator engine (fields, units, modes, compute → outputs/steps/table/visual) + `num()`/`fixed()` formatters. Use it for every formula-style calculator.
- `src/components/tools/engines/UnitConverterTool.tsx` — unit converter engine.
- `src/components/tools/engines/TextTransformTool.tsx` — text-in/text-out engine.
- `src/components/tools/engines/files.tsx` — FileDrop, FileChip, Spinner, ProgressBar, formatBytes, baseName/withExt/uniqueNames, downloadBlob, zipFiles (fflate), fileToBytes, fileToDataURL, loadImage, canvasToBlob, canEncode, useObjectUrl.
- `src/components/tools/engines/pdf.ts` — getPdfjs/openPdf/renderPage (pdf.js with self-hosted worker), getPdfLib, parsePageRanges, `embedUnicodeFonts(doc)` (Noto Sans regular/bold via @pdf-lib/fontkit; use it for any generated PDF text so accented/Greek/Cyrillic characters work; pdf-lib StandardFonts only cover WinAnsi), `VENDOR` paths for self-hosted wasm/workers (sql.js, libarchive, tesseract, onnxruntime).
- `src/content/catalog/types.ts` (`CatalogTool`), `src/content/catalog/categories.ts`.
- `src/components/ui/Icon.tsx` — valid icon names are the keys of `paths` (type `AnyIcon`).
- One existing tool for style reference: `src/components/tools/engineering/json-formatter.tsx`.

## Deliverables for your batch `<batch>`
1. **Content**: replace the placeholder `src/content/catalog/tools/<batch>.ts` with `export const tools: CatalogTool[] = [...]` — one entry per tool in your batch, in inventory order.
2. **Components**: `src/components/tools/catalog/<batch>/<slug>.tsx` — `"use client"`, a single `export default function Tool()` (no props). Put shared helpers/data for your batch in `src/components/tools/catalog/<batch>/lib/` (pure TS, no React) so they can be unit-tested.
3. **Loader map**: delete `src/components/tools/catalog/<batch>/loaders.ts` and create `loaders.tsx`:
   ```tsx
   "use client";
   import dynamic from "next/dynamic";
   import type { ComponentType } from "react";
   import { ToolLoading } from "../loading";
   const opts = { loading: () => <ToolLoading /> };
   export const components: Record<string, ComponentType> = {
     "some-slug": dynamic(() => import("./some-slug"), opts),
     // one entry per tool; each import() must be a string literal
   };
   ```

## Content rules (`CatalogTool`)
- Slugs, names and categories exactly as in the inventory. `icon`: pick the most fitting `AnyIcon`.
- 100% original wording. Never copy text from the reference site or anywhere else.
- `summary` ≤ 20 words. `h1` unique, ≤ 10 words, natural (e.g. "Merge PDF files in your browser"). `metaTitle` ≤ 52 chars (" | Nuvella Promo Code" is appended). `metaDescription` 130-160 chars. `primaryKeyword`: the realistic search phrase. `intro` 1-2 sentences.
- `instructions` 3-5 steps that match your actual UI. `howItWorks` 2-3 short paragraphs describing the real method, formulas, standards and **honest limits**. `example` with concrete, **correct** input/output. `faqs` 3-4 genuinely useful Q&As (privacy, limits, edge cases, interpretation).
- `related`: 3 slugs that exist in the inventory (any batch).
- `network`: set a plain-language disclosure if anything is fetched over the network (e.g. a model or font download). Omit for fully local tools.
- `popular: true` on the 2-3 most broadly useful tools of your batch.
- Inline markup allowed in text: `` `code` ``, `**bold**`, `[text](/path)` (internal links only to /tools/<slug>, /student-tools/<slug>, /articles/<slug>, /services/<slug>).
- No fabricated statistics or claims. Sentence case. US English. No em dashes in UI strings (use commas, colons, periods). Avoid "seamless", "leverage", "unlock", "powerful", "cutting-edge".

## Functionality rules
- Real, working functionality for every tool. No placeholder buttons, no fake results. If something is technically impossible in a browser, implement the closest honest version and state the limit in the UI and in `howItWorks`; list it in your final report.
- Everything runs locally. No network calls, except: self-hosted assets under `/vendor/*`, and these disclosed downloads: tesseract language data, the background-removal model from Hugging Face, Google Fonts for the font-pairing preview. Never send user data anywhere.
- Libraries are already installed (see package.json). **Do not install packages.** Import heavy libraries (pdf-lib, pdfjs, mathjs, prettier, svgo, terser, faker, tesseract, transformers, sql.js, libarchive, zip.js, music-metadata, heic2any, @zxing, wasm-media-encoders, marked, turndown, dompurify, diff, js-yaml, fast-xml-parser, papaparse, jose, otpauth, zxcvbn) **dynamically on first use** (`const { PDFDocument } = await import("pdf-lib")`), not at the top of the module. Small libraries (qrcode, jsbarcode, cronstrue, libphonenumber-js) may be top-level imports. Exception: when a library must be available synchronously for live calculation (e.g. mathjs inside a `FormulaTool` `compute`), a top-level import in that one tool file is acceptable because every tool is its own lazily loaded chunk.
- For `FormulaTool`/`TextTransformTool`/`UnitConverterTool`: define the spec / transform / units array at **module scope** (stable references), then `export default function Tool() { return <FormulaTool spec={spec} /> }`.
- States: empty, validation errors near fields, processing (Spinner/ProgressBar), success, error (Notice). Copy/download/reset where it makes sense. Validate file type and size (FileDrop does both; set sensible `maxSizeMB`). Revoke object URLs. Handle cancellation/unmount of long tasks.
- Persist user-created data (planners, lists, drafts) with `usePersistentState("<slug>", initial)` and show `<PrivacyNote stored />`; otherwise `<PrivacyNote />` once per tool (engines already include one; don't double up).
- Accessibility: every control labelled; keyboard operable (drag interactions need a keyboard/button alternative); status not by color alone; `prefers-reduced-motion` respected for any animation; canvas/SVG outputs get text alternatives.
- Mobile: works at 375px wide; no horizontal page overflow (wide tables/output scroll inside their own box); tap targets ≥ 40px.
- Never use `dangerouslySetInnerHTML` except to show HTML that you have sanitized with DOMPurify (loaded dynamically). Never `eval`/`new Function` user input (mathjs `evaluate` is fine).
- Math and data must be correct. Verify formulas against known values. For reference datasets (atomic weights, tax brackets, CPI, size charts, IBAN lengths), use authoritative values, state the source/year in `howItWorks`, and keep the data in your batch's `lib/` or `data/` folder.
- TypeScript strict: no `any`. Must pass `npx tsc --noEmit -p .` and `npx eslint src/components/tools/catalog/<batch> src/content/catalog/tools/<batch>.ts` with zero errors (react-hooks rules: derive state instead of setState inside effects; no ref reads during render).

## Do not
- Run `next build`, `next dev`, `npm run build`/`dev`, or `npm install` (other agents are working; the lead runs builds centrally).
- Edit files outside your batch folders, your content file, and your loaders. Shared engines/kit are read-only: if you find a bug there, work around it locally and mention it in your report.
- Rebuild tools marked `existing` or `alias` in the inventory.

## Verify before reporting
- `npx tsc --noEmit -p .` (ignore errors located in other batches' files) and eslint on your paths: zero errors.
- Unit-test pure logic in `lib/` with Node 24 (it runs `.ts` directly: write a throwaway test script in your scratch area or `lib/__check__.ts`, then delete it) for every calculation/parsing function with known answers.

## Final report (keep it short)
- Slugs implemented (count).
- Any tool with reduced functionality vs the inventory note, and why.
- Any network/model/API requirement.
- Anything in shared code you had to work around.
