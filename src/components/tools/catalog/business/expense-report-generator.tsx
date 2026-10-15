"use client";

import { DocEditor } from "./shared/DocEditor";

export default function Tool() {
  return <DocEditor kind="expense" storageKey="expense-report-generator" />;
}
