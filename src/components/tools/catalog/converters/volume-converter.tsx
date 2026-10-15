"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { volumeUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={volumeUnits}
      defaultFrom="l"
      defaultTo="us-gal"
      footnote="US and UK (imperial) gallons, pints and fluid ounces are different sizes, so choose the right system. 1 US gal = 3.785411784 L, 1 UK gal = 4.54609 L."
    />
  );
}
