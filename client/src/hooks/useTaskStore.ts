import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { STORAGE_KEY, dateKey, loadTasks, nowTime, rollover, saveTasks, type Task } from "@/lib/tasks";

type UndoEntry = { id: number; label: string; previous: Map<string, Task | null> };

/** Records the prior version of every task a change touched (null = the task was added). */
function diff(before: Task[], after: Task[]) {
  const beforeMap = new Map(before.map((task) => [task.id, task]));
  const afterMap = new Map(after.map((task) => [task.id, task]));
  const previous = new Map<string, Task | null>();
  beforeMap.forEach((task, id) => {
    if (afterMap.get(id) !== task) previous.set(id, task);
  });
  afterMap.forEach((_task, id) => {
    if (!beforeMap.has(id)) previous.set(id, null);
  });
  return previous;
}

function restore(current: Task[], previous: Map<string, Task | null>) {
  const kept = current.filter((task) => !previous.has(task.id));
  previous.forEach((task) => {
    if (task) kept.push(task);
  });
  return kept;
}

export type ChangeOptions = {
  /** Toast message. Omit for a silent change. */
  message?: string;
  description?: string;
  undoable?: boolean;
};

export function useTaskStore() {
  const [boot] = useState(() => rollover(loadTasks()));
  const [tasks, setTasksState] = useState<Task[]>(boot.tasks);
  const [today, setToday] = useState(dateKey);
  const [now, setNow] = useState(nowTime);
  const [rolledOver, setRolledOver] = useState<Task[]>(boot.moved);
  const tasksRef = useRef(tasks);
  const undoStack = useRef<UndoEntry[]>([]);
  const undoSeq = useRef(0);

  const setTasks = useCallback((next: Task[]) => {
    tasksRef.current = next;
    setTasksState(next);
  }, []);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // Keep "today" fresh and roll unfinished past tasks forward while the app stays open.
  useEffect(() => {
    const tick = () => {
      const key = dateKey();
      setToday(key);
      setNow(nowTime());
      const result = rollover(tasksRef.current, key);
      if (result.moved.length) {
        setTasks(result.tasks);
        setRolledOver((current) => {
          const ids = new Set(result.moved.map((task) => task.id));
          return [...current.filter((task) => !ids.has(task.id)), ...result.moved];
        });
      }
    };
    const interval = window.setInterval(tick, 30_000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [setTasks]);

  // Sync edits made in another tab.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setTasks(loadTasks());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setTasks]);

  const undo = useCallback(
    (entryId?: number) => {
      const stack = undoStack.current;
      const index = entryId === undefined ? stack.length - 1 : stack.findIndex((entry) => entry.id === entryId);
      if (index < 0) return false;
      const [entry] = stack.splice(index, 1);
      setTasks(restore(tasksRef.current, entry.previous));
      toast(`Undone: ${entry.label.toLowerCase()}`, { duration: 2000 });
      return true;
    },
    [setTasks],
  );

  const change = useCallback(
    (update: (current: Task[]) => Task[], { message, description, undoable = true }: ChangeOptions = {}) => {
      const before = tasksRef.current;
      const after = update(before);
      if (after === before) return;
      const previous = diff(before, after);
      if (!previous.size) return;
      setTasks(after);
      if (!message) return;
      if (!undoable) {
        toast(message, { description });
        return;
      }
      const entry: UndoEntry = { id: ++undoSeq.current, label: message, previous };
      undoStack.current = [...undoStack.current.slice(-19), entry];
      toast(message, {
        description,
        action: { label: "Undo", onClick: () => undo(entry.id) },
        duration: 6000,
      });
    },
    [setTasks, undo],
  );

  const dismissRollover = useCallback(() => setRolledOver([]), []);

  return { tasks, today, now, change, undo, rolledOver, dismissRollover };
}

export type TaskStore = ReturnType<typeof useTaskStore>;
