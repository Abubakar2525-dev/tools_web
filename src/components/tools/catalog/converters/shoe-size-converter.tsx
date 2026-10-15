"use client";

import { SizeChart, type Chart } from "./SizeChart";
import { shoeRows, shoeSystems } from "./lib/sizes";

const charts: Chart[] = [
  {
    id: "adult-shoes",
    title: "Adult shoes",
    systems: shoeSystems,
    rows: shoeRows,
    note: "Mondopoint and Japanese sizes describe foot length; US, UK and EU sizes describe the shoe last, so the same foot can need different sizes in different styles.",
  },
];

const DISCLAIMER =
  "Shoe sizing differs between brands, and even between models from one brand. Measure your foot length in centimeters and compare with the brand's chart when you can.";

export default function Tool() {
  return <SizeChart charts={charts} disclaimer={DISCLAIMER} />;
}
