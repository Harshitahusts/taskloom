import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  ListChecks,
  Loader2,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

type TaskStatus = "todo" | "done" | "later";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  scheduledAt: string;
};

type ExtractedTask = {
  title: string;
  date: string;
  time: string;
};

const statusMeta: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "Not done", className: "status-todo" },
  done: { label: "Done", className: "status-done" },
  later: { label: "Later", className: "status-later" },
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDate(key: string, days: number) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

const todayInput = () => dateKey();

const timeInput = () => {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  return now.toTimeString().slice(0, 5);
};

const starterTasks: Task[] = [
  { id: "starter-1", title: "Ship the first version of the landing page", status: "todo", scheduledAt: `${todayInput()}T10:00` },
  { id: "starter-2", title: "Review saved tasks after lunch", status: "later", scheduledAt: `${todayInput()}T14:30` },
  { id: "starter-3", title: "Send the weekly update", status: "done", scheduledAt: `${todayInput()}T09:00` },
  { id: "starter-4", title: "Sketch next week’s focus", status: "todo", scheduledAt: `${todayInput()}T17:00` },
];

function normalizeTasks(raw: Task[]): Task[] {
  const today = todayInput();
  const tomorrow = shiftDate(today, 1);
  let movedCount = 0;
  const normalized = raw.map((task, index) => {
    const fallbackTime = ["10:00", "14:30", "09:00", "17:00"][index % 4];
    const scheduledAt = task.scheduledAt || `${today}T${fallbackTime}`;
    const scheduledDate = scheduledAt.slice(0, 10);
    if (task.status !== "done" && scheduledDate < today) {
      movedCount += 1;
      return { ...task, scheduledAt: `${tomorrow}T${scheduledAt.slice(11, 16) || fallbackTime}` };
    }
    return { ...task, scheduledAt };
  });
  if (movedCount && typeof window !== "undefined") {
    window.setTimeout(() => toast(`${movedCount} unfinished ${movedCount === 1 ? "task was" : "tasks were"} moved to tomorrow`), 0);
  }
  return normalized;
}

