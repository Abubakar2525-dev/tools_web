"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Btn, Checkbox, Notice, NumberField, PrivacyNote, SelectField, TextField, ToolPanel, parseNum } from "@/components/tools/kit";
import { describeDuration, formatClock } from "./lib/duration";

type Sound = "beep" | "chime" | "pulse";
type TimerState =
  | { phase: "idle" }
  | { phase: "running"; endAt: number; total: number }
  | { phase: "paused"; remaining: number; total: number }
  | { phase: "done"; endAt: number; total: number; firedAt: number };
type AlarmState = { phase: "off" } | { phase: "armed"; at: number; label: string } | { phase: "ringing"; at: number; label: string; firedAt: number };

const PRESETS = [1, 3, 5, 10, 15, 25, 30, 60];
const RING_SECONDS = 30;

/* ---------------- Web Audio tone generator ---------------- */

type AudioRig = { ctx: AudioContext; master: GainNode | null };

function playPattern(rig: AudioRig, sound: Sound, volume: number, seconds: number) {
  const { ctx } = rig;
  rig.master?.disconnect();
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  rig.master = master;
  const t0 = ctx.currentTime + 0.05;
  const beep = (at: number, freq: number, dur: number, type: OscillatorType = "sine") => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.6, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  };
  for (let k = 0; k < seconds; k++) {
    const at = t0 + k;
    if (sound === "beep") {
      beep(at, 880, 0.12, "square");
      beep(at + 0.2, 880, 0.12, "square");
    } else if (sound === "chime") {
      beep(at, 659.25, 0.5);
      beep(at + 0.25, 987.77, 0.6);
    } else {
      beep(at, 520, 0.35, "triangle");
    }
  }
}

function stopSound(rig: AudioRig | null) {
  if (rig?.master) {
    rig.master.disconnect();
    rig.master = null;
  }
}

/* ---------------- Notification permission (hydration-safe) ---------------- */

type Perm = NotificationPermission | "unsupported";
const readPerm = (): Perm => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);
const noopSub = () => () => {};

function nextOccurrence(hhmm: string, from: number): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const base = new Date(from);
  // Local calendar construction keeps the wall time across daylight-saving changes.
  let at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Number(m[1]), Number(m[2]), 0, 0);
  if (at.getTime() <= from) at = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, Number(m[1]), Number(m[2]), 0, 0);
  return at.getTime();
}

