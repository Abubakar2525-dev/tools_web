"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { angleUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={angleUnits}
      defaultFrom="deg"
      defaultTo="rad"
      allowNegative
      footnote="Mil here is the NATO mil (6400 per turn). Other armies have used 6000 or 6300 per turn, and the milliradian (about 6283 per turn) is a separate unit."
    />
  );
}
