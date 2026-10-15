"use client";

import { useState } from "react";
import {
  Btn,
  CellSelect,
  CopyBtn,
  EmptyState,
  PrivacyNote,
  Segmented,
  ToolPanel,
  downloadFile,
  inputCls,
  uid,
  usePersistentState,
} from "@/components/tools/kit";
import { Icon } from "@/components/ui/Icon";
import { recurringDone } from "./lib/dates";
import { normalizeTodo, todoInitial, type Recur, type TodoItem, type TodoList, type TodoState } from "./lib/schema";
import { BackupBar, ConfirmButton, PrintArea, PrintBox, useToday } from "./shared";

const RECUR_OPTIONS: { value: Recur; label: string }[] = [
  { value: "none", label: "One-time" },
  { value: "daily", label: "Repeats daily" },
  { value: "weekly", label: "Repeats weekly" },
];
type Filter = "all" | "active" | "done";

const isDone = (it: TodoItem, today: string) => (it.recur === "none" ? it.done : recurringDone(it.recur, it.doneOn, today));

function listText(list: TodoList, today: string) {
  const lines = list.items.map((it) => `- [${isDone(it, today) ? "x" : " "}] ${it.text}${it.recur !== "none" ? ` (${it.recur})` : ""}`);
  return `${list.name}\n\n${lines.join("\n")}\n`;
}

const iconBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-accent";

