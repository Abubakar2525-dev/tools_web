"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "basic-calculator": dynamic(() => import("./basic-calculator"), { loading: () => <ToolLoading /> }),
  "scientific-calculator": dynamic(() => import("./scientific-calculator"), { loading: () => <ToolLoading /> }),
  "ratio-and-proportion-calculator": dynamic(() => import("./ratio-and-proportion-calculator"), { loading: () => <ToolLoading /> }),
  "fraction-calculator": dynamic(() => import("./fraction-calculator"), { loading: () => <ToolLoading /> }),
  "exponent-calculator": dynamic(() => import("./exponent-calculator"), { loading: () => <ToolLoading /> }),
  "root-calculator": dynamic(() => import("./root-calculator"), { loading: () => <ToolLoading /> }),
  "logarithm-calculator": dynamic(() => import("./logarithm-calculator"), { loading: () => <ToolLoading /> }),
  "factorial-calculator": dynamic(() => import("./factorial-calculator"), { loading: () => <ToolLoading /> }),
  "prime-number-checker-and-generator": dynamic(() => import("./prime-number-checker-and-generator"), { loading: () => <ToolLoading /> }),
  "prime-factorization-calculator": dynamic(() => import("./prime-factorization-calculator"), { loading: () => <ToolLoading /> }),
  "lcm-and-gcd-calculator": dynamic(() => import("./lcm-and-gcd-calculator"), { loading: () => <ToolLoading /> }),
  "fibonacci-calculator": dynamic(() => import("./fibonacci-calculator"), { loading: () => <ToolLoading /> }),
  "permutation-and-combination-calculator": dynamic(() => import("./permutation-and-combination-calculator"), { loading: () => <ToolLoading /> }),
  "probability-calculator": dynamic(() => import("./probability-calculator"), { loading: () => <ToolLoading /> }),
  "equation-solver": dynamic(() => import("./equation-solver"), { loading: () => <ToolLoading /> }),
  "quadratic-equation-solver": dynamic(() => import("./quadratic-equation-solver"), { loading: () => <ToolLoading /> }),
  "matrix-calculator": dynamic(() => import("./matrix-calculator"), { loading: () => <ToolLoading /> }),
  "sequence-calculator": dynamic(() => import("./sequence-calculator"), { loading: () => <ToolLoading /> }),
  "series-calculator": dynamic(() => import("./series-calculator"), { loading: () => <ToolLoading /> }),
  "derivative-calculator": dynamic(() => import("./derivative-calculator"), { loading: () => <ToolLoading /> }),
  "vector-calculator": dynamic(() => import("./vector-calculator"), { loading: () => <ToolLoading /> }),
  "number-base-calculator": dynamic(() => import("./number-base-calculator"), { loading: () => <ToolLoading /> }),
  "mean-median-and-mode-calculator": dynamic(() => import("./mean-median-and-mode-calculator"), { loading: () => <ToolLoading /> }),
  "standard-deviation-and-variance-calculator": dynamic(() => import("./standard-deviation-and-variance-calculator"), { loading: () => <ToolLoading /> }),
  "z-score-calculator": dynamic(() => import("./z-score-calculator"), { loading: () => <ToolLoading /> }),
  "confidence-interval-calculator": dynamic(() => import("./confidence-interval-calculator"), { loading: () => <ToolLoading /> }),
  "p-value-calculator": dynamic(() => import("./p-value-calculator"), { loading: () => <ToolLoading /> }),
  "effect-size-calculator": dynamic(() => import("./effect-size-calculator"), { loading: () => <ToolLoading /> }),
  "sample-size-calculator": dynamic(() => import("./sample-size-calculator"), { loading: () => <ToolLoading /> }),
  "regression-calculator": dynamic(() => import("./regression-calculator"), { loading: () => <ToolLoading /> }),
};
