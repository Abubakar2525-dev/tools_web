"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { energyUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={energyUnits}
      defaultFrom="kwh"
      defaultTo="kj"
      footnote="cal and kcal are thermochemical (4.184 J); nutrition labels' Calorie equals 1 kcal. BTU is the International Table BTU."
    />
  );
}
