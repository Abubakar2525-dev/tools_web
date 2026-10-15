"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { pressureUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={pressureUnits}
      defaultFrom="bar"
      defaultTo="psi"
      footnote="Gauge readings (psig) are relative to the surrounding air, absolute readings (psia) include it. Convert like with like. mmHg and inHg use the conventional mercury values."
    />
  );
}
