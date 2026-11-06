# Strechy

A guided stretching / mobility timer, built as an installable, offline-first PWA optimized for iPhone. No backend, no build step, no dependencies — plain HTML, CSS and ES modules.

## Features

- Program list → exercise list (tap an exercise for its how-to notes) → guided full-screen timer → completion screen.
- Handles unilateral exercises (Left/Right per set) and multiple sets automatically.
- 5-second "Get ready" countdown whenever the side or exercise changes (configurable: off / 3 / 5 / 10 s). Consecutive sets of the same hold run back-to-back.
- Pause/resume (button or tap the ring), back one step, skip one step. No skip-to-end.
- Transition cues: screen flash (always), sound (WebAudio beeps; respects the iOS silent switch and mixes with your music), vibration where supported.
- Keeps the screen awake during a session (Screen Wake Lock, iOS 16.4+).
- If iOS reloads the app mid-session, the program screen offers **Resume**.
- Optional completion log stored in `localStorage`; "Last done" badge on each program.

> **iPhone note:** iOS Safari does not implement the Vibration API, so vibration only works on Android/other browsers. On iPhone the cues are the sound beeps (when the ring switch is on) plus the full-screen colour flash.

## Install on iPhone

1. Open the deployed URL in **Safari**.
2. Share → **Add to Home Screen**.
3. Launch from the home-screen icon. After the first load it works fully offline.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` runs the tests and publishes the app on every push to `main`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site will be at `https://<user>.github.io/strechy/`. All paths are relative, so any static host or subpath works.

## Adding a program

Edit `js/data.js` and append an object to `PROGRAMS`:

```js
{
  id: "set-c",                       // unique, URL-safe
  name: "Set C – Recovery",
  exercises: [
    { name: "Hip Flexor", sides: "unilateral", sets: 1, duration_seconds: 30,
      notes: "Optional how-to text." },
    { name: "Child's Pose", sides: "bilateral", sets: 1, duration_seconds: 45 },
  ],
}
```

Then bump `CACHE` in `sw.js` (e.g. `strechy-v2`) so installed copies pick up the change. That's the release step for **any** file change.

`SIDE_ORDER` in `js/session.js` switches unilateral ordering between alternating per set (L, R, L, R — default) and grouped (L, L, R, R).

## Development

```sh
python3 -m http.server 8080   # then open http://localhost:8080
node --test                   # unit tests for the session/step logic
```

Service workers need `localhost` or HTTPS. During development, use DevTools → Application → "Update on reload", or bump `CACHE`.

## Structure

```
index.html        app shell
styles.css        all styles (safe-area aware)
manifest.json     PWA manifest
sw.js             offline cache (cache-first, versioned)
js/data.js        program definitions
js/session.js     expands a program into timed steps (pure, tested)
js/timer.js       deadline-based timer (no drift when backgrounded)
js/cues.js        sound + vibration
js/store.js       localStorage persistence
js/app.js         router + screens
tests/            node:test unit tests
```
