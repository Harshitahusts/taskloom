import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CalendarDays, Clock3, CornerDownLeft, Plus, Sparkles } from "lucide-react";
import { formatTime, nextQuarterHour, parseQuickAdd, relativeDayLabel, type TaskStatus } from "@/lib/tasks";
import { StatusSegment } from "./TaskRow";

export type ComposerHandle = { focus: () => void };

type Props = {
  today: string;
  defaultDate: string;
  onAdd: (input: { title: string; date: string; time: string; status: TaskStatus }) => void;
  /** Called after a successful add or on Escape with an empty field. */
  onDismiss?: () => void;
  autoFocus?: boolean;
  variant?: "inline" | "sheet";
};

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ today, defaultDate, onAdd, onDismiss, autoFocus, variant = "inline" }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(nextQuarterHour);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [touched, setTouched] = useState({ date: false, time: false });
  const [active, setActive] = useState(!!autoFocus);
  const [error, setError] = useState("");

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
  }));

  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, today) : null), [text, today]);
  const effectiveDate = touched.date ? date : parsed?.date || defaultDate;
  const effectiveTime = (!touched.time && parsed?.time) || time;
  const detected = parsed && ((!touched.date && parsed.date) || (!touched.time && parsed.time));

  const reset = () => {
    setText("");
    setStatus("todo");
    setTouched({ date: false, time: false });
    setDate(defaultDate);
    setTime(nextQuarterHour());
    setError("");
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const title = (parsed?.title ?? text).trim();
    if (!title) {
      setError("Give the task a name.");
      inputRef.current?.focus();
      return;
    }
    if (!effectiveDate || !effectiveTime) {
      setError("Pick a date and a time.");
      return;
    }
    onAdd({ title, date: effectiveDate, time: effectiveTime, status });
    reset();
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (text) {
        reset();
      } else {
        inputRef.current?.blur();
        setActive(false);
        onDismiss?.();
      }
    }
  };


  return (
    <form
      className={`composer composer-${variant}${active ? " is-active" : ""}`}
      onSubmit={submit}
      onKeyDown={onKeyDown}
      onFocus={() => {
        if (!active && !text) setTime(nextQuarterHour());
        setActive(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setActive(false);
      }}
      aria-label="Add a task"
    >
      <div className="composer-line">
        <span className="composer-plus" aria-hidden="true">
          <Plus size={16} />
        </span>
        <input
          ref={inputRef}
          className="composer-input"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
          placeholder="Add a task"
          aria-label="Task name"
          aria-describedby="composer-hint"
          aria-invalid={!!error}
          autoFocus={autoFocus}
          enterKeyHint="done"
          autoComplete="off"
        />
        {!active && !text && (
          <kbd className="kbd" aria-hidden="true">
            N
          </kbd>
        )}
      </div>

      <div className="composer-fields">
        <label className={`field-chip${!touched.date && parsed?.date ? " is-detected" : ""}`}>
          <CalendarDays size={14} aria-hidden="true" />
          <span className="sr-only">Date</span>
          <input
            type="date"
            value={effectiveDate}
            onChange={(event) => {
              setDate(event.target.value);
              setTouched((current) => ({ ...current, date: true }));
            }}
            required
          />
        </label>
        <label className={`field-chip${!touched.time && parsed?.time ? " is-detected" : ""}`}>
          <Clock3 size={14} aria-hidden="true" />
          <span className="sr-only">Time</span>
          <input
            type="time"
            value={effectiveTime}
            onChange={(event) => {
              setTime(event.target.value);
              setTouched((current) => ({ ...current, time: true }));
            }}
            required
          />
        </label>
        <StatusSegment value={status} onChange={setStatus} />
        <span className="composer-spacer" />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          Add <CornerDownLeft size={13} aria-hidden="true" />
        </button>
      </div>

      <p id="composer-hint" className={`composer-hint${error ? " is-error" : ""}`} role={error ? "alert" : undefined}>
        {error ? (
          error
        ) : detected ? (
          <>
            <Sparkles size={12} aria-hidden="true" /> {relativeDayLabel(effectiveDate, today)} at {formatTime(effectiveTime)} — picked up from your text
          </>
        ) : (
          <>Tip: type “tomorrow 3pm” and Taskloom sets the date and time.</>
        )}
      </p>
    </form>
  );
});
