"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { speedUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={speedUnits}
      defaultFrom="kmh"
      defaultTo="mph"
      footnote="Mach is fixed at the speed of sound in the ISA standard atmosphere at sea level and 15 °C (340.294 m/s). The real speed of sound changes with air temperature."
    />
  );
}
