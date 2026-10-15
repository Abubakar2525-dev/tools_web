"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { powerUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={powerUnits}
      defaultFrom="kw"
      defaultTo="hp"
      footnote="Mechanical horsepower is 550 ft·lbf/s (about 745.7 W); metric horsepower (PS) is 735.49875 W; electrical horsepower is defined as 746 W."
    />
  );
}
