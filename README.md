# Study Timer

A clean, distraction-free Pomodoro-style study timer that runs entirely in the browser. No installs, no build step.

## Features

- **Focus / Short Break / Long Break** modes with an animated progress ring
- **Automatic cycling** — a long break after every N focus sessions
- **Task list** — add tasks with estimated sessions, pick one to focus on, and track progress
- **Daily stats** — sessions completed, focus minutes, day streak, and a daily goal bar
- **7-day chart** of focus minutes
- **Customizable settings** — durations, long-break interval, daily goal, auto-start
- **Alerts** — sound chime and optional desktop notifications
- **Light / dark theme**
- **Keyboard shortcuts** — `Space` start/pause, `R` reset, `S` skip
- Everything is saved in your browser's `localStorage`

## Getting started

Just open `index.html` in any modern browser.

Or serve it locally:

```bash
npx serve .
# or
python -m http.server 8000
```

## Project structure

```
index.html   # markup
style.css    # styles and themes
app.js       # timer, tasks, stats, and settings logic
```

## License

MIT
