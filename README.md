# Taskloom

A simple personal task list with required date and time, clear status colors, grouped date windows, automatic rollover, and Google Calendar shortcuts.

## Features

Taskloom answers one question: *what should I do now, and what's next?*

- **Today first.** The app opens on your day: what's left, what's next, and what's already done, with a small progress line and an **Up next** preview of tomorrow.
- **Views:** Today, Upcoming (Tomorrow / This week / Later), Completed, and All (with Not done / Later / Done filters).
- **Fast capture.** One line, then <kbd>Enter</kbd>. Date and time are required and pre-filled; typing “tomorrow 3pm” sets them for you. Status is **Not done** or **Later**.
- **Clear states.** Hollow ring = not done, dashed ring = later, filled check = done, amber = overdue. Each state also has a text label, so color is never the only signal.
- **Progressive actions.** Later, move to tomorrow/today, Google Calendar, edit and delete appear on hover or keyboard focus, and behind a ⋯ tray on touch screens.
- **Automatic rollover (unchanged behavior).** Unfinished tasks from past dates move to tomorrow. Done tasks stay on their date. Taskloom now tells you when this happens, tags moved tasks with “Moved from …”, and offers **Review** or **Move all to today**.
- **Undo everything.** Complete, delete, move, edit, clear, and plan all show a toast with **Undo**. <kbd>Ctrl/⌘ Z</kbd> works too.
- **Search** (<kbd>/</kbd>) matches names, statuses, and days (“tomorrow”, “friday”). The **command menu** (<kbd>Ctrl/⌘ K</kbd>) finds tasks and runs commands.
- **Plan my day** turns a few lines (“8 AM gym”, “after lunch review metrics”) into a preview you can edit before anything is added.
- **Chatloom** is your task list, conversationally: “What's next?”, “What's overdue?”, “How many are left?”, “Show completed”, “Add call Sam at 4pm”.
- **Focus** (<kbd>F</kbd>) shows only the current task, its time, what comes next, and Complete / Later / Open.
- Dark theme by default, with an optional light theme. Responsive, with a bottom tab bar, an add button, and bottom sheets on mobile. Respects reduced motion.

### Keyboard

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `N` | New task | `J` / `K` | Next / previous task |
| `/` | Search | `X` | Complete / reopen |
| `Ctrl/⌘ K` | Command menu | `L` | Later / not done |
| `P` | Plan my day | `T` | Move to tomorrow (or today) |
| `C` | Chatloom | `E` | Edit |
| `F` | Focus | `⌫` | Delete |
| `1`–`4` | Switch view | `Ctrl/⌘ Z` | Undo |
| `?` | All shortcuts | `Esc` | Cancel / close |

## Run locally

```bash
pnpm install
pnpm dev
```

The production build is:

```bash
pnpm check
pnpm build
```

## Deploy to Vercel

This repository is configured for Vercel. Import the repository in Vercel and use the detected settings, or set:

- **Framework preset:** Vite
- **Build command:** `pnpm build`
- **Output directory:** `dist/public`
- **Install command:** `pnpm install --frozen-lockfile`

Tasks are stored in browser local storage, so each browser/device has its own task list. The app works without environment variables or API keys.

### Routine assistant

The **Plan my day** assistant is a lightweight local planner. Add one routine item per line, and it detects common times such as `8 AM`, time-of-day phrases such as `after lunch`, and relative dates such as `tomorrow`. You review and edit a preview before it imports the items as **Not done**. Nothing is sent to an external AI service.

### Chatloom

Chatloom is a small rule-based assistant built into the app. It answers questions about the current task list (today, next, remaining, overdue, moved, tomorrow, later, completed) and can add a task or open the planner. Messages stay in the browser and are not sent to an external service.

## Google Calendar

Taskloom does not request access to a Google account. The Google Calendar links open Google Calendar or a pre-filled event page in a new tab, where you can review and save the event.

## License

MIT
