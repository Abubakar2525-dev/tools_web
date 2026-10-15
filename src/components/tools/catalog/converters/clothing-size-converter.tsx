"use client";

import { SizeChart } from "./SizeChart";
import { clothingTables } from "./lib/sizes";

const DISCLAIMER =
  "Size labels are not standardized across brands or countries, so treat these as starting points and check each brand's own measurement chart.";

export default function Tool() {
  return <SizeChart charts={clothingTables} disclaimer={DISCLAIMER} />;
}
