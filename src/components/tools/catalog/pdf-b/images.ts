"use client";

/** Image intake for the PDF editors: PNG/JPG pass through, other formats become PNG. */

import { canvasToBlob, fileToBytes } from "@/components/tools/engines/files";
import { decodeImage } from "@/components/tools/catalog/image/lib/pipeline";
import type { StoredImage } from "./lib/write";
import { jpegOrientation } from "./lib/text";

export async function fileToStoredImage(file: File): Promise<StoredImage & { blob: Blob }> {
  const bmp = await decodeImage(file);
  const width = bmp.width;
  const height = bmp.height;
  const type = file.type.toLowerCase();
  const isJpg = type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
  const isPng = type === "image/png" || /\.png$/i.test(file.name);
  if (isJpg || isPng) {
    const bytes = await fileToBytes(file);
    // PDF ignores EXIF rotation, so rotated JPGs are re-encoded below as the browser shows them.
    if (isPng || jpegOrientation(bytes) === 1) {
      bmp.close();
      return { bytes, type: isPng ? "png" : "jpg", width, height, blob: file };
    }
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const asJpg = isJpg;
  const blob = await canvasToBlob(c, asJpg ? "image/jpeg" : "image/png", asJpg ? 0.92 : undefined);
  return { bytes: await fileToBytes(blob), type: asJpg ? "jpg" : "png", width, height, blob };
}

/** Converts a canvas to a stored PNG. */
export async function canvasToStoredImage(c: HTMLCanvasElement): Promise<StoredImage & { blob: Blob }> {
  const blob = await canvasToBlob(c, "image/png");
  return { bytes: await fileToBytes(blob), type: "png", width: c.width, height: c.height, blob };
}
