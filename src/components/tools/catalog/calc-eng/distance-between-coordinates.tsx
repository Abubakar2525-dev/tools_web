"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { compassPoint, haversine, parseLatLon, vincentyInverse } from "./lib/geo";

const KM_MI = 1.609344;
const KM_NMI = 1.852;

const spec: FormulaSpec = {
  lead: <>Any coordinate format works: decimal degrees, DMS or degrees with decimal minutes.</>,
  fields: [
    { id: "a", label: "Point A", type: "text", mono: true, placeholder: "40.6413, -73.7781" },
    { id: "b", label: "Point B", type: "text", mono: true, placeholder: "51.4700, -0.4543" },
  ],
  example: { a: "40.6413, -73.7781", b: "51.4700, -0.4543" },
  compute: (v) => {
    const a = parseLatLon(v.str("a"));
    if (typeof a === "string") return `Point A: ${a}`;
    const b = parseLatLon(v.str("b"));
    if (typeof b === "string") return `Point B: ${b}`;
    const hav = haversine(a, b) / 1000;
    const vin = vincentyInverse(a, b);
    const best = vin.ok ? vin.distance / 1000 : hav;
    const rows = [
      ["Ellipsoid (Vincenty, WGS84)", vin.ok ? num(vin.distance / 1000, 7) : "did not converge", vin.ok ? num(vin.distance / 1000 / KM_MI, 7) : "-", vin.ok ? num(vin.distance / 1000 / KM_NMI, 7) : "-"],
      ["Sphere (haversine, R = 6371.0088 km)", num(hav, 7), num(hav / KM_MI, 7), num(hav / KM_NMI, 7)],
    ];
    return {
      outputs: [
        { label: vin.ok ? "Distance (WGS84 ellipsoid)" : "Distance (spherical estimate)", value: `${num(best, 6)} km`, primary: true, note: `${num(best / KM_MI, 6)} mi · ${num(best / KM_NMI, 6)} nmi` },
        { label: "Great-circle (haversine)", value: `${num(hav, 6)} km` },
        { label: "Difference", value: vin.ok ? `${num(((hav - best) / best) * 100, 3)}%` : "n/a" },
        ...(vin.ok && Number.isFinite(vin.initialBearing)
          ? [
              { label: "Initial bearing", value: `${num(vin.initialBearing, 5)}° (${compassPoint(vin.initialBearing)})` },
              { label: "Final bearing", value: `${num(vin.finalBearing, 5)}°` },
            ]
          : []),
      ],
      steps: [
        `A = ${num(a.lat, 8)}, ${num(a.lon, 8)}; B = ${num(b.lat, 8)}, ${num(b.lon, 8)}`,
        `Haversine: d = 2R · asin(√(sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2))) = ${num(hav, 7)} km`,
        vin.ok ? `Vincenty converged after ${vin.iterations} iteration${vin.iterations === 1 ? "" : "s"}: ${num(vin.distance, 9)} m` : `Vincenty: ${vin.reason}`,
      ],
      table: { caption: "Distance by method", columns: ["Method", "km", "mi", "nmi"], rows },
      notes: vin.ok
        ? ["These are shortest paths over the Earth's surface at sea level, not road or flight-route distances."]
        : [`${vin.reason} The haversine result is shown instead; on a sphere it may differ from the true ellipsoidal distance by up to about 0.5%.`],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
