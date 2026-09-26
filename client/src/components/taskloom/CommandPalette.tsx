import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { byTime, formatLongDay, formatTime, relativeDayLabel, statusMeta, taskDate, type Task } from "@/lib/tasks";

export type PaletteCommand = {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  keywords?: string[];
  group: "Actions" | "Go to" | "Settings";
  run: () => void;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
  tasks: Task[];
  today: string;
  onOpenTask: (task: Task) => void;
};

export function CommandPalette({ open, onOpenChange, commands, tasks, today, onOpenTask }: Props) {
  const run = (fn: () => void) => {
    onOpenChange(false);
    // Let the dialog release focus before the command moves it.
    requestAnimationFrame(fn);
  };
  const groups = ["Actions", "Go to", "Settings"] as const;
  const sorted = [...tasks].sort((a, b) => {
    const aOpen = a.status !== "done" ? 0 : 1;
    const bOpen = b.status !== "done" ? 0 : 1;
    return aOpen - bOpen || byTime(a, b);
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay overlay-light" />
        <Dialog.Content className="palette" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Command menu</Dialog.Title>
          <Command label="Command menu" loop>
            <Command.Input className="palette-input" placeholder="Search tasks or type a command…" autoFocus />
            <Command.List className="palette-list">
              <Command.Empty className="palette-empty">No tasks or commands match that.</Command.Empty>
              {groups.map((group) => (
                <Command.Group key={group} heading={group} className="palette-group">
                  {commands
                    .filter((command) => command.group === group)
                    .map((command) => (
                      <Command.Item key={command.id} value={command.label} keywords={command.keywords} onSelect={() => run(command.run)} className="palette-item">
                        <span className="palette-icon" aria-hidden="true">
                          {command.icon}
                        </span>
                        <span className="palette-label">{command.label}</span>
                        {command.shortcut && <kbd className="kbd">{command.shortcut}</kbd>}
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
              <Command.Group heading="Tasks" className="palette-group">
                {sorted.map((task) => (
                  <Command.Item
                    key={task.id}
                    value={`${task.title} ${task.id}`}
                    keywords={[relativeDayLabel(taskDate(task), today), formatLongDay(taskDate(task)), statusMeta[task.status].label]}
                    onSelect={() => run(() => onOpenTask(task))}
                    className={`palette-item palette-task${task.status === "done" ? " is-done" : ""}`}
                  >
                    <span className={`mini-status status-${task.status}`} aria-hidden="true" />
                    <span className="palette-label">{task.title}</span>
                    <span className="palette-meta">
                      {relativeDayLabel(taskDate(task), today)} · {formatTime(task.scheduledAt)}
                      {task.status !== "todo" && ` · ${statusMeta[task.status].label}`}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
            <footer className="palette-foot" aria-hidden="true">
              <span>
                <kbd className="kbd">↑</kbd>
                <kbd className="kbd">↓</kbd> navigate
              </span>
              <span>
                <kbd className="kbd">↵</kbd> select
              </span>
              <span>
                <kbd className="kbd">esc</kbd> close
              </span>
            </footer>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
