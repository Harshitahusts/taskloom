import * as Dialog from "@radix-ui/react-dialog";
import { Check, CornerUpLeft, MoonStar, X } from "lucide-react";
import { formatTime, isOverdue, nextAfter, relativeDayLabel, taskDate, type Task } from "@/lib/tasks";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | undefined;
  tasks: Task[];
  today: string;
  now: string;
  onComplete: (task: Task) => void;
  onSnooze: (task: Task) => void;
  onOpenTask: (task: Task) => void;
};

export function FocusMode({ open, onOpenChange, task, tasks, today, now, onComplete, onSnooze, onOpenTask }: Props) {
  const next = nextAfter(tasks, task);
  const day = task ? relativeDayLabel(taskDate(task), today) : "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay overlay-focus" />
        <Dialog.Content className="focus" aria-describedby={undefined}>
          <Dialog.Close className="icon-btn focus-close" aria-label="Leave focus">
            <X size={18} />
          </Dialog.Close>
          <span className="eyebrow">Focus</span>
          {task ? (
            <div className="focus-body" key={task.id}>
              <p className="focus-when">
                {isOverdue(task, today, now) ? <span className="tag tag-overdue">Overdue</span> : day !== "Today" && <span className="tag">{day}</span>}
                <time dateTime={task.scheduledAt}>{formatTime(task.scheduledAt)}</time>
              </p>
              <Dialog.Title className="focus-title">{task.title}</Dialog.Title>
              <div className="focus-actions">
                <button type="button" className="btn btn-primary btn-lg" onClick={() => onComplete(task)} autoFocus>
                  <Check size={16} aria-hidden="true" /> Complete
                </button>
                <button type="button" className="btn btn-quiet btn-lg" onClick={() => onSnooze(task)}>
                  <MoonStar size={16} aria-hidden="true" /> Later
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-lg"
                  onClick={() => {
                    onOpenChange(false);
                    requestAnimationFrame(() => onOpenTask(task));
                  }}
                >
                  <CornerUpLeft size={16} aria-hidden="true" /> Open in list
                </button>
              </div>
              <p className="focus-next">
                {next ? (
                  <>
                    <span className="muted">Then</span> {next.title} <span className="muted">· {taskDate(next) !== today ? `${relativeDayLabel(taskDate(next), today)}, ` : ""}{formatTime(next.scheduledAt)}</span>
                  </>
                ) : (
                  <span className="muted">Nothing else open after this.</span>
                )}
              </p>
            </div>
          ) : (
            <div className="focus-body">
              <Dialog.Title className="focus-title">Nothing left to focus on.</Dialog.Title>
              <p className="focus-next muted">Every open task is done or set for later. Enjoy the quiet.</p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
