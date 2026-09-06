import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  Check,
  Clipboard,
  Command,
  Filter,
  Inbox,
  ListChecks,
  Plus,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

type TaskStatus = "todo" | "done" | "later";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
};

const starterTasks: Task[] = [
  {
    id: "starter-1",
    title: "Ship the first version of the landing page",
    status: "todo",
    createdAt: "2026-09-06",
  },
  {
    id: "starter-2",
    title: "Review saved tasks after lunch",
    status: "later",
    createdAt: "2026-09-06",
  },
  {
    id: "starter-3",
    title: "Send the weekly update",
    status: "done",
    createdAt: "2026-09-05",
  },
  {
    id: "starter-4",
    title: "Sketch next week’s focus",
    status: "todo",
    createdAt: "2026-09-05",
  },
];

const statusMeta: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "Not done", className: "status-todo" },
  done: { label: "Done", className: "status-done" },
  later: { label: "Later", className: "status-later" },
};

function getStoredTasks(): Task[] {
  try {
    const raw = window.localStorage.getItem("taskloom-tasks");
    return raw ? (JSON.parse(raw) as Task[]) : starterTasks;
  } catch {
    return starterTasks;
  }
}

function parseBotText(input: string): string[] {
  return input
    .split(/\n|\r/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
        .replace(/^\s*\[[ xX]\]\s*/, "")
        .replace(/^\s*(?:task|todo|later|add)\s*:\s*/i, "")
        .replace(/\s+$/, "")
        .trim(),
    )
    .filter((line) => line.length > 2)
    .filter((line) => !/^#+\s/.test(line))
    .filter((line) => !/^tasks?$/i.test(line))
    .map((line) => line.replace(/[.。]+$/, ""));
}

function dateLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(2026, 8, 6));
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(getStoredTasks);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [search, setSearch] = useState("");
  const [quickTask, setQuickTask] = useState("");
  const [botText, setBotText] = useState("");
  const [captureState, setCaptureState] = useState("Ready when you are");
  const [isCaptureOpen, setIsCaptureOpen] = useState(true);

  useEffect(() => {
    window.localStorage.setItem("taskloom-tasks", JSON.stringify(tasks));
  }, [tasks]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      todo: tasks.filter((task) => task.status === "todo").length,
      done: tasks.filter((task) => task.status === "done").length,
      later: tasks.filter((task) => task.status === "later").length,
    }),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesFilter = filter === "all" || task.status === filter;
      const matchesSearch = !query || task.title.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, tasks]);

  const addTask = (title: string, status: TaskStatus = "todo") => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTasks((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: trimmed,
        status,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
  };

  const toggleTask = (id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, status: task.status === "done" ? "todo" : "done" }
          : task,
      ),
    );
  };

  const cycleStatus = (id: string) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task;
        const nextStatus: TaskStatus =
          task.status === "todo" ? "later" : task.status === "later" ? "done" : "todo";
        return { ...task, status: nextStatus };
      }),
    );
  };

  const removeTask = (id: string) => {
    const removedTask = tasks.find((task) => task.id === id);
    if (!removedTask) return;
    setTasks((current) => current.filter((task) => task.id !== id));
    toast("Task removed", {
      action: {
        label: "Undo",
        onClick: () => setTasks((current) => [removedTask, ...current]),
      },
    });
  };

  const addQuickTask = () => {
    if (!quickTask.trim()) return;
    addTask(quickTask);
    setQuickTask("");
    toast.success("Task added to your list");
  };

  const turnIntoTasks = () => {
    const parsed = parseBotText(botText);
    if (!parsed.length) {
      setCaptureState("Try one task per line");
      toast.error("No task lines found yet");
      return;
    }
    parsed.forEach((line, index) => addTask(line, index === 0 ? "todo" : "later"));
    setBotText("");
    setCaptureState(`${parsed.length} ${parsed.length === 1 ? "task" : "tasks"} added to your list`);
    toast.success(`${parsed.length} ${parsed.length === 1 ? "task" : "tasks"} captured`);
  };

  const copyPrompt = async () => {
    const prompt = "Turn this into a clean checklist. One task per line, no extra commentary:\n\n";
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copied — paste it into any chatbot");
    } catch {
      toast("Select and copy the prompt manually");
    }
  };

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="/" aria-label="Taskloom home">
          <span className="brand-mark"><ListChecks size={18} strokeWidth={2.8} /></span>
          <span>taskloom</span>
        </a>
        <div className="topbar-meta">
          <span className="date-label">{dateLabel()}</span>
          <span className="avatar" aria-label="Personal workspace">A</span>
        </div>
      </header>

      <main className="workspace">
        <section className="welcome-row">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> Personal command center</div>
            <h1>Make room for <em>what matters.</em></h1>
            <p className="lede">A quiet place to collect the next right thing — from your head or any chatbot.</p>
          </div>
          <div className="focus-note">
            <Sparkles size={17} />
            <span><strong>{counts.todo}</strong> things need your attention</span>
          </div>
        </section>

        <section className="stat-strip" aria-label="Task summary">
          <div className="stat-primary">
            <div className="stat-icon"><Inbox size={17} /></div>
            <div><span className="stat-number">{counts.all}</span><span className="stat-label">total tasks</span></div>
          </div>
          <div className="stat-item"><span className="stat-number stat-number-red">{counts.todo}</span><span className="stat-label">not done</span></div>
          <div className="stat-item"><span className="stat-number stat-number-green">{counts.done}</span><span className="stat-label">done</span></div>
          <div className="stat-item"><span className="stat-number stat-number-blue">{counts.later}</span><span className="stat-label">later</span></div>
          <div className="progress-stat">
            <div className="progress-copy"><span>Today’s momentum</span><strong>{counts.all ? Math.round((counts.done / counts.all) * 100) : 0}%</strong></div>
            <div className="progress-track"><span style={{ width: `${counts.all ? (counts.done / counts.all) * 100 : 0}%` }} /></div>
          </div>
        </section>

        <div className="content-grid">
          <section className="tasks-panel panel-card">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">Your list</div>
                <h2>Keep moving</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setFilter("all")} aria-label="Show all tasks" title="Show all tasks"><Filter size={17} /></button>
            </div>

            <div className="task-toolbar">
              <div className="filter-tabs" role="tablist" aria-label="Filter tasks">
                {(["all", "todo", "done", "later"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    className={`filter-tab ${filter === value ? "active" : ""}`}
                    onClick={() => setFilter(value)}
                  >
                    {value === "all" ? "All" : statusMeta[value].label}
                    <span>{counts[value]}</span>
                  </button>
                ))}
              </div>
              <label className="search-box">
                <Search size={15} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" aria-label="Search tasks" />
                {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}
              </label>
            </div>

            <div className="task-list" aria-live="polite">
              {visibleTasks.length ? visibleTasks.map((task, index) => (
                <article className={`task-row ${task.status === "done" ? "is-done" : ""}`} key={task.id} style={{ "--item-delay": `${index * 35}ms` } as React.CSSProperties}>
                  <button className={`task-checkbox ${task.status === "done" ? "checked" : ""}`} type="button" onClick={() => toggleTask(task.id)} aria-label={`${task.status === "done" ? "Mark not done" : "Mark done"}: ${task.title}`}>
                    {task.status === "done" && <Check size={14} strokeWidth={3} />}
                  </button>
                  <button className="task-title" type="button" onClick={() => cycleStatus(task.id)} title="Click to cycle status">
                    <span>{task.title}</span>
                    <small>{task.status === "done" ? "Completed" : task.status === "later" ? "Parked for later" : "Ready for your attention"}</small>
                  </button>
                  <button className={`status-pill ${statusMeta[task.status].className}`} type="button" onClick={() => cycleStatus(task.id)} aria-label={`Change status, currently ${statusMeta[task.status].label}`}>
                    <span className="status-dot" />{statusMeta[task.status].label}
                  </button>
                  <button className="delete-button" type="button" onClick={() => removeTask(task.id)} aria-label={`Delete ${task.title}`}><Trash2 size={15} /></button>
                </article>
              )) : (
                <div className="empty-state">
                  <div className="empty-icon"><Search size={20} /></div>
                  <strong>No tasks here yet</strong>
                  <span>Try another filter or capture something new.</span>
                </div>
              )}
            </div>

            <div className="quick-add">
              <span className="quick-add-icon"><Plus size={17} /></span>
              <input value={quickTask} onChange={(event) => setQuickTask(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addQuickTask(); }} placeholder="Add a task…" aria-label="Add a task" />
              <kbd><Command size={11} /> ↵</kbd>
            </div>
          </section>

          <aside className={`capture-panel panel-card ${isCaptureOpen ? "is-open" : ""}`}>
            <button className="capture-heading" type="button" onClick={() => setIsCaptureOpen((open) => !open)} aria-expanded={isCaptureOpen}>
              <span className="bot-avatar"><Bot size={19} /></span>
              <span><span className="section-kicker">Bot capture</span><strong>Bring in the messy bits</strong></span>
              <ArrowUpRight className="capture-arrow" size={18} />
            </button>
            {isCaptureOpen && <div className="capture-body">
              <p className="capture-intro">Paste a reply from any chatbot. Taskloom pulls out the checklist and gives every line a home.</p>
              <div className="capture-editor">
                <div className="editor-topline"><span className="live-dot" /> listening for task lines <span className="editor-count">{parseBotText(botText).length || "—"}</span></div>
                <textarea value={botText} onChange={(event) => { setBotText(event.target.value); setCaptureState("Ready to sort it"); }} placeholder={'- Reply to the design brief\n- [ ] Add FAQ section\n- Later: plan onboarding'} aria-label="Paste chatbot output" />
                <button className="capture-button" type="button" onClick={turnIntoTasks}><WandSparkles size={16} /> Turn into tasks</button>
              </div>
              <div className="capture-status"><span className="status-check"><Check size={12} /></span><span>{captureState}</span></div>
              <div className="prompt-helper">
                <div className="prompt-icon"><Clipboard size={16} /></div>
                <div><strong>Give your chatbot a nudge</strong><span>Ask it for one task per line, no extra commentary.</span></div>
                <button type="button" onClick={copyPrompt} aria-label="Copy chatbot prompt" title="Copy chatbot prompt"><Clipboard size={15} /></button>
              </div>
            </div>}
          </aside>
        </div>

        <footer className="app-footer"><span><span className="footer-mark" /> saved locally in this browser</span><span>Built for your one-person sprint <ArrowUpRight size={13} /></span></footer>
      </main>
    </div>
  );
}
