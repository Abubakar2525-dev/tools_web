"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";
export const components: Record<string, ComponentType> = {
  "json-to-csharp": dynamic(() => import("./json-to-csharp"), { loading: () => <ToolLoading /> }),
  "json-to-typescript": dynamic(() => import("./json-to-typescript"), { loading: () => <ToolLoading /> }),
  "json-to-sql": dynamic(() => import("./json-to-sql"), { loading: () => <ToolLoading /> }),
  "json-to-csv-converter": dynamic(() => import("./json-to-csv-converter"), { loading: () => <ToolLoading /> }),
  "json-to-xml-converter": dynamic(() => import("./json-to-xml-converter"), { loading: () => <ToolLoading /> }),
  "json-to-yaml-converter": dynamic(() => import("./json-to-yaml-converter"), { loading: () => <ToolLoading /> }),
  "xml-formatter": dynamic(() => import("./xml-formatter"), { loading: () => <ToolLoading /> }),
  "yaml-formatter": dynamic(() => import("./yaml-formatter"), { loading: () => <ToolLoading /> }),
  "csv-viewer-and-formatter": dynamic(() => import("./csv-viewer-and-formatter"), { loading: () => <ToolLoading /> }),
  "html-formatter": dynamic(() => import("./html-formatter"), { loading: () => <ToolLoading /> }),
  "css-formatter-and-minifier": dynamic(() => import("./css-formatter-and-minifier"), { loading: () => <ToolLoading /> }),
  "javascript-formatter-and-minifier": dynamic(() => import("./javascript-formatter-and-minifier"), { loading: () => <ToolLoading /> }),
  "html-entity-encoder-decoder": dynamic(() => import("./html-entity-encoder-decoder"), { loading: () => <ToolLoading /> }),
  "jwt-decoder": dynamic(() => import("./jwt-decoder"), { loading: () => <ToolLoading /> }),
  "jwt-generator": dynamic(() => import("./jwt-generator"), { loading: () => <ToolLoading /> }),
  "uuid-ulid-generator": dynamic(() => import("./uuid-ulid-generator"), { loading: () => <ToolLoading /> }),
  "mock-data-generator": dynamic(() => import("./mock-data-generator"), { loading: () => <ToolLoading /> }),
  "gitignore-generator": dynamic(() => import("./gitignore-generator"), { loading: () => <ToolLoading /> }),
  "docker-compose-generator": dynamic(() => import("./docker-compose-generator"), { loading: () => <ToolLoading /> }),
  "cron-expression-builder-and-parser": dynamic(() => import("./cron-expression-builder-and-parser"), { loading: () => <ToolLoading /> }),
  "regex-explainer": dynamic(() => import("./regex-explainer"), { loading: () => <ToolLoading /> }),
  "ip-subnet-cidr-calculator": dynamic(() => import("./ip-subnet-cidr-calculator"), { loading: () => <ToolLoading /> }),
  "user-agent-parser": dynamic(() => import("./user-agent-parser"), { loading: () => <ToolLoading /> }),
  "sql-playground": dynamic(() => import("./sql-playground"), { loading: () => <ToolLoading /> }),
  "git-command-helper": dynamic(() => import("./git-command-helper"), { loading: () => <ToolLoading /> }),
};
