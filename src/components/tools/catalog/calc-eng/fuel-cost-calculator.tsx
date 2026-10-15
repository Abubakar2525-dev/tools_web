"use client";

import { FormulaTool, fixed, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { ECONOMY_OPTIONS, KM_PER_MI, VOLUME_FACTOR, fromL100, toL100, type Economy } from "./lib/fuel";

const spec: FormulaSpec = {
  lead: <>Trip fuel = distance × consumption. Uses your car&apos;s average figure, so real trips vary with speed, load, traffic and weather.</>,
  fields: [
    {
      id: "dist",
      label: "Trip distance (one way)",
      type: "number",
      gt: 0,
      units: [
        { value: "km", label: "km", factor: 1 },
        { value: "mi", label: "miles", factor: KM_PER_MI },
      ],
    },
    { id: "eff", label: "Fuel economy", type: "number", gt: 0 },
    { id: "effUnit", label: "Fuel economy unit", type: "select", options: ECONOMY_OPTIONS },
    { id: "price", label: "Fuel price", type: "number", min: 0, hint: "In your currency, per volume unit below." },
    {
      id: "priceUnit",
      label: "Price per",
      type: "select",
      options: [
        { value: "L", label: "Liter" },
        { value: "usgal", label: "US gallon" },
        { value: "ukgal", label: "UK (imperial) gallon" },
      ],
    },
    { id: "people", label: "Split between people", type: "number", optional: true, gt: 0, integer: true, placeholder: "1" },
    { id: "round", label: "Round trip (double the distance)", type: "checkbox" },
  ],
  example: { dist: "350", eff: "6.5", effUnit: "l100", price: "1.85", priceUnit: "L", people: "2", round: true },
  compute: (v) => {
    const oneWay = v.num("dist") as number;
    const km = oneWay * (v.bool("round") ? 2 : 1);
    const unit = v.str("effUnit") as Economy;
    const l100 = toL100(v.num("eff") as number, unit);
    const liters = (km * l100) / 100;
    const volF = VOLUME_FACTOR[v.str("priceUnit")];
    const volume = liters / volF;
    const price = v.num("price") as number;
    const cost = volume * price;
    const people = v.num("people") ?? 1;
    const volLabel = v.str("priceUnit") === "L" ? "L" : v.str("priceUnit") === "usgal" ? "US gal" : "UK gal";
    const miles = km / KM_PER_MI;
    return {
      outputs: [
        { label: v.bool("round") ? "Round-trip fuel cost" : "Trip fuel cost", value: fixed(cost), primary: true, note: people > 1 ? `${fixed(cost / people)} each for ${people} people` : undefined },
        { label: "Fuel used", value: `${num(volume, 4)} ${volLabel}` },
        { label: "Distance driven", value: `${num(km, 5)} km / ${num(miles, 5)} mi` },
        { label: "Cost per km", value: fixed(cost / km, 3) },
        { label: "Cost per mile", value: fixed(cost / miles, 3) },
        { label: "Economy in other units", value: ECONOMY_OPTIONS.filter((o) => o.value !== unit).map((o) => `${num(fromL100(l100, o.value as Economy), 4)} ${o.label}`).join(" · ") },
      ],
      steps: [
        `Consumption = ${num(l100, 5)} L/100 km`,
        `Fuel = ${num(km, 5)} km × ${num(l100, 5)} ÷ 100 = ${num(liters, 5)} L${volF !== 1 ? ` = ${num(volume, 5)} ${volLabel}` : ""}`,
        `Cost = ${num(volume, 5)} × ${num(price)} = ${fixed(cost)}`,
      ],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
