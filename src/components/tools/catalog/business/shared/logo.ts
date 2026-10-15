"use client";

import { loadImage } from "@/components/tools/engines/files";

/**
 * Reads a PNG or JPG logo, scales it down to at most `maxPx` on the long side
 * and returns a data URL in the same format (PNG keeps transparency). Keeps
 * drafts small enough for local storage and PDFs light.
 */
export async function logoToDataUrl(file: File, maxPx = 600): Promise<string> {
  const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
  const isJpg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
  if (!isPng && !isJpg) throw new Error("Use a PNG or JPG image for the logo.");
  const bmp = await loadImage(file);
  try {
    const s = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * s));
    const h = Math.max(1, Math.round(bmp.height * s));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    if (!isPng) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    return isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    bmp.close();
  }
}
