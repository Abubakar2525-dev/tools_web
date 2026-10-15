"use client";

import type { Plugin } from "prettier";
import { FormatterShell, type FormatterConfig } from "./FormatterShell";
import { minifyHtml } from "./lib/htmlMinify";

const SAMPLE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pricing</title>
<style>.card{padding:16px;border-radius:8px}</style></head>
<body><header class="top"><nav><a href="/">Home</a> <a href="/pricing" aria-current="page">Pricing</a></nav></header>
<main><h1>Plans</h1><ul><li>Starter <strong>$9</strong></li><li>Team <strong>$29</strong></li></ul>
<pre>  spacing   kept
  here</pre><!-- promo banner removed --></main>
<script>document.querySelector("h1").addEventListener("click",()=>{console.log("hi")})</script></body></html>`;

const config: FormatterConfig = {
  inputLabel: "HTML",
  languages: [{ value: "html", label: "HTML", ext: "html", mime: "text/html" }],
  samples: { html: SAMPLE },
  format: async (code, _lang, o) => {
    const [prettier, html, postcss, babel, estree] = await Promise.all([
      import("prettier/standalone"),
      import("prettier/plugins/html"),
      import("prettier/plugins/postcss"),
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree"),
    ]);
    return prettier.format(code, {
      parser: "html",
      plugins: [html, postcss, babel, estree] as unknown as Plugin[],
      printWidth: o.printWidth,
      tabWidth: o.tabWidth,
      useTabs: o.useTabs,
      htmlWhitespaceSensitivity: "css",
    });
  },
  minify: async (code, _lang, o) => minifyHtml(code, { removeComments: o.removeComments }),
  formatOptions: [],
  minifyOptions: ["removeComments"],
  minifyNote:
    "Minify collapses whitespace runs to one space and drops whitespace only between block-level tags, so inline spacing is never lost. Contents of pre, textarea, script and style are left as written; conditional comments are kept.",
};

export default function Tool() {
  return <FormatterShell config={config} />;
}
