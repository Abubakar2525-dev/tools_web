"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "area-calculator": dynamic(() => import("./area-calculator"), { loading: () => <ToolLoading /> }),
  "circle-calculator": dynamic(() => import("./circle-calculator"), { loading: () => <ToolLoading /> }),
  "triangle-calculator": dynamic(() => import("./triangle-calculator"), { loading: () => <ToolLoading /> }),
  "volume-and-surface-area-calculator": dynamic(() => import("./volume-and-surface-area-calculator"), { loading: () => <ToolLoading /> }),
  "pythagorean-theorem-calculator": dynamic(() => import("./pythagorean-theorem-calculator"), { loading: () => <ToolLoading /> }),
  "speed-distance-and-time-calculator": dynamic(() => import("./speed-distance-and-time-calculator"), { loading: () => <ToolLoading /> }),
  "acceleration-calculator": dynamic(() => import("./acceleration-calculator"), { loading: () => <ToolLoading /> }),
  "force-calculator": dynamic(() => import("./force-calculator"), { loading: () => <ToolLoading /> }),
  "momentum-calculator": dynamic(() => import("./momentum-calculator"), { loading: () => <ToolLoading /> }),
  "energy-calculator": dynamic(() => import("./energy-calculator"), { loading: () => <ToolLoading /> }),
  "power-calculator": dynamic(() => import("./power-calculator"), { loading: () => <ToolLoading /> }),
  "pressure-calculator": dynamic(() => import("./pressure-calculator"), { loading: () => <ToolLoading /> }),
  "density-calculator": dynamic(() => import("./density-calculator"), { loading: () => <ToolLoading /> }),
  "work-calculator": dynamic(() => import("./work-calculator"), { loading: () => <ToolLoading /> }),
  "projectile-motion-calculator": dynamic(() => import("./projectile-motion-calculator"), { loading: () => <ToolLoading /> }),
  "gravitational-force-calculator": dynamic(() => import("./gravitational-force-calculator"), { loading: () => <ToolLoading /> }),
  "wavelength-calculator": dynamic(() => import("./wavelength-calculator"), { loading: () => <ToolLoading /> }),
  "frequency-calculator": dynamic(() => import("./frequency-calculator"), { loading: () => <ToolLoading /> }),
  "molarity-calculator": dynamic(() => import("./molarity-calculator"), { loading: () => <ToolLoading /> }),
  "molecular-weight-calculator": dynamic(() => import("./molecular-weight-calculator"), { loading: () => <ToolLoading /> }),
  "ph-calculator": dynamic(() => import("./ph-calculator"), { loading: () => <ToolLoading /> }),
  "mole-calculator": dynamic(() => import("./mole-calculator"), { loading: () => <ToolLoading /> }),
  "concentration-calculator": dynamic(() => import("./concentration-calculator"), { loading: () => <ToolLoading /> }),
  "stoichiometry-calculator": dynamic(() => import("./stoichiometry-calculator"), { loading: () => <ToolLoading /> }),
  "chemical-equation-balancer": dynamic(() => import("./chemical-equation-balancer"), { loading: () => <ToolLoading /> }),
  "ideal-gas-law-calculator": dynamic(() => import("./ideal-gas-law-calculator"), { loading: () => <ToolLoading /> }),
  "half-life-calculator": dynamic(() => import("./half-life-calculator"), { loading: () => <ToolLoading /> }),
  "periodic-table": dynamic(() => import("./periodic-table"), { loading: () => <ToolLoading /> }),
};
