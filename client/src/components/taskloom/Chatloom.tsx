import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Lock, MessagesSquare, X } from "lucide-react";
import { chatloomReply, chatSuggestions, type ChatAction } from "@/lib/chatloom";
import { formatTime, relativeDayLabel, statusMeta, taskDate, type Task } from "@/lib/tasks";

type Message = { id: number; role: "user" | "assistant"; text: string; tasks?: Task[] };

type Props = {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  today: string;
  now: string;
  defaultTime: string;
  onAction: (action: ChatAction) => void;
  onOpenTask: (task: Task) => void;
};

const intro: Message = {
  id: 0,
  role: "assistant",
  text: "Ask me about your list — what’s today, what’s next, what’s overdue. I only read tasks stored in this browser.",
};

export function Chatloom({ open, onClose, tasks, today, now, defaultTime, onAction, onOpenTask }: Props) {
  const [messages, setMessages] = useState<Message[]>([intro]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const seq = useRef(1);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (returnFocus.current && document.body.contains(returnFocus.current)) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const reply = chatloomReply(trimmed, { tasks, today, now, defaultTime });
    setMessages((current) => [
      ...current,
      { id: seq.current++, role: "user", text: trimmed },
      { id: seq.current++, role: "assistant", text: reply.text, tasks: reply.tasks },
    ]);
    setInput("");
    if (reply.action) onAction(reply.action);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };

  if (!open) return null;

  return (
    <>
      <div className="chat-scrim" onClick={onClose} aria-hidden="true" />
      <aside
        className="chatloom"
        role="dialog"
        aria-modal="false"
        aria-labelledby="chatloom-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="chatloom-head">
          <span className="chatloom-mark" aria-hidden="true">
            <MessagesSquare size={15} />
          </span>
          <div>
            <h2 id="chatloom-title">Chatloom</h2>
            <p>Your task list, conversationally</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close Chatloom">
            <X size={16} />
          </button>
        </header>

        <div className="chatloom-messages" ref={listRef} aria-live="polite" aria-relevant="additions">
          {messages.map((message) => (
            <div key={message.id} className={`bubble bubble-${message.role}`}>
              <p>{message.text}</p>
              {message.tasks && message.tasks.length > 0 && (
                <ul className="bubble-tasks">
                  {message.tasks.map((task) => (
                    <li key={task.id}>
                      <button type="button" onClick={() => onOpenTask(task)}>
                        <span className={`mini-status status-${task.status}`} aria-label={statusMeta[task.status].label} />
                        <span className="bubble-task-title">{task.title}</span>
                        <span className="bubble-task-time">
                          {taskDate(task) !== today && `${relativeDayLabel(taskDate(task), today)} · `}
                          {formatTime(task.scheduledAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="chatloom-suggestions" aria-label="Suggested questions">
          {chatSuggestions.map((suggestion) => (
            <button key={suggestion} type="button" className="chip" onClick={() => ask(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>

        <form className="chatloom-form" onSubmit={submit}>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask, or “add call Sam at 4pm”"
            aria-label="Message Chatloom"
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="btn btn-primary btn-icon" aria-label="Send" disabled={!input.trim()}>
            <ArrowUp size={16} />
          </button>
        </form>
        <p className="chatloom-foot">
          <Lock size={11} aria-hidden="true" /> Runs locally. No AI service, no network.
        </p>
      </aside>
    </>
  );
}