export default function Tool() {
  const [state, setState, clear] = usePersistentState<TodoState>("to-do-list-and-checklist", todoInitial);
  const today = useToday();
  const [draft, setDraft] = useState("");
  const [recur, setRecur] = useState<Recur>("none");
  const [filter, setFilter] = useState<Filter>("all");
  const [newList, setNewList] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const lists = state.lists.length ? state.lists : todoInitial.lists;
  const active = lists.find((l) => l.id === state.activeId) ?? lists[0];
  const day = today ?? "";

  const updateList = (fn: (l: TodoList) => TodoList) =>
    setState((s) => ({ ...s, lists: s.lists.map((l) => (l.id === active.id ? fn(l) : l)) }));
  const updateItem = (id: string, fn: (it: TodoItem) => TodoItem) => updateList((l) => ({ ...l, items: l.items.map((it) => (it.id === id ? fn(it) : it)) }));

  const visible = active.items.filter((it) => (filter === "all" ? true : filter === "done" ? isDone(it, day) : !isDone(it, day)));
  const doneCount = active.items.filter((it) => isDone(it, day)).length;
  const hasData = lists.some((l) => l.items.length > 0) || lists.length > 1;

  const move = (id: string, dir: -1 | 1) => {
    const vi = visible.findIndex((v) => v.id === id);
    const other = visible[vi + dir];
    if (!other) return;
    updateList((l) => {
      const items = [...l.items];
      const a = items.findIndex((x) => x.id === id);
      const b = items.findIndex((x) => x.id === other.id);
      [items[a], items[b]] = [items[b], items[a]];
      return { ...l, items };
    });
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    updateList((l) => ({ ...l, items: [...l.items, { id: uid(), text, done: false, recur, doneOn: null }] }));
    setDraft("");
  };

  const text = today ? listText(active, today) : "";

  return (
    <div className="space-y-5">
      <ToolPanel title="To-do lists">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lists">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={l.id === active.id}
              onClick={() => setState((s) => ({ ...s, activeId: l.id }))}
              className={`h-10 rounded-lg px-3.5 text-sm font-medium transition-colors ${l.id === active.id ? "bg-ink text-surface" : "bg-sunken text-ink-2 hover:text-ink"}`}
            >
              {l.name}
              <span className="ml-1.5 tabular-nums opacity-70">{l.items.length}</span>
            </button>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newList.trim();
              if (!name) return;
              const id = uid();
              setState((s) => ({ lists: [...s.lists, { id, name: name.slice(0, 80), items: [] }], activeId: id }));
              setNewList("");
            }}
          >
            <input
              aria-label="New list name"
              placeholder="New list"
              value={newList}
              maxLength={80}
              onChange={(e) => setNewList(e.target.value)}
              className={`${inputCls} h-10 w-36 px-2.5 text-[0.95rem]`}
            />
            <Btn variant="ghost" icon="plus" type="submit" disabled={!newList.trim()}>
              Add list
            </Btn>
          </form>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {renaming === active.id ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setRenaming(null);
              }}
            >
              <input
                aria-label="List name"
                autoFocus
                value={active.name}
                maxLength={80}
                onChange={(e) => {
                  const name = e.target.value;
                  updateList((l) => ({ ...l, name }));
                }}
                onBlur={() => {
                  if (!active.name.trim()) updateList((l) => ({ ...l, name: "Untitled list" }));
                  setRenaming(null);
                }}
                className={`${inputCls} h-10 w-56 px-2.5`}
              />
              <Btn type="submit">Done</Btn>
            </form>
          ) : (
            <div>
              <h3 className="font-display text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">{active.name}</h3>
              <p className="text-sm text-ink-2">
                {active.items.length ? `${doneCount} of ${active.items.length} done` : "Empty list"}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn variant="subtle" icon="pen" onClick={() => setRenaming(active.id)}>
              Rename
            </Btn>
            {lists.length > 1 && (
              <ConfirmButton
                label="Delete list"
                confirmLabel={`Delete "${active.name}"`}
                onConfirm={() =>
                  setState((s) => {
                    const rest = s.lists.filter((l) => l.id !== active.id);
                    return { lists: rest, activeId: rest[0].id };
                  })
                }
              />
            )}
          </div>
        </div>

        <form onSubmit={addItem} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            aria-label="New task"
            placeholder="Add a task and press Enter"
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            className={`${inputCls} h-11`}
          />
          <CellSelect label="Repeat" value={recur} onChange={(e) => setRecur(e.target.value as Recur)} options={RECUR_OPTIONS} className="[&_select]:h-11" />
          <Btn type="submit" icon="plus" className="h-11" disabled={!draft.trim()}>
            Add
          </Btn>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "To do" },
              { value: "done", label: "Done" },
            ]}
          />
          <Btn
            variant="subtle"
            disabled={!active.items.some((it) => it.recur === "none" && it.done)}
            onClick={() => updateList((l) => ({ ...l, items: l.items.filter((it) => !(it.recur === "none" && it.done)) }))}
          >
            Remove completed one-time tasks
          </Btn>
        </div>

        <div className="mt-4">
          {visible.length === 0 ? (
            <EmptyState icon="checklist" title={active.items.length ? "Nothing in this view" : "No tasks yet"}>
              {active.items.length ? "Switch the filter to see other tasks." : "Add your first task above. Repeating tasks reset each day or each week."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]">
              {visible.map((it, i) => {
                const doneNow = isDone(it, day);
                return (
                  <li key={it.id} className="flex items-center gap-2 bg-surface px-3 py-1.5">
                    <input
                      id={`todo-${it.id}`}
                      type="checkbox"
                      checked={doneNow}
                      onChange={() =>
                        updateItem(it.id, (x) =>
                          x.recur === "none" ? { ...x, done: !x.done } : { ...x, doneOn: isDone(x, day) ? null : day },
                        )
                      }
                      className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--accent)]"
                    />
                    {editing?.id === it.id ? (
                      <form
                        className="min-w-0 flex-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const t = editing.text.trim();
                          if (t) updateItem(it.id, (x) => ({ ...x, text: t }));
                          setEditing(null);
                        }}
                      >
                        <input
                          aria-label="Edit task"
                          autoFocus
                          value={editing.text}
                          maxLength={500}
                          onChange={(e) => setEditing({ id: it.id, text: e.target.value })}
                          onBlur={() => {
                            const t = editing.text.trim();
                            if (t) updateItem(it.id, (x) => ({ ...x, text: t }));
                            setEditing(null);
                          }}
                          onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                          className={`${inputCls} h-10 px-2.5`}
                        />
                      </form>
                    ) : (
                      <label htmlFor={`todo-${it.id}`} className="min-w-0 flex-1 cursor-pointer py-2">
                        <span className={`break-words ${doneNow ? "text-muted line-through" : "text-ink"}`}>{it.text}</span>
                        {it.recur !== "none" && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 align-middle text-[0.72rem] text-ink-2">
                            <Icon name="reset" size={11} />
                            {it.recur === "daily" ? "Daily" : "Weekly"}
                          </span>
                        )}
                      </label>
                    )}
                    <button type="button" className={iconBtn} aria-label={`Move "${it.text}" up`} disabled={i === 0} onClick={() => move(it.id, -1)}>
                      <Icon name="chevron" size={16} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      className={iconBtn}
                      aria-label={`Move "${it.text}" down`}
                      disabled={i === visible.length - 1}
                      onClick={() => move(it.id, 1)}
                    >
                      <Icon name="chevron" size={16} />
                    </button>
                    <button type="button" className={iconBtn} aria-label={`Edit "${it.text}"`} onClick={() => setEditing({ id: it.id, text: it.text })}>
                      <Icon name="pen" size={15} />
                    </button>
                    <button
                      type="button"
                      className={`${iconBtn} hover:!text-danger`}
                      aria-label={`Delete "${it.text}"`}
                      onClick={() => updateList((l) => ({ ...l, items: l.items.filter((x) => x.id !== it.id) }))}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ToolPanel>

      <ToolPanel>
        <div className="space-y-4">
          <BackupBar<TodoState>
            tool="to-do-list-and-checklist"
            data={state}
            normalize={normalizeTodo}
            onImport={(v) => setState(v)}
            onClear={clear}
            hasData={hasData}
            printLabel="Print this list"
            extra={
              <>
                <Btn
                  variant="ghost"
                  icon="download"
                  disabled={!active.items.length}
                  onClick={() => downloadFile(`${active.name.replace(/[^\w-]+/g, "-").toLowerCase() || "list"}.txt`, text)}
                >
                  Export text
                </Btn>
                <CopyBtn text={active.items.length ? text : ""} label="Copy as text" />
              </>
            }
          />
          <PrivacyNote stored />
        </div>
      </ToolPanel>

      <PrintArea>
        <h2>{active.name}</h2>
        <p className="meta">
          {doneCount} of {active.items.length} done
        </p>
        {active.items.map((it) => (
          <p key={it.id} style={{ margin: "0 0 5pt" }}>
            <PrintBox checked={isDone(it, day)} />
            {it.text}
            {it.recur !== "none" && <span className="muted"> ({it.recur === "daily" ? "daily" : "weekly"})</span>}
          </p>
        ))}
      </PrintArea>
    </div>
  );
}