const timeOf = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function Tool() {
  const [hRaw, setH] = useState("0");
  const [mRaw, setM] = useState("5");
  const [sRaw, setS] = useState("0");
  const [timer, setTimer] = useState<TimerState>({ phase: "idle" });
  const [alarmTime, setAlarmTime] = useState("07:00");
  const [alarmLabel, setAlarmLabel] = useState("");
  const [alarm, setAlarm] = useState<AlarmState>({ phase: "off" });
  const [now, setNow] = useState(0);
  const [sound, setSound] = useState<Sound>("chime");
  const [volume, setVolume] = useState(0.6);
  const [notify, setNotify] = useState(false);
  const [permOverride, setPermOverride] = useState<Perm | null>(null);
  const permSnap = useSyncExternalStore(noopSub, readPerm, () => "default" as Perm);
  const perm = permOverride ?? permSnap;
  const rig = useRef<AudioRig | null>(null);
  const originalTitle = useRef<string | null>(null);

  const ensureAudio = () => {
    if (!rig.current) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      rig.current = { ctx: new Ctor(), master: null };
    }
    void rig.current.ctx.resume();
    return rig.current;
  };

  const h = parseNum(hRaw) ?? 0;
  const m = parseNum(mRaw) ?? 0;
  const s = parseNum(sRaw) ?? 0;
  const durationMs = (h * 3600 + m * 60 + s) * 1000;
  const durError =
    [hRaw, mRaw, sRaw].some((v) => v.trim() !== "" && (parseNum(v) === null || (parseNum(v) as number) < 0 || !Number.isInteger(parseNum(v))))
      ? "Use whole, non-negative numbers."
      : durationMs > 100 * 3600 * 1000
        ? "Keep the timer under 100 hours."
        : null;

  /* Ticking + firing. Effects subscribe to the clock; state changes happen in callbacks. */
  useEffect(() => {
    const timerEnd = timer.phase === "running" ? timer.endAt : null;
    const alarmAt = alarm.phase === "armed" ? alarm.at : null;
    if (timerEnd === null && alarmAt === null) return;
    let fired = false;
    const fire = (title: string, body: string) => {
      const r = rig.current;
      if (r) playPattern(r, sound, volume, RING_SECONDS);
      if (notify && readPerm() === "granted") {
        try {
          new Notification(title, { body, tag: "stratum-timer" });
        } catch {
          /* some mobile browsers only allow notifications from a service worker */
        }
      }
    };
    const check = () => {
      const t = Date.now();
      setNow(t);
      if (fired) return;
      if (timer.phase === "running" && t >= timer.endAt) {
        fired = true;
        setTimer({ phase: "done", endAt: timer.endAt, total: timer.total, firedAt: t });
        fire("Timer finished", `${describeDuration(timer.total)} timer is done.`);
      } else if (alarm.phase === "armed" && t >= alarm.at) {
        fired = true;
        setAlarm({ phase: "ringing", at: alarm.at, label: alarm.label, firedAt: t });
        fire(alarm.label || "Alarm", `It is ${timeOf(alarm.at)}.`);
      }
    };
    const iv = window.setInterval(check, 250);
    const next = Math.min(timerEnd ?? Infinity, alarmAt ?? Infinity);
    const precise = window.setTimeout(check, Math.max(0, Math.min(next - Date.now(), 2 ** 31 - 1)));
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(precise);
      document.removeEventListener("visibilitychange", check);
    };
  }, [timer, alarm, sound, volume, notify]);

  /* Document title mirrors the timer. */
  const remaining = timer.phase === "running" ? Math.max(0, timer.endAt - now) : timer.phase === "paused" ? timer.remaining : 0;
  const ringing = timer.phase === "done" || alarm.phase === "ringing";
  const titleText =
    timer.phase === "running" ? `${formatClock(remaining)} · Timer` : timer.phase === "paused" ? `Paused ${formatClock(remaining)}` : ringing ? "Time is up" : null;
  useEffect(() => {
    if (originalTitle.current === null) originalTitle.current = document.title;
    document.title = titleText ?? originalTitle.current;
  }, [titleText]);
  useEffect(
    () => () => {
      if (originalTitle.current !== null) document.title = originalTitle.current;
      stopSound(rig.current);
    },
    [],
  );

  const startTimer = (ms: number) => {
    if (ms <= 0) return;
    ensureAudio();
    const t = Date.now();
    setNow(t);
    setTimer({ phase: "running", endAt: t + ms, total: ms });
  };
  const dismiss = () => {
    stopSound(rig.current);
    if (timer.phase === "done") setTimer({ phase: "idle" });
    if (alarm.phase === "ringing") setAlarm({ phase: "off" });
  };

  const lateBy = (firedAt: number, due: number) => (firedAt - due > 5000 ? ` It finished while this tab or device was asleep, ${describeDuration(firedAt - due, false)} late.` : "");

  return (
    <div className="space-y-5">
      {ringing && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft p-4">
          <p className="font-medium text-ink">
            {timer.phase === "done" ? `Timer finished at ${timeOf(timer.firedAt)}.${lateBy(timer.firedAt, timer.endAt)}` : ""}
            {alarm.phase === "ringing" ? ` ${alarm.label || "Alarm"}: ${timeOf(alarm.at)}.${lateBy(alarm.firedAt, alarm.at)}` : ""}
          </p>
          <Btn onClick={dismiss}>Stop sound</Btn>
        </div>
      )}

      <ToolPanel title="Countdown timer">
        <div className="space-y-5">
          <p
            role="timer"
            className="text-center font-display text-[3.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink sm:text-[4.5rem]"
          >
            {timer.phase === "idle" || timer.phase === "done" ? formatClock(durationMs) : formatClock(remaining)}
          </p>
          {timer.phase !== "idle" && timer.phase !== "done" && (
            <div
              className="h-2 overflow-hidden rounded-full bg-sunken"
              role="progressbar"
              aria-label="Time remaining"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((remaining / timer.total) * 100)}
            >
              <div className="h-full bg-accent" style={{ width: `${(remaining / timer.total) * 100}%` }} />
            </div>
          )}
          {timer.phase === "idle" || timer.phase === "done" ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <NumberField label="Hours" value={hRaw} onChange={(e) => setH(e.target.value)} inputMode="numeric" />
                <NumberField label="Minutes" value={mRaw} onChange={(e) => setM(e.target.value)} inputMode="numeric" />
                <NumberField label="Seconds" value={sRaw} onChange={(e) => setS(e.target.value)} inputMode="numeric" />
              </div>
              {durError && <Notice tone="error">{durError}</Notice>}
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Btn
                    key={p}
                    variant="subtle"
                    onClick={() => {
                      setH(String(Math.floor(p / 60)));
                      setM(String(p % 60));
                      setS("0");
                    }}
                  >
                    {p < 60 ? `${p} min` : `${p / 60} h`}
                  </Btn>
                ))}
              </div>
              <Btn icon="play" onClick={() => startTimer(durationMs)} disabled={!!durError || durationMs <= 0}>
                Start timer
              </Btn>
            </>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {timer.phase === "running" ? (
                <Btn icon="pause" onClick={() => setTimer({ phase: "paused", remaining: Math.max(0, timer.endAt - Date.now()), total: timer.total })}>
                  Pause
                </Btn>
              ) : (
                <Btn
                  icon="play"
                  onClick={() => {
                    const t = Date.now();
                    setNow(t);
                    setTimer({ phase: "running", endAt: t + timer.remaining, total: timer.total });
                  }}
                >
                  Resume
                </Btn>
              )}
              <Btn variant="ghost" icon="plus" onClick={() => timer.phase === "running" ? setTimer({ ...timer, endAt: timer.endAt + 60_000, total: timer.total + 60_000 }) : setTimer({ ...timer, remaining: timer.remaining + 60_000, total: timer.total + 60_000 })}>
                1 min
              </Btn>
              <Btn variant="ghost" icon="reset" onClick={() => setTimer({ phase: "idle" })}>
                Cancel
              </Btn>
            </div>
          )}
          {timer.phase === "running" && <p className="text-center text-sm text-ink-2">Ends at {timeOf(timer.endAt)}.</p>}
        </div>
      </ToolPanel>

      <ToolPanel title="Alarm">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Alarm time" type="time" value={alarmTime} onChange={(e) => setAlarmTime(e.target.value)} disabled={alarm.phase !== "off"} />
            <TextField label="Label" optional value={alarmLabel} maxLength={60} onChange={(e) => setAlarmLabel(e.target.value)} placeholder="Stand-up" disabled={alarm.phase !== "off"} />
          </div>
          {alarm.phase === "off" ? (
            <Btn
              icon="timer"
              disabled={!/^\d{2}:\d{2}$/.test(alarmTime)}
              onClick={() => {
                const t = Date.now();
                const at = nextOccurrence(alarmTime, t);
                if (at === null) return;
                ensureAudio();
                setNow(t);
                setAlarm({ phase: "armed", at, label: alarmLabel.trim() });
              }}
            >
              Set alarm
            </Btn>
          ) : alarm.phase === "armed" ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-ink" aria-live="polite">
                Alarm set for {timeOf(alarm.at)}
                {new Date(alarm.at).getDate() !== new Date(now || alarm.at).getDate() ? " tomorrow" : ""}
                {now ? `, in ${describeDuration(alarm.at - now, false)}` : ""}.
              </p>
              <Btn variant="ghost" onClick={() => setAlarm({ phase: "off" })}>
                Turn off
              </Btn>
            </div>
          ) : null}
        </div>
      </ToolPanel>

      <ToolPanel title="Sound and alerts">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Sound"
              value={sound}
              onChange={(e) => setSound(e.target.value as Sound)}
              options={[
                { value: "chime", label: "Chime (two tones)" },
                { value: "beep", label: "Beep (double)" },
                { value: "pulse", label: "Soft pulse" },
              ]}
            />
            <div>
              <label htmlFor="ta-volume" className="text-sm font-medium text-ink">
                Volume: {Math.round(volume * 100)}%
              </label>
              <input
                id="ta-volume"
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="mt-4 block h-6 w-full accent-[var(--accent)]"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="ghost"
              icon="play"
              onClick={() => {
                const r = ensureAudio();
                if (r) playPattern(r, sound, volume, 2);
              }}
            >
              Test sound
            </Btn>
            <Btn variant="subtle" onClick={() => stopSound(rig.current)}>
              Stop
            </Btn>
          </div>
          <Checkbox
            label="Also show a system notification"
            hint={
              perm === "unsupported"
                ? "This browser does not support notifications."
                : perm === "denied"
                  ? "Notifications are blocked for this site. Allow them in your browser's site settings."
                  : "Your browser asks for permission the first time you turn this on."
            }
            checked={notify && perm === "granted"}
            onChange={async (on) => {
              if (!on) return setNotify(false);
              if (perm === "unsupported") return;
              const p = perm === "granted" ? "granted" : await Notification.requestPermission();
              setPermOverride(p);
              setNotify(p === "granted");
            }}
          />
          <p className="text-[0.8125rem] text-muted">
            Keep this tab open: browsers stop page timers when a tab is closed. Background tabs and sleeping devices can
            delay the sound; the timer is based on the clock, so it still shows the correct state when you return.
          </p>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}
