"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "invoice-generator": dynamic(() => import("./invoice-generator"), { loading: () => <ToolLoading /> }),
  "receipt-generator": dynamic(() => import("./receipt-generator"), { loading: () => <ToolLoading /> }),
  "quotation-generator": dynamic(() => import("./quotation-generator"), { loading: () => <ToolLoading /> }),
  "purchase-order-generator": dynamic(() => import("./purchase-order-generator"), { loading: () => <ToolLoading /> }),
  "expense-report-generator": dynamic(() => import("./expense-report-generator"), { loading: () => <ToolLoading /> }),
  "letterhead-generator": dynamic(() => import("./letterhead-generator"), { loading: () => <ToolLoading /> }),
  "business-card-generator": dynamic(() => import("./business-card-generator"), { loading: () => <ToolLoading /> }),
  "email-signature-generator": dynamic(() => import("./email-signature-generator"), { loading: () => <ToolLoading /> }),
  "vcard-to-csv-converter": dynamic(() => import("./vcard-to-csv-converter"), { loading: () => <ToolLoading /> }),
  "timesheet-and-working-hours-calculator": dynamic(() => import("./timesheet-and-working-hours-calculator"), { loading: () => <ToolLoading /> }),
  "overtime-calculator": dynamic(() => import("./overtime-calculator"), { loading: () => <ToolLoading /> }),
  "commission-calculator": dynamic(() => import("./commission-calculator"), { loading: () => <ToolLoading /> }),
  "bonus-calculator": dynamic(() => import("./bonus-calculator"), { loading: () => <ToolLoading /> }),
  "employee-cost-calculator": dynamic(() => import("./employee-cost-calculator"), { loading: () => <ToolLoading /> }),
  "profit-margin-calculator": dynamic(() => import("./profit-margin-calculator"), { loading: () => <ToolLoading /> }),
  "markup-calculator": dynamic(() => import("./markup-calculator"), { loading: () => <ToolLoading /> }),
  "break-even-calculator": dynamic(() => import("./break-even-calculator"), { loading: () => <ToolLoading /> }),
  "revenue-calculator": dynamic(() => import("./revenue-calculator"), { loading: () => <ToolLoading /> }),
  "cash-flow-calculator": dynamic(() => import("./cash-flow-calculator"), { loading: () => <ToolLoading /> }),
  "project-cost-calculator": dynamic(() => import("./project-cost-calculator"), { loading: () => <ToolLoading /> }),
  "meeting-cost-calculator": dynamic(() => import("./meeting-cost-calculator"), { loading: () => <ToolLoading /> }),
  "resume-builder": dynamic(() => import("./resume-builder"), { loading: () => <ToolLoading /> }),
  "portfolio-builder": dynamic(() => import("./portfolio-builder"), { loading: () => <ToolLoading /> }),
  "job-application-tracker": dynamic(() => import("./job-application-tracker"), { loading: () => <ToolLoading /> }),
};