function getStoredTasks(): Task[] {
  try {
    const raw = window.localStorage.getItem("taskloom-tasks");
    return raw ? normalizeTasks(JSON.parse(raw) as Task[]) : starterTasks;
  } catch {
    return starterTasks;
  }
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatWindowLabel(value: string) {
  const today = todayInput();
  if (value === today) return "Today";
  if (value === shiftDate(today, 1)) return "Tomorrow";
  return formatDay(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function calendarUrl(task: Task) {
  const start = new Date(task.scheduledAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `https://calendar.google.com/calendar/u/0/r/eventedit?text=${encodeURIComponent(task.title)}&dates=${stamp(start)}/${stamp(end)}&details=${encodeURIComponent(`Taskloom task · ${statusMeta[task.status].label}`)}`;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(getStoredTasks);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayInput);
  const [time, setTime] = useState(timeInput);
  const [newStatus, setNewStatus] = useState<TaskStatus>("todo");
  const [showComposer, setShowComposer] = useState(true);
  const [isRoutineOpen, setIsRoutineOpen] = useState(false);
  const [routine, setRoutine] = useState("");
  const [isParsingRoutine, setIsParsingRoutine] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("taskloom-tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    const rolloverTimer = window.setInterval(() => {
      setTasks((current) => normalizeTasks(current));
    }, 60_000);
    return () => window.clearInterval(rolloverTimer);
  }, []);

  const counts = useMemo(() => ({
    all: tasks.length,
    todo: tasks.filter((task) => task.status === "todo").length,
    done: tasks.filter((task) => task.status === "done").length,
    later: tasks.filter((task) => task.status === "later").length,
  }), [tasks]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...tasks]
      .filter((task) => (filter === "all" || task.status === filter) && (!query || task.title.toLowerCase().includes(query)))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }, [filter, search, tasks]);

  const taskWindows = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    visibleTasks.forEach((task) => {
      const key = task.scheduledAt.slice(0, 10);
      grouped.set(key, [...(grouped.get(key) || []), task]);
    });
    return Array.from(grouped.entries());
  }, [visibleTasks]);

  const addTask = () => {
    const trimmed = title.trim();
    if (!trimmed || !date || !time) {
      toast.error("Add a task, date, and time first");
      return;
    }
    setTasks((current) => [{ id: `${Date.now()}`, title: trimmed, status: newStatus, scheduledAt: `${date}T${time}` }, ...current]);
    setTitle("");
    setNewStatus("todo");
    toast.success("Task added");
  };

  const toggleTask = (id: string) => setTasks((current) => current.map((task) => task.id === id ? { ...task, status: task.status === "done" ? "todo" : "done" } : task));

  const cycleStatus = (id: string) => setTasks((current) => current.map((task) => {
    if (task.id !== id) return task;
    const nextStatus = task.status === "todo" ? "later" : task.status === "later" ? "done" : "todo";
    return { ...task, status: nextStatus };
  }));

  const removeTask = (id: string) => {
    const removed = tasks.find((task) => task.id === id);
    if (!removed) return;
    setTasks((current) => current.filter((task) => task.id !== id));
    toast("Task removed", { action: { label: "Undo", onClick: () => setTasks((current) => [removed, ...current]) } });
  };

  const extractRoutine = async () => {
    if (!routine.trim()) {
      toast.error("Paste your routine first");
      return;
    }
    setIsParsingRoutine(true);
    try {
      const response = await fetch("/api/extract-routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routine, baseDate: todayInput() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not read that routine");
      const extracted = payload.tasks as ExtractedTask[];
      if (!extracted.length) throw new Error("No actionable tasks found in that routine");
      setTasks((current) => [
        ...extracted.map((task, index) => ({
          id: `routine-${Date.now()}-${index}`,
          title: task.title,
          status: "todo" as TaskStatus,
          scheduledAt: `${task.date}T${task.time}`,
        })),
        ...current,
      ]);
      setRoutine("");
      setIsRoutineOpen(false);
      toast.success(`${extracted.length} tasks added as Not done`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that routine");
    } finally {
      setIsParsingRoutine(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Taskloom home"><span className="brand-mark"><ListChecks size={17} /></span><span>taskloom</span></a>
        <div className="header-actions">
          <button className="routine-link" type="button" onClick={() => setIsRoutineOpen(true)}><Bot size={15} /> Plan my day</button>
          <a className="calendar-link" href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer"><CalendarDays size={15} /> Google Calendar <ExternalLink size={12} /></a>
        </div>
      </header>

      <main className="workspace">
        <div className="page-heading">
          <div><p className="today-label">{formatDay(todayInput())}</p><h1>My tasks</h1></div>
          <div className="summary"><span className="summary-number">{counts.todo}</span><span>not done</span></div>
        </div>

        <section className="composer panel-card" aria-label="Add a task">
          <button className="composer-toggle" type="button" onClick={() => setShowComposer((open) => !open)} aria-expanded={showComposer}>
            <span className="add-icon"><Plus size={18} /></span><strong>Add task</strong><ChevronDown className={showComposer ? "rotate" : ""} size={17} />
          </button>
          {showComposer && <div className="composer-body">
            <input className="task-input" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addTask(); }} placeholder="What needs to be done?" aria-label="Task name" autoFocus />
            <div className="field-row">
              <label className="field"><span><CalendarDays size={14} /> Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required aria-label="Task date" /></label>
              <label className="field"><span><Clock3 size={14} /> Time</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required aria-label="Task time" /></label>
              <div className="status-choice"><span>Status</span><div className="status-options">
                {(["todo", "later"] as const).map((value) => <button key={value} type="button" className={`choice ${newStatus === value ? "selected" : ""} ${statusMeta[value].className}`} onClick={() => setNewStatus(value)}><span className="status-dot" />{statusMeta[value].label}</button>)}
              </div></div>
              <button className="add-button" type="button" onClick={addTask}><Plus size={16} /> Add</button>
            </div>
          </div>}
        </section>

        <section className="list-card panel-card">
          <div className="list-toolbar">
            <div className="filter-tabs" role="tablist" aria-label="Task filters">
              {(["all", "todo", "later", "done"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={`filter-tab ${filter === value ? "active" : ""}`} onClick={() => setFilter(value)}>{value === "all" ? "All" : statusMeta[value].label}<span>{counts[value]}</span></button>)}
            </div>
            <label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" aria-label="Search tasks" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}</label>
          </div>
          <div className="task-list" aria-live="polite">
            {taskWindows.length ? taskWindows.map(([windowDate, windowTasks]: [string, Task[]]) => <section className="date-window" key={windowDate}>
              <div className="date-window-header"><div><span className="date-window-title">{formatWindowLabel(windowDate)}</span><span className="date-window-date">{formatDay(windowDate)}</span></div><span className="window-count">{windowTasks.length}</span></div>
              {windowTasks.map((task: Task) => <article className={`task-row ${task.status === "done" ? "is-done" : ""}`} key={task.id}>
                <button className={`task-checkbox ${task.status === "done" ? "checked" : ""}`} type="button" onClick={() => toggleTask(task.id)} aria-label={`${task.status === "done" ? "Mark not done" : "Mark done"}: ${task.title}`}>{task.status === "done" && <Check size={14} />}</button>
                <button className="task-main" type="button" onClick={() => cycleStatus(task.id)} title="Click to change status"><strong>{task.title}</strong><span><CalendarDays size={13} /> {formatDay(task.scheduledAt.slice(0, 10))}<i /> <Clock3 size={13} /> {formatTime(task.scheduledAt)}</span></button>
                <button className={`status-pill ${statusMeta[task.status].className}`} type="button" onClick={() => cycleStatus(task.id)} aria-label={`Change status, currently ${statusMeta[task.status].label}`}><span className="status-dot" />{statusMeta[task.status].label}</button>
                <a className="calendar-task" href={calendarUrl(task)} target="_blank" rel="noreferrer" aria-label={`Add ${task.title} to Google Calendar`} title="Add to Google Calendar"><CalendarDays size={15} /></a>
                <button className="delete-button" type="button" onClick={() => removeTask(task.id)} aria-label={`Delete ${task.title}`}><Trash2 size={15} /></button>
              </article>)}
            </section>) : <div className="empty-state"><strong>No tasks here</strong><span>Add one above or choose another filter.</span></div>}
          </div>
        </section>

        {isRoutineOpen && <div className="routine-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsRoutineOpen(false); }}>
          <section className="routine-modal panel-card" role="dialog" aria-modal="true" aria-labelledby="routine-title">
            <div className="routine-modal-head"><div><span className="today-label">Routine assistant</span><h2 id="routine-title">Turn your day into tasks</h2></div><button className="modal-close" type="button" onClick={() => setIsRoutineOpen(false)} aria-label="Close routine assistant">×</button></div>
            <p className="routine-help">Share a full-day routine in plain language. I’ll find the actionable items, dates, and times, then add them as <strong>Not done</strong>.</p>
            <textarea className="routine-input" value={routine} onChange={(event) => setRoutine(event.target.value)} placeholder={'Example:\n7:30 wake up and exercise\n9:00 finish the client proposal\nAfter lunch, call the dentist\n6 PM plan tomorrow'} aria-label="Describe your full-day routine" />
            <div className="routine-modal-foot"><span><Bot size={14} /> Powered by your Vercel server function</span><button className="add-button" type="button" onClick={extractRoutine} disabled={isParsingRoutine}>{isParsingRoutine ? <><Loader2 className="spin" size={15} /> Reading routine</> : <><Send size={15} /> Add tasks</>}</button></div>
          </section>
        </div>}

        <footer className="footer"><span>{counts.all} tasks · unfinished past tasks move to tomorrow</span><a href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer">Open Google Calendar <ExternalLink size={12} /></a></footer>
      </main>
    </div>
  );
}
