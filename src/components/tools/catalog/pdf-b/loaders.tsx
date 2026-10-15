"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";
export const components: Record<string, ComponentType> = {
  "pdf-editor": dynamic(() => import("./pdf-editor"), { loading: () => <ToolLoading /> }),
  "add-text-to-pdf": dynamic(() => import("./add-text-to-pdf"), { loading: () => <ToolLoading /> }),
  "add-image-to-pdf": dynamic(() => import("./add-image-to-pdf"), { loading: () => <ToolLoading /> }),
  "sign-pdf": dynamic(() => import("./sign-pdf"), { loading: () => <ToolLoading /> }),
  "add-links-to-pdf": dynamic(() => import("./add-links-to-pdf"), { loading: () => <ToolLoading /> }),
  "add-watermark-to-pdf": dynamic(() => import("./add-watermark-to-pdf"), { loading: () => <ToolLoading /> }),
  "add-page-numbers": dynamic(() => import("./add-page-numbers"), { loading: () => <ToolLoading /> }),
  "add-header-and-footer": dynamic(() => import("./add-header-and-footer"), { loading: () => <ToolLoading /> }),
  "add-margins-to-pdf": dynamic(() => import("./add-margins-to-pdf"), { loading: () => <ToolLoading /> }),
  "resize-pdf-pages": dynamic(() => import("./resize-pdf-pages"), { loading: () => <ToolLoading /> }),
  "crop-pdf": dynamic(() => import("./crop-pdf"), { loading: () => <ToolLoading /> }),
  "annotate-pdf": dynamic(() => import("./annotate-pdf"), { loading: () => <ToolLoading /> }),
  "pdf-form-filler": dynamic(() => import("./pdf-form-filler"), { loading: () => <ToolLoading /> }),
  "pdf-metadata-viewer-and-editor": dynamic(() => import("./pdf-metadata-viewer-and-editor"), { loading: () => <ToolLoading /> }),
  "pdf-image-extractor": dynamic(() => import("./pdf-image-extractor"), { loading: () => <ToolLoading /> }),
  "compare-pdfs": dynamic(() => import("./compare-pdfs"), { loading: () => <ToolLoading /> }),
};
