"use client";

import { useState } from "react";
import {
  Btn,
  Checkbox,
  CopyBtn,
  Notice,
  NumberField,
  OutputBlock,
  PrivacyNote,
  ResetBtn,
  Segmented,
  SelectField,
  TextArea,
  TextField,
  ToolPanel,
  downloadFile,
  parseNum,
} from "@/components/tools/kit";
import { addDays, dayKey } from "./lib/dates";
import {
  WEEKDAYS,
  buildIcs,
  describeRrule,
  parsePeople,
  utcStamp,
  validateEvent,
  zonedToUtc,
  type IcsEvent,
  type Recurrence,
  type TzMode,
  type Weekday,
} from "./lib/ics";
import { SubHead, useIsClient, useNow } from "./shared";

const ALARMS: { value: number; label: string }[] = [
  { value: 0, label: "At start" },
  { value: 5, label: "5 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
  { value: 10080, label: "1 week before" },
];
const DAY_LABEL: Record<Weekday, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };

const makeUid = () => `${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}@stratum.local`;

function zoneList(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    const z = intl.supportedValuesOf?.("timeZone") ?? [];
    return z.includes("UTC") ? z : ["UTC", ...z];
  } catch {
    return ["UTC"];
  }
}

type Form = {
  title: string;
  location: string;
  description: string;
  url: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  tzMode: TzMode;
  timeZone: string;
  orgName: string;
  orgEmail: string;
  attendees: string;
  alarms: number[];
  freq: "NONE" | Recurrence["freq"];
  interval: string;
  byDay: Weekday[];
  monthly: Recurrence["monthly"];
  endKind: Recurrence["end"]["kind"];
  count: string;
  until: string;
};

const BLANK: Form = {
  title: "",
  location: "",
  description: "",
  url: "",
  allDay: false,
  startDate: "",
  startTime: "09:00",
  endDate: "",
  endTime: "10:00",
  tzMode: "tzid",
  timeZone: "",
  orgName: "",
  orgEmail: "",
  attendees: "",
  alarms: [15],
  freq: "NONE",
  interval: "1",
  byDay: [],
  monthly: "date",
  endKind: "count",
  count: "10",
  until: "",
};

