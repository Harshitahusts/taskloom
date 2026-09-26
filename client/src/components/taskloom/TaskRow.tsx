import { memo, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRight, CalendarPlus, Check, CornerDownLeft, MoonStar, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import {
  calendarUrl,
  formatTime,
  isOverdue,
  relativeDayLabel,
  shiftDate,
  taskDate,
  taskTime,
  type Task,
  type TaskStatus,
} from "@/lib/tasks";

export type TaskActions = {
  toggleDone: (task: Task) => void;
  toggleLater: (task: Task) => void;
  moveTo: (task: Task, date: string) => void;
  remove: (task: Task) => void;
  update: (task: Task, patch: Partial<Pick<Task, "title" | "scheduledAt" | "status">>) => void;
  calendarOpened: (task: Task) => void;
};

type Props = {
  task: Task;
  today: string;
  now: string;
  actions: TaskActions;
  showDate?: boolean;
  editing: boolean;
  onEditChange: (id: string | null) => void;
  highlighted?: boolean;
};

function TaskRowImpl({ task, today, now, actions, showDate, editing, onEditChange, highlighted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const done = task.status === "done";
  const later = task.status === "later";
  const overdue = isOverdue(task, today, now);
  const date = taskDate(task);
  const tomorrow = shiftDate(today, 1);
  const moveTarget = date <= today ? tomorrow : today;
  const moveLabel = moveTarget === today ? "Today" : "Tomorrow";

  if (editing) return <TaskEditor task={task} onDone={() => onEditChange(null)} actions={actions} />;

  const stateLabel = done ? "Done" : later ? "Later" : overdue ? "Overdue" : "Not done";

  return (
    <li
      className={`task${done ? " is-done" : ""}${later ? " is-later" : ""}${overdue ? " is-overdue" : ""}${expanded ? " is-expanded" : ""}${highlighted ? " is-highlighted" : ""}`}
      data-task-id={task.id}
      tabIndex={-1}
      aria-label={`${task.title}, ${relativeDayLabel(date, today)} at ${formatTime(task.scheduledAt)}, ${stateLabel}`}
    >
      <button
        type="button"
        className="task-check"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark “${task.title}” as not done` : `Complete “${task.title}”`}
        onClick={() => actions.toggleDone(task)}
      >
        <span className="task-check-ring" aria-hidden="true">
          <Check size={12} strokeWidth={3} />
        </span>
      </button>

      <div className="task-body" onClick={() => onEditChange(task.id)} title="Click to edit">
        <span className="task-title">{task.title}</span>
        {(later || overdue || (task.rolledFrom && !done) || showDate) && (
          <span className="task-meta">
            {showDate && <span>{relativeDayLabel(date, today)}</span>}
            {later && (
              <span className="tag tag-later">
                <MoonStar size={11} aria-hidden="true" /> Later
              </span>
            )}
            {overdue && <span className="tag tag-overdue">Overdue</span>}
            {task.rolledFrom && !done && (
              <span className="tag tag-moved" title={`Automatically moved from ${relativeDayLabel(task.rolledFrom, today)}`}>
                <RotateCcw size={11} aria-hidden="true" /> Moved from {relativeDayLabel(task.rolledFrom, today)}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="task-actions" aria-label="Task actions" role="group">
        {!done && (
          <button type="button" className="icon-btn" onClick={() => actions.toggleLater(task)} aria-label={later ? "Move back to Not done" : "Mark as Later"} data-tip={later ? "Not done  L" : "Later  L"}>
            {later ? <RotateCcw size={15} /> : <MoonStar size={15} />}
            <span className="tray-label">{later ? "Not done" : "Later"}</span>
          </button>
        )}
        {!done && (
          <button type="button" className="icon-btn" onClick={() => actions.moveTo(task, moveTarget)} aria-label={`Move to ${moveLabel.toLowerCase()}`} data-tip={`${moveLabel}  T`}>
            <ArrowRight size={15} />
            <span className="tray-label">{moveLabel}</span>
          </button>
        )}
        <a
          className="icon-btn"
          href={calendarUrl(task)}
          target="_blank"
          rel="noreferrer"
          onClick={() => actions.calendarOpened(task)}
          aria-label={`Add “${task.title}” to Google Calendar (opens a new tab)`}
          data-tip="Google Calendar"
        >
          <CalendarPlus size={15} />
          <span className="tray-label">Calendar</span>
        </a>
        <button type="button" className="icon-btn" onClick={() => onEditChange(task.id)} aria-label={`Edit “${task.title}”`} data-tip="Edit  E">
          <Pencil size={15} />
          <span className="tray-label">Edit</span>
        </button>
        <button type="button" className="icon-btn danger" onClick={() => actions.remove(task)} aria-label={`Delete “${task.title}”`} data-tip="Delete  ⌫">
          <Trash2 size={15} />
          <span className="tray-label">Delete</span>
        </button>
      </div>

      <time className="task-time" dateTime={task.scheduledAt}>
        {formatTime(task.scheduledAt)}
      </time>

      <button type="button" className="task-more icon-btn" aria-expanded={expanded} aria-label={`More actions for “${task.title}”`} onClick={() => setExpanded((open) => !open)}>
        <MoreHorizontal size={18} />
      </button>
    </li>
  );
}

function TaskEditor({ task, onDone, actions }: { task: Task; onDone: () => void; actions: TaskActions }) {
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(taskDate(task));
  const [time, setTime] = useState(taskTime(task));
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const save = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return setError("A task needs a name.");
    if (!date || !time) return setError("Pick a date and a time.");
    actions.update(task, { title: trimmed, scheduledAt: `${date}T${time}`, status });
    onDone();
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`)?.focus());
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onDone();
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`)?.focus());
    }
  };

  return (
    <li className="task task-editing" data-task-id={task.id}>
      <form className="editor" onSubmit={save} onKeyDown={onKeyDown} aria-label={`Edit ${task.title}`}>
        <input
          ref={titleRef}
          className="editor-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setError("");
          }}
          aria-label="Task name"
          aria-invalid={!!error}
        />
        <div className="editor-row">
          <label className="field-chip">
            <span className="sr-only">Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label className="field-chip">
            <span className="sr-only">Time</span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
          </label>
          <StatusSegment value={status} onChange={setStatus} includeDone />
          <span className="editor-spacer" />
          <button type="button" className="btn btn-ghost" onClick={onDone}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save <CornerDownLeft size={13} aria-hidden="true" />
          </button>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </li>
  );
}

export function StatusSegment({ value, onChange, includeDone }: { value: TaskStatus; onChange: (status: TaskStatus) => void; includeDone?: boolean }) {
  const options: TaskStatus[] = includeDone ? ["todo", "later", "done"] : ["todo", "later"];
  return (
    <div className="segment" role="radiogroup" aria-label="Status">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`segment-item status-${option}`}
          onClick={() => onChange(option)}
        >
          <span className="status-glyph" aria-hidden="true" />
          {option === "todo" ? "Not done" : option === "later" ? "Later" : "Done"}
        </button>
      ))}
    </div>
  );
}

export const TaskRow = memo(TaskRowImpl);
