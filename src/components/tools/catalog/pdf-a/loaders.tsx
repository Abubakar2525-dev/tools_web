"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "pdf-to-image": dynamic(() => import("./pdf-to-image"), { loading: () => <ToolLoading /> }),
  "pdf-to-text": dynamic(() => import("./pdf-to-text"), { loading: () => <ToolLoading /> }),
  "pdf-to-markdown": dynamic(() => import("./pdf-to-markdown"), { loading: () => <ToolLoading /> }),
  "image-to-pdf": dynamic(() => import("./image-to-pdf"), { loading: () => <ToolLoading /> }),
  "text-to-pdf": dynamic(() => import("./text-to-pdf"), { loading: () => <ToolLoading /> }),
  "email-eml-to-pdf": dynamic(() => import("./email-eml-to-pdf"), { loading: () => <ToolLoading /> }),
  "document-scanner": dynamic(() => import("./document-scanner"), { loading: () => <ToolLoading /> }),
  "merge-pdf": dynamic(() => import("./merge-pdf"), { loading: () => <ToolLoading /> }),
  "split-pdf": dynamic(() => import("./split-pdf"), { loading: () => <ToolLoading /> }),
  "extract-pdf-pages": dynamic(() => import("./extract-pdf-pages"), { loading: () => <ToolLoading /> }),
  "delete-pdf-pages": dynamic(() => import("./delete-pdf-pages"), { loading: () => <ToolLoading /> }),
  "rotate-pdf": dynamic(() => import("./rotate-pdf"), { loading: () => <ToolLoading /> }),
  "reorder-pdf-pages": dynamic(() => import("./reorder-pdf-pages"), { loading: () => <ToolLoading /> }),
  "duplicate-pdf-pages": dynamic(() => import("./duplicate-pdf-pages"), { loading: () => <ToolLoading /> }),
  "reverse-pdf-pages": dynamic(() => import("./reverse-pdf-pages"), { loading: () => <ToolLoading /> }),
  "pdf-booklet-maker": dynamic(() => import("./pdf-booklet-maker"), { loading: () => <ToolLoading /> }),
  "pdf-poster-maker-tile-pages": dynamic(() => import("./pdf-poster-maker-tile-pages"), { loading: () => <ToolLoading /> }),
  "pdf-n-up-contact-sheet": dynamic(() => import("./pdf-n-up-contact-sheet"), { loading: () => <ToolLoading /> }),
  "pdf-thumbnail-and-preview-generator": dynamic(() => import("./pdf-thumbnail-and-preview-generator"), { loading: () => <ToolLoading /> }),
  "pdf-info-pages-size-version": dynamic(() => import("./pdf-info-pages-size-version"), { loading: () => <ToolLoading /> }),
};
