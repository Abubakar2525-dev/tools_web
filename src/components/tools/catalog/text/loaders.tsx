"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "readability-checker": dynamic(() => import("./readability-checker"), { loading: () => <ToolLoading /> }),
  "word-frequency-counter": dynamic(() => import("./word-frequency-counter"), { loading: () => <ToolLoading /> }),
  "essay-word-count-planner": dynamic(() => import("./essay-word-count-planner"), { loading: () => <ToolLoading /> }),
  "case-converter": dynamic(() => import("./case-converter"), { loading: () => <ToolLoading /> }),
  "text-cleaner": dynamic(() => import("./text-cleaner"), { loading: () => <ToolLoading /> }),
  "remove-duplicate-lines": dynamic(() => import("./remove-duplicate-lines"), { loading: () => <ToolLoading /> }),
  "remove-empty-lines": dynamic(() => import("./remove-empty-lines"), { loading: () => <ToolLoading /> }),
  "remove-extra-spaces": dynamic(() => import("./remove-extra-spaces"), { loading: () => <ToolLoading /> }),
  "sort-lines": dynamic(() => import("./sort-lines"), { loading: () => <ToolLoading /> }),
  "shuffle-lines": dynamic(() => import("./shuffle-lines"), { loading: () => <ToolLoading /> }),
  "reverse-text": dynamic(() => import("./reverse-text"), { loading: () => <ToolLoading /> }),
  "number-lines": dynamic(() => import("./number-lines"), { loading: () => <ToolLoading /> }),
  "add-prefix-suffix-to-lines": dynamic(() => import("./add-prefix-suffix-to-lines"), { loading: () => <ToolLoading /> }),
  "text-splitter-and-joiner": dynamic(() => import("./text-splitter-and-joiner"), { loading: () => <ToolLoading /> }),
  "text-length-limiter": dynamic(() => import("./text-length-limiter"), { loading: () => <ToolLoading /> }),
  "find-and-replace": dynamic(() => import("./find-and-replace"), { loading: () => <ToolLoading /> }),
  "diff-checker": dynamic(() => import("./diff-checker"), { loading: () => <ToolLoading /> }),
  "markdown-to-html-converter": dynamic(() => import("./markdown-to-html-converter"), { loading: () => <ToolLoading /> }),
  "markdown-editor-and-formatter": dynamic(() => import("./markdown-editor-and-formatter"), { loading: () => <ToolLoading /> }),
  "html-to-plain-text": dynamic(() => import("./html-to-plain-text"), { loading: () => <ToolLoading /> }),
  "text-to-html": dynamic(() => import("./text-to-html"), { loading: () => <ToolLoading /> }),
  "text-to-csv": dynamic(() => import("./text-to-csv"), { loading: () => <ToolLoading /> }),
  "text-to-binary": dynamic(() => import("./text-to-binary"), { loading: () => <ToolLoading /> }),
  "text-to-hex": dynamic(() => import("./text-to-hex"), { loading: () => <ToolLoading /> }),
  "text-to-ascii-codes": dynamic(() => import("./text-to-ascii-codes"), { loading: () => <ToolLoading /> }),
  "rot13-encoder-decoder": dynamic(() => import("./rot13-encoder-decoder"), { loading: () => <ToolLoading /> }),
  "morse-code-translator": dynamic(() => import("./morse-code-translator"), { loading: () => <ToolLoading /> }),
  "unicode-inspector-and-converter": dynamic(() => import("./unicode-inspector-and-converter"), { loading: () => <ToolLoading /> }),
  "emoji-translator": dynamic(() => import("./emoji-translator"), { loading: () => <ToolLoading /> }),
  "lorem-ipsum-generator": dynamic(() => import("./lorem-ipsum-generator"), { loading: () => <ToolLoading /> }),
  "username-generator": dynamic(() => import("./username-generator"), { loading: () => <ToolLoading /> }),
  "random-name-generator": dynamic(() => import("./random-name-generator"), { loading: () => <ToolLoading /> }),
  "phone-number-formatter": dynamic(() => import("./phone-number-formatter"), { loading: () => <ToolLoading /> }),
  "postal-zip-code-formatter": dynamic(() => import("./postal-zip-code-formatter"), { loading: () => <ToolLoading /> }),
};
