"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Btn,
  Checkbox,
  Notice,
  NumberField,
  PrivacyNote,
  StatGrid,
  ToolPanel,
  usePersistentState,
} from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Phase = "focus" | "short" | "long";

type Settings = {
  focus: string;
  short: string;
  long: string;
  every: string;
  autoStart: boolean;
  sound: boolean;
  notify: boolean;
};

type Stored = {
  settings: Settings;
  /** Completed focus stats for one local calendar day. */
  day: { date: string; minutes: number; sessions: number };
};

type Timer = {
  phase: Phase;
  status: "idle" | "running" | "paused";
  /** Epoch ms when the running phase ends. */
  endAt: number;
  /** Remaining ms while paused. */
  remaining: number;
  /** Focus sessions finished in the current long-break cycle. */
  cycle: number;
};

const DEFAULTS: Settings = {
  focus: "25",
  short: "5",
  long: "15",
  every: "4",
  autoStart: false,
  sound: true,
  notify: false,
};

const PHASE_LABEL: Record<Phase, string> = { focus: "Focus", short: "Short break", long: "Long break" };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function localDateKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function subscribeDay(cb: () => void) {
  const id = window.setInterval(cb, 30_000);
  document.addEventListener("visibilitychange", cb);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", cb);
  };
}

function validateInt(raw: string, min: number, max: number, what: string): { value: number | null; error: string | null } {
  const s = raw.trim();
  if (!s) return { value: null, error: `Enter ${what}.` };
  if (!/^\d+$/.test(s)) return { value: null, error: `Use a whole number from ${min} to ${max}.` };
  const n = Number(s);
  if (n < min || n > max) return { value: null, error: `Use a whole number from ${min} to ${max}.` };
  return { value: n, error: null };
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm.padStart(2, "0")}:${ss}`;
}

function spokenDuration(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const parts = [];
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (s || !m) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(el.tagName);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Tool() {
  const [stored, setStored] = usePersistentState<Stored>("pomodoro", {
    settings: DEFAULTS,
    day: { date: "", minutes: 0, sessions: 0 },
  });
  const settings: Settings = { ...DEFAULTS, ...(stored?.settings ?? {}) };
  const dayStore = stored?.day ?? { date: "", minutes: 0, sessions: 0 };

  const today = useSyncExternalStore(subscribeDay, () => localDateKey(), () => "");
  const todayMinutes = dayStore.date === today ? dayStore.minutes : 0;
  const todaySessions = dayStore.date === today ? dayStore.sessions : 0;

  /* Settings validation: invalid fields fall back to defaults and block starting. */
  const vFocus = validateInt(settings.focus, 1, 180, "focus minutes");
  const vShort = validateInt(settings.short, 1, 180, "short break minutes");
  const vLong = validateInt(settings.long, 1, 180, "long break minutes");
  const vEvery = validateInt(settings.every, 1, 12, "how many focus sessions come before a long break");
  const settingsValid = !vFocus.error && !vShort.error && !vLong.error && !vEvery.error;
  const fMin = vFocus.value ?? 25;
  const sMin = vShort.value ?? 5;
  const lMin = vLong.value ?? 15;
  const minutes = useMemo<Record<Phase, number>>(() => ({ focus: fMin, short: sMin, long: lMin }), [fMin, sMin, lMin]);
  const every = vEvery.value ?? 4;

  const [timer, setTimer] = useState<Timer>({ phase: "focus", status: "idle", endAt: 0, remaining: 0, cycle: 0 });
  const [now, setNow] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [notifyMsg, setNotifyMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const audioRef = useRef<AudioContext | null>(null);
  const originalTitle = useRef<string | null>(null);

  const phaseMs = minutes[timer.phase] * 60_000;
  const remaining =
    timer.status === "running" ? Math.max(0, timer.endAt - now) : timer.status === "paused" ? timer.remaining : phaseMs;
  const progress = phaseMs > 0 ? Math.min(1, Math.max(0, 1 - remaining / phaseMs)) : 0;

  const updateSettings = (patch: Partial<Settings>) =>
    setStored((prev) => ({ ...prev, settings: { ...DEFAULTS, ...(prev?.settings ?? {}), ...patch } }));

  /* Sound: short generated tone, no audio files. */
  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioRef.current) {
      try {
        audioRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    if (audioRef.current.state === "suspended") void audioRef.current.resume().catch(() => undefined);
    return audioRef.current;
  }, []);

  const beep = useCallback(() => {
    const ctx = ensureAudio();
    if (!ctx) return;
    const playTone = (start: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.27);
    };
    const t = ctx.currentTime;
    playTone(t, 880);
    playTone(t + 0.32, 1175);
  }, [ensureAudio]);

  useEffect(
    () => () => {
      void audioRef.current?.close().catch(() => undefined);
      audioRef.current = null;
    },
    [],
  );

  /* Phase completion, driven by wall-clock time so it survives tab throttling. */
  useEffect(() => {
    if (timer.status !== "running") return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t < timer.endAt) return;

      const finished = timer.phase;
      let nextPhase: Phase = "focus";
      let cycle = timer.cycle;
      if (finished === "focus") {
        cycle = timer.cycle + 1;
        nextPhase = cycle >= every ? "long" : "short";
        const key = localDateKey(new Date(t));
        const add = minutes.focus;
        setStored((prev) => {
          const day = prev?.day?.date === key ? prev.day : { date: key, minutes: 0, sessions: 0 };
          return { ...prev, day: { date: key, minutes: day.minutes + add, sessions: day.sessions + 1 } };
        });
      } else if (finished === "long") {
        cycle = 0;
      }
      const auto = settings.autoStart && settingsValid;
      const nextMs = minutes[nextPhase] * 60_000;
      setTimer({
        phase: nextPhase,
        status: auto ? "running" : "idle",
        endAt: auto ? t + nextMs : 0,
        remaining: 0,
        cycle,
      });
      const msg = `${PHASE_LABEL[finished]} finished. ${auto ? `${PHASE_LABEL[nextPhase]} started` : `Up next: ${PHASE_LABEL[nextPhase].toLowerCase()}`}.`;
      setAnnounce(msg);
      if (settings.sound) beep();
      if (settings.notify && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(`${PHASE_LABEL[finished]} finished`, {
            body: auto ? `${PHASE_LABEL[nextPhase]} has started.` : `Start your ${PHASE_LABEL[nextPhase].toLowerCase()} when ready.`,
            tag: "stratum-pomodoro",
          });
        } catch {
          /* Some mobile browsers only allow notifications from a service worker. */
        }
      }
    };
    const id = window.setInterval(tick, 250);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [
    timer,
    every,
    minutes,
    settings.autoStart,
    settings.sound,
    settings.notify,
    settingsValid,
    setStored,
    beep,
  ]);

  /* Document title: show remaining time while running, restore afterwards. */
  useEffect(() => {
    if (originalTitle.current === null) originalTitle.current = document.title;
    return () => {
      if (originalTitle.current !== null) document.title = originalTitle.current;
    };
  }, []);
  useEffect(() => {
    if (originalTitle.current === null) return;
    document.title =
      timer.status === "running"
        ? `${formatClock(remaining)} ${PHASE_LABEL[timer.phase]}`
        : timer.status === "paused"
          ? `Paused ${formatClock(remaining)}`
          : originalTitle.current;
  }, [timer.status, timer.phase, remaining]);

  /* Controls */
  const start = () => {
    if (!settingsValid) {
      setAnnounce("Fix the timer settings before starting.");
      return;
    }
    if (settings.sound) ensureAudio();
    const t = Date.now();
    setNow(t);
    setTimer((prev) => {
      const ms = prev.status === "paused" ? prev.remaining : minutes[prev.phase] * 60_000;
      return { ...prev, status: "running", endAt: t + ms, remaining: 0 };
    });
    setAnnounce(`${PHASE_LABEL[timer.phase]} ${timer.status === "paused" ? "resumed" : "started"}.`);
  };

  const pause = () => {
    const t = Date.now();
    setTimer((prev) => (prev.status === "running" ? { ...prev, status: "paused", remaining: Math.max(0, prev.endAt - t) } : prev));
    setAnnounce(`Paused with ${spokenDuration(Math.max(0, timer.endAt - t))} left.`);
  };

  const toggle = () => {
    if (timer.status === "running") pause();
    else start();
  };

  const skip = () => {
    const finished = timer.phase;
    let nextPhase: Phase = "focus";
    let cycle = timer.cycle;
    if (finished === "focus") {
      cycle = timer.cycle + 1;
      nextPhase = cycle >= every ? "long" : "short";
    } else if (finished === "long") cycle = 0;
    setTimer({ phase: nextPhase, status: "idle", endAt: 0, remaining: 0, cycle });
    setAnnounce(`Skipped ${PHASE_LABEL[finished].toLowerCase()}. Up next: ${PHASE_LABEL[nextPhase].toLowerCase()}. Skipped sessions are not counted.`);
  };

  const reset = () => {
    setTimer({ phase: "focus", status: "idle", endAt: 0, remaining: 0, cycle: 0 });
    setAnnounce("Timer reset to a fresh focus session.");
  };

  /* Keyboard: Space starts or pauses when focus is not in a control. */
  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      toggleRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* Notifications: permission requested only from this click. */
  const setNotify = async (on: boolean) => {
    if (!on) {
      updateSettings({ notify: false });
      setNotifyMsg(null);
      return;
    }
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setNotifyMsg({ tone: "error", text: "This browser does not support notifications. Sound and the tab title still work." });
      return;
    }
    if (Notification.permission === "granted") {
      updateSettings({ notify: true });
      setNotifyMsg({ tone: "info", text: "Notifications are on. You will get one when each session ends." });
      return;
    }
    if (Notification.permission === "denied") {
      setNotifyMsg({
        tone: "error",
        text: "Notifications are blocked for this site. Allow them in your browser's site settings, then try again.",
      });
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        updateSettings({ notify: true });
        setNotifyMsg({ tone: "info", text: "Notifications are on. You will get one when each session ends." });
      } else {
        updateSettings({ notify: false });
        setNotifyMsg({ tone: "error", text: "Permission was not granted, so notifications stay off." });
      }
    } catch {
      setNotifyMsg({ tone: "error", text: "Could not ask for notification permission in this browser." });
    }
  };

  /* Ring geometry */
  const R = 104;
  const C = 2 * Math.PI * R;
  const isFocus = timer.phase === "focus";
  const sessionInCycle = Math.min(timer.cycle + (isFocus ? 1 : 0), every);

  return (
    <div className="space-y-5">
      <ToolPanel title="Pomodoro timer">
        <div className="flex flex-col items-center gap-5">
          <p className="chip h-8 px-3 text-sm font-medium text-ink">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${isFocus ? "bg-accent" : "bg-ink-2"}`} />
            {PHASE_LABEL[timer.phase]}
            {timer.status === "paused" && <span className="text-muted">(paused)</span>}
          </p>

          <div className="relative aspect-square w-full max-w-[260px]">
            <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90" aria-hidden="true" focusable="false">
              <circle cx="120" cy="120" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
              <circle
                cx="120"
                cy="120"
                r={R}
                fill="none"
                stroke={isFocus ? "var(--accent)" : "var(--ink-2)"}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300 motion-safe:ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                role="timer"
                aria-live="off"
                aria-atomic="true"
                aria-label={`${PHASE_LABEL[timer.phase]}, ${spokenDuration(remaining)} remaining`}
                className="font-display text-[3.25rem] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums sm:text-[3.75rem]"
              >
                {formatClock(remaining)}
              </div>
              <p className="mt-2 text-sm text-muted">
                {isFocus ? `Session ${sessionInCycle} of ${every}` : "Break time"}
              </p>
            </div>
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {announce}
          </p>

          <div className="flex w-full flex-wrap justify-center gap-2">
            <Btn
              onClick={toggle}
              disabled={!settingsValid && timer.status !== "running"}
              className="min-w-[140px] !min-h-12"
              aria-keyshortcuts="Space"
            >
              <Icon name={timer.status === "running" ? "timer" : "arrow"} size={16} />
              {timer.status === "running" ? "Pause" : timer.status === "paused" ? "Resume" : "Start"}
            </Btn>
            <Btn variant="ghost" icon="arrow" onClick={skip} className="!min-h-12">
              Skip
            </Btn>
            <Btn variant="subtle" icon="reset" onClick={reset} className="!min-h-12">
              Reset
            </Btn>
          </div>
          <p className="text-center text-[0.8125rem] text-muted">
            Tip: press <kbd className="inline-code">Space</kbd> to start or pause when you are not typing in a field.
          </p>
          {!settingsValid && (
            <Notice tone="error">Some settings are not valid. Fix them below to start the timer.</Notice>
          )}
        </div>
      </ToolPanel>

      <ToolPanel title="Today">
        <StatGrid
          items={[
            { label: "Focus sessions done", value: today ? todaySessions : "–" },
            { label: "Focus minutes today", value: today ? todayMinutes : "–" },
            { label: "Until long break", value: `${Math.max(0, every - timer.cycle)} focus` },
          ]}
        />
        <p className="mt-3 text-[0.8125rem] text-muted">
          Only focus sessions that run to the end count. Totals reset at local midnight.
        </p>
      </ToolPanel>

      <ToolPanel title="Settings">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Focus (minutes)"
              inputMode="numeric"
              value={settings.focus}
              onChange={(e) => updateSettings({ focus: e.target.value })}
              error={vFocus.error}
            />
            <NumberField
              label="Short break (minutes)"
              inputMode="numeric"
              value={settings.short}
              onChange={(e) => updateSettings({ short: e.target.value })}
              error={vShort.error}
            />
            <NumberField
              label="Long break (minutes)"
              inputMode="numeric"
              value={settings.long}
              onChange={(e) => updateSettings({ long: e.target.value })}
              error={vLong.error}
            />
            <NumberField
              label="Long break after this many focus sessions"
              inputMode="numeric"
              value={settings.every}
              onChange={(e) => updateSettings({ every: e.target.value })}
              error={vEvery.error}
            />
          </div>
          <p className="text-[0.8125rem] text-muted">
            Durations are whole minutes from 1 to 180. Changes apply to the next session that starts.
          </p>
          <div className="space-y-3">
            <Checkbox
              label="Start the next session automatically"
              checked={settings.autoStart}
              onChange={(v) => updateSettings({ autoStart: v })}
            />
            <Checkbox
              label="Play a short sound when a session ends"
              checked={settings.sound}
              onChange={(v) => {
                updateSettings({ sound: v });
                if (v) ensureAudio();
              }}
            />
            <Checkbox
              label="Show a browser notification when a session ends"
              hint="Your browser will ask for permission the first time."
              checked={settings.notify}
              onChange={(v) => void setNotify(v)}
            />
            {notifyMsg && <Notice tone={notifyMsg.tone}>{notifyMsg.text}</Notice>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="subtle"
              icon="reset"
              onClick={() => {
                updateSettings({ focus: DEFAULTS.focus, short: DEFAULTS.short, long: DEFAULTS.long, every: DEFAULTS.every });
                setAnnounce("Durations restored to 25, 5 and 15 minutes with a long break every 4 sessions.");
              }}
            >
              Restore default durations
            </Btn>
          </div>
          <PrivacyNote stored />
        </div>
      </ToolPanel>
    </div>
  );
}
