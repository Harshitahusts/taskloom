export type TaskStatus = "todo" | "done" | "later";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  /** Local date-time, `YYYY-MM-DDTHH:mm`. */
  scheduledAt: string;
  /** Date key the task was automatically rolled over from, if any. */
  rolledFrom?: string;
};

export type View = "today" | "upcoming" | "completed" | "all";

export const STORAGE_KEY = "taskloom-tasks";

export const statusMeta: Record<TaskStatus, { label: string; short: string }> = {
  todo: { label: "Not done", short: "Open" },
  done: { label: "Done", short: "Done" },
  later: { label: "Later", short: "Later" },
};

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shiftDate(key: string, days: number) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export const taskDate = (task: Task) => task.scheduledAt.slice(0, 10);
export const taskTime = (task: Task) => task.scheduledAt.slice(11, 16);

/** Next quarter hour from now, as `HH:mm`. */
export function nextQuarterHour() {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function nowTime() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const dayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const longDayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });
const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function formatDay(key: string) {
  return dayFormat.format(new Date(`${key}T12:00:00`));
}

export function formatLongDay(key: string) {
  return longDayFormat.format(new Date(`${key}T12:00:00`));
}

/** `HH:mm` or a full `scheduledAt` → "10:30 AM". */
export function formatTime(value: string) {
  const time = value.length > 5 ? value.slice(11, 16) : value;
  return timeFormat.format(new Date(`2000-01-01T${time}`));
}

/** Human label relative to today: Today, Tomorrow, Yesterday, Friday, Sat, Oct 4. */
export function relativeDayLabel(key: string, today: string) {
  const diff = daysBetween(today, key);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return weekdayFormat.format(new Date(`${key}T12:00:00`));
  return formatDay(key);
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export const byTime = (a: Task, b: Task) => a.scheduledAt.localeCompare(b.scheduledAt);

/** Open (not done, not later) tasks on today whose time has already passed. */
export function isOverdue(task: Task, today: string, now: string) {
  return task.status === "todo" && taskDate(task) === today && taskTime(task) < now;
}

export function starterTasks(today = dateKey()): Task[] {
  return [
    { id: "starter-1", title: "Ship the first version of the landing page", status: "todo", scheduledAt: `${today}T10:00` },
    { id: "starter-2", title: "Review saved tasks after lunch", status: "later", scheduledAt: `${today}T14:30` },
    { id: "starter-3", title: "Send the weekly update", status: "done", scheduledAt: `${today}T09:00` },
    { id: "starter-4", title: "Sketch next week’s focus", status: "todo", scheduledAt: `${today}T17:00` },
  ];
}

export type RolloverResult = { tasks: Task[]; moved: Task[] };

/**
 * Unfinished tasks from past dates move to tomorrow (existing Taskloom behavior).
 * Done tasks stay on their original date. Moved tasks remember where they came from.
 */
export function rollover(raw: Task[], today = dateKey()): RolloverResult {
  const tomorrow = shiftDate(today, 1);
  const moved: Task[] = [];
  let changed = false;
  const tasks = raw.map((task, index) => {
    const fallbackTime = ["10:00", "14:30", "09:00", "17:00"][index % 4];
    const scheduledAt = task.scheduledAt || `${today}T${fallbackTime}`;
    const scheduledDate = scheduledAt.slice(0, 10);
    if (task.status !== "done" && scheduledDate < today) {
      changed = true;
      const next: Task = {
        ...task,
        scheduledAt: `${tomorrow}T${scheduledAt.slice(11, 16) || fallbackTime}`,
        rolledFrom: task.rolledFrom ?? scheduledDate,
      };
      moved.push(next);
      return next;
    }
    if (scheduledAt !== task.scheduledAt) {
      changed = true;
      return { ...task, scheduledAt };
    }
    return task;
  });
  return { tasks: changed ? tasks : raw, moved };
}

export function loadTasks(): Task[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return starterTasks();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return starterTasks();
    return parsed.filter(
      (task): task is Task =>
        task && typeof task.id === "string" && typeof task.title === "string" && ["todo", "done", "later"].includes(task.status),
    );
  } catch {
    return starterTasks();
  }
}

export function saveTasks(tasks: Task[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    /* storage full or blocked — keep working in memory */
  }
}

