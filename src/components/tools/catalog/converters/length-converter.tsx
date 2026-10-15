"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { lengthUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={lengthUnits}
      defaultFrom="m"
      defaultTo="ft"
      footnote="Inch, foot, yard and mile use the 1959 international definitions (1 in = 25.4 mm exactly). A light year is the IAU value of 9,460,730,472,580,800 m."
    />
  );
}
