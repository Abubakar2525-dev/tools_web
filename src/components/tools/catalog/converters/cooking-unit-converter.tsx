"use client";

import { useState } from "react";
import { Notice, NumberField, Segmented, SelectField, StatGrid, ToolPanel, parseNum } from "@/components/tools/kit";
import { UnitConverterTool } from "@/components/tools/engines/UnitConverterTool";
import { num } from "@/components/tools/engines/FormulaTool";
import { POUND, US_CUP_ML, cookingVolumeUnits, ingredients } from "./lib/units";

const VOLUME_OPTIONS = cookingVolumeUnits.map((u) => ({ value: u.id, label: `${u.label} (${u.symbol})` }));
const INGREDIENT_OPTIONS = ingredients.map((i) => ({ value: i.id, label: i.name }));
const OZ_G = (POUND * 1000) / 16;

function IngredientWeights() {
  const [dir, setDir] = useState<"vol" | "mass">("vol");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState("us-cup");
  const [ing, setIng] = useState("flour-ap");
  const [grams, setGrams] = useState("250");

  const item = ingredients.find((i) => i.id === ing)!;
  const gPerMl = item.gPerCup / US_CUP_ML;
  const u = cookingVolumeUnits.find((x) => x.id === unit)!;
  const mlPerUnit = u.toBase as number;

  const a = parseNum(amount);
  const g = parseNum(grams);
  const aErr = amount.trim() && (a === null || a < 0) ? "Enter an amount of 0 or more." : null;
  const gErr = grams.trim() && (g === null || g < 0) ? "Enter a weight of 0 or more." : null;

  let result: { label: string; value: string }[] | null = null;
  if (dir === "vol" && a !== null && !aErr) {
    const w = a * mlPerUnit * gPerMl;
    result = [
      { label: "Grams", value: `${num(w, 4)} g` },
      { label: "Ounces (weight)", value: `${num(w / OZ_G, 3)} oz` },
      { label: "Milliliters", value: `${num(a * mlPerUnit, 4)} mL` },
    ];
  } else if (dir === "mass" && g !== null && !gErr) {
    const ml = g / gPerMl;
    result = [
      { label: "US cups", value: `${num(ml / US_CUP_ML, 3)} cup` },
      { label: "US tablespoons", value: `${num(ml / (US_CUP_ML / 16), 3)} tbsp` },
      { label: "Milliliters", value: `${num(ml, 4)} mL` },
    ];
  }

  return (
    <ToolPanel title="Cups to grams by ingredient">
      <div className="mb-5">
        <Segmented
          label="Direction"
          value={dir}
          onChange={setDir}
          options={[
            { value: "vol", label: "Volume to weight" },
            { value: "mass", label: "Weight to volume" },
          ]}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Ingredient" value={ing} onChange={(e) => setIng(e.target.value)} options={INGREDIENT_OPTIONS} />
        {dir === "vol" ? (
          <>
            <NumberField label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} error={aErr} />
            <SelectField label="Measure" value={unit} onChange={(e) => setUnit(e.target.value)} options={VOLUME_OPTIONS} />
          </>
        ) : (
          <NumberField label="Weight (grams)" value={grams} onChange={(e) => setGrams(e.target.value)} error={gErr} />
        )}
      </div>
      <div className="mt-6 space-y-3" aria-live="polite">
        {result ? <StatGrid items={result} /> : <p className="text-sm text-muted">Enter an amount to see the conversion.</p>}
        <p className="text-[0.8125rem] text-muted">
          Working value: 1 US cup of {item.name.toLowerCase()} ≈ {item.gPerCup} g{item.note ? ` (${item.note})` : ""}.
        </p>
      </div>
      <div className="mt-5">
        <Notice tone="warning">
          These weights are approximate. The same cup of flour weighs noticeably more when scooped and packed than when spooned in and leveled, and brands differ,
          so weigh ingredients when precision matters, as in bread and pastry.
        </Notice>
      </div>
      <details className="mt-5 rounded-xl bg-sunken p-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">All ingredient weights</summary>
        <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Ingredient weight table">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                {["Ingredient", "1 US cup", "1 tbsp", "1 tsp"].map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-ink">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ingredients.map((i) => (
                <tr key={i.id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-3 py-2 font-normal text-ink-2">
                    {i.name}
                  </th>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{num(i.gPerCup, 4)} g</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{num(i.gPerCup / 16, 3)} g</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{num(i.gPerCup / 48, 2)} g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </ToolPanel>
  );
}

const extra = <IngredientWeights />;

export default function Tool() {
  return (
    <UnitConverterTool
      units={cookingVolumeUnits}
      defaultFrom="us-cup"
      defaultTo="ml"
      extra={extra}
      footnote="A US cup is 236.6 mL, a metric cup 250 mL and an Australian tablespoon 20 mL. Recipes from different countries can use different spoons and cups for the same name."
    />
  );
}
