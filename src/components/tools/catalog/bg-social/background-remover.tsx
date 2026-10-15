"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Btn,
  Checkbox,
  Notice,
  PrivacyNote,
  ResetBtn,
  Segmented,
  ToolPanel,
  uid,
} from "@/components/tools/kit";
import {
  FileDrop,
  ProgressBar,
  Spinner,
  baseName,
  canvasToBlob,
  downloadBlob,
  formatBytes,
  loadImage,
  useObjectUrl,
  zipFiles,
} from "@/components/tools/engines/files";
import { ColorField, RangeField } from "./shared/controls";
import {
  compose,
  toWorkingCanvas,
  type BgMode,
  type ComposeOptions,
  type Mask,
} from "./shared/compose";
import {
  MODELS,
  detectDevice,
  downloadSizeMB,
  friendlyError,
  loadSegmenter,
  supportCheck,
  unloadSegmenter,
  type Device,
  type LoadProgress,
  type ModelKey,
  type Segmenter,
} from "./shared/segmenter";
import { opaqueShare, repairPortraitAlpha } from "./lib/misc";

const MAX_OUTPUT_SIDE = 8192;
const MAX_OUTPUT_PIXELS = 48_000_000;
const MAX_FILES = 10;
const PREVIEW_MAX = 1200;

interface Item {
  id: string;
  file: File;
  status: "queued" | "working" | "done" | "error";
  error?: string;
  src?: HTMLCanvasElement;
  mask?: Mask;
  downscaled?: boolean;
  seconds?: number;
  maskWarning?: "empty" | "full";
}

type Phase =
  | { kind: "idle" }
  | { kind: "download"; progress: LoadProgress | null }
  | { kind: "run"; index: number; total: number }
  | { kind: "error"; message: string };

type Backend = "auto" | "wasm";