export function newId(prefix = "t") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Pre-filled Google Calendar event link. No account access is requested. */
export function calendarUrl(task: Task) {
  const start = new Date(task.scheduledAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `https://calendar.google.com/calendar/u/0/r/eventedit?text=${encodeURIComponent(task.title)}&dates=${stamp(start)}/${stamp(end)}&details=${encodeURIComponent(`Taskloom task · ${statusMeta[task.status].label}`)}`;
}

export const GOOGLE_CALENDAR_URL = "https://calendar.google.com/calendar/u/0/r";

export type DateGroup = { key: string; label: string; sublabel: string; tasks: Task[] };
export type DateSection = { id: string; title: string; groups: DateGroup[] };

export function groupByDate(tasks: Task[], today: string, order: "asc" | "desc" = "asc"): DateGroup[] {
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = taskDate(task);
    const list = grouped.get(key);
    if (list) list.push(task);
    else grouped.set(key, [task]);
  }
  const keys = Array.from(grouped.keys()).sort();
  if (order === "desc") keys.reverse();
  return keys.map((key) => {
    const label = relativeDayLabel(key, today);
    return {
      key,
      label,
      sublabel: label === formatDay(key) ? "" : formatDay(key),
      tasks: grouped.get(key)!.sort(byTime),
    };
  });
}

/** Buckets future tasks into Tomorrow / This week / Later windows. */
export function upcomingSections(tasks: Task[], today: string): DateSection[] {
  const groups = groupByDate(tasks.filter((task) => taskDate(task) > today), today);
  const sections: DateSection[] = [
    { id: "tomorrow", title: "Tomorrow", groups: [] },
    { id: "week", title: "This week", groups: [] },
    { id: "later", title: "Later", groups: [] },
  ];
  for (const group of groups) {
    const diff = daysBetween(today, group.key);
    if (diff === 1) sections[0].groups.push(group);
    else if (diff < 7) sections[1].groups.push(group);
    else sections[2].groups.push(group);
  }
  return sections.filter((section) => section.groups.length);
}

/** Search matches title, status words, and date words ("tomorrow", "fri", "sep 27"). */
export function matchesQuery(task: Task, query: string, today: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const key = taskDate(task);
  const haystack = [
    task.title,
    statusMeta[task.status].label,
    task.status === "done" ? "completed finished" : task.status === "later" ? "later someday" : "open active todo",
    relativeDayLabel(key, today),
    formatLongDay(key),
    formatDay(key),
    formatTime(task.scheduledAt),
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/** The task that deserves attention now: overdue first, then the next open one today, then anything open. */
export function currentTask(tasks: Task[], today: string): Task | undefined {
  const open = tasks.filter((task) => task.status === "todo").sort(byTime);
  return open.find((task) => taskDate(task) === today) ?? open.find((task) => taskDate(task) > today);
}

export function nextAfter(tasks: Task[], task: Task | undefined): Task | undefined {
  if (!task) return undefined;
  return tasks
    .filter((other) => other.status === "todo" && other.id !== task.id && other.scheduledAt >= task.scheduledAt)
    .sort(byTime)[0];
}

/**
 * Pulls an explicit time or day out of a quick-add title.
 * "Call mom tomorrow at 6pm" → { title: "Call mom", date: tomorrow, time: "18:00" }.
 */
export function parseQuickAdd(input: string, today: string): { title: string; date?: string; time?: string } {
  let title = input;
  let date: string | undefined;
  let time: string | undefined;

  const meridiem = title.match(/\b(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i);
  const clock = meridiem ? null : title.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
  const match = meridiem || clock;
  if (match) {
    let hour = Number(match[1]);
    const minute = match[2] || "00";
    const suffix = meridiem ? match[3].toLowerCase() : undefined;
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    if (hour <= 23) {
      time = `${pad(hour)}:${minute}`;
      title = title.replace(match[0], " ");
    }
  }

  const dayMatch = title.match(/\b(day after tomorrow|tomorrow|today|tonight)\b/i);
  if (dayMatch) {
    const word = dayMatch[1].toLowerCase();
    date = word === "day after tomorrow" ? shiftDate(today, 2) : word === "tomorrow" ? shiftDate(today, 1) : today;
    if (word === "tonight" && !time) time = "20:00";
    title = title.replace(dayMatch[0], " ");
  }

  title = title
    .replace(/\s+(?:at|on|by)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,:-]+|[\s,:-]+$/g, "")
    .trim();
  return { title: title || input.trim(), date, time };
}
