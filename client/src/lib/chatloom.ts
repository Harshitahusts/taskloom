import {
  byTime,
  currentTask,
  formatDay,
  formatTime,
  isOverdue,
  matchesQuery,
  nextAfter,
  parseQuickAdd,
  relativeDayLabel,
  shiftDate,
  taskDate,
  type Task,
} from "./tasks";

export type ChatAction = { type: "plan" } | { type: "add"; title: string; date: string; time: string } | { type: "focus" };

export type ChatReply = { text: string; tasks?: Task[]; action?: ChatAction };

export const chatSuggestions = [
  "What do I have today?",
  "What’s next?",
  "How many are left?",
  "What should I focus on?",
  "Show completed",
  "Help me plan my day",
];

type Context = { tasks: Task[]; today: string; now: string; defaultTime: string };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const has = (text: string, ...words: string[]) => words.some((word) => text.includes(word));

/**
 * Chatloom answers questions about the local task list with simple rules.
 * No model, no network: every answer is computed from the tasks in this browser.
 */
export function chatloomReply(input: string, { tasks, today, now, defaultTime }: Context): ChatReply {
  const lower = input.toLowerCase().trim().replace(/[’']/g, "'");
  const tomorrow = shiftDate(today, 1);
  const todays = tasks.filter((task) => taskDate(task) === today).sort(byTime);
  const openToday = todays.filter((task) => task.status === "todo");
  const laterToday = todays.filter((task) => task.status === "later");
  const doneToday = todays.filter((task) => task.status === "done");

  const addMatch = input.match(/^\s*(?:add|create|new task|remind me to)\s*:?\s+(.+)$/i);
  if (addMatch) {
    const parsed = parseQuickAdd(addMatch[1], today);
    parsed.title = parsed.title.charAt(0).toUpperCase() + parsed.title.slice(1);
    const date = parsed.date ?? today;
    const time = parsed.time ?? defaultTime;
    return {
      text: `Added “${parsed.title}” for ${relativeDayLabel(date, today).toLowerCase()} at ${formatTime(time)}.`,
      action: { type: "add", title: parsed.title, date, time },
    };
  }

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(lower)) {
    const current = currentTask(tasks, today);
    return {
      text: current
        ? `Hi. You have ${plural(openToday.length, "open task")} today. Next up is “${current.title}” at ${formatTime(current.scheduledAt)}.`
        : "Hi. Your list is clear right now. Want to plan the day?",
    };
  }

  if (has(lower, "plan my day", "plan the day", "plan today", "plan tomorrow", "routine", "help me plan")) {
    return { text: "Opening the planner. Write your day one line at a time and you’ll get a preview before anything is added.", action: { type: "plan" } };
  }

  if (lower === "help" || has(lower, "what can you do", "commands", "how do you work")) {
    return {
      text: "I read your Taskloom list and answer from it. Try “What’s next?”, “What’s overdue?”, “Show tomorrow”, “Show completed”, or “Add call mom at 6pm”. Everything stays on this device.",
    };
  }

  if (has(lower, "overdue", "late", "behind", "missed")) {
    const overdue = tasks.filter((task) => isOverdue(task, today, now)).sort(byTime);
    return overdue.length
      ? { text: `${plural(overdue.length, "task")} ${overdue.length === 1 ? "is" : "are"} past its time today:`, tasks: overdue }
      : { text: "Nothing is overdue. You’re on schedule." };
  }

  if (has(lower, "moved", "rolled", "rollover", "carried")) {
    const moved = tasks.filter((task) => task.rolledFrom && task.status !== "done").sort(byTime);
    return moved.length
      ? { text: `${plural(moved.length, "unfinished task")} rolled forward from an earlier day:`, tasks: moved }
      : { text: "No tasks have been rolled over. Unfinished tasks from past days move to tomorrow automatically." };
  }

  if (has(lower, "completed", "finished", "what did i do", "done today", "show done", "accomplish")) {
    const done = tasks.filter((task) => task.status === "done").sort(byTime).reverse();
    if (!done.length) return { text: "Nothing completed yet. Check one off and it’ll show up here." };
    return {
      text: doneToday.length
        ? `You’ve finished ${plural(doneToday.length, "task")} today${done.length > doneToday.length ? ` (${done.length} overall)` : ""}:`
        : `${plural(done.length, "completed task")}:`,
      tasks: (doneToday.length ? doneToday : done).slice(0, 8),
    };
  }

  if (has(lower, "tomorrow")) {
    const list = tasks.filter((task) => taskDate(task) === tomorrow && task.status !== "done").sort(byTime);
    return list.length
      ? { text: `Tomorrow (${formatDay(tomorrow)}) has ${plural(list.length, "task")}:`, tasks: list }
      : { text: "Nothing planned for tomorrow yet." };
  }

  if (has(lower, "focus", "priority", "prioritize", "most important", "start with")) {
    const current = currentTask(tasks, today);
    if (!current) return { text: "Nothing open that needs focus. Take a breath, or plan what comes next." };
    const after = nextAfter(tasks, current);
    return {
      text: `Focus on “${current.title}”${isOverdue(current, today, now) ? " — it’s already past its time" : ` at ${formatTime(current.scheduledAt)}`}. Give it one uninterrupted block, then check it off.${after ? ` After that: “${after.title}”.` : ""}`,
      tasks: [current],
      action: { type: "focus" },
    };
  }

  if (has(lower, "next", "what should i do", "what now", "do now", "up next")) {
    const current = currentTask(tasks, today);
    if (!current) return { text: "You’re all clear. Nothing open is scheduled." };
    const day = relativeDayLabel(taskDate(current), today);
    return {
      text: `Next: “${current.title}” — ${day === "Today" ? "" : `${day.toLowerCase()} `}at ${formatTime(current.scheduledAt)}${isOverdue(current, today, now) ? " (overdue)" : ""}.`,
      tasks: [current],
    };
  }

  if (has(lower, "how many", "left", "remaining", "count", "status", "progress")) {
    if (!todays.length) {
      const open = tasks.filter((task) => task.status === "todo").length;
      return { text: `Nothing scheduled today. ${open ? `${plural(open, "open task")} later on.` : "Your list is clear."}` };
    }
    return {
      text: `Today: ${openToday.length} left, ${doneToday.length} done${laterToday.length ? `, ${laterToday.length} set for later` : ""}. ${
        openToday.length === 0 ? "Done for today." : `${Math.round((doneToday.length / todays.length) * 100)}% through the day.`
      }`,
    };
  }

  if (has(lower, "later", "someday", "snoozed")) {
    const later = tasks.filter((task) => task.status === "later").sort(byTime);
    return later.length ? { text: `${plural(later.length, "task")} marked Later:`, tasks: later } : { text: "Nothing is marked Later." };
  }

  if (has(lower, "today", "what do i have", "schedule", "agenda", "show tasks", "my day")) {
    const list = todays.filter((task) => task.status !== "done");
    if (!todays.length) return { text: "Nothing scheduled today. You have room to breathe." };
    if (!list.length) return { text: `Done for today — all ${plural(todays.length, "task")} checked off.` };
    return { text: `${plural(list.length, "task")} on today${doneToday.length ? ` (${doneToday.length} already done)` : ""}:`, tasks: list };
  }

  const words = lower.replace(/^(find|search|show|where is|look for)\s+/, "");
  const found = words.length > 2 ? tasks.filter((task) => matchesQuery(task, words, today)).sort(byTime).slice(0, 6) : [];
  if (found.length) return { text: `Found ${plural(found.length, "matching task")}:`, tasks: found };

  return { text: "I’m not sure about that one. I can tell you what’s today, what’s next, what’s overdue, or add a task — try “Add review notes at 3pm”." };
}
