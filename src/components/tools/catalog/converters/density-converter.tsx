"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { densityUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={densityUnits}
      defaultFrom="gcm3"
      defaultTo="lbft3"
      footnote="Water at about 4 °C has a density close to 1 g/cm³ (1000 kg/m³). Density changes with temperature, especially for liquids and gases."
    />
  );
}