export default function Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modelKey, setModelKey] = useState<ModelKey>("fast");
  const [backend, setBackend] = useState<Backend>("auto");
  const [gpu, setGpu] = useState<{ device: Device; fp16: boolean } | null>(
    null,
  );
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [usedDevice, setUsedDevice] = useState<string | null>(null);
  const [opts, setOpts] = useState<ComposeOptions>({
    bg: "transparent",
    color: "#ffffff",
    blur: 30,
    bgImage: null,
    feather: 1,
    cleanup: 0,
  });
  const [bgImageName, setBgImageName] = useState("");
  const [jpg, setJpg] = useState(false);
  const [split, setSplit] = useState(0);
  const [zipping, setZipping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoRunRequested, setAutoRunRequested] = useState(false);

  const runRef = useRef(0);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const unsupported = useMemo(
    () => (typeof window === "undefined" ? null : supportCheck()),
    [],
  );

  useEffect(() => {
    let alive = true;
    const runs = runRef;
    detectDevice().then((d) => alive && setGpu(d));
    return () => {
      alive = false;
      runs.current++; // cancels any batch still running
    };
  }, []);

  const active = items.find((i) => i.id === activeId) ?? items[0] ?? null;
  const done = items.filter((i) => i.status === "done");
  const busy = phase.kind === "download" || phase.kind === "run";

  const device: Device = backend === "wasm" || !gpu ? "wasm" : gpu.device;
  const fp16 = device === "webgpu" && !!gpu?.fp16;
  const sizeFor = (k: ModelKey) => downloadSizeMB(MODELS[k], device, fp16);

  const chooseModel = (key: ModelKey) => {
    setModelKey(key);
    setItems((current) =>
      current.map((item) => ({
        ...item,
        status: "queued",
        error: undefined,
        mask: undefined,
        seconds: undefined,
        maskWarning: undefined,
      })),
    );
    setPhase({ kind: "idle" });
    setSplit(0);
    setAutoRunRequested(items.length > 0);
  };

  /* ------------------------------ preview ------------------------------ */

  useEffect(() => {
    const c = previewRef.current;
    if (!c || !active?.src || !active.mask) return;
    const scale = Math.min(
      1,
      PREVIEW_MAX / Math.max(active.src.width, active.src.height),
    );
    const out = compose(active.src, active.mask, opts, scale);
    c.width = out.width;
    c.height = out.height;
    c.getContext("2d")?.drawImage(out, 0, 0);
    out.width = out.height = 0;
  }, [active, opts]);

  const originalUrl = useObjectUrl(active?.file ?? null);

  /* ------------------------------ actions ------------------------------ */

  const addFiles = (files: File[]) => {
    setNotice(null);
    const room = MAX_FILES - items.length;
    if (room <= 0) {
      setNotice(
        `You can process up to ${MAX_FILES} images at a time. Remove some first.`,
      );
      return;
    }
    if (files.length > room)
      setNotice(
        `Only ${room} more image${room === 1 ? "" : "s"} fit in this batch of ${MAX_FILES}.`,
      );
    const next = files
      .slice(0, room)
      .map<Item>((file) => ({ id: uid(), file, status: "queued" }));
    if (!active && next[0]) setActiveId(next[0].id);
    setItems((prev) => [...prev, ...next]);
    if (next.length) setAutoRunRequested(true);
  };

  const patch = (id: string, p: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const run = async () => {
    const todo = items.filter((i) => i.status !== "done");
    if (!todo.length) return;
    const token = ++runRef.current;
    const alive = () => runRef.current === token;
    setNotice(null);

    let seg: Segmenter;
    let activeModel: ModelKey =
      device === "wasm" && modelKey === "quality" ? "fast" : modelKey;
    let dev = device;
    const progress = (p: LoadProgress) =>
      alive() && setPhase({ kind: "download", progress: p });
    try {
      setPhase({ kind: "download", progress: null });
      if (activeModel !== modelKey)
        setNotice(
          "The high-quality model needs WebGPU on this device, so the lightweight portrait model is being used on the CPU.",
        );
      try {
        seg = await loadSegmenter(activeModel, dev, fp16, progress);
      } catch (primaryError) {
        if (dev === "webgpu") {
          dev = "wasm";
          setBackend("wasm");
          try {
            activeModel = "fast";
            seg = await loadSegmenter("fast", "wasm", false, progress);
            setNotice(
              "WebGPU was unavailable, so processing continued automatically with the lightweight CPU model.",
            );
          } catch (cpuError) {
            throw cpuError;
          }
        } else {
          throw primaryError;
        }
      }
    } catch (e) {
      if (alive())
        setPhase({ kind: "error", message: friendlyError(e, activeModel) });
      return;
    }
    if (!alive()) return;
    setUsedDevice(
      `${seg.device === "webgpu" ? "GPU (WebGPU)" : "CPU (WebAssembly)"}, ${seg.dtype}, ${MODELS[activeModel].label}`,
    );

    for (let n = 0; n < todo.length; n++) {
      const it = todo[n];
      if (!alive()) return;
      setPhase({ kind: "run", index: n + 1, total: todo.length });
      patch(it.id, { status: "working", error: undefined });
      const t0 = performance.now();
      try {
        const bmp = await loadImage(it.file);
        const { canvas: src, downscaled } = toWorkingCanvas(
          bmp,
          MAX_OUTPUT_SIDE,
          MAX_OUTPUT_PIXELS,
        );
        const { canvas: small } = toWorkingCanvas(bmp, seg.info.inferMax);
        bmp.close();
        let mask: Mask | null = null;
        try {
          mask = await seg.run(small);
        } catch (primaryError) {
          let lastError: unknown = primaryError;
          if (seg.device === "webgpu") {
            try {
              await unloadSegmenter(
                activeModel,
                "webgpu",
                seg.dtype === "fp16",
              );
              setBackend("wasm");
              activeModel = "fast";
              seg = await loadSegmenter("fast", "wasm", false, () => {});
              setUsedDevice(
                `CPU (WebAssembly), ${seg.dtype}, ${MODELS[activeModel].label}`,
              );
              setNotice(
                "The GPU stopped during processing, so the tool continued automatically with the lightweight CPU model.",
              );
              mask = await seg.run(small);
              lastError = null;
            } catch (cpuError) {
              lastError = cpuError;
            }
          }
          if (lastError) throw lastError;
        }
        if (!mask) throw new Error("The background-removal model returned no mask.");
        if (activeModel === "fast")
          mask = {
            ...mask,
            alpha: repairPortraitAlpha(mask.alpha, mask.w, mask.h),
          };
        small.width = small.height = 0;
        if (!alive()) return;
        const share = opaqueShare(mask.alpha);
        patch(it.id, {
          status: "done",
          src,
          mask,
          downscaled,
          seconds: (performance.now() - t0) / 1000,
          maskWarning:
            share < 0.005 ? "empty" : share > 0.995 ? "full" : undefined,
        });
      } catch (e) {
        if (!alive()) return;
        patch(it.id, { status: "error", error: friendlyError(e, activeModel) });
      }
    }
    if (alive()) setPhase({ kind: "idle" });
  };

  useEffect(() => {
    if (
      !autoRunRequested ||
      phase.kind !== "idle" ||
      !items.some((item) => item.status === "queued")
    )
      return;
    const timer = window.setTimeout(() => {
      setAutoRunRequested(false);
      void run();
    }, 0);
    return () => window.clearTimeout(timer);
    // `run` intentionally uses the latest render's model, backend and items.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunRequested, items, phase.kind]);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const reset = () => {
    runRef.current++;
    setItems([]);
    setActiveId(null);
    setPhase({ kind: "idle" });
    setNotice(null);
    setAutoRunRequested(false);
    opts.bgImage?.close();
    setOpts((o) => ({ ...o, bgImage: null, bg: "transparent" }));
    setBgImageName("");
  };

  const transparent = opts.bg === "transparent";
  const outType = !transparent && jpg ? "image/jpeg" : "image/png";
  const outExt = outType === "image/jpeg" ? "jpg" : "png";

  const render = async (it: Item) => {
    if (!it.src || !it.mask) throw new Error("Not processed yet.");
    const c = compose(it.src, it.mask, opts, 1);
    const blob = await canvasToBlob(
      c,
      outType,
      outType === "image/jpeg" ? 0.92 : undefined,
    );
    c.width = c.height = 0;
    return blob;
  };

  const downloadOne = async (it: Item) => {
    try {
      downloadBlob(
        await render(it),
        `${baseName(it.file.name)}-no-bg.${outExt}`,
      );
    } catch (e) {
      setNotice(friendlyError(e, modelKey));
    }
  };

  const downloadZip = async () => {
    setZipping(true);
    try {
      const entries: { name: string; data: Blob }[] = [];
      for (const it of done)
        entries.push({
          name: `${baseName(it.file.name)}-no-bg.${outExt}`,
          data: await render(it),
        });
      downloadBlob(await zipFiles(entries, 0), "backgrounds-removed.zip");
    } catch (e) {
      setNotice(friendlyError(e, modelKey));
    } finally {
      setZipping(false);
    }
  };

  const setBgImage = async (files: File[]) => {
    try {
      const bmp = await loadImage(files[0]);
      opts.bgImage?.close();
      setOpts((o) => ({ ...o, bg: "image", bgImage: bmp }));
      setBgImageName(files[0].name);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not read that image.");
    }
  };

  /* ------------------------------- render ------------------------------- */

  if (unsupported) {
    return (
      <ToolPanel title="Background remover">
        <Notice tone="error" title="This browser can't run the model">
          {unsupported}
        </Notice>
      </ToolPanel>
    );
  }

  const pending = items.filter((i) => i.status !== "done").length;

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Remove image backgrounds"
        actions={
          items.length > 0 ? (
            <ResetBtn onClick={reset} label="Start over" />
          ) : undefined
        }
      >
        <div className="space-y-5">
          <fieldset>
            <legend className="text-sm font-medium text-ink">Model</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(Object.keys(MODELS) as ModelKey[]).map((k) => {
                const m = MODELS[k];
                const checked = modelKey === k;
                return (
                  <label
                    key={k}
                    className={`relative flex cursor-pointer flex-col gap-1 rounded-xl p-4 text-sm shadow-[inset_0_0_0_1px_var(--line-strong)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${checked ? "bg-accent-soft shadow-[inset_0_0_0_2px_var(--accent)]" : "bg-surface hover:bg-sunken"}`}
                  >
                    <input
                      type="radio"
                      name="bg-model"
                      value={k}
                      checked={checked}
                      disabled={busy || (k === "quality" && device === "wasm")}
                      onChange={() => chooseModel(k)}
                      className="sr-only"
                    />
                    <span className="font-semibold text-ink">
                      {m.label}{" "}
                      {checked && <span className="sr-only">(selected)</span>}
                    </span>
                    <span className="text-ink-2">{m.blurb}</span>
                    <span className="text-muted">
                      {m.license} license · {sizeFor(k).toFixed(1)} MB download
                      {k === "quality" && device === "wasm"
                        ? " (fp32 on CPU)"
                        : ""}
                      {k === "quality" && device === "webgpu"
                        ? fp16
                          ? " (fp16 on GPU)"
                          : " (fp32 on GPU)"
                        : ""}
                    </span>
                    {k === "quality" && device === "wasm" && (
                      <span className="text-muted">Requires WebGPU on this device.</span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Run on</p>
              <Segmented
                label="Backend"
                value={backend}
                onChange={(v) => setBackend(v)}
                options={[
                  {
                    value: "auto",
                    label: gpu?.device === "webgpu" ? "GPU (WebGPU)" : "Auto",
                  },
                  { value: "wasm", label: "CPU only" },
                ]}
              />
            </div>
            <p className="max-w-md text-[0.8125rem] text-muted">
              {gpu === null
                ? "Checking for WebGPU…"
                : gpu.device === "webgpu"
                  ? "WebGPU is available, so the model can run on your graphics card. If it fails, the tool falls back to the CPU."
                  : "WebGPU isn't available here, so the model runs on the CPU with WebAssembly. It works, just more slowly."}
            </p>
          </div>

          <FileDrop
            multiple
            maxFiles={MAX_FILES}
            maxSizeMB={30}
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp"
            onFiles={addFiles}
            allowPaste
            label="Choose up to 10 images or drop them here"
            hint="JPG, PNG, WebP or AVIF, up to 30 MB each. Native resolution is preserved whenever the browser can process it safely."
          />
          {notice && <Notice tone="warning">{notice}</Notice>}

          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Btn icon="spark" onClick={run} disabled={busy || pending === 0}>
                {pending === 0
                  ? "All images processed"
                  : `Remove background${pending > 1 ? `s (${pending})` : ""}`}
              </Btn>
              {usedDevice && (
                <span className="text-[0.8125rem] text-muted">
                  Running on {usedDevice}
                </span>
              )}
            </div>
          )}

          {phase.kind === "download" && (
            <div className="space-y-2">
              {phase.progress &&
              phase.progress.ratio !== null &&
              phase.progress.ratio < 1 ? (
                <ProgressBar
                  value={phase.progress.ratio}
                  label={`Downloading model: ${formatBytes(phase.progress.loadedBytes)} of ${formatBytes(phase.progress.totalBytes)}`}
                />
              ) : (
                <Spinner label="Preparing the model" />
              )}
              <p className="text-[0.8125rem] text-muted">
                Only the model files are downloaded (from Hugging Face). Your
                browser caches them, so the next run starts much faster.
              </p>
            </div>
          )}
          {phase.kind === "run" && (
            <ProgressBar
              value={(phase.index - 1) / phase.total}
              label={`Processing image ${phase.index} of ${phase.total}`}
            />
          )}
          {phase.kind === "error" && (
            <Notice tone="error" title="Couldn't load the model">
              {phase.message}
            </Notice>
          )}

          {items.length > 0 && (
            <ul
              className="grid gap-2 sm:grid-cols-2"
              aria-label="Images in this batch"
            >
              {items.map((it) => (
                <li
                  key={it.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${active?.id === it.id ? "bg-accent-soft" : "bg-sunken"}`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(it.id)}
                    aria-pressed={active?.id === it.id}
                    className="min-h-10 min-w-0 flex-1 truncate rounded-md px-2 text-left text-ink hover:bg-surface"
                    title={it.file.name}
                  >
                    {it.file.name}
                  </button>
                  <span className="shrink-0 text-[0.8125rem] text-muted">
                    {it.status === "queued" && "Waiting"}
                    {it.status === "working" && "Working…"}
                    {it.status === "done" &&
                      `Done${it.seconds ? ` in ${it.seconds.toFixed(1)} s` : ""}`}
                    {it.status === "error" && (
                      <span className="text-danger">Failed</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    disabled={it.status === "working"}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:opacity-40"
                    aria-label={`Remove ${it.file.name}`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ToolPanel>

      {active && (
        <ToolPanel title="Result">
          {active.status === "error" ? (
            <Notice tone="error" title={`Couldn't process ${active.file.name}`}>
              {active.error}
            </Notice>
          ) : active.status !== "done" ? (
            <div className="grid gap-4">
              {originalUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img
                  src={originalUrl}
                  alt={`Original: ${active.file.name}`}
                  className="mx-auto max-h-[420px] w-auto max-w-full rounded-lg"
                />
              )}
              <p className="text-center text-sm text-muted">
                {active.status === "working"
                  ? "Finding the subject…"
                  : "Press “Remove background” to process this image."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-3">
                <div className="relative overflow-hidden rounded-lg bg-[repeating-conic-gradient(var(--sunken)_0_25%,var(--surface)_0_50%)] bg-[length:20px_20px]">
                  {originalUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img
                      src={originalUrl}
                      alt=""
                      aria-hidden="true"
                      className="block h-auto w-full"
                      style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                    />
                  )}
                  <canvas
                    ref={previewRef}
                    role="img"
                    aria-label={`${active.file.name} with the background ${opts.bg === "transparent" ? "removed (transparent)" : opts.bg === "color" ? `replaced by ${opts.color}` : opts.bg === "blur" ? "blurred" : "replaced by your image"}`}
                    className="absolute inset-0 h-full w-full"
                    style={{ clipPath: `inset(0 0 0 ${split}%)` }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                    style={{ left: `${split}%` }}
                  />
                </div>
                <RangeField
                  label="Before / after"
                  value={split}
                  min={0}
                  max={100}
                  onChange={setSplit}
                  format={(v) => `${100 - v}% shows the result`}
                />
                <p className="text-[0.8125rem] text-muted">
                  Output: {active.src?.width}×{active.src?.height} px, lossless
                  PNG when the background is transparent.
                </p>
                {active.downscaled && (
                  <p className="text-[0.8125rem] text-muted">
                    This image exceeded the browser-safe canvas limit, so it was
                    reduced to {active.src?.width}×{active.src?.height} px.
                  </p>
                )}
                {active.maskWarning === "empty" && (
                  <Notice tone="warning">
                    The model found almost no foreground in this image. Try the
                    other model, or a photo with a clearer subject.
                  </Notice>
                )}
                {active.maskWarning === "full" && (
                  <Notice tone="warning">
                    The model kept almost the whole image, so little background
                    was removed. Try the High quality model or use a photo with
                    clearer separation between subject and background.
                  </Notice>
                )}
              </div>

              <div className="min-w-0 space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-ink">
                    New background
                  </p>
                  <Segmented<BgMode>
                    label="Background"
                    value={opts.bg}
                    onChange={(v) => setOpts((o) => ({ ...o, bg: v }))}
                    options={[
                      { value: "transparent", label: "None" },
                      { value: "color", label: "Color" },
                      { value: "blur", label: "Blur" },
                      { value: "image", label: "Image" },
                    ]}
                  />
                </div>
                {(opts.bg === "color" || opts.bg === "image") && (
                  <ColorField
                    label={
                      opts.bg === "image"
                        ? "Fill behind image"
                        : "Background color"
                    }
                    value={opts.color}
                    onChange={(v) => setOpts((o) => ({ ...o, color: v }))}
                  />
                )}
                {opts.bg === "blur" && (
                  <RangeField
                    label="Blur strength"
                    value={opts.blur}
                    min={5}
                    max={100}
                    onChange={(v) => setOpts((o) => ({ ...o, blur: v }))}
                  />
                )}
                {opts.bg === "image" && (
                  <FileDrop
                    compact
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    maxSizeMB={30}
                    onFiles={setBgImage}
                    label={
                      bgImageName
                        ? `Replace ${bgImageName}`
                        : "Choose a background image"
                    }
                    hint="It is scaled to fill the frame."
                  />
                )}
                <RangeField
                  label="Edge feather"
                  value={opts.feather}
                  min={0}
                  max={8}
                  step={0.5}
                  onChange={(v) => setOpts((o) => ({ ...o, feather: v }))}
                  format={(v) => `${v} px`}
                  hint="Softens the cut-out edge slightly."
                />
                <RangeField
                  label="Edge cleanup"
                  value={opts.cleanup}
                  min={0}
                  max={60}
                  onChange={(v) => setOpts((o) => ({ ...o, cleanup: v }))}
                  hint="Higher removes faint halos but can thin hair."
                />
                {!transparent && (
                  <Checkbox
                    label="Save as JPG (smaller file)"
                    checked={jpg}
                    onChange={setJpg}
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <Btn icon="download" onClick={() => downloadOne(active)}>
                    Download {outExt.toUpperCase()}
                  </Btn>
                  {done.length > 1 && (
                    <Btn
                      variant="ghost"
                      icon="download"
                      onClick={downloadZip}
                      disabled={zipping}
                    >
                      {zipping ? "Zipping…" : `All ${done.length} as ZIP`}
                    </Btn>
                  )}
                </div>
                <p className="text-[0.8125rem] text-muted">
                  Settings apply to every image in the batch.
                </p>
              </div>
            </div>
          )}
        </ToolPanel>
      )}
      <PrivacyNote />
    </div>
  );
}
