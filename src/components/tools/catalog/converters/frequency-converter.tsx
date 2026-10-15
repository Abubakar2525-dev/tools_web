"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { frequencyUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={frequencyUnits}
      defaultFrom="hz"
      defaultTo="rpm"
      footnote="rpm and rad/s describe rotation: 1 Hz = 1 revolution per second = 60 rpm = 2π rad/s."
    />
  );
}
