"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "apa-citation-generator": dynamic(() => import("./apa-citation-generator"), { loading: () => <ToolLoading /> }),
  "mla-citation-generator": dynamic(() => import("./mla-citation-generator"), { loading: () => <ToolLoading /> }),
  "chicago-citation-generator": dynamic(() => import("./chicago-citation-generator"), { loading: () => <ToolLoading /> }),
  "harvard-citation-generator": dynamic(() => import("./harvard-citation-generator"), { loading: () => <ToolLoading /> }),
  "ieee-citation-generator": dynamic(() => import("./ieee-citation-generator"), { loading: () => <ToolLoading /> }),
  "bibtex-generator": dynamic(() => import("./bibtex-generator"), { loading: () => <ToolLoading /> }),
  "reference-list-generator": dynamic(() => import("./reference-list-generator"), { loading: () => <ToolLoading /> }),
  "literature-matrix": dynamic(() => import("./literature-matrix"), { loading: () => <ToolLoading /> }),
  "url-encoder-decoder": dynamic(() => import("./url-encoder-decoder"), { loading: () => <ToolLoading /> }),
  "url-parser": dynamic(() => import("./url-parser"), { loading: () => <ToolLoading /> }),
  "utm-builder": dynamic(() => import("./utm-builder"), { loading: () => <ToolLoading /> }),
  "url-tracking-cleaner": dynamic(() => import("./url-tracking-cleaner"), { loading: () => <ToolLoading /> }),
  "slug-generator": dynamic(() => import("./slug-generator"), { loading: () => <ToolLoading /> }),
  "domain-name-generator": dynamic(() => import("./domain-name-generator"), { loading: () => <ToolLoading /> }),
  "meta-tag-generator": dynamic(() => import("./meta-tag-generator"), { loading: () => <ToolLoading /> }),
  "open-graph-and-twitter-card-generator": dynamic(() => import("./open-graph-and-twitter-card-generator"), { loading: () => <ToolLoading /> }),
  "schema-json-ld-generator": dynamic(() => import("./schema-json-ld-generator"), { loading: () => <ToolLoading /> }),
  "robotstxt-generator": dynamic(() => import("./robotstxt-generator"), { loading: () => <ToolLoading /> }),
  "keyword-density-checker": dynamic(() => import("./keyword-density-checker"), { loading: () => <ToolLoading /> }),
};
