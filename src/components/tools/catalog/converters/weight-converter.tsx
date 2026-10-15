"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { weightUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={weightUnits}
      defaultFrom="kg"
      defaultTo="lb"
      footnote="1 lb = 0.45359237 kg exactly (international pound). Troy units are for precious metals; a troy ounce is about 9.7% heavier than an ordinary ounce."
    />
  );
}
