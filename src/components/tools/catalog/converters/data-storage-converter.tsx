"use client";

import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { storageUnits } from "./lib/units";

export default function Tool() {
  return (
    <UnitConverterTool
      units={storageUnits}
      defaultFrom="gb"
      defaultTo="gib"
      footnote="Decimal units (kB, MB, GB) use powers of 1000; binary units (KiB, MiB, GiB) use powers of 1024. Drive makers use decimal, while some operating systems report binary values."
    />
  );
}
