"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "color-picker": dynamic(() => import("./color-picker"), { loading: () => <ToolLoading /> }),
  "color-converter": dynamic(() => import("./color-converter"), { loading: () => <ToolLoading /> }),
  "color-palette-generator": dynamic(() => import("./color-palette-generator"), { loading: () => <ToolLoading /> }),
  "image-color-extractor": dynamic(() => import("./image-color-extractor"), { loading: () => <ToolLoading /> }),
  "contrast-checker-wcag": dynamic(() => import("./contrast-checker-wcag"), { loading: () => <ToolLoading /> }),
  "css-gradient-generator": dynamic(() => import("./css-gradient-generator"), { loading: () => <ToolLoading /> }),
  "css-box-shadow-generator": dynamic(() => import("./css-box-shadow-generator"), { loading: () => <ToolLoading /> }),
  "border-radius-generator": dynamic(() => import("./border-radius-generator"), { loading: () => <ToolLoading /> }),
  "css-button-generator": dynamic(() => import("./css-button-generator"), { loading: () => <ToolLoading /> }),
  "glassmorphism-generator": dynamic(() => import("./glassmorphism-generator"), { loading: () => <ToolLoading /> }),
  "neumorphism-generator": dynamic(() => import("./neumorphism-generator"), { loading: () => <ToolLoading /> }),
  "font-pairing-tool": dynamic(() => import("./font-pairing-tool"), { loading: () => <ToolLoading /> }),
  "type-scale-generator": dynamic(() => import("./type-scale-generator"), { loading: () => <ToolLoading /> }),
  "aspect-ratio-calculator": dynamic(() => import("./aspect-ratio-calculator"), { loading: () => <ToolLoading /> }),
  "golden-ratio-calculator": dynamic(() => import("./golden-ratio-calculator"), { loading: () => <ToolLoading /> }),
  "svg-optimizer": dynamic(() => import("./svg-optimizer"), { loading: () => <ToolLoading /> }),
  "flowchart-maker": dynamic(() => import("./flowchart-maker"), { loading: () => <ToolLoading /> }),
  "mind-map-maker": dynamic(() => import("./mind-map-maker"), { loading: () => <ToolLoading /> }),
  "timeline-maker": dynamic(() => import("./timeline-maker"), { loading: () => <ToolLoading /> }),
};
