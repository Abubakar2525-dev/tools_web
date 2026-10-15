"use client";

/**
 * Hydration-safe clock and environment hooks for the date and time tools.
 * Server render and hydration see `null`; real values appear right after.
 * Clocks pause while the tab is hidden and refresh as soon as it is visible.
 */

import { useSyncExternalStore } from "react";
import { formatISODate } from "./lib/dates";
import { localZone } from "./lib/tz";

type ClockStore = { now: number; subs: Set<() => void>; timer: number | null; onVis: (() => void) | null };
const clocks = new Map<number, ClockStore>();

function clockStore(ms: number): ClockStore {
  let s = clocks.get(ms);
  if (!s) {
    s = { now: 0, subs: new Set(), timer: null, onVis: null };
    clocks.set(ms, s);
  }
  return s;
}

function startClock(ms: number, s: ClockStore) {
  const notify = () => {
    s.now = Date.now();
    s.subs.forEach((f) => f());
  };
  const schedule = () => {
    if (s.timer !== null) window.clearTimeout(s.timer);
    // Align to the interval boundary so a 1 s clock ticks on the second.
    const delay = ms - (Date.now() % ms) + 2;
    s.timer = window.setTimeout(() => {
      s.timer = null;
      if (document.hidden) return;
      notify();
      schedule();
    }, delay);
  };
  s.onVis = () => {
    if (document.hidden) {
      if (s.timer !== null) window.clearTimeout(s.timer);
      s.timer = null;
    } else {
      notify();
      schedule();
    }
  };
  document.addEventListener("visibilitychange", s.onVis);
  s.now = Date.now();
  if (!document.hidden) schedule();
}

function stopClock(s: ClockStore) {
  if (s.timer !== null) window.clearTimeout(s.timer);
  s.timer = null;
  if (s.onVis) document.removeEventListener("visibilitychange", s.onVis);
  s.onVis = null;
}

type ClockApi = { subscribe: (cb: () => void) => () => void; get: () => number };
const apis = new Map<number, ClockApi>();

function clockApi(ms: number): ClockApi {
  let api = apis.get(ms);
  if (!api) {
    const s = clockStore(ms);
    api = {
      subscribe: (cb) => {
        s.subs.add(cb);
        if (s.subs.size === 1) startClock(ms, s);
        return () => {
          s.subs.delete(cb);
          if (s.subs.size === 0) stopClock(s);
        };
      },
      get: () => {
        if (s.now === 0) s.now = Date.now();
        return s.now;
      },
    };
    apis.set(ms, api);
  }
  return api;
}

const serverNull = () => null;

/** Current time in ms, updated every `intervalMs` while visible. `null` during SSR/hydration. */
export function useNow(intervalMs = 1000): number | null {
  const api = clockApi(intervalMs);
  return useSyncExternalStore(api.subscribe, api.get, serverNull);
}

/** Today's local date as YYYY-MM-DD, or "" before hydration. */
export function useTodayISO(): string {
  const now = useNow(60_000);
  if (now === null) return "";
  const d = new Date(now);
  return formatISODate({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
}

const noop = () => () => {};

/** The browser's IANA time zone, or "" before hydration. */
export function useLocalZone(): string {
  return useSyncExternalStore(noop, localZone, () => "");
}

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function subscribeLocation(cb: () => void) {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
}

/** `window.location.search`, read without useSearchParams ("" during SSR). */
export function useLocationSearch(): string {
  return useSyncExternalStore(subscribeLocation, () => window.location.search, () => "");
}
