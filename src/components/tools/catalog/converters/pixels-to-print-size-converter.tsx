"use client";

import { FormulaTool, num, type FormulaSpec, type UnitOption } from "@/components/tools/engines/FormulaTool";
import { photoSizes, pixelsAt } from "./lib/sizes";

const LEN_UNITS: UnitOption[] = [
  { value: "in", label: "in", factor: 1 },
  { value: "cm", label: "cm", factor: 1 / 2.54 },
  { value: "mm", label: "mm", factor: 1 / 25.4 },
];

function quality(dpi: number) {
  if (dpi >= 300) return "Excellent (300+)";
  if (dpi >= 200) return "Good (200-299)";
  if (dpi >= 150) return "Fair (150-199)";
  return "Low (under 150)";
}

const spec: FormulaSpec = {
  modes: [
    { id: "toprint", label: "Pixels to print size", fields: ["wpx", "hpx", "dpi"] },
    { id: "topx", label: "Print size to pixels", fields: ["wlen", "hlen", "dpi"] },
  ],
  fields: [
    { id: "wpx", label: "Image width", type: "number", suffix: "px", gt: 0, integer: true },
    { id: "hpx", label: "Image height", type: "number", suffix: "px", gt: 0, integer: true },
    { id: "wlen", label: "Print width", type: "number", units: LEN_UNITS, gt: 0 },
    { id: "hlen", label: "Print height", type: "number", units: LEN_UNITS, gt: 0 },
    {
      id: "dpi",
      label: "Resolution",
      type: "number",
      suffix: "DPI",
      gt: 0,
      max: 10000,
      hint: "300 DPI suits photo prints viewed up close; 150 DPI is often enough for posters seen from a distance.",
    },
  ],
  defaults: { wpx: "4000", hpx: "3000", dpi: "300", wlen: "8", hlen: "10" },
  example: { wpx: "6000", hpx: "4000", dpi: "300", wlen: "20", hlen: "30", "wlen:unit": "cm", "hlen:unit": "cm" },
  compute: (v) => {
    const dpi = v.num("dpi")!;
    if (v.mode === "topx") {
      const wIn = v.num("wlen")!;
      const hIn = v.num("hlen")!;
      const wpx = pixelsAt(wIn, dpi);
      const hpx = pixelsAt(hIn, dpi);
      return {
        outputs: [
          { label: "Pixels needed", value: `${wpx.toLocaleString("en-US")} × ${hpx.toLocaleString("en-US")} px`, primary: true, note: `At ${num(dpi)} DPI` },
          { label: "Megapixels", value: `${num((wpx * hpx) / 1e6, 3)} MP` },
          { label: "Print size (in)", value: `${num(wIn, 4)} × ${num(hIn, 4)}` },
          { label: "Print size (cm)", value: `${num(wIn * 2.54, 4)} × ${num(hIn * 2.54, 4)}` },
        ],
        steps: [`Pixels = inches × DPI`, `${num(wIn, 6)} in × ${num(dpi)} = ${wpx} px`, `${num(hIn, 6)} in × ${num(dpi)} = ${hpx} px`],
        table: {
          caption: "Common photo and paper sizes: pixels required (portrait; swap for landscape)",
          columns: ["Size", "At 150 DPI", "At 300 DPI"],
          rows: photoSizes.map((p) => [
            p.name,
            `${pixelsAt(p.wIn, 150)} × ${pixelsAt(p.hIn, 150)}`,
            `${pixelsAt(p.wIn, 300)} × ${pixelsAt(p.hIn, 300)}`,
          ]),
        },
      };
    }
    const wpx = v.num("wpx")!;
    const hpx = v.num("hpx")!;
    const wIn = wpx / dpi;
    const hIn = hpx / dpi;
    const long = Math.max(wpx, hpx);
    const short = Math.min(wpx, hpx);
    return {
      outputs: [
        { label: "Print size", value: `${num(wIn, 4)} × ${num(hIn, 4)} in`, primary: true, note: `${num(wIn * 2.54, 4)} × ${num(hIn * 2.54, 4)} cm at ${num(dpi)} DPI` },
        { label: "Millimeters", value: `${num(wIn * 25.4, 4)} × ${num(hIn * 25.4, 4)}` },
        { label: "Megapixels", value: `${num((wpx * hpx) / 1e6, 3)} MP` },
        { label: "Aspect ratio", value: `${num(long / short, 4)} : 1` },
      ],
      steps: [`Inches = pixels ÷ DPI`, `${wpx} ÷ ${num(dpi)} = ${num(wIn, 6)} in`, `${hpx} ÷ ${num(dpi)} = ${num(hIn, 6)} in`, `Centimeters = inches × 2.54`],
      table: {
        caption: "How your image prints on common sizes (image rotated to match the paper, cropped to fill)",
        columns: ["Size", "Effective DPI", "Quality", "Needed at 300 DPI"],
        rows: photoSizes.map((p) => {
          const pl = Math.max(p.wIn, p.hIn);
          const ps = Math.min(p.wIn, p.hIn);
          // Filling the paper: the axis with fewer pixels per inch sets the scale; the other axis overflows and is cropped.
          const eff = Math.min(long / pl, short / ps);
          return [p.name, num(Math.floor(eff)), quality(eff), `${pixelsAt(p.wIn, 300)} × ${pixelsAt(p.hIn, 300)}`];
        }),
      },
      notes: ["Effective DPI assumes the image is scaled to fill the paper; any part that overflows is cropped. DPI and PPI are used interchangeably here."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
