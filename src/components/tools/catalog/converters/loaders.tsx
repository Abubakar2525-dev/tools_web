"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "length-converter": dynamic(() => import("./length-converter"), { loading: () => <ToolLoading /> }),
  "weight-converter": dynamic(() => import("./weight-converter"), { loading: () => <ToolLoading /> }),
  "temperature-converter": dynamic(() => import("./temperature-converter"), { loading: () => <ToolLoading /> }),
  "area-converter": dynamic(() => import("./area-converter"), { loading: () => <ToolLoading /> }),
  "volume-converter": dynamic(() => import("./volume-converter"), { loading: () => <ToolLoading /> }),
  "speed-converter": dynamic(() => import("./speed-converter"), { loading: () => <ToolLoading /> }),
  "time-converter": dynamic(() => import("./time-converter"), { loading: () => <ToolLoading /> }),
  "pressure-converter": dynamic(() => import("./pressure-converter"), { loading: () => <ToolLoading /> }),
  "energy-converter": dynamic(() => import("./energy-converter"), { loading: () => <ToolLoading /> }),
  "power-converter": dynamic(() => import("./power-converter"), { loading: () => <ToolLoading /> }),
  "frequency-converter": dynamic(() => import("./frequency-converter"), { loading: () => <ToolLoading /> }),
  "force-converter": dynamic(() => import("./force-converter"), { loading: () => <ToolLoading /> }),
  "torque-converter": dynamic(() => import("./torque-converter"), { loading: () => <ToolLoading /> }),
  "density-converter": dynamic(() => import("./density-converter"), { loading: () => <ToolLoading /> }),
  "angle-converter": dynamic(() => import("./angle-converter"), { loading: () => <ToolLoading /> }),
  "fuel-economy-converter": dynamic(() => import("./fuel-economy-converter"), { loading: () => <ToolLoading /> }),
  "cooking-unit-converter": dynamic(() => import("./cooking-unit-converter"), { loading: () => <ToolLoading /> }),
  "data-storage-converter": dynamic(() => import("./data-storage-converter"), { loading: () => <ToolLoading /> }),
  "data-transfer-rate-converter": dynamic(() => import("./data-transfer-rate-converter"), { loading: () => <ToolLoading /> }),
  "pixels-to-print-size-converter": dynamic(() => import("./pixels-to-print-size-converter"), { loading: () => <ToolLoading /> }),
  "screen-size-calculator": dynamic(() => import("./screen-size-calculator"), { loading: () => <ToolLoading /> }),
  "clothing-size-converter": dynamic(() => import("./clothing-size-converter"), { loading: () => <ToolLoading /> }),
  "shoe-size-converter": dynamic(() => import("./shoe-size-converter"), { loading: () => <ToolLoading /> }),
  "paper-size-reference": dynamic(() => import("./paper-size-reference"), { loading: () => <ToolLoading /> }),
  "number-base-converter": dynamic(() => import("./number-base-converter"), { loading: () => <ToolLoading /> }),
  "roman-numeral-converter": dynamic(() => import("./roman-numeral-converter"), { loading: () => <ToolLoading /> }),
  "number-to-words-converter": dynamic(() => import("./number-to-words-converter"), { loading: () => <ToolLoading /> }),
  "decimal-to-fraction-converter": dynamic(() => import("./decimal-to-fraction-converter"), { loading: () => <ToolLoading /> }),
  "scientific-notation-converter": dynamic(() => import("./scientific-notation-converter"), { loading: () => <ToolLoading /> }),
  "number-formatter": dynamic(() => import("./number-formatter"), { loading: () => <ToolLoading /> }),
};
