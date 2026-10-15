"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "discount-calculator": dynamic(() => import("./discount-calculator"), { loading: () => <ToolLoading /> }),
  "tip-calculator": dynamic(() => import("./tip-calculator"), { loading: () => <ToolLoading /> }),
  "bill-splitter": dynamic(() => import("./bill-splitter"), { loading: () => <ToolLoading /> }),
  "vat-gst-sales-tax-calculator": dynamic(() => import("./vat-gst-sales-tax-calculator"), { loading: () => <ToolLoading /> }),
  "unit-price-comparison": dynamic(() => import("./unit-price-comparison"), { loading: () => <ToolLoading /> }),
  "currency-formatter": dynamic(() => import("./currency-formatter"), { loading: () => <ToolLoading /> }),
  "loan-emi-calculator": dynamic(() => import("./loan-emi-calculator"), { loading: () => <ToolLoading /> }),
  "mortgage-calculator": dynamic(() => import("./mortgage-calculator"), { loading: () => <ToolLoading /> }),
  "simple-interest-calculator": dynamic(() => import("./simple-interest-calculator"), { loading: () => <ToolLoading /> }),
  "compound-interest-calculator": dynamic(() => import("./compound-interest-calculator"), { loading: () => <ToolLoading /> }),
  "savings-calculator": dynamic(() => import("./savings-calculator"), { loading: () => <ToolLoading /> }),
  "investment-calculator": dynamic(() => import("./investment-calculator"), { loading: () => <ToolLoading /> }),
  "sip-calculator": dynamic(() => import("./sip-calculator"), { loading: () => <ToolLoading /> }),
  "roi-calculator": dynamic(() => import("./roi-calculator"), { loading: () => <ToolLoading /> }),
  "retirement-calculator": dynamic(() => import("./retirement-calculator"), { loading: () => <ToolLoading /> }),
  "inflation-calculator": dynamic(() => import("./inflation-calculator"), { loading: () => <ToolLoading /> }),
  "net-worth-calculator": dynamic(() => import("./net-worth-calculator"), { loading: () => <ToolLoading /> }),
  "salary-converter": dynamic(() => import("./salary-converter"), { loading: () => <ToolLoading /> }),
  "take-home-pay-calculator": dynamic(() => import("./take-home-pay-calculator"), { loading: () => <ToolLoading /> }),
  "budget-planner": dynamic(() => import("./budget-planner"), { loading: () => <ToolLoading /> }),
  "expense-tracker": dynamic(() => import("./expense-tracker"), { loading: () => <ToolLoading /> }),
  "subscription-cost-calculator": dynamic(() => import("./subscription-cost-calculator"), { loading: () => <ToolLoading /> }),
  "student-budget-calculator": dynamic(() => import("./student-budget-calculator"), { loading: () => <ToolLoading /> }),
  "rent-affordability-calculator": dynamic(() => import("./rent-affordability-calculator"), { loading: () => <ToolLoading /> }),
  "iban-validator-and-formatter": dynamic(() => import("./iban-validator-and-formatter"), { loading: () => <ToolLoading /> }),
  "swift-bic-checker": dynamic(() => import("./swift-bic-checker"), { loading: () => <ToolLoading /> }),
  "card-number-validator-luhn": dynamic(() => import("./card-number-validator-luhn"), { loading: () => <ToolLoading /> }),
};
