/**
 * Maps tool slugs to their interactive client components. Server pages import
 * this map; each page renders one entry, so only that tool's client chunk is
 * shipped to the browser.
 */
import type { ComponentType } from "react";

import PromptBuilder from "./engineering/prompt-builder";
import JsonFormatter from "./engineering/json-formatter";
import RegexTester from "./engineering/regex-tester";
import SqlFormatter from "./engineering/sql-formatter";
import TokenEstimator from "./engineering/token-estimator";
import ApiRequestBuilder from "./engineering/api-request-builder";
import MarkdownPreviewer from "./engineering/markdown-previewer";
import Base64Tool from "./engineering/base64-encoder-decoder";
import AiUseCasePlanner from "./engineering/ai-use-case-planner";
import RagReadiness from "./engineering/rag-readiness-checklist";

import GpaCalculator from "./student/gpa-calculator";
import CgpaCalculator from "./student/cgpa-calculator";
import PercentageCalculator from "./student/percentage-calculator";
import GradeCalculator from "./student/grade-calculator";
import StudyPlanner from "./student/study-planner";
import AssignmentPlanner from "./student/assignment-planner";
import PomodoroTimer from "./student/pomodoro-timer";
import WordCounter from "./student/word-counter";
import CitationFormatter from "./student/citation-formatter";
import CodingPracticePlanner from "./student/coding-practice-planner";

export const engineeringComponents: Record<string, ComponentType> = {
  "prompt-builder": PromptBuilder,
  "json-formatter": JsonFormatter,
  "regex-tester": RegexTester,
  "sql-formatter": SqlFormatter,
  "token-estimator": TokenEstimator,
  "api-request-builder": ApiRequestBuilder,
  "markdown-previewer": MarkdownPreviewer,
  "base64-encoder-decoder": Base64Tool,
  "ai-use-case-planner": AiUseCasePlanner,
  "rag-readiness-checklist": RagReadiness,
};

export const studentComponents: Record<string, ComponentType> = {
  "gpa-calculator": GpaCalculator,
  "cgpa-calculator": CgpaCalculator,
  "percentage-calculator": PercentageCalculator,
  "grade-calculator": GradeCalculator,
  "study-planner": StudyPlanner,
  "assignment-planner": AssignmentPlanner,
  "pomodoro-timer": PomodoroTimer,
  "word-counter": WordCounter,
  "citation-formatter": CitationFormatter,
  "coding-practice-planner": CodingPracticePlanner,
};
