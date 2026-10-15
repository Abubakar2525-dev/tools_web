"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "social-media-image-resizer": dynamic(() => import("./social-media-image-resizer"), { loading: () => <ToolLoading /> }),
  "social-media-banner-maker": dynamic(() => import("./social-media-banner-maker"), { loading: () => <ToolLoading /> }),
  "youtube-thumbnail-maker": dynamic(() => import("./youtube-thumbnail-maker"), { loading: () => <ToolLoading /> }),
  "open-graph-image-generator": dynamic(() => import("./open-graph-image-generator"), { loading: () => <ToolLoading /> }),
  "caption-formatter": dynamic(() => import("./caption-formatter"), { loading: () => <ToolLoading /> }),
  "social-character-counter": dynamic(() => import("./social-character-counter"), { loading: () => <ToolLoading /> }),
  "social-post-preview": dynamic(() => import("./social-post-preview"), { loading: () => <ToolLoading /> }),
};
