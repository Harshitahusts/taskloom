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
- Use the secure **Plan my day** assistant to turn a full-day routine into Not done tasks.

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

Tasks are stored in browser local storage, so each browser/device has its own task list. The core task list works without an environment variable.

### Routine assistant setup

To enable the routine assistant, add `OPENAI_API_KEY` as a **server-only** environment variable in Vercel for Preview and Production. Never add the key to `.env` files committed to GitHub or to client-side code. The assistant uses the Vercel function at `/api/extract-routine` and imports every extracted item as **Not done**.

## Google Calendar

Taskloom does not request access to a Google account. The Google Calendar links open Google Calendar or a pre-filled event page in a new tab, where you can review and save the event.

## License

MIT
