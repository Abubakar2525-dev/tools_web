"use client";

import { FormulaTool, num, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { formatDD, formatDDM, formatDMS, fromUtm, parseLatLon, parseUtm, toUtm, type LatLon } from "./lib/geo";

const spec: FormulaSpec = {
  lead: (
    <>
      Accepts decimal degrees, degrees-minutes-seconds and degrees-decimal-minutes, with signs or N/S/E/W letters, or a UTM reference on the WGS84 datum.
    </>
  ),
  modes: [
    { id: "ll", label: "From latitude/longitude", fields: ["ll", "prec"] },
    { id: "utm", label: "From UTM", fields: ["utm", "prec"] },
  ],
  fields: [
    {
      id: "ll",
      label: "Coordinates",
      type: "text",
      mono: true,
      placeholder: "40°41'21.4\"N 74°02'40.2\"W",
      hint: "Examples: 40.6892, -74.0445 · 40 41 21.4 N, 74 2 40.2 W · N 40° 41.357' W 74° 2.670'",
    },
    { id: "utm", label: "UTM reference", type: "text", mono: true, placeholder: "18T 580735 4504695", hint: "Zone, latitude band (or north/south), easting, northing in meters." },
    {
      id: "prec",
      label: "Precision",
      type: "select",
      options: [
        { value: "std", label: "Standard (about 0.1 m)" },
        { value: "high", label: "High (about 1 mm)" },
        { value: "low", label: "Low (about 10 m)" },
      ],
    },
  ],
  example: { __mode: "ll", ll: "40°41'21.4\"N 74°02'40.2\"W" },
  compute: (v) => {
    let p: LatLon;
    const steps: string[] = [];
    if (v.mode === "ll") {
      const r = parseLatLon(v.str("ll"));
      if (typeof r === "string") return r;
      p = r;
    } else {
      const u = parseUtm(v.str("utm"));
      if (typeof u === "string") return u;
      const r = fromUtm(u.zone, u.hemisphere, u.easting, u.northing);
      if (typeof r === "string") return r;
      p = r;
      steps.push(`Read zone ${u.zone}, ${u.hemisphere === "N" ? "northern" : "southern"} hemisphere${u.band ? ` (band ${u.band})` : ""}, E ${num(u.easting)} m, N ${num(u.northing)} m`);
      if (u.band) {
        const back = toUtm(p.lat, p.lon, u.zone);
        if (typeof back !== "string" && back.band !== u.band) steps.push(`Note: the computed latitude falls in band ${back.band}, not ${u.band}. Check the reference.`);
      }
    }
    const prec = v.str("prec");
    const dd = prec === "high" ? 8 : prec === "low" ? 4 : 6;
    const sec = prec === "high" ? 4 : prec === "low" ? 1 : 2;
    const min = prec === "high" ? 6 : prec === "low" ? 3 : 4;
    const utm = toUtm(p.lat, p.lon);
    const utmText = typeof utm === "string" ? utm : `${utm.zone}${utm.band} ${utm.easting.toFixed(prec === "high" ? 3 : prec === "low" ? 0 : 1)} ${utm.northing.toFixed(prec === "high" ? 3 : prec === "low" ? 0 : 1)}`;
    const ddText = `${formatDD(p.lat, dd)}, ${formatDD(p.lon, dd)}`;
    const dmsText = `${formatDMS(p.lat, "lat", sec)}, ${formatDMS(p.lon, "lon", sec)}`;
    const ddmText = `${formatDDM(p.lat, "lat", min)}, ${formatDDM(p.lon, "lon", min)}`;
    steps.push(`Latitude ${formatDD(p.lat, 9)}°, longitude ${formatDD(p.lon, 9)}°`);
    if (typeof utm !== "string") {
      steps.push(`UTM zone ${utm.zone} (central meridian ${(utm.zone - 1) * 6 - 180 + 3}°), band ${utm.band}`);
      if ((p.lat >= 56 && p.lat < 64 && p.lon >= 3 && p.lon < 12) || (p.lat >= 72 && p.lon >= 0 && p.lon < 42)) steps.push("Norway/Svalbard zone exception applied.");
    }
    return {
      outputs: [
        { label: "Decimal degrees", value: ddText, primary: true },
        { label: "UTM (WGS84)", value: utmText },
      ],
      steps,
      table: {
        caption: "All formats",
        columns: ["Format", "Value"],
        rows: [
          ["Decimal degrees (DD)", ddText],
          ["Degrees minutes seconds (DMS)", dmsText],
          ["Degrees decimal minutes (DDM)", ddmText],
          ["UTM", utmText],
          ...(typeof utm !== "string" ? [["UTM scale factor / convergence", `${utm.scale.toFixed(6)} / ${utm.convergence.toFixed(4)}°`]] : []),
        ],
      },
      notes: ["All conversions use the WGS84 datum (GPS). Coordinates from older local datums such as NAD27 or ED50 can differ by tens to hundreds of meters."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
