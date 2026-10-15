"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { timeUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={timeUnits}
      defaultFrom="h"
      defaultTo="min"
      footnote="Months and years use the average Gregorian year of 365.2425 days, so 1 month = 30.436875 days. Calendar months and leap years vary."
    />
  );
}
