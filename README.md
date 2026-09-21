# Taskloom

A simple personal task list with required date and time, clear status colors, grouped date windows, automatic rollover, and Google Calendar shortcuts.

## Features

- Create tasks with a required date and time.
- Choose **Not done** or **Later** when creating a task.
- Mark tasks done with green checkboxes.
- View tasks grouped into separate date windows.
- Automatically move unfinished tasks from past dates to tomorrow.
- Keep completed green tasks on their original date.
- Search, filter, delete, and undo task changes.
- Add individual tasks to Google Calendar with one click.
- Save tasks locally in the current browser.
- Responsive greyish dark theme for desktop and mobile.
- Use the **Plan my day** assistant to turn a full-day routine into Not done tasks locally.

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

The **Plan my day** assistant is a lightweight local planner. Add one routine item per line, and it detects common times such as `8 AM`, time-of-day phrases such as `after lunch`, and relative dates such as `tomorrow`. It imports every item as **Not done** without sending data to an external AI service.

## Google Calendar

Taskloom does not request access to a Google account. The Google Calendar links open Google Calendar or a pre-filled event page in a new tab, where you can review and save the event.

## License

MIT
