"use client";

import { ToolPanel } from "@/components/tools/kit";
import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { gasMarks, temperatureUnits } from "./lib/units";

function GasMarkChart() {
  return (
    <ToolPanel title="Oven temperatures and gas marks">
      <div className="overflow-x-auto rounded-xl shadow-[0_0_0_1px_var(--line)]" tabIndex={0} role="region" aria-label="Gas mark chart">
        <table className="w-full text-left text-sm">
          <caption className="px-4 pt-3 text-left text-[0.8125rem] text-muted">
            UK gas marks with their nominal Fahrenheit setting, the exact Celsius equivalent and a typical fan oven setting.
          </caption>
          <thead>
            <tr className="border-b border-line">
              {["Gas mark", "°F", "°C (exact)", "°C fan (approx.)", "Description"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gasMarks.map((g) => (
              <tr key={g.mark} className="border-b border-line last:border-0">
                <th scope="row" className="whitespace-nowrap px-4 py-2 font-medium tabular-nums text-ink">
                  {g.mark}
                </th>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">{g.f}</td>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">{g.c.toFixed(1)}</td>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">{Math.round((g.c - 20) / 5) * 5}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink-2">{g.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[0.8125rem] text-muted">
        Recipes usually round Celsius to the nearest 10 degrees (gas mark 4 is often written as 180 °C). Fan ovens run hotter, so a setting about 20 °C lower is
        common; check your oven manual.
      </p>
    </ToolPanel>
  );
}

const extra = <GasMarkChart />;

export default function Tool() {
  return (
    <UnitConverterTool
      units={temperatureUnits}
      defaultFrom="c"
      defaultTo="f"
      defaultValue="20"
      allowNegative
      extra={extra}
      footnote="Kelvin and Rankine start at absolute zero (−273.15 °C, −459.67 °F), so values below absolute zero show as n/a. A temperature change of 1 °C equals a change of 1.8 °F."
    />
  );
}
