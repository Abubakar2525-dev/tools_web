/**
 * In-browser foreground segmentation with Transformers.js (Apache-2.0) and
 * ONNX Runtime Web. Only model files are downloaded (from the Hugging Face
 * Hub, then cached by the browser); images never leave the device.
 *
 * Models (licenses verified on the Hugging Face model API, Oct 2026):
 * - Xenova/modnet: MODNet portrait matting, Apache-2.0. fp32 ONNX, 25.9 MB.
 * - onnx-community/BiRefNet_lite-ONNX: BiRefNet lite, MIT.
 *   fp16 ONNX 114.5 MB (WebGPU with shader-f16), otherwise fp32 224.0 MB.
 */

import { VENDOR } from "@/components/tools/engines/pdf";

export type ModelKey = "fast" | "quality";

export interface ModelInfo {
  key: ModelKey;
  id: string;
  label: string;
  license: string;
  input: string;
  output: string;
  /** Download size in MB per dtype. */
  sizes: { fp32: number; fp16?: number };
  /** Longest side fed to the processor (it resizes again internally). */
  inferMax: number;
  blurb: string;
}

export const MODELS: Record<ModelKey, ModelInfo> = {
  fast: {
    key: "fast",
    id: "Xenova/modnet",
    label: "Fast, portraits (MODNet)",
    license: "Apache-2.0",
    input: "input",
    output: "output",
    sizes: { fp32: 25.9 },
    inferMax: 1024,
    blurb:
      "Small and quick. Tuned for people and portraits; weaker on products and objects.",
  },
  quality: {
    key: "quality",
    id: "onnx-community/BiRefNet_lite-ONNX",
    label: "High quality, general (recommended)",
    license: "MIT",
    input: "input_image",
    output: "output_image",
    sizes: { fp32: 224.0, fp16: 114.5 },
    inferMax: 1024,
    blurb:
      "Sharper edges on any subject (products, pets, people). Large download and slower without a GPU.",
  },
};

export type Device = "webgpu" | "wasm";

export interface LoadProgress {
  /** 0..1 when known. */
  ratio: number | null;
  loadedBytes: number;
  totalBytes: number;
  file: string;
}

type GpuNavigator = Navigator & {
  gpu?: {
    requestAdapter(): Promise<{
      features: { has(name: string): boolean };
    } | null>;
  };
};

export async function detectDevice(): Promise<{
  device: Device;
  fp16: boolean;
}> {
  if (typeof navigator === "undefined") return { device: "wasm", fp16: false };
  const gpu = (navigator as GpuNavigator).gpu;
  if (!gpu) return { device: "wasm", fp16: false };
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { device: "wasm", fp16: false };
    return { device: "webgpu", fp16: adapter.features.has("shader-f16") };
  } catch {
    return { device: "wasm", fp16: false };
  }
}

export function downloadSizeMB(info: ModelInfo, device: Device, fp16: boolean) {
  return device === "webgpu" && fp16 && info.sizes.fp16
    ? info.sizes.fp16
    : info.sizes.fp32;
}

type TensorLike = {
  dims: number[];
  type: string;
  data: ArrayLike<number>;
  to(type: "float32"): TensorLike;
  dispose?: () => void;
};

type ImageProcessor = (image: unknown) => Promise<{
  pixel_values: TensorLike;
}>;

export interface Segmenter {
  info: ModelInfo;
  device: Device;
  dtype: "fp32" | "fp16";
  /** Returns the model's alpha mask (0..255) at the model's output resolution. */
  run(
    canvas: HTMLCanvasElement,
  ): Promise<{ alpha: Uint8ClampedArray; w: number; h: number }>;
  dispose(): Promise<void>;
}

const cache = new Map<string, Promise<Segmenter>>();

const dtypeFor = (key: ModelKey, device: Device, fp16: boolean): "fp32" | "fp16" =>
  device === "webgpu" && fp16 && MODELS[key].sizes.fp16 ? "fp16" : "fp32";

const segmenterCacheKey = (key: ModelKey, device: Device, fp16: boolean) =>
  `${key}:${device}:${dtypeFor(key, device, fp16)}`;

export function supportCheck(): string | null {
  if (typeof WebAssembly === "undefined")
    return "This browser does not support WebAssembly, which the model needs. Try a current version of Chrome, Edge, Firefox or Safari.";
  if (typeof createImageBitmap === "undefined")
    return "This browser cannot decode images for processing. Please update it.";
  return null;
}

/** Loads (once per model/device) and returns a segmenter. */
export function loadSegmenter(
  key: ModelKey,
  device: Device,
  fp16: boolean,
  onProgress: (p: LoadProgress) => void,
): Promise<Segmenter> {
  const dtype = dtypeFor(key, device, fp16);
  const cacheKey = segmenterCacheKey(key, device, fp16);
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const p = create(key, device, dtype, onProgress);
  cache.set(cacheKey, p);
  p.catch(() => cache.delete(cacheKey));
  return p;
}