export default function Tool() {
  const client = useIsClient();
  const now = useNow(60_000);
  const [f, setF] = useState<Form>(BLANK);
  const [uidVal, setUidVal] = useState(makeUid);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const today = now === null ? "2026-01-01" : dayKey(new Date(now));
  const localZone = client ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC";
  const zones = client ? zoneList() : ["UTC"];
  const timeZone = f.timeZone || localZone;
  const startDate = f.startDate || today;
  const endDate = f.endDate || startDate;
  const people = parsePeople(f.attendees);

  const interval = parseNum(f.interval);
  const count = parseNum(f.count);
  const recurrence: Recurrence | null =
    f.freq === "NONE"
      ? null
      : {
          freq: f.freq,
          interval: interval ?? NaN,
          byDay: f.byDay,
          monthly: f.monthly,
          end: f.endKind === "never" ? { kind: "never" } : f.endKind === "count" ? { kind: "count", count: count ?? NaN } : { kind: "until", date: f.until || addDays(startDate, 90) },
        };

  const ev: IcsEvent = {
    uid: uidVal,
    title: f.title,
    description: f.description,
    location: f.location,
    url: f.url,
    allDay: f.allDay,
    startDate,
    startTime: f.startTime,
    endDate,
    endTime: f.endTime,
    tzMode: f.tzMode,
    timeZone,
    organizer: f.orgEmail.trim() ? { name: f.orgName.trim(), email: f.orgEmail.trim() } : null,
    attendees: people.people,
    alarms: f.alarms,
    recurrence,
  };
  const errors = validateEvent(ev);
  const valid = Object.keys(errors).length === 0 && people.bad.length === 0;
  const ics = valid && now !== null ? buildIcs(ev, now) : "";

  let utcPreview = "";
  if (valid && !f.allDay && f.tzMode !== "floating") {
    try {
      const s = utcStamp(zonedToUtc(startDate, f.startTime, timeZone));
      utcPreview = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(9, 11)}:${s.slice(11, 13)} UTC`;
    } catch {
      utcPreview = "";
    }
  }

  const fileName = `${(f.title.trim() || "event").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "event"}.ics`;

  return (
    <div className="space-y-5">
      <ToolPanel title="Event details" actions={<ResetBtn onClick={() => { setF(BLANK); setUidVal(makeUid()); }} />}>
        <div className="space-y-4">
          <TextField label="Title" value={f.title} maxLength={200} error={f.title ? errors.title : null} placeholder="Quarterly planning" onChange={(e) => set("title", e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Location" optional value={f.location} maxLength={200} placeholder="Room 4 or a video link" onChange={(e) => set("location", e.target.value)} />
            <TextField label="Link" optional type="url" value={f.url} maxLength={500} error={errors.url} placeholder="https://" onChange={(e) => set("url", e.target.value)} />
          </div>
          <TextArea label="Description" optional value={f.description} maxLength={5000} onChange={(e) => set("description", e.target.value)} />

          <Checkbox label="All-day event" checked={f.allDay} onChange={(v) => set("allDay", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <TextField label={f.allDay ? "First day" : "Start"} type="date" value={startDate} error={errors.start} onChange={(e) => set("startDate", e.target.value)} />
              {!f.allDay && <TextField label="Time" type="time" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} className="w-32" />}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <TextField label={f.allDay ? "Last day" : "End"} type="date" value={endDate} error={errors.end} onChange={(e) => set("endDate", e.target.value)} />
              {!f.allDay && <TextField label="Time" type="time" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} className="w-32" />}
            </div>
          </div>

          {!f.allDay && (
            <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
              <SelectField
                label="Time zone of these times"
                value={timeZone}
                error={errors.timeZone}
                disabled={f.tzMode === "floating"}
                onChange={(e) => set("timeZone", e.target.value)}
                options={zones.includes(timeZone) ? zones : [timeZone, ...zones]}
              />
              <div>
                <p className="text-sm font-medium text-ink">Write times as</p>
                <div className="mt-2">
                  <Segmented
                    label="Write times as"
                    value={f.tzMode}
                    onChange={(v) => set("tzMode", v)}
                    options={[
                      { value: "tzid", label: "Time zone" },
                      { value: "utc", label: "UTC" },
                      { value: "floating", label: "Floating" },
                    ]}
                  />
                </div>
                <p className="mt-1.5 text-[0.8125rem] text-muted">
                  {f.tzMode === "tzid"
                    ? "TZID plus a VTIMEZONE block, so recurring events follow daylight saving time."
                    : f.tzMode === "utc"
                      ? "Converted to UTC. Works everywhere; repeats keep a fixed UTC time across DST changes."
                      : "No time zone: the event happens at this clock time wherever the reader is."}
                  {utcPreview && ` Starts ${utcPreview}.`}
                </p>
              </div>
            </div>
          )}
        </div>
      </ToolPanel>

      <ToolPanel title="Repeat, reminders and people">
        <div className="space-y-6">
          <div className="space-y-4">
            <SubHead>Repeat</SubHead>
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Frequency"
                value={f.freq}
                onChange={(e) => set("freq", e.target.value as Form["freq"])}
                options={[
                  { value: "NONE", label: "Does not repeat" },
                  { value: "DAILY", label: "Daily" },
                  { value: "WEEKLY", label: "Weekly" },
                  { value: "MONTHLY", label: "Monthly" },
                ]}
              />
              {f.freq !== "NONE" && (
                <NumberField
                  label={`Every how many ${f.freq === "DAILY" ? "days" : f.freq === "WEEKLY" ? "weeks" : "months"}`}
                  value={f.interval}
                  error={errors.interval}
                  onChange={(e) => set("interval", e.target.value)}
                />
              )}
              {f.freq === "MONTHLY" && (
                <SelectField
                  label="On"
                  value={f.monthly}
                  onChange={(e) => set("monthly", e.target.value as Recurrence["monthly"])}
                  options={[
                    { value: "date", label: `Day ${Number(startDate.slice(8))} of the month` },
                    { value: "nth", label: "Same weekday position (e.g. 2nd Tuesday)" },
                    { value: "last", label: "Last same weekday of the month" },
                  ]}
                />
              )}
            </div>
            {f.freq === "WEEKLY" && (
              <fieldset>
                <legend className="text-sm font-medium text-ink">On these days</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = f.byDay.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("byDay", on ? f.byDay.filter((x) => x !== d) : [...f.byDay, d])}
                        className={`h-10 min-w-12 rounded-lg px-3 text-sm font-medium transition-colors ${on ? "bg-ink text-surface" : "bg-sunken text-ink-2 hover:text-ink"}`}
                      >
                        {DAY_LABEL[d]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[0.8125rem] text-muted">None selected means the start date&apos;s weekday.</p>
              </fieldset>
            )}
            {f.freq !== "NONE" && (
              <div className="grid gap-4 sm:grid-cols-3 sm:items-start">
                <SelectField
                  label="Ends"
                  value={f.endKind}
                  onChange={(e) => set("endKind", e.target.value as Form["endKind"])}
                  options={[
                    { value: "count", label: "After a number of times" },
                    { value: "until", label: "On a date" },
                    { value: "never", label: "Never" },
                  ]}
                />
                {f.endKind === "count" && <NumberField label="Occurrences" value={f.count} error={errors.count} onChange={(e) => set("count", e.target.value)} />}
                {f.endKind === "until" && (
                  <TextField label="Last date" type="date" value={f.until || addDays(startDate, 90)} error={errors.until} onChange={(e) => set("until", e.target.value)} />
                )}
              </div>
            )}
            {recurrence && Object.keys(errors).every((k) => !["interval", "count", "until"].includes(k)) && (
              <p className="text-sm text-ink-2" aria-live="polite">
                {describeRrule(recurrence, startDate)}.
              </p>
            )}
          </div>

          <fieldset>
            <legend className="font-sans text-[0.95rem] font-semibold text-ink">Reminders</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {ALARMS.map((a) => (
                <Checkbox
                  key={a.value}
                  label={a.label}
                  checked={f.alarms.includes(a.value)}
                  onChange={(v) => set("alarms", v ? [...f.alarms, a.value] : f.alarms.filter((x) => x !== a.value))}
                />
              ))}
            </div>
          </fieldset>

          <div className="space-y-4">
            <SubHead>Organizer and attendees</SubHead>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Organizer name" optional value={f.orgName} maxLength={120} onChange={(e) => set("orgName", e.target.value)} />
              <TextField label="Organizer email" optional type="email" value={f.orgEmail} maxLength={200} error={errors.organizer} onChange={(e) => set("orgEmail", e.target.value)} />
            </div>
            <TextArea
              label="Attendees"
              optional
              hint="One per line: Name <email@example.com> or just an email."
              value={f.attendees}
              onChange={(e) => set("attendees", e.target.value)}
              error={people.bad.length ? `Not a valid email: ${people.bad.slice(0, 3).join(", ")}` : null}
            />
          </div>
        </div>
      </ToolPanel>

      <ToolPanel
        title=".ics file"
        actions={
          <>
            <CopyBtn text={ics} />
            <Btn icon="download" disabled={!ics} onClick={() => downloadFile(fileName, ics, "text/calendar")}>
              Download .ics
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          {!valid && (
            <Notice tone="info">{f.title.trim() ? "Fix the highlighted fields to generate the file." : "Add a title to generate the file."}</Notice>
          )}
          <OutputBlock label="Generated iCalendar text">{ics || " "}</OutputBlock>
          <p className="text-[0.8125rem] text-muted">
            Lines end with CRLF and are folded at 75 bytes, as RFC 5545 requires. UID <code className="font-mono break-all">{client ? uidVal : ""}</code> stays the same until you
            reset, so a re-downloaded file updates the same event.
          </p>
          <PrivacyNote />
        </div>
      </ToolPanel>
    </div>
  );
}
