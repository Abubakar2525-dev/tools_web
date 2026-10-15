"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { forceUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={forceUnits}
      defaultFrom="n"
      defaultTo="lbf"
      footnote="Pound-force and kilogram-force use standard gravity, 9.80665 m/s² exactly."
    />
  );
}
