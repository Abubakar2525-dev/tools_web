"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { fuelUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={fuelUnits}
      defaultFrom="mpgus"
      defaultTo="l100"
      footnote="mpg and km/L are distance per fuel (higher is better); L/100 km and gallons per 100 miles are fuel per distance (lower is better), so the conversion is a reciprocal, not a fixed factor."
    />
  );
}
