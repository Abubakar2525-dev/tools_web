"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { torqueUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={torqueUnits}
      defaultFrom="nm"
      defaultTo="ftlbf"
      footnote="1 ft·lbf = 1.3558179483 N·m. Torque and energy share the same base units, but they are different quantities; use the energy converter for joules."
    />
  );
}
