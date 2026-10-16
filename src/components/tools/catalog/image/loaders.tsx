"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "svg-viewer": dynamic(() => import("./svg-viewer"), { loading: () => <ToolLoading /> }),
  "image-converter": dynamic(() => import("./image-converter"), { loading: () => <ToolLoading /> }),
  "heic-to-jpg-png-webp": dynamic(() => import("./heic-to-jpg-png-webp"), { loading: () => <ToolLoading /> }),
  "favicon-and-ico-generator": dynamic(() => import("./favicon-and-ico-generator"), { loading: () => <ToolLoading /> }),
  "image-to-base64": dynamic(() => import("./image-to-base64"), { loading: () => <ToolLoading /> }),
  "image-compressor": dynamic(() => import("./image-compressor"), { loading: () => <ToolLoading /> }),
  "image-resizer": dynamic(() => import("./image-resizer"), { loading: () => <ToolLoading /> }),
  "image-cropper": dynamic(() => import("./image-cropper"), { loading: () => <ToolLoading /> }),
  "rotate-and-flip-image": dynamic(() => import("./rotate-and-flip-image"), { loading: () => <ToolLoading /> }),
  "photo-adjustments": dynamic(() => import("./photo-adjustments"), { loading: () => <ToolLoading /> }),
  "photo-effects": dynamic(() => import("./photo-effects"), { loading: () => <ToolLoading /> }),
  "image-noise-reduction": dynamic(() => import("./image-noise-reduction"), { loading: () => <ToolLoading /> }),
  "add-border-and-rounded-corners": dynamic(() => import("./add-border-and-rounded-corners"), { loading: () => <ToolLoading /> }),
  // Canvas/ImageBitmap processing is browser-only. Avoid evaluating this
  // module while Next.js prerenders the route with webpack.
  "image-watermark": dynamic(() => import("./image-watermark"), {
    loading: () => <ToolLoading />,
    ssr: false,
  }),
  "screenshot-annotator": dynamic(() => import("./screenshot-annotator"), { loading: () => <ToolLoading /> }),
  "image-to-text-ocr": dynamic(() => import("./image-to-text-ocr"), { loading: () => <ToolLoading /> }),
  "exif-viewer-and-remover": dynamic(() => import("./exif-viewer-and-remover"), { loading: () => <ToolLoading /> }),
  "image-dimensions-and-dpi-checker": dynamic(() => import("./image-dimensions-and-dpi-checker"), { loading: () => <ToolLoading /> }),
  "duplicate-image-finder": dynamic(() => import("./duplicate-image-finder"), { loading: () => <ToolLoading /> }),
  "passport-id-photo-maker": dynamic(() => import("./passport-id-photo-maker"), { loading: () => <ToolLoading /> }),
  "qr-code-generator": dynamic(() => import("./qr-code-generator"), { loading: () => <ToolLoading /> }),
  "bulk-qr-code-generator": dynamic(() => import("./bulk-qr-code-generator"), { loading: () => <ToolLoading /> }),
  "qr-code-scanner": dynamic(() => import("./qr-code-scanner"), { loading: () => <ToolLoading /> }),
  "barcode-generator": dynamic(() => import("./barcode-generator"), { loading: () => <ToolLoading /> }),
  "barcode-scanner": dynamic(() => import("./barcode-scanner"), { loading: () => <ToolLoading /> }),
};