/** Removes and disposes a failed session before another backend is loaded. */
export async function unloadSegmenter(
  key: ModelKey,
  device: Device,
  fp16: boolean,
) {
  const cacheKey = segmenterCacheKey(key, device, fp16);
  const pending = cache.get(cacheKey);
  cache.delete(cacheKey);
  if (!pending) return;
  try {
    const segmenter = await pending;
    await segmenter.dispose();
  } catch {
    // A session that failed while loading has already removed itself.
  }
}

async function create(
  key: ModelKey,
  device: Device,
  dtype: "fp32" | "fp16",
  onProgress: (p: LoadProgress) => void,
): Promise<Segmenter> {
  const info = MODELS[key];
  const { AutoModel, AutoProcessor, RawImage, env } =
    await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  const onnx = env.backends.onnx;
  if (onnx.wasm) {
    onnx.wasm.wasmPaths = VENDOR.ortWasm;
    // multithreading needs cross-origin isolation; avoid a noisy fallback warning otherwise
    if (typeof crossOriginIsolated !== "undefined" && !crossOriginIsolated)
      onnx.wasm.numThreads = 1;
  }

  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (i: {
    status: string;
    file?: string;
    loaded?: number;
    total?: number;
    progress?: number;
  }) => {
    if (i.status === "progress" && i.file) {
      files.set(i.file, { loaded: i.loaded ?? 0, total: i.total ?? 0 });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      onProgress({
        ratio: total > 0 ? loaded / total : null,
        loadedBytes: loaded,
        totalBytes: total,
        file: i.file,
      });
    }
  };

  const model = await AutoModel.from_pretrained(info.id, {
    device,
    dtype,
    progress_callback,
  });
  let processor: ImageProcessor;
  try {
    processor = (await AutoProcessor.from_pretrained(info.id, {
      progress_callback,
    })) as unknown as ImageProcessor;
  } catch (error) {
    await model.dispose();
    throw error;
  }

  const run = async (canvas: HTMLCanvasElement) => {
    const image = RawImage.fromCanvas(canvas);
    let pixelValues: TensorLike | undefined;
    const tensors = new Set<TensorLike>();
    try {
      const processed = await processor(image);
      pixelValues = processed.pixel_values;
      const outputs = (await model({ [info.input]: pixelValues })) as Record<
        string,
        TensorLike
      >;
      for (const tensor of Object.values(outputs)) tensors.add(tensor);
      const raw = outputs[info.output] ?? Object.values(outputs)[0];
      if (!raw) throw new Error("The model returned no mask.");
      const t = raw.to("float32");
      tensors.add(t);
      const dims = t.dims;
      const mh = dims[dims.length - 2];
      const mw = dims[dims.length - 1];
      const data = t.data;
      let needsSigmoid = false;
      for (let i = 0; i < data.length; i += 97) {
        if (data[i] < -1e-5 || data[i] > 1 + 1e-5) {
          needsSigmoid = true;
          break;
        }
      }
      const small = new Uint8ClampedArray(mw * mh);
      for (let i = 0; i < small.length; i++) {
        const v = needsSigmoid ? 1 / (1 + Math.exp(-data[i])) : data[i];
        small[i] = Math.round(v * 255);
      }
      return { alpha: small, w: mw, h: mh };
    } finally {
      pixelValues?.dispose?.();
      for (const tensor of tensors) tensor.dispose?.();
    }
  };

  return {
    info,
    device,
    dtype,
    run,
    dispose: async () => {
      await model.dispose();
    },
  };
}

/** Turns low-level runtime failures into actionable messages. */
export function friendlyError(e: unknown, key: ModelKey): string {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  if (/memory|OOM|allocat|bad[_ ]?alloc|RangeError|Aborted|out of bounds/i.test(msg)) {
    return key === "quality"
      ? "Your device ran out of memory while running the high-quality model. Close other tabs, try the fast model, or use a smaller image."
      : "Your device ran out of memory. Close other tabs or try a smaller image.";
  }
  if (/fetch|network|Failed to load|404|ERR_/i.test(msg)) {
    return "The model files could not be downloaded. Check your connection (or any content blocker) and try again.";
  }
  if (/webgpu|adapter|device lost|GPU/i.test(msg))
    return "The GPU backend failed and the automatic CPU retry could not finish. CPU-only mode is now selected; retry with the Fast model if this device has limited memory.";
  if (/wasm|WebAssembly/i.test(msg))
    return "The WebAssembly runtime could not start in this browser. Try a current version of Chrome, Edge, Firefox or Safari.";
  return `Processing failed: ${msg}`;
}
