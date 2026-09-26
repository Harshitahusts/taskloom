import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Lock, Sparkles, X } from "lucide-react";
import { parseRoutine, type ExtractedTask } from "@/lib/routine";
import { formatDay, formatTime, relativeDayLabel, shiftDate } from "@/lib/tasks";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: string;
  onCommit: (items: ExtractedTask[]) => void;
};

const example = "8 AM gym\n10 AM deep work on the proposal\nafter lunch review product metrics\n6 PM study\n8 PM dinner with Sam";

export function PlanMyDay({ open, onOpenChange, today, onCommit }: Props) {
  const [text, setText] = useState("");
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [preview, setPreview] = useState<ExtractedTask[] | null>(null);
  const [error, setError] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const baseDate = day === "today" ? today : shiftDate(today, 1);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setError("");
    }
  }, [open]);

  const lineCount = useMemo(() => text.split(/[\n;]+/).filter((line) => line.trim()).length, [text]);

  const buildPreview = () => {
    const items = parseRoutine(text, baseDate);
    if (!items.length) {
      setError("Write at least one thing you plan to do — one per line.");
      textRef.current?.focus();
      return;
    }
    setError("");
    setPreview(items.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
  };

  const updateItem = (id: string, patch: Partial<ExtractedTask>) =>
    setPreview((current) => current?.map((item) => (item.id === id ? { ...item, ...patch } : item)) ?? null);

  const commit = () => {
    const items = (preview ?? []).filter((item) => item.title.trim() && item.time);
    if (!items.length) return;
    onCommit(items.map((item) => ({ ...item, title: item.title.trim() })));
    setText("");
    setPreview(null);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog dialog-plan">
          <header className="dialog-head">
            <div>
              <span className="eyebrow">Plan my day</span>
              <Dialog.Title className="dialog-title">{preview ? "Here’s your day" : "What does your day look like?"}</Dialog.Title>
            </div>
            <Dialog.Close className="icon-btn" aria-label="Close planner">
              <X size={16} />
            </Dialog.Close>
          </header>

          {!preview ? (
            <div className="plan-step" key="write">
              <Dialog.Description className="dialog-desc">
                One thing per line. Times like <em>8 AM</em> or phrases like <em>after lunch</em> are picked up automatically. You’ll review everything before it’s added.
              </Dialog.Description>
              <div className="plan-day-toggle segment" role="radiogroup" aria-label="Plan for">
                {(["today", "tomorrow"] as const).map((option) => (
                  <button key={option} type="button" role="radio" aria-checked={day === option} className="segment-item" onClick={() => setDay(option)}>
                    {option === "today" ? "Today" : "Tomorrow"} <span className="muted">{formatDay(option === "today" ? today : shiftDate(today, 1))}</span>
                  </button>
                ))}
              </div>
              <textarea
                ref={textRef}
                className="plan-input"
                value={text}
                autoFocus
                onChange={(event) => {
                  setText(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    buildPreview();
                  }
                }}
                placeholder={example}
                aria-label="Describe your day, one item per line"
                aria-invalid={!!error}
                rows={7}
              />
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <footer className="dialog-foot">
                <span className="privacy-note">
                  <Lock size={12} aria-hidden="true" /> Parsed on this device. Nothing is sent anywhere.
                </span>
                <div className="dialog-actions">
                  {!text && (
                    <button type="button" className="btn btn-ghost" onClick={() => setText(example)}>
                      Use example
                    </button>
                  )}
                  <button type="button" className="btn btn-primary" onClick={buildPreview} disabled={!lineCount}>
                    Preview{lineCount ? ` ${lineCount}` : ""} <kbd className="kbd kbd-on-primary">⌘↵</kbd>
                  </button>
                </div>
              </footer>
            </div>
          ) : (
            <div className="plan-step" key="preview">
              <Dialog.Description className="dialog-desc">
                Adjust anything that looks off. Times marked <span className="guess-dot" aria-label="estimated" /> were estimated.
              </Dialog.Description>
              <ol className="plan-preview">
                {preview.map((item) => (
                  <li key={item.id} className="plan-item">
                    <label className="plan-time">
                      <span className="sr-only">Time for {item.title}</span>
                      <input type="time" value={item.time} onChange={(event) => updateItem(item.id, { time: event.target.value, timeDetected: true })} />
                      {!item.timeDetected && <span className="guess-dot" title="Estimated time" />}
                    </label>
                    <input className="plan-title" value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} aria-label="Task name" />
                    {item.date !== baseDate && <span className="tag">{relativeDayLabel(item.date, today)}</span>}
                    <button type="button" className="icon-btn" aria-label={`Remove ${item.title}`} onClick={() => setPreview((current) => current?.filter((other) => other.id !== item.id) ?? null)}>
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ol>
              {!preview.length && <p className="dialog-desc">Everything removed. Go back to write your day again.</p>}
              <footer className="dialog-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>
                  <ArrowLeft size={14} aria-hidden="true" /> Edit text
                </button>
                <button type="button" className="btn btn-primary" onClick={commit} disabled={!preview.length}>
                  <Sparkles size={14} aria-hidden="true" /> Add {preview.length} to {day === "today" ? "Today" : "Tomorrow"}
                </button>
              </footer>
              <p className="sr-only" aria-live="polite">
                {preview.length} tasks ready. First at {preview[0] ? formatTime(preview[0].time) : ""}.
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
