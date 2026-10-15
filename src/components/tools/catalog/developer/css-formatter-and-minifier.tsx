"use client";

import type { Plugin } from "prettier";
import { FormatterShell, type FormatterConfig } from "./FormatterShell";

const CSS = `/*! Theme v2 */
:root{--brand:#0f766e;--radius:8px}
.btn{display:inline-flex;padding:8px 16px;border-radius:var(--radius);background:var(--brand);color:#ffffff}
.btn:hover{background:#115e59}
.btn{margin:0px 0px 0px 0px}
@media (max-width:600px){.btn{width:100%}}`;

const SCSS = `$brand: #0f766e;
.card { padding: 16px; &:hover { box-shadow: 0 2px 8px rgba(0,0,0,.1); } .title { font-weight: 600; color: darken($brand, 10%); } }`;

const LESS = `@brand: #0f766e;
.card { padding: 16px; .title { color: @brand; } &:hover { opacity: .9; } }`;

const config: FormatterConfig = {
  inputLabel: "Stylesheet",
  languages: [
    { value: "css", label: "CSS", ext: "css", mime: "text/css" },
    { value: "scss", label: "SCSS", ext: "scss", mime: "text/x-scss" },
    { value: "less", label: "Less", ext: "less", mime: "text/x-less" },
  ],
  samples: { css: CSS, scss: SCSS, less: LESS },
  format: async (code, lang, o) => {
    const [prettier, postcss] = await Promise.all([import("prettier/standalone"), import("prettier/plugins/postcss")]);
    return prettier.format(code, {
      parser: lang,
      plugins: [postcss] as unknown as Plugin[],
      printWidth: o.printWidth,
      tabWidth: o.tabWidth,
      useTabs: o.useTabs,
    });
  },
  minify: async (code, _lang, o) => {
    const csso = await import("csso");
    return csso.minify(code, { restructure: o.restructure, comments: o.removeComments ? "exclamation" : true }).css;
  },
  minifyUnsupported: (lang) => (lang === "css" ? null : "Minifying works on plain CSS. Compile SCSS or Less to CSS first, then minify the result."),
  formatOptions: [],
  minifyOptions: ["removeComments", "restructure"],
  minifyNote: "Minify uses CSSO: it removes whitespace, shortens colors and values, and can merge duplicate rules.",
};

export default function Tool() {
  return <FormatterShell config={config} />;
}
