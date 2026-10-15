"use client";

import { useEffect, useRef, useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, PrivacyNote, ResetBtn, SelectField, TextArea, ToolPanel, downloadFile, fmt } from "@/components/tools/kit";
import { FileChip, FileDrop, ProgressBar, baseName, canvasToBlob, useObjectUrl } from "@/components/tools/engines/files";
import { VENDOR } from "@/components/tools/engines/pdf";
import { errMsg } from "./shared";
import { bitmapToCanvas, decodeImage, makeCanvas } from "./lib/pipeline";

const LANGS = [
  { value: "eng", label: "English" },
  { value: "spa", label: "Spanish" },
  { value: "fra", label: "French" },
  { value: "deu", label: "German" },
  { value: "ita", label: "Italian" },
  { value: "por", label: "Portuguese" },
  { value: "hin", label: "Hindi" },
  { value: "ara", label: "Arabic" },
  { value: "chi_sim", label: "Chinese (Simplified)" },
  { value: "urd", label: "Urdu" },
];

const PSM = [
  { value: "3", label: "Automatic page layout" },
  { value: "6", label: "Single block of text" },
  { value: "4", label: "Single column, varied sizes" },
  { value: "7", label: "Single line" },
  { value: "11", label: "Sparse text (labels, signs)" },
];

const STATUS: Record<string, string> = {
  "loading tesseract core": "Loading the OCR engine",
  "initializing tesseract": "Starting the OCR engine",
  "loading language traineddata": "Downloading language data",
  "loading language traineddata (from cache)": "Loading language data from cache",
  "initializing api": "Preparing",
  "recognizing text": "Recognizing text",
};

type TWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

/** Optional cleanup: grayscale + upscale small images, which helps Tesseract on screenshots. */
async function prepare(file: File, enhance: boolean): Promise<Blob> {
  if (!enhance) return file;
  const bmp = await decodeImage(file);
  try {
    const short = Math.min(bmp.width, bmp.height);
    const k = short < 1000 ? Math.min(3, 1000 / short) : 1;
    const src = k > 1 ? null : bitmapToCanvas(bmp);
    const { canvas, ctx } = makeCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
    ctx.drawImage(src ?? bmp, 0, 0, canvas.width, canvas.height);
    // Grayscale + mild contrast boost in pixels (works in every browser).
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      const v = (l - 128) * 1.25 + 128;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(d, 0, 0);
    return await canvasToBlob(canvas, "image/png");
  } finally {
    bmp.close();
  }
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const url = useObjectUrl(file);
  const [lang, setLang] = useState("eng");
  const [addEng, setAddEng] = useState(true);
  const [psm, setPsm] = useState("3");
  const [enhance, setEnhance] = useState(true);
  const [status, setStatus] = useState<{ label: string; p: number } | null>(null);
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<{ w: TWorker; langs: string } | null>(null);
  const busy = useRef(false);

  useEffect(
    () => () => {
      worker.current?.w.terminate();
      worker.current = null;
    },
    [],
  );

  const langs = lang !== "eng" && addEng ? `${lang}+eng` : lang;

  const run = async () => {
    if (!file || busy.current) return;
    busy.current = true;
    setError(null);
    setText("");
    setConfidence(null);
    setStatus({ label: "Loading the OCR engine", p: 0 });
    try {
      const image = await prepare(file, enhance);
      if (!worker.current || worker.current.langs !== langs) {
        await worker.current?.w.terminate();
        worker.current = null;
        const { createWorker } = await import("tesseract.js");
        const w = await createWorker(langs, 1, {
          workerPath: VENDOR.tesseractWorker,
          corePath: VENDOR.tesseractCore,
          logger: (m) => setStatus({ label: STATUS[m.status] ?? m.status, p: m.progress ?? 0 }),
        });
        worker.current = { w, langs };
      }
      await worker.current.w.setParameters({ tessedit_pageseg_mode: psm as never, preserve_interword_spaces: "1" });
      const res = await worker.current.w.recognize(image);
      setText(res.data.text.replace(/\n{3,}/g, "\n\n").trim());
      setConfidence(res.data.confidence);
    } catch (e) {
      const m = errMsg(e);
      setError(/network|fetch|load/i.test(m) ? `Could not load the OCR engine or language data (${m}). Check your connection and try again.` : m);
      await worker.current?.w.terminate();
      worker.current = null;
    } finally {
      setStatus(null);
      busy.current = false;
    }
  };

  const cancel = async () => {
    await worker.current?.w.terminate();
    worker.current = null;
    setStatus(null);
    busy.current = false;
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Extract text from an image" actions={file ? <ResetBtn onClick={() => { setFile(null); setText(""); setConfidence(null); }} label="New image" /> : undefined}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            {file ? (
              <>
                <FileChip file={file} />
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="Image to read" className="max-h-72 w-full rounded-lg bg-sunken object-contain" />
                )}
              </>
            ) : (
              <FileDrop onFiles={(f) => setFile(f[0] ?? null)} accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" maxSizeMB={25} allowPaste label="Choose an image with text" hint="Photos of documents, screenshots or scans. PNG, JPG, WebP, BMP or GIF up to 25 MB." />
            )}
            <SelectField label="Language" value={lang} onChange={(e) => setLang(e.target.value)} options={LANGS} />
            {lang !== "eng" && <Checkbox label="Also recognize English" checked={addEng} onChange={setAddEng} hint="Useful for mixed text; downloads a second language file." />}
            <SelectField label="Layout" value={psm} onChange={(e) => setPsm(e.target.value)} options={PSM} />
            <Checkbox label="Enhance before reading" checked={enhance} onChange={setEnhance} hint="Converts to grayscale, boosts contrast and enlarges small images." />
            {status ? (
              <div className="space-y-2">
                <ProgressBar value={status.p} label={status.label} />
                <Btn variant="ghost" onClick={cancel}>
                  Cancel
                </Btn>
              </div>
            ) : (
              <Btn icon="text" disabled={!file} onClick={run}>
                Extract text
              </Btn>
            )}
            <Notice>The first run downloads the language data (about 2 to 10 MB per language) from a public CDN; your browser caches it. The image itself never leaves your device.</Notice>
          </div>
          <div className="min-w-0 space-y-4">
            {error && <Notice tone="error">{error}</Notice>}
            {text || confidence !== null ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ink-2" aria-live="polite">
                    {fmt(text.length, 0)} characters
                    {confidence !== null ? `, average confidence ${fmt(confidence, 0)}%` : ""}
                  </p>
                  <div className="flex gap-2">
                    <CopyBtn text={text} />
                    <Btn variant="ghost" icon="download" disabled={!text} onClick={() => downloadFile(`${file ? baseName(file.name) : "ocr"}.txt`, text)}>
                      .txt
                    </Btn>
                  </div>
                </div>
                {confidence !== null && confidence < 60 && <Notice tone="warning">Low confidence. Try a sharper or larger image, the correct language, or a different layout setting.</Notice>}
                <TextArea label="Recognized text (editable)" rows={16} value={text} onChange={(e) => setText(e.target.value)} />
              </>
            ) : (
              <EmptyState icon="text" title="No text yet">Choose an image and press Extract text. Results appear here for you to correct, copy or download.</EmptyState>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
