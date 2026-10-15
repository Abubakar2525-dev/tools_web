"use client";

import { FormulaTool, fixed, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { ECONOMY_OPTIONS, toL100, type Economy } from "./lib/fuel";

const hours = (h: number) => {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")} min`;
};

const spec: FormulaSpec = {
  lead: <>Energy from the grid = energy added to the battery ÷ charging efficiency. Time assumes the charger&apos;s full power the whole way.</>,
  modes: [
    { id: "charge", label: "Charging session", fields: ["kwh", "from", "to", "eff", "price", "kw"] },
    { id: "trip", label: "Trip vs petrol", fields: ["dist", "evEff", "eff", "price", "fuelEco", "fuelUnit", "fuelPrice"] },
  ],
  fields: [
    { id: "kwh", label: "Usable battery capacity", type: "number", suffix: "kWh", gt: 0 },
    { id: "from", label: "Charge from", type: "number", suffix: "%", min: 0, max: 100 },
    { id: "to", label: "Charge to", type: "number", suffix: "%", min: 0, max: 100 },
    { id: "eff", label: "Charging efficiency", type: "number", suffix: "%", gt: 0, max: 100, hint: "Share of grid energy that reaches the battery; about 85-95% is typical for AC charging." },
    { id: "price", label: "Electricity price per kWh", type: "number", min: 0 },
    { id: "kw", label: "Charger power", type: "number", suffix: "kW", gt: 0 },
    { id: "dist", label: "Trip distance", type: "number", suffix: "km", gt: 0 },
    { id: "evEff", label: "EV consumption", type: "number", suffix: "kWh/100 km", gt: 0, hint: "At the battery, from the car's trip computer." },
    { id: "fuelEco", label: "Petrol car fuel economy", type: "number", gt: 0 },
    { id: "fuelUnit", label: "Fuel economy unit", type: "select", options: ECONOMY_OPTIONS },
    { id: "fuelPrice", label: "Petrol price per liter", type: "number", min: 0 },
  ],
  defaults: { eff: "90", from: "20", to: "80" },
  example: { __mode: "charge", kwh: "75", from: "20", to: "80", eff: "90", price: "0.30", kw: "11" },
  compute: (v) => {
    const eff = (v.num("eff") as number) / 100;
    const price = v.num("price") as number;
    if (v.mode === "charge") {
      const cap = v.num("kwh") as number;
      const from = v.num("from") as number;
      const to = v.num("to") as number;
      if (to <= from) return "The target charge must be higher than the starting charge.";
      const battery = (cap * (to - from)) / 100;
      const grid = battery / eff;
      const kw = v.num("kw") as number;
      const t = grid / kw;
      return {
        outputs: [
          { label: "Charging cost", value: fixed(price * grid), primary: true, note: `${num(grid, 4)} kWh drawn from the grid` },
          { label: "Energy added to battery", value: `${num(battery, 4)} kWh` },
          { label: "Energy lost in charging", value: `${num(grid - battery, 4)} kWh` },
          { label: "Estimated time", value: hours(t) },
          { label: "Cost per 1% of charge", value: fixed((price * grid) / (to - from), 3) },
        ],
        steps: [
          `Battery energy = ${num(cap)} kWh × (${num(to)}% − ${num(from)}%) = ${num(battery, 5)} kWh`,
          `Grid energy = ${num(battery, 5)} ÷ ${num(eff)} = ${num(grid, 5)} kWh`,
          `Cost = ${num(grid, 5)} × ${num(price)} = ${fixed(price * grid)}`,
          `Time = ${num(grid, 5)} kWh ÷ ${num(kw)} kW = ${num(t, 4)} h`,
        ],
        notes: [
          "Real sessions are often slower: the car's onboard charger may limit AC power, and DC fast charging tapers off as the battery fills, especially above about 80%.",
        ],
      };
    }
    const dist = v.num("dist") as number;
    const evEff = v.num("evEff") as number;
    const battery = (dist * evEff) / 100;
    const grid = battery / eff;
    const evCost = grid * price;
    const l100 = toL100(v.num("fuelEco") as number, v.str("fuelUnit") as Economy);
    const liters = (dist * l100) / 100;
    const petrolCost = liters * (v.num("fuelPrice") as number);
    const diff = petrolCost - evCost;
    return {
      outputs: [
        { label: "EV energy cost", value: fixed(evCost), primary: true, note: diff >= 0 ? `${fixed(diff)} less than petrol` : `${fixed(-diff)} more than petrol` },
        { label: "Petrol cost", value: fixed(petrolCost) },
        { label: "EV cost per 100 km", value: fixed((evCost / dist) * 100) },
        { label: "Petrol cost per 100 km", value: fixed((petrolCost / dist) * 100) },
        { label: "EV grid energy", value: `${num(grid, 4)} kWh` },
        { label: "Petrol used", value: `${num(liters, 4)} L` },
      ],
      steps: [
        `EV: ${num(dist)} km × ${num(evEff)} kWh/100 km ÷ ${num(eff)} = ${num(grid, 5)} kWh × ${num(price)} = ${fixed(evCost)}`,
        `Petrol: ${num(dist)} km × ${num(l100, 5)} L/100 km = ${num(liters, 5)} L × ${num(v.num("fuelPrice") as number)} = ${fixed(petrolCost)}`,
      ],
      notes: ["Energy costs only: maintenance, insurance, tolls and purchase price are not included. Use the same currency for both prices."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
