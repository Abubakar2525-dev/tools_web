"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "./loading";


/** The original engineering tools (components live in ../engineering). */
export const components: Record<string, ComponentType> = {
  "prompt-builder": dynamic(() => import("../engineering/prompt-builder"), { loading: () => <ToolLoading /> }),
  "json-formatter": dynamic(() => import("../engineering/json-formatter"), { loading: () => <ToolLoading /> }),
  "regex-tester": dynamic(() => import("../engineering/regex-tester"), { loading: () => <ToolLoading /> }),
  "sql-formatter": dynamic(() => import("../engineering/sql-formatter"), { loading: () => <ToolLoading /> }),
  "token-estimator": dynamic(() => import("../engineering/token-estimator"), { loading: () => <ToolLoading /> }),
  "api-request-builder": dynamic(() => import("../engineering/api-request-builder"), { loading: () => <ToolLoading /> }),
  "markdown-previewer": dynamic(() => import("../engineering/markdown-previewer"), { loading: () => <ToolLoading /> }),
  "base64-encoder-decoder": dynamic(() => import("../engineering/base64-encoder-decoder"), { loading: () => <ToolLoading /> }),
  "ai-use-case-planner": dynamic(() => import("../engineering/ai-use-case-planner"), { loading: () => <ToolLoading /> }),
  "rag-readiness-checklist": dynamic(() => import("../engineering/rag-readiness-checklist"), { loading: () => <ToolLoading /> }),
};
