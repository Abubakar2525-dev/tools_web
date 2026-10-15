"use client";

import type { ComponentType } from "react";
import { components as existing } from "./existing";
import { components as cPdfA } from "./pdf-a/loaders";
import { components as cPdfB } from "./pdf-b/loaders";
import { components as cImage } from "./image/loaders";
import { components as cBgSocial } from "./bg-social/loaders";
import { components as cAudio } from "./audio/loaders";
import { components as cText } from "./text/loaders";
import { components as cResearchWeb } from "./research-web/loaders";
import { components as cCalcMath } from "./calc-math/loaders";
import { components as cCalcScience } from "./calc-science/loaders";
import { components as cCalcEng } from "./calc-eng/loaders";
import { components as cConverters } from "./converters/loaders";
import { components as cFinance } from "./finance/loaders";
import { components as cDatetimeA } from "./datetime-a/loaders";
import { components as cDatetimeB } from "./datetime-b/loaders";
import { components as cSecurityFiles } from "./security-files/loaders";
import { components as cDeveloper } from "./developer/loaders";
import { components as cBusiness } from "./business/loaders";
import { components as cDesign } from "./design/loaders";

/** slug → lazily loaded tool component (each is its own chunk via next/dynamic). */
const registry: Record<string, ComponentType> = {
  ...existing,
  ...cPdfA,
  ...cPdfB,
  ...cImage,
  ...cBgSocial,
  ...cAudio,
  ...cText,
  ...cResearchWeb,
  ...cCalcMath,
  ...cCalcScience,
  ...cCalcEng,
  ...cConverters,
  ...cFinance,
  ...cDatetimeA,
  ...cDatetimeB,
  ...cSecurityFiles,
  ...cDeveloper,
  ...cBusiness,
  ...cDesign,
};

export function ToolHost({ slug }: { slug: string }) {
  const C = registry[slug];
  if (!C) return <p className="text-danger">This tool is not available yet.</p>;
  return <C />;
}

export const registeredSlugs = () => Object.keys(registry);
