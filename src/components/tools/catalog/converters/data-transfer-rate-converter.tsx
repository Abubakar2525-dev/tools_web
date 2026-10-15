"use client";

import { useState } from "react";
import { NumberField, SelectField, StatGrid, ToolPanel, parseNum } from "@/components/tools/kit";
import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { num } from "@/components/tools/engines/FormulaTool";
import { downloadSeconds, formatDuration, rateUnits, storageUnits } from "./lib/units";

const SIZE_UNITS = ["mb", "gb", "tb", "mib", "gib", "tib"].map((id) => storageUnits.find((u) => u.id === id)!);
const SPEED_UNITS = ["kbps", "mbps", "gbps", "MBps"].map((id) => rateUnits.find((u) => u.id === id)!);

function DownloadTime() {
  const [size, setSize] = useState("50");
  const [sizeUnit, setSizeUnit] = useState("gb");
  const [speed, setSpeed] = useState("100");
  const [speedUnit, setSpeedUnit] = useState("mbps");
  const [overhead, setOverhead] = useState("10");

  const s = parseNum(size);
  const r = parseNum(speed);
  const o = parseNum(overhead);
  const sizeErr = size.trim() && (s === null || s < 0) ? "Enter a size of 0 or more." : null;
  const speedErr = speed.trim() && (r === null || r <= 0) ? "Enter a speed above 0." : null;
  const overErr = overhead.trim() && (o === null || o < 0 || o >= 100) ? "Use 0 to 99%." : null;

  const su = SIZE_UNITS.find((u) => u.id === sizeUnit)!;
  const ru = SPEED_UNITS.find((u) => u.id === speedUnit)!;
  const ready = s !== null && r !== null && !sizeErr && !speedErr && !overErr;
  const bits = ready ? s * (su.toBase as number) : 0;
  const bps = ready ? r * (ru.toBase as number) : 0;
  const ideal = ready ? downloadSeconds(bits, bps) : 0;
  const real = ready ? downloadSeconds(bits, bps, o ?? 0) : 0;

  return (
    <ToolPanel title="Download time calculator">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid grid-cols-[1fr_7.5rem] gap-2">
          <NumberField label="File size" value={size} onChange={(e) => setSize(e.target.value)} error={sizeErr} />
          <SelectField
            label="Size unit"
            value={sizeUnit}
            onChange={(e) => setSizeUnit(e.target.value)}
            options={SIZE_UNITS.map((u) => ({ value: u.id, label: u.symbol }))}
          />
        </div>
        <div className="grid grid-cols-[1fr_7.5rem] gap-2">
          <NumberField label="Connection speed" value={speed} onChange={(e) => setSpeed(e.target.value)} error={speedErr} />
          <SelectField
            label="Speed unit"
            value={speedUnit}
            onChange={(e) => setSpeedUnit(e.target.value)}
            options={SPEED_UNITS.map((u) => ({ value: u.id, label: u.symbol }))}
          />
        </div>
        <NumberField
          label="Overhead allowance (%)"
          hint="Protocol overhead, Wi-Fi losses and server limits. 10% is a reasonable starting guess."
          value={overhead}
          onChange={(e) => setOverhead(e.target.value)}
          error={overErr}
        />
      </div>
      <div className="mt-6" aria-live="polite">
        {ready ? (
          <StatGrid
            items={[
              { label: "At full line speed", value: formatDuration(ideal) },
              { label: `With ${num(o ?? 0)}% overhead`, value: formatDuration(real) },
              { label: "Throughput", value: `${num(bps / 8e6, 4)} MB/s` },
            ]}
          />
        ) : (
          <p className="text-sm text-muted">Enter a file size and connection speed to estimate the time.</p>
        )}
      </div>
      <p className="mt-3 text-[0.8125rem] text-muted">
        Internet plans are sold in megabits per second (Mbit/s), while files are measured in bytes. 8 bits make 1 byte, so 100 Mbit/s moves at most 12.5 MB each
        second.
      </p>
    </ToolPanel>
  );
}

const extra = <DownloadTime />;

export default function Tool() {
  return (
    <UnitConverterTool
      units={rateUnits}
      defaultFrom="mbps"
      defaultTo="MBps"
      defaultValue="100"
      extra={extra}
      footnote="Lowercase b means bits and uppercase B means bytes. Decimal prefixes (k, M, G) are powers of 1000; KiB/s, MiB/s and GiB/s are powers of 1024."
    />
  );
}
