"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "age-calculator": dynamic(() => import("./age-calculator"), { loading: () => <ToolLoading /> }),
  "date-difference-calculator": dynamic(() => import("./date-difference-calculator"), { loading: () => <ToolLoading /> }),
  "add-subtract-days": dynamic(() => import("./add-subtract-days"), { loading: () => <ToolLoading /> }),
  "business-days-calculator": dynamic(() => import("./business-days-calculator"), { loading: () => <ToolLoading /> }),
  "day-of-the-week-calculator": dynamic(() => import("./day-of-the-week-calculator"), { loading: () => <ToolLoading /> }),
  "week-number-calculator": dynamic(() => import("./week-number-calculator"), { loading: () => <ToolLoading /> }),
  "leap-year-checker": dynamic(() => import("./leap-year-checker"), { loading: () => <ToolLoading /> }),
  "countdown": dynamic(() => import("./countdown"), { loading: () => <ToolLoading /> }),
  "time-zone-converter": dynamic(() => import("./time-zone-converter"), { loading: () => <ToolLoading /> }),
  "world-clock": dynamic(() => import("./world-clock"), { loading: () => <ToolLoading /> }),
  "meeting-planner": dynamic(() => import("./meeting-planner"), { loading: () => <ToolLoading /> }),
  "unix-timestamp-converter": dynamic(() => import("./unix-timestamp-converter"), { loading: () => <ToolLoading /> }),
  "date-format-converter": dynamic(() => import("./date-format-converter"), { loading: () => <ToolLoading /> }),
  "stopwatch": dynamic(() => import("./stopwatch"), { loading: () => <ToolLoading /> }),
  "timer-and-alarm": dynamic(() => import("./timer-and-alarm"), { loading: () => <ToolLoading /> }),
};
