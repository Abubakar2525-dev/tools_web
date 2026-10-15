"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "study-timer": dynamic(() => import("./study-timer"), { loading: () => <ToolLoading /> }),
  "exam-countdown": dynamic(() => import("./exam-countdown"), { loading: () => <ToolLoading /> }),
  "presentation-timer": dynamic(() => import("./presentation-timer"), { loading: () => <ToolLoading /> }),
  "calendar-generator": dynamic(() => import("./calendar-generator"), { loading: () => <ToolLoading /> }),
  "calendar-invite-ics-generator": dynamic(() => import("./calendar-invite-ics-generator"), { loading: () => <ToolLoading /> }),
  "week-planner": dynamic(() => import("./week-planner"), { loading: () => <ToolLoading /> }),
  "to-do-list-and-checklist": dynamic(() => import("./to-do-list-and-checklist"), { loading: () => <ToolLoading /> }),
  "habit-tracker": dynamic(() => import("./habit-tracker"), { loading: () => <ToolLoading /> }),
  notes: dynamic(() => import("./notes"), { loading: () => <ToolLoading /> }),
  "semester-planner": dynamic(() => import("./semester-planner"), { loading: () => <ToolLoading /> }),
  "daily-study-planner": dynamic(() => import("./daily-study-planner"), { loading: () => <ToolLoading /> }),
  "project-planner": dynamic(() => import("./project-planner"), { loading: () => <ToolLoading /> }),
  "thesis-planner": dynamic(() => import("./thesis-planner"), { loading: () => <ToolLoading /> }),
};
