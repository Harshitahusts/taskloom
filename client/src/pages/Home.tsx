import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Toaster, toast } from "sonner";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Command as CommandIcon,
  ExternalLink,
  Inbox,
  Keyboard,
  ListTodo,
  Lock,
  MessagesSquare,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useTaskStore } from "@/hooks/useTaskStore";
import {
  byTime,
  currentTask,
  formatLongDay,
  formatTime,
  GOOGLE_CALENDAR_URL,
  greeting,
  groupByDate,
  matchesQuery,
  newId,
  nextQuarterHour,
  relativeDayLabel,
  shiftDate,
  taskDate,
  taskTime,
  upcomingSections,
  type DateGroup,
  type Task,
  type TaskStatus,
  type View,
} from "@/lib/tasks";
import { isTypingTarget, mod } from "@/lib/platform";
import type { ChatAction } from "@/lib/chatloom";
import type { ExtractedTask } from "@/lib/routine";
import { TaskRow, type TaskActions } from "@/components/taskloom/TaskRow";
import { Composer, type ComposerHandle } from "@/components/taskloom/Composer";
import { PlanMyDay } from "@/components/taskloom/PlanMyDay";
import { Chatloom } from "@/components/taskloom/Chatloom";
import { CommandPalette, type PaletteCommand } from "@/components/taskloom/CommandPalette";
import { FocusMode } from "@/components/taskloom/FocusMode";
import { ShortcutsDialog } from "@/components/taskloom/ShortcutsDialog";

type Theme = "dark" | "light";

const views: { id: View; label: string; short: string; icon: ReactNode }[] = [
  { id: "today", label: "Today", short: "Today", icon: <Target size={16} /> },
  { id: "upcoming", label: "Upcoming", short: "Upcoming", icon: <CalendarClock size={16} /> },
  { id: "completed", label: "Completed", short: "Done", icon: <CheckCircle2 size={16} /> },
  { id: "all", label: "All tasks", short: "All", icon: <ListTodo size={16} /> },
];

function readPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const value = window.localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default function Home() {
  const { tasks, today, now, change, undo, rolledOver, dismissRollover } = useTaskStore();
  const [view, setView] = useState<View>("today");
  const [query, setQuery] = useState("");
  const [allFilter, setAllFilter] = useState<"all" | TaskStatus>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showDone, setShowDone] = useState(() => readPref("taskloom-show-done", "1", ["0", "1"] as const) === "1");
  const [theme, setTheme] = useState<Theme>(() => readPref<Theme>("taskloom-theme", "dark", ["dark", "light"] as const));
  const isMobile = useMediaQuery("(max-width: 860px)");

  const composerRef = useRef<ComposerHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#141615" : "#f6f6f3");
    writePref("taskloom-theme", theme);
  }, [theme]);

  useEffect(() => writePref("taskloom-show-done", showDone ? "1" : "0"), [showDone]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  // ---------- Derived data ----------
  const tomorrow = shiftDate(today, 1);
  const todays = useMemo(() => tasks.filter((task) => taskDate(task) === today).sort(byTime), [tasks, today]);
  const openToday = todays.filter((task) => task.status === "todo");
  const laterToday = todays.filter((task) => task.status === "later");
  const doneToday = todays.filter((task) => task.status === "done");
  const upcoming = useMemo(() => tasks.filter((task) => taskDate(task) > today && task.status !== "done"), [tasks, today]);
  const completed = useMemo(() => tasks.filter((task) => task.status === "done"), [tasks]);
  const focusTask = useMemo(() => currentTask(tasks, today), [tasks, today]);
  const counts = {
    today: openToday.length + laterToday.length,
    upcoming: upcoming.length,
    completed: completed.length,
    all: tasks.length,
  };
  const searching = query.trim().length > 0;
  const searchResults = useMemo(
    () => (searching ? groupByDate(tasks.filter((task) => matchesQuery(task, query, today)), today) : []),
    [searching, tasks, query, today],
  );

  // ---------- Actions ----------
  const revealTask = useCallback(
    (task: Task) => {
      const date = taskDate(task);
      setQuery("");
      setView(date === today ? "today" : date > today ? "upcoming" : "all");
      if (task.status === "done" && date === today) setShowDone(true);
      setHighlightId(task.id);
      setChatOpen((open) => (isMobile ? false : open));
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const row = document.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`);
          row?.scrollIntoView({ block: "center", behavior: "smooth" });
          row?.focus({ preventScroll: true });
        }),
      );
    },
    [today, isMobile],
  );

  const addTask = useCallback(
    ({ title, date, time, status }: { title: string; date: string; time: string; status: TaskStatus }) => {
      const task: Task = { id: newId(), title, status, scheduledAt: `${date}T${time}` };
      change((current) => [task, ...current], {
        message: `Added to ${relativeDayLabel(date, today)}`,
        description: `${title} · ${formatTime(time)}`,
      });
      setHighlightId(task.id);
      return task;
    },
    [change, today],
  );

  const patchTask = useCallback(
    (id: string, patch: Partial<Task>, message: string, description?: string) =>
      change((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)), { message, description }),
    [change],
  );

  const actions: TaskActions = useMemo(
    () => ({
      toggleDone: (task) =>
        patchTask(task.id, { status: task.status === "done" ? "todo" : "done" }, task.status === "done" ? "Marked not done" : "Task completed", task.title),
      toggleLater: (task) =>
        patchTask(task.id, { status: task.status === "later" ? "todo" : "later" }, task.status === "later" ? "Back to Not done" : "Set for later", task.title),
      moveTo: (task, date) =>
        patchTask(task.id, { scheduledAt: `${date}T${taskTime(task)}`, rolledFrom: undefined }, `Moved to ${relativeDayLabel(date, today)}`, task.title),
      remove: (task) => change((current) => current.filter((other) => other.id !== task.id), { message: "Task deleted", description: task.title }),
      update: (task, patch) => {
        const dateChanged = patch.scheduledAt && patch.scheduledAt.slice(0, 10) !== taskDate(task);
        patchTask(task.id, { ...patch, ...(dateChanged ? { rolledFrom: undefined } : {}) }, "Task updated", patch.title ?? task.title);
      },
      calendarOpened: () => toast("Calendar event ready", { description: "Review and save it in the Google Calendar tab.", duration: 3500 }),
    }),
    [change, patchTask, today],
  );

  const clearCompleted = useCallback(() => {
    const count = tasksRef.current.filter((task) => task.status === "done").length;
    if (!count) return toast("Nothing completed to clear");
    change((current) => current.filter((task) => task.status !== "done"), { message: `Cleared ${plural(count, "completed task")}` });
  }, [change]);

  const commitPlan = useCallback(
    (items: ExtractedTask[]) => {
      const created: Task[] = items.map((item) => ({ id: newId("plan"), title: item.title, status: "todo", scheduledAt: `${item.date}T${item.time}` }));
      const firstDate = created[0] ? taskDate(created[0]) : today;
      change((current) => [...created, ...current], { message: `Added ${plural(created.length, "task")} to ${relativeDayLabel(firstDate, today)}` });
      setQuery("");
      setView(firstDate === today ? "today" : "upcoming");
    },
    [change, today],
  );

  const moveRolledToToday = useCallback(() => {
    const ids = new Set(rolledOver.map((task) => task.id));
    change(
      (current) =>
        current.map((task) => (ids.has(task.id) && task.status !== "done" && taskDate(task) === tomorrow ? { ...task, scheduledAt: `${today}T${taskTime(task)}`, rolledFrom: undefined } : task)),
      { message: `Moved ${plural(ids.size, "task")} to Today` },
    );
    dismissRollover();
  }, [change, dismissRollover, rolledOver, today, tomorrow]);

  const onChatAction = useCallback(
    (action: ChatAction) => {
      if (action.type === "plan") {
        setChatOpen(false);
        setPlanOpen(true);
      } else if (action.type === "add") {
        addTask({ title: action.title, date: action.date, time: action.time, status: "todo" });
      }
    },
    [addTask],
  );

  const startNewTask = useCallback(() => {
    if (isMobile) {
      setSheetOpen(true);
      return;
    }
    setQuery("");
    if (view === "completed") setView("today");
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [isMobile, view]);

  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  const goTo = useCallback((next: View) => {
    setQuery("");
    setView(next);
    mainRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  }, []);

  // ---------- Keyboard ----------
  const anyModalOpen = paletteOpen || planOpen || focusOpen || shortcutsOpen || sheetOpen;
  const keyState = useRef({ anyModalOpen, actions, startNewTask, focusSearch, goTo, undo, focusTask });
  keyState.current = { anyModalOpen, actions, startNewTask, focusSearch, goTo, undo, focusTask };

  useEffect(() => {
    const rows = () => Array.from(document.querySelectorAll<HTMLElement>("main [data-task-id]"));
    const focusRow = (row: HTMLElement | undefined) => {
      if (!row) return;
      row.focus({ preventScroll: true });
      row.scrollIntoView({ block: "nearest" });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const state = keyState.current;
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key;

      if (modifier && key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.defaultPrevented || state.anyModalOpen) return;
      const typing = isTypingTarget(event.target);

      if (modifier && key.toLowerCase() === "z" && !event.shiftKey && !typing) {
        event.preventDefault();
        if (!state.undo()) toast("Nothing to undo", { duration: 1500 });
        return;
      }
      if (typing) {
        if (key === "Escape" && event.target === searchRef.current) {
          setQuery("");
          searchRef.current?.blur();
        }
        return;
      }
      if (modifier || event.altKey) return;

      const activeRow = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-task-id]");
      const task = activeRow ? tasksRef.current.find((item) => item.id === activeRow.dataset.taskId) : undefined;
      const list = rows();

      switch (key) {
        case "j":
        case "ArrowDown":
          if (key === "ArrowDown" && !activeRow) return;
          event.preventDefault();
          focusRow(activeRow ? list[list.indexOf(activeRow) + 1] ?? activeRow : list[0]);
          return;
        case "k":
        case "ArrowUp":
          if (key === "ArrowUp" && !activeRow) return;
          event.preventDefault();
          focusRow(activeRow ? list[list.indexOf(activeRow) - 1] ?? activeRow : list[list.length - 1]);
          return;
        case "n":
          event.preventDefault();
          state.startNewTask();
          return;
        case "/":
          event.preventDefault();
          state.focusSearch();
          return;
        case "p":
          event.preventDefault();
          setPlanOpen(true);
          return;
        case "c":
          event.preventDefault();
          setChatOpen((open) => !open);
          return;
        case "f":
          event.preventDefault();
          setFocusOpen(true);
          return;
        case "?":
          event.preventDefault();
          setShortcutsOpen(true);
          return;
        case "1":
        case "2":
        case "3":
        case "4":
          state.goTo(views[Number(key) - 1].id);
          return;
        case "Escape":
          setQuery("");
          setChatOpen(false);
          return;
      }

      if (!task || !activeRow) return;
      const index = list.indexOf(activeRow);
      const neighbour = list[index + 1] ?? list[index - 1];
      const keepFocus = (id: string) => requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-task-id="${id}"]`)?.focus({ preventScroll: true }));
      switch (key.toLowerCase()) {
        case "x":
          event.preventDefault();
          state.actions.toggleDone(task);
          keepFocus(task.id);
          return;
        case "l":
          if (task.status === "done") return;
          state.actions.toggleLater(task);
          keepFocus(task.id);
          return;
        case "t": {
          if (task.status === "done") return;
          const date = taskDate(task) === today || taskDate(task) < today ? shiftDate(today, 1) : today;
          state.actions.moveTo(task, date);
          requestAnimationFrame(() => neighbour?.focus({ preventScroll: true }));
          return;
        }
        case "enter":
          // Enter on a button inside the row should press that button, not open the editor.
          if (document.activeElement !== activeRow) return;
          event.preventDefault();
          setEditingId(task.id);
          return;
        case "e":
          event.preventDefault();
          setEditingId(task.id);
          return;
        case "backspace":
        case "delete":
          event.preventDefault();
          state.actions.remove(task);
          requestAnimationFrame(() => neighbour?.focus({ preventScroll: true }));
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [today]);

  // ---------- Palette commands ----------
  const commands: PaletteCommand[] = useMemo(
    () => [
      { id: "new", group: "Actions", label: "New task", icon: <Plus size={15} />, shortcut: "N", keywords: ["add", "create"], run: startNewTask },
      { id: "plan", group: "Actions", label: "Plan my day", icon: <Sparkles size={15} />, shortcut: "P", keywords: ["routine", "schedule"], run: () => setPlanOpen(true) },
      { id: "focus", group: "Actions", label: "Focus on current task", icon: <Target size={15} />, shortcut: "F", run: () => setFocusOpen(true) },
      { id: "chat", group: "Actions", label: "Open Chatloom", icon: <MessagesSquare size={15} />, shortcut: "C", keywords: ["ask", "assistant", "chat"], run: () => setChatOpen(true) },
      { id: "search", group: "Actions", label: "Search tasks", icon: <Search size={15} />, shortcut: "/", keywords: ["find"], run: focusSearch },
      { id: "undo", group: "Actions", label: "Undo last change", icon: <Undo2 size={15} />, shortcut: `${mod}Z`, run: () => void (undo() || toast("Nothing to undo")) },
      { id: "clear", group: "Actions", label: "Clear completed tasks", icon: <Trash2 size={15} />, keywords: ["delete", "done"], run: clearCompleted },
      ...views.map((item, index) => ({
        id: `go-${item.id}`,
        group: "Go to" as const,
        label: `Go to ${item.label}`,
        icon: item.icon,
        shortcut: String(index + 1),
        run: () => goTo(item.id),
      })),
      { id: "gcal", group: "Go to", label: "Open Google Calendar", icon: <ExternalLink size={15} />, run: () => window.open(GOOGLE_CALENDAR_URL, "_blank", "noopener") },
      {
        id: "theme",
        group: "Settings",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: theme === "dark" ? <Sun size={15} /> : <Moon size={15} />,
        keywords: ["theme", "appearance", "dark", "light"],
        run: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
      },
      { id: "keys", group: "Settings", label: "Keyboard shortcuts", icon: <Keyboard size={15} />, shortcut: "?", run: () => setShortcutsOpen(true) },
    ],
    [clearCompleted, focusSearch, goTo, startNewTask, theme, undo],
  );

  // ---------- Rendering helpers ----------
  const row = (task: Task, showDate = false) => (
    <TaskRow
      key={task.id}
      task={task}
      today={today}
      now={now}
      actions={actions}
      showDate={showDate}
      editing={editingId === task.id}
      onEditChange={setEditingId}
      highlighted={highlightId === task.id}
    />
  );

  const renderGroups = (groups: DateGroup[]) =>
    groups.map((group) => (
      <section className="day-group" key={group.key} aria-labelledby={`day-${group.key}`}>
        <h3 className="day-head" id={`day-${group.key}`}>
          <span className="day-label">{group.label}</span>
          {group.sublabel && <span className="day-sub">{group.sublabel}</span>}
          <span className="day-count">{group.tasks.length}</span>
        </h3>
        <ul className="task-list">{group.tasks.map((task) => row(task))}</ul>
      </section>
    ));

  const composer = (defaultDate: string) => (
    <div className="composer-wrap">
      <Composer ref={composerRef} today={today} defaultDate={defaultDate} onAdd={addTask} />
    </div>
  );

  // ---------- Views ----------
  const renderToday = () => {
    const total = todays.length;
    const progress = total ? Math.round((doneToday.length / total) * 100) : 0;
    const sub = !total
      ? "Nothing scheduled. You have room to breathe."
      : openToday.length === 0
        ? laterToday.length
          ? `Done with what’s due. ${plural(laterToday.length, "task")} set for later.`
          : "Done for today. Nicely handled."
        : `${openToday.length} left today${focusTask && taskDate(focusTask) === today ? ` · next up: ${focusTask.title} at ${formatTime(focusTask.scheduledAt)}` : ""}`;
    const tomorrowTasks = upcoming.filter((task) => taskDate(task) === tomorrow).sort(byTime);

    return (
      <>
        <header className="page-head">
          <p className="eyebrow">{formatLongDay(today)}</p>
          <h1 className="page-title">{greeting()}.</h1>
          <p className="page-sub">{sub}</p>
          {total > 0 && (
            <div className="progress-row">
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneToday.length} aria-label={`${doneToday.length} of ${total} done today`}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <span className="progress-label">
                {doneToday.length} of {total} done
              </span>
              {focusTask && (
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setFocusOpen(true)}>
                  <Target size={14} aria-hidden="true" /> Focus
                </button>
              )}
            </div>
          )}
        </header>

        {rolledOver.length > 0 && (
          <div className="notice" role="status">
            <RotateCcw size={16} aria-hidden="true" className="notice-icon" />
            <p>
              <strong>
                {plural(rolledOver.length, "unfinished task")} moved to tomorrow.
              </strong>{" "}
              <span className="muted">Taskloom carries anything left open on a past day forward.</span>
            </p>
            <div className="notice-actions">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => {
                  const first = rolledOver[0];
                  dismissRollover();
                  const live = tasksRef.current.find((task) => task.id === first.id);
                  if (live) revealTask(live);
                }}
              >
                Review
              </button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={moveRolledToToday}>
                Move all to today
              </button>
              <button type="button" className="icon-btn" aria-label="Dismiss" onClick={dismissRollover}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {composer(today)}

        {total === 0 ? (
          <EmptyState
            icon={<Sparkles size={18} />}
            title="Nothing scheduled."
            body="You have room to breathe — or sketch the day in a few lines."
            actions={
              <>
                <button type="button" className="btn btn-primary" onClick={() => setPlanOpen(true)}>
                  <Sparkles size={14} aria-hidden="true" /> Plan my day
                </button>
                <button type="button" className="btn btn-quiet" onClick={startNewTask}>
                  <Plus size={14} aria-hidden="true" /> Add a task
                </button>
              </>
            }
          />
        ) : (
          <section aria-label="Today’s tasks" className="today-list">
            {openToday.length > 0 && <ul className="task-list">{openToday.map((task) => row(task))}</ul>}
            {openToday.length === 0 && (
              <p className="inline-empty">
                <CheckCircle2 size={16} aria-hidden="true" /> Everything due today is done.
              </p>
            )}
            {laterToday.length > 0 && (
              <div className="subgroup">
                <h3 className="subgroup-head">
                  Later <span className="day-count">{laterToday.length}</span>
                </h3>
                <ul className="task-list">{laterToday.map((task) => row(task))}</ul>
              </div>
            )}
            {doneToday.length > 0 && (
              <div className="subgroup">
                <button type="button" className="subgroup-head subgroup-toggle" aria-expanded={showDone} onClick={() => setShowDone((open) => !open)}>
                  <ChevronDown size={14} className="chev" aria-hidden="true" /> Done <span className="day-count">{doneToday.length}</span>
                </button>
                {showDone && <ul className="task-list">{doneToday.map((task) => row(task))}</ul>}
              </div>
            )}
          </section>
        )}

        <section className="up-next" aria-labelledby="up-next-title">
          <div className="up-next-head">
            <h2 id="up-next-title">Up next</h2>
            {upcoming.length > 0 && (
              <button type="button" className="link-btn" onClick={() => goTo("upcoming")}>
                All upcoming <span className="day-count">{upcoming.length}</span> <ArrowRight size={13} aria-hidden="true" />
              </button>
            )}
          </div>
          {tomorrowTasks.length ? (
            <>
              <h3 className="day-head">
                <span className="day-label">Tomorrow</span>
                <span className="day-sub">{formatLongDay(tomorrow)}</span>
              </h3>
              <ul className="task-list task-list-compact">{tomorrowTasks.slice(0, 4).map((task) => row(task))}</ul>
              {tomorrowTasks.length > 4 && (
                <button type="button" className="link-btn more-link" onClick={() => goTo("upcoming")}>
                  +{tomorrowTasks.length - 4} more tomorrow
                </button>
              )}
            </>
          ) : (
            <p className="inline-empty muted">
              {upcoming.length ? `Nothing tomorrow. Next: ${[...upcoming].sort(byTime)[0].title}, ${relativeDayLabel(taskDate([...upcoming].sort(byTime)[0]), today)}.` : "Nothing planned yet beyond today."}
            </p>
          )}
        </section>
      </>
    );
  };

  const renderUpcoming = () => {
    const sections = upcomingSections(upcoming, today);
    return (
      <>
        <header className="page-head">
          <p className="eyebrow">Next days</p>
          <h1 className="page-title">Upcoming</h1>
          <p className="page-sub">{upcoming.length ? `${plural(upcoming.length, "task")} ahead.` : "Nothing planned yet."}</p>
        </header>
        {composer(tomorrow)}
        {sections.length ? (
          sections.map((section) => (
            <section key={section.id} className="window" aria-labelledby={`win-${section.id}`}>
              {section.id !== "tomorrow" && (
                <h2 className="window-title" id={`win-${section.id}`}>
                  {section.title}
                </h2>
              )}
              {section.id === "tomorrow" && (
                <h2 className="sr-only" id={`win-${section.id}`}>
                  Tomorrow
                </h2>
              )}
              {renderGroups(section.groups)}
            </section>
          ))
        ) : (
          <EmptyState
            icon={<CalendarClock size={18} />}
            title="Nothing planned yet."
            body="Anything you schedule after today shows up here, grouped by day."
            actions={
              <button type="button" className="btn btn-quiet" onClick={() => setPlanOpen(true)}>
                <Sparkles size={14} aria-hidden="true" /> Plan tomorrow
              </button>
            }
          />
        )}
      </>
    );
  };

  const renderCompleted = () => {
    const groups = groupByDate(completed, today, "desc");
    return (
      <>
        <header className="page-head page-head-row">
          <div>
            <p className="eyebrow">Review</p>
            <h1 className="page-title">Completed</h1>
            <p className="page-sub">{completed.length ? `${plural(completed.length, "task")} done${doneToday.length ? `, ${doneToday.length} today` : ""}.` : "Nothing completed yet."}</p>
          </div>
          {completed.length > 0 && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={clearCompleted}>
              <Trash2 size={14} aria-hidden="true" /> Clear completed
            </button>
          )}
        </header>
        {groups.length ? (
          renderGroups(groups)
        ) : (
          <EmptyState icon={<CheckCircle2 size={18} />} title="Nothing completed yet." body="Check a task off and it lands here — a quiet record of what you got done." />
        )}
      </>
    );
  };

  const renderAll = () => {
    const filtered = tasks.filter((task) => allFilter === "all" || task.status === allFilter);
    const statusCounts = {
      all: tasks.length,
      todo: tasks.filter((task) => task.status === "todo").length,
      later: tasks.filter((task) => task.status === "later").length,
      done: completed.length,
    };
    return (
      <>
        <header className="page-head">
          <p className="eyebrow">Everything</p>
          <h1 className="page-title">All tasks</h1>
          <p className="page-sub">
            {plural(tasks.length, "task")} saved on this device.
          </p>
        </header>
        <div className="filter-bar segment" role="radiogroup" aria-label="Filter by status">
          {(["all", "todo", "later", "done"] as const).map((value) => (
            <button key={value} type="button" role="radio" aria-checked={allFilter === value} className={`segment-item status-${value}`} onClick={() => setAllFilter(value)}>
              {value !== "all" && <span className="status-glyph" aria-hidden="true" />}
              {value === "all" ? "All" : value === "todo" ? "Not done" : value === "later" ? "Later" : "Done"}
              <span className="segment-count">{statusCounts[value]}</span>
            </button>
          ))}
        </div>
        {composer(today)}
        {filtered.length ? (
          renderGroups(groupByDate(filtered, today))
        ) : (
          <EmptyState icon={<Inbox size={18} />} title={tasks.length ? "No tasks with that status." : "Your list is empty."} body={tasks.length ? "Try another filter." : "Add your first task above — it only takes a name and a time."} />
        )}
      </>
    );
  };

  const renderSearch = () => {
    const count = searchResults.reduce((sum, group) => sum + group.tasks.length, 0);
    return (
      <>
        <header className="page-head page-head-row">
          <div>
            <p className="eyebrow">Search</p>
            <h1 className="page-title page-title-sm">
              {count ? plural(count, "result") : "No results"} for “{query.trim()}”
            </h1>
          </div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setQuery("")}>
            Clear <kbd className="kbd">esc</kbd>
          </button>
        </header>
        {count ? (
          renderGroups(searchResults)
        ) : (
          <EmptyState
            icon={<Search size={18} />}
            title="No tasks match that search."
            body="Search looks at task names, status, and days like “tomorrow” or “friday”."
            actions={
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  addTask({ title: query.trim(), date: today, time: nextQuarterHour(), status: "todo" });
                  setQuery("");
                  setView("today");
                }}
              >
                <Plus size={14} aria-hidden="true" /> Create “{query.trim()}” for today
              </button>
            }
          />
        )}
      </>
    );
  };

  const content = searching ? renderSearch() : view === "today" ? renderToday() : view === "upcoming" ? renderUpcoming() : view === "completed" ? renderCompleted() : renderAll();

  return (
    <div className={`app${chatOpen ? " chat-open" : ""}`}>
      <a href="#main" className="skip-link">
        Skip to tasks
      </a>

      <aside className="sidebar" aria-label="Navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <span>Taskloom</span>
        </div>

        <button type="button" className="sidebar-search" onClick={() => setPaletteOpen(true)}>
          <Search size={15} aria-hidden="true" />
          <span>Search or jump to…</span>
          <kbd className="kbd">{mod}K</kbd>
        </button>

        <nav className="nav" aria-label="Views">
          {views.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${view === item.id && !searching ? " is-active" : ""}`}
              aria-current={view === item.id && !searching ? "page" : undefined}
              onClick={() => goTo(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
              {counts[item.id] > 0 && <span className="nav-count">{counts[item.id]}</span>}
              <kbd className="kbd nav-kbd">{index + 1}</kbd>
            </button>
          ))}
        </nav>

        <div className="nav-section">
          <p className="nav-heading">Tools</p>
          <button type="button" className="nav-item" onClick={() => setPlanOpen(true)}>
            <span className="nav-icon" aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <span className="nav-label">Plan my day</span>
            <kbd className="kbd nav-kbd">P</kbd>
          </button>
          <button type="button" className={`nav-item${chatOpen ? " is-active" : ""}`} aria-pressed={chatOpen} onClick={() => setChatOpen((open) => !open)}>
            <span className="nav-icon" aria-hidden="true">
              <MessagesSquare size={16} />
            </span>
            <span className="nav-label">Chatloom</span>
            <kbd className="kbd nav-kbd">C</kbd>
          </button>
          <button type="button" className="nav-item" onClick={() => setFocusOpen(true)}>
            <span className="nav-icon" aria-hidden="true">
              <Target size={16} />
            </span>
            <span className="nav-label">Focus</span>
            <kbd className="kbd nav-kbd">F</kbd>
          </button>
        </div>

        <div className="sidebar-foot">
          <a className="nav-item" href={GOOGLE_CALENDAR_URL} target="_blank" rel="noreferrer">
            <span className="nav-icon" aria-hidden="true">
              <CalendarDays size={16} />
            </span>
            <span className="nav-label">Google Calendar</span>
            <ExternalLink size={12} aria-hidden="true" className="muted" />
          </a>
          <div className="sidebar-utils">
            <button type="button" className="icon-btn" onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} data-tip={theme === "dark" ? "Light theme" : "Dark theme"}>
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button type="button" className="icon-btn" onClick={() => setShortcutsOpen(true)} aria-label="Keyboard shortcuts" data-tip="Shortcuts  ?">
              <Keyboard size={15} />
            </button>
            <span className="privacy-note" title="Tasks are stored in this browser’s local storage. Nothing is uploaded.">
              <Lock size={11} aria-hidden="true" /> Stored on this device
            </span>
          </div>
        </div>
      </aside>

      <div className="main-col">
        <div className="topbar">
          <div className="brand brand-mobile">
            <span className="brand-mark" aria-hidden="true">
              <BrandMark />
            </span>
            <span>Taskloom</span>
          </div>
          <label className="search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search tasks</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query ? (
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setQuery("")} aria-label="Clear search">
                <X size={13} />
              </button>
            ) : (
              <kbd className="kbd search-kbd" aria-hidden="true">
                /
              </kbd>
            )}
          </label>
          <div className="topbar-actions">
            <button type="button" className="btn btn-quiet btn-sm topbar-plan" onClick={() => setPlanOpen(true)} aria-label="Plan my day">
              <Sparkles size={15} aria-hidden="true" /> <span className="hide-mobile">Plan my day</span>
            </button>
            <button type="button" className={`btn btn-quiet btn-sm${chatOpen ? " is-active" : ""}`} onClick={() => setChatOpen((open) => !open)} aria-label="Chatloom" aria-pressed={chatOpen}>
              <MessagesSquare size={15} aria-hidden="true" /> <span className="hide-mobile">Chatloom</span>
            </button>
            <button type="button" className="btn btn-quiet btn-sm show-mobile" onClick={() => setPaletteOpen(true)} aria-label="Command menu">
              <CommandIcon size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        <main id="main" ref={mainRef} className="content" tabIndex={-1}>
          <div className="view" key={searching ? "search" : view}>
            {content}
          </div>
          <footer className="content-foot">
            <span>
              <Lock size={11} aria-hidden="true" /> Tasks stay in this browser. Unfinished tasks from past days move to tomorrow.
            </span>
            <button type="button" className="link-btn hide-mobile" onClick={() => setShortcutsOpen(true)}>
              <Keyboard size={12} aria-hidden="true" /> Shortcuts
            </button>
          </footer>
        </main>
      </div>

      <nav className="tabbar" aria-label="Views">
        {views.map((item) => (
          <button key={item.id} type="button" className={`tab${view === item.id && !searching ? " is-active" : ""}`} aria-current={view === item.id && !searching ? "page" : undefined} onClick={() => goTo(item.id)}>
            {item.icon}
            <span>{item.short}</span>
            {item.id === "today" && counts.today > 0 && <span className="tab-badge">{counts.today}</span>}
          </button>
        ))}
      </nav>
      {view !== "completed" && !searching && (
        <button type="button" className="fab" onClick={() => setSheetOpen(true)} aria-label="Add a task">
          <Plus size={22} />
        </button>
      )}

      <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="sheet" aria-describedby={undefined}>
            <span className="sheet-grip" aria-hidden="true" />
            <Dialog.Title className="sheet-title">New task</Dialog.Title>
            <Composer
              today={today}
              defaultDate={view === "upcoming" ? tomorrow : today}
              variant="sheet"
              autoFocus
              onAdd={(input) => {
                addTask(input);
                setSheetOpen(false);
              }}
              onDismiss={() => setSheetOpen(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <PlanMyDay open={planOpen} onOpenChange={setPlanOpen} today={today} onCommit={commitPlan} />
      <Chatloom
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        tasks={tasks}
        today={today}
        now={now}
        defaultTime={nextQuarterHour()}
        onAction={(action) => {
          if (action.type === "focus") return;
          onChatAction(action);
        }}
        onOpenTask={revealTask}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} tasks={tasks} today={today} onOpenTask={revealTask} />
      <FocusMode
        open={focusOpen}
        onOpenChange={setFocusOpen}
        task={focusTask}
        tasks={tasks}
        today={today}
        now={now}
        onComplete={(task) => actions.toggleDone(task)}
        onSnooze={(task) => actions.toggleLater(task)}
        onOpenTask={revealTask}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <Toaster
        theme={theme}
        position="bottom-center"
        visibleToasts={3}
        offset={24}
        mobileOffset={{ bottom: "calc(140px + env(safe-area-inset-bottom))", left: 12, right: 12 }}
        toastOptions={{ className: "toast", classNames: { actionButton: "toast-action", description: "toast-desc" } }}
      />
    </div>
  );
}

function EmptyState({ icon, title, body, actions }: { icon: ReactNode; title: string; body: string; actions?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-title">{title}</p>
      <p className="empty-body">{body}</p>
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}

/** Three threads woven through a check — the Taskloom mark. */
function BrandMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 5.5h12M3 9h7M3 12.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity=".55" />
      <path d="M9.5 12.2l2.2 2.1L16 9.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
