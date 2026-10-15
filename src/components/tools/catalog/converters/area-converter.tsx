"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { areaUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={areaUnits}
      defaultFrom="m2"
      defaultTo="ft2"
      footnote="Uses the international foot and acre. The US survey acre, still used in some older land records, differs by about 2 parts per million."
    />
  );
}
