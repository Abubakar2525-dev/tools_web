"use client";

import type { Plugin } from "prettier";
import { FormatterShell, type FormatterConfig } from "./FormatterShell";

const JS = `// cart helpers
import {formatPrice} from './money.js'
export function cartTotal(items,{taxRate=0.2,discount=0}={}){const subtotal=items.reduce((sum,{price,qty})=>sum+price*qty,0)
console.log('subtotal',subtotal)
const total=(subtotal-discount)*(1+taxRate);return formatPrice(Math.max(0,total))}`;

const TS = `interface Item{price:number;qty:number}
export function cartTotal(items:Item[],opts:{taxRate?:number;discount?:number}={}):number{const {taxRate=0.2,discount=0}=opts
return items.reduce((s,i)=>s+i.price*i.qty,0)*(1+taxRate)-discount}`;

const config: FormatterConfig = {
  inputLabel: "Code",
  languages: [
    { value: "babel", label: "JavaScript", ext: "js", mime: "text/javascript" },
    { value: "typescript", label: "TypeScript", ext: "ts", mime: "text/plain" },
  ],
  samples: { babel: JS, typescript: TS },
  format: async (code, lang, o) => {
    const prettier = await import("prettier/standalone");
    const estree = await import("prettier/plugins/estree");
    const parserPlugin = lang === "typescript" ? await import("prettier/plugins/typescript") : await import("prettier/plugins/babel");
    return prettier.format(code, {
      parser: lang,
      plugins: [parserPlugin, estree] as unknown as Plugin[],
      printWidth: o.printWidth,
      tabWidth: o.tabWidth,
      useTabs: o.useTabs,
      singleQuote: o.singleQuote,
      semi: o.semi,
    });
  },
  minify: async (code, _lang, o) => {
    const { minify } = await import("terser");
    const res = await minify(code, {
      module: true,
      ecma: 2020,
      compress: { drop_console: o.dropConsole, passes: 2 },
      mangle: o.mangle,
      format: { comments: o.removeComments ? /^!|@license|@preserve/ : "all" },
    });
    return res.code ?? "";
  },
  minifyUnsupported: (lang) => (lang === "typescript" ? "Minifying needs plain JavaScript. Compile TypeScript first (for example with tsc), then minify the output." : null),
  formatOptions: ["quotes", "semi"],
  minifyOptions: ["removeComments", "mangle", "dropConsole"],
  minifyNote:
    "Minify uses Terser and treats the input as an ES module (strict mode, import and export allowed). Top-level names are not renamed, so exports keep working.",
};

export default function Tool() {
  return <FormatterShell config={config} />;
}
