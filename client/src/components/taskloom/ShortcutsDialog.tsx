import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { mod } from "@/lib/platform";

const sections: { title: string; items: [string[], string][] }[] = [
  {
    title: "Anywhere",
    items: [
      [["N"], "New task"],
      [["/"], "Search"],
      [[`${mod.trim()}`, "K"], "Command menu"],
      [["P"], "Plan my day"],
      [["C"], "Chatloom"],
      [["F"], "Focus"],
      [["1", "–", "4"], "Today · Upcoming · Completed · All"],
      [[`${mod.trim()}`, "Z"], "Undo last change"],
      [["?"], "This list"],
    ],
  },
  {
    title: "On a task",
    items: [
      [["J", "K"], "Next / previous task"],
      [["X"], "Complete or reopen"],
      [["L"], "Later / not done"],
      [["T"], "Move to tomorrow (or today)"],
      [["E"], "Edit"],
      [["⌫"], "Delete"],
      [["Esc"], "Cancel / close"],
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog dialog-shortcuts" aria-describedby={undefined}>
          <header className="dialog-head">
            <Dialog.Title className="dialog-title">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </header>
          <div className="shortcut-grid">
            {sections.map((section) => (
              <section key={section.title}>
                <h3 className="eyebrow">{section.title}</h3>
                <dl>
                  {section.items.map(([keys, label]) => (
                    <div key={label} className="shortcut-row">
                      <dt>{label}</dt>
                      <dd>
                        {keys.map((key) => (key === "–" ? <span key={key}>–</span> : <kbd key={key} className="kbd">{key}</kbd>))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
