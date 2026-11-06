import { PROGRAMS, getProgram } from "./data.js";
import {
  buildSteps, holdSteps, totalSeconds, exerciseSummary,
  formatClock, formatDuration,
} from "./session.js";
import { SessionTimer } from "./timer.js";
import * as store from "./store.js";
import { cue, unlockAudio, resumeAudio, setCuePrefs, canVibrate } from "./cues.js";

const app = document.getElementById("app");
const flashEl = document.getElementById("flash");
const exitDialog = document.getElementById("confirm-exit");

let prefs = store.getPrefs();
setCuePrefs(prefs);

/** Active session state, if any. */
let session = null;
/** Result of the last finished session, for the done screen. */
let lastResult = null;

// ---------------------------------------------------------------- helpers

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ICONS = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path class="fill" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect class="fill" x="6" y="5" width="4.2" height="14" rx="1.2"/><rect class="fill" x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M18 6l-8 6 8 6V6zM6 6v12"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M6 6l8 6-8 6V6zM18 6v12"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
};

function relDay(ts) {
  const day = 86400000;
  const startOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const diff = Math.round((startOf(Date.now()) - startOf(ts)) / day);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function stepsFor(program) {
  return buildSteps(program, { prepSeconds: prefs.prepSeconds });
}

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function flash(kind) {
  flashEl.style.setProperty("--flash", kind === "prep" ? "var(--prep)" : "var(--accent)");
  flashEl.classList.remove("on");
  void flashEl.offsetWidth; // restart animation
  flashEl.classList.add("on");
}

// ---------------------------------------------------------------- wake lock

let wakeLock = null;

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener?.("release", () => { wakeLock = null; });
    }
  } catch { wakeLock = null; }
}

function releaseWakeLock() {
  try { wakeLock?.release(); } catch {}
  wakeLock = null;
}

// ---------------------------------------------------------------- router

function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [view, id] = parts;

  // Leaving the session screen (e.g. Android back) pauses and keeps it resumable.
  if (session && view !== "s") suspendSession();

  if (view === "p" && getProgram(id)) return renderProgram(getProgram(id));
  if (view === "s" && getProgram(id)) return renderSession(getProgram(id));
  if (view === "done" && lastResult && lastResult.programId === id) return renderDone();
  return renderHome();
}

window.addEventListener("hashchange", route);

// ---------------------------------------------------------------- home

function renderHome() {
  const lastId = store.getLastProgramId();
  const history = store.getHistory();

  const cards = PROGRAMS.map((p) => {
    const steps = stepsFor(p);
    const done = store.lastDone(p.id);
    const recent = done && Date.now() - done < 3 * 86400000;
    return `
      <button class="card${p.id === lastId ? " last" : ""}" data-program="${esc(p.id)}">
        <div class="card-title">${esc(p.name)}</div>
        <div class="card-meta">
          <span>${p.exercises.length} exercises</span>
          <span>~${formatDuration(totalSeconds(steps))}</span>
          ${done ? `<span class="badge${recent ? " recent" : ""}">Last done ${esc(relDay(done))}</span>` : ""}
        </div>
      </button>`;
  }).join("");

  const recentRows = history.slice(0, 5).map((h) => {
    const p = getProgram(h.programId);
    const when = new Date(h.finishedAt);
    return `
      <div class="list-row">
        <div class="grow">
          <div>${esc(p ? p.name : h.programId)}</div>
          <div class="sub">${esc(relDay(h.finishedAt))} · ${when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · ${formatDuration(h.durationSec)}</div>
        </div>
      </div>`;
  }).join("");

  const prepOpts = [0, 3, 5, 10].map((n) =>
    `<button data-prep="${n}" aria-pressed="${prefs.prepSeconds === n}">${n === 0 ? "Off" : n + "s"}</button>`).join("");

  app.innerHTML = `
    <section class="view">
      <div class="scroll">
        <h1 class="app-title">Strechy</h1>
        <p class="app-sub">Pick a program to start.</p>
        <div class="cards">${cards}</div>

        <h2 class="eyebrow section-title">Recent sessions</h2>
        <div class="list">${recentRows || '<div class="empty">No sessions logged yet.</div>'}</div>
        ${history.length ? '<button class="link-btn" data-clear>Clear history</button>' : ""}

        <h2 class="eyebrow section-title">Settings</h2>
        <div class="list">
          <button class="list-row row-btn" data-toggle="sound">
            <div class="grow">Sound cues<div class="sub">Silenced by the ring/silent switch</div></div>
            <span class="switch" role="switch" aria-checked="${prefs.sound}"></span>
          </button>
          <button class="list-row row-btn" data-toggle="vibrate">
            <div class="grow">Vibration<div class="sub">${canVibrate ? "Pulse on every transition" : "Not supported by this browser"}</div></div>
            <span class="switch" role="switch" aria-checked="${prefs.vibrate}"></span>
          </button>
          <div class="list-row">
            <div class="grow">Get-ready time<div class="sub">Before each new side or exercise</div></div>
            <div class="segmented">${prepOpts}</div>
          </div>
        </div>
      </div>
    </section>`;

  app.querySelectorAll("[data-program]").forEach((el) =>
    el.addEventListener("click", () => go(`#/p/${el.dataset.program}`)));

  app.querySelectorAll("[data-toggle]").forEach((el) =>
    el.addEventListener("click", () => {
      const key = el.dataset.toggle;
      prefs = store.setPrefs({ [key]: !prefs[key] });
      setCuePrefs(prefs);
      el.querySelector(".switch").setAttribute("aria-checked", prefs[key]);
    }));

  app.querySelectorAll("[data-prep]").forEach((el) =>
    el.addEventListener("click", () => {
      prefs = store.setPrefs({ prepSeconds: Number(el.dataset.prep) });
      renderHome();
    }));

  app.querySelector("[data-clear]")?.addEventListener("click", () => {
    if (confirm("Clear all logged sessions?")) { store.clearHistory(); renderHome(); }
  });
}

// ---------------------------------------------------------------- program

function renderProgram(program) {
  const steps = stepsFor(program);
  const holds = holdSteps(steps).length;
  const active = store.getActive();
  const canResume = active && active.programId === program.id;

  const rows = program.exercises.map((ex, i) => {
    const hasNotes = Boolean(ex.notes && ex.notes.trim());
    return `
      <div class="ex">
        <button class="ex-head" ${hasNotes ? `aria-expanded="false"` : "disabled"}>
          <span class="ex-num">${i + 1}</span>
          <span style="flex:1;min-width:0">
            <div class="ex-name">${esc(ex.name)}</div>
            <div class="ex-sum">${esc(exerciseSummary(ex))}</div>
          </span>
          ${hasNotes ? ICONS.chev : ""}
        </button>
        ${hasNotes ? `<div class="ex-notes">${esc(ex.notes)}</div>` : ""}
      </div>`;
  }).join("");

  app.innerHTML = `
    <section class="view">
      <div class="topbar">
        <button class="icon-btn" data-back aria-label="Back">${ICONS.back}</button>
      </div>
      <div class="scroll">
        <h1 class="prog-title">${esc(program.name)}</h1>
        <div class="prog-stats">
          <span><strong>~${formatDuration(totalSeconds(steps))}</strong> total</span>
          <span><strong>${program.exercises.length}</strong> exercises</span>
          <span><strong>${holds}</strong> holds</span>
        </div>
        <div class="list">${rows}</div>
      </div>
      <div class="dock">
        ${canResume
          ? `<div class="resume-row">
               <button class="btn btn-secondary" data-start>Restart</button>
               <button class="btn btn-primary" data-resume>Resume</button>
             </div>`
          : `<button class="btn btn-primary btn-block" data-start>Start</button>`}
      </div>
    </section>`;

  app.querySelector("[data-back]").addEventListener("click", () => go("#/"));

  app.querySelectorAll(".ex-head:not([disabled])").forEach((btn) =>
    btn.addEventListener("click", () => {
      const ex = btn.parentElement;
      const open = ex.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
    }));

  app.querySelector("[data-start]").addEventListener("click", () => {
    unlockAudio();
    store.setActive(null);
    startSession(program, null);
  });

  app.querySelector("[data-resume]")?.addEventListener("click", () => {
    unlockAudio();
    startSession(program, store.getActive());
  });
}

// ---------------------------------------------------------------- session

function startSession(program, resumeState) {
  if (session) destroySession();
  const steps = stepsFor(program);
  const timer = new SessionTimer(steps, {
    onRender: renderSessionFrame,
    onStep: onSessionStep,
    onDone: onSessionDone,
  });
  session = {
    program,
    steps,
    timer,
    holds: holdSteps(steps).length,
    startedAt: resumeState?.startedAt || Date.now(),
    lastSecond: null,
    els: null,
    howtoOpen: false,
  };
  if (resumeState && resumeState.index < steps.length) {
    timer.index = resumeState.index;
    timer.remainingMs = Math.min(resumeState.remainingMs, steps[resumeState.index].seconds * 1000);
  }
  store.setLastProgramId(program.id);
  go(`#/s/${program.id}`);
  timer.start();
  requestWakeLock();
  const s = timer.step;
  cue(s.kind === "prep" ? "switch" : "go");
  flash(s.kind);
}

function persistSession() {
  if (!session || session.timer.finished) return;
  store.setActive({
    programId: session.program.id,
    index: session.timer.index,
    remainingMs: session.timer.remaining,
    startedAt: session.startedAt,
  });
}

function suspendSession() {
  if (!session) return;
  session.timer.pause();
  persistSession();
  destroySession();
}

function destroySession() {
  session?.timer.destroy();
  session = null;
  releaseWakeLock();
}

function renderSession(program) {
  if (!session || session.program.id !== program.id) {
    // Reload or deep link: offer resume from the program screen instead.
    return go(`#/p/${program.id}`);
  }

  const segs = Array.from({ length: session.holds }, () => "<i></i>").join("");
  const R = 46;
  const C = 2 * Math.PI * R;

  app.innerHTML = `
    <section class="view session">
      <div class="topbar">
        <button class="icon-btn" data-exit aria-label="End session">${ICONS.close}</button>
        <div class="spacer"></div>
        <span class="step-count" data-count></span>
        <button class="icon-btn" data-sound aria-label="Toggle sound"></button>
      </div>
      <div class="progress" data-progress aria-hidden="true">${segs}</div>
      <div class="now">
        <div class="eyebrow phase-label" data-phase></div>
        <h1 class="ex-title" data-name></h1>
        <div class="chips" data-chips></div>
      </div>
      <div class="ring-wrap">
        <button class="ring" data-ring aria-label="Pause or resume">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="track" cx="50" cy="50" r="${R}" fill="none" stroke-width="4"/>
            <circle class="bar" data-bar cx="50" cy="50" r="${R}" fill="none" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0"/>
          </svg>
          <span class="clock" data-clock role="timer"></span>
          <span class="paused-tag">Paused</span>
        </button>
      </div>
      <div class="up-next" data-next></div>
      <div class="howto" data-howto>
        <button class="howto-toggle" data-howto-toggle aria-expanded="false"><span>How to</span>${ICONS.chev}</button>
        <div class="howto-body" data-howto-body></div>
      </div>
      <div class="controls">
        <div class="ctrl-group">
          <button class="ctrl" data-prev aria-label="Previous step">${ICONS.prev}</button>
          <span class="ctrl-label">Back</span>
        </div>
        <div class="ctrl-group">
          <button class="ctrl main" data-toggle-run aria-label="Pause"></button>
          <span class="ctrl-label" data-run-label>Pause</span>
        </div>
        <div class="ctrl-group">
          <button class="ctrl" data-next-btn aria-label="Next step">${ICONS.next}</button>
          <span class="ctrl-label">Skip</span>
        </div>
      </div>
    </section>`;

  const q = (sel) => app.querySelector(sel);
  session.els = {
    root: q(".session"),
    count: q("[data-count]"),
    progress: q("[data-progress]"),
    segs: [...q("[data-progress]").children],
    phase: q("[data-phase]"),
    name: q("[data-name]"),
    chips: q("[data-chips]"),
    bar: q("[data-bar]"),
    clock: q("[data-clock]"),
    next: q("[data-next]"),
    howto: q("[data-howto]"),
    howtoBody: q("[data-howto-body]"),
    howtoToggle: q("[data-howto-toggle]"),
    run: q("[data-toggle-run]"),
    runLabel: q("[data-run-label]"),
    sound: q("[data-sound]"),
    circ: C,
  };
  session.renderedIndex = -1;
  session.renderedRunning = null;
  session.lastSecond = null;

  const t = session.timer;
  q("[data-toggle-run]").addEventListener("click", () => { resumeAudio(); t.toggle(); persistSession(); });
  q("[data-ring]").addEventListener("click", () => { resumeAudio(); t.toggle(); persistSession(); });
  q("[data-prev]").addEventListener("click", () => { t.prev(); persistSession(); });
  q("[data-next-btn]").addEventListener("click", () => { t.next(); persistSession(); });
  q("[data-exit]").addEventListener("click", confirmExit);
  q("[data-sound]").addEventListener("click", () => {
    prefs = store.setPrefs({ sound: !prefs.sound });
    setCuePrefs(prefs);
    if (prefs.sound) unlockAudio();
    renderSoundBtn();
  });
  session.els.howtoToggle.addEventListener("click", () => {
    session.howtoOpen = !session.howtoOpen;
    session.els.howto.classList.toggle("open", session.howtoOpen);
    session.els.howtoToggle.setAttribute("aria-expanded", session.howtoOpen);
  });

  renderSoundBtn();
  renderSessionFrame(t);
}

function renderSoundBtn() {
  if (!session?.els) return;
  session.els.sound.innerHTML = prefs.sound ? ICONS.soundOn : ICONS.soundOff;
  session.els.sound.setAttribute("aria-label", prefs.sound ? "Mute sound" : "Unmute sound");
}

function confirmExit() {
  if (!session) return go("#/");
  const t = session.timer;
  const wasRunning = t.running;
  t.pause();
  const onClose = () => {
    exitDialog.removeEventListener("close", onClose);
    if (exitDialog.returnValue === "end") {
      const id = session.program.id;
      store.setActive(null);
      destroySession();
      go(`#/p/${id}`);
    } else if (wasRunning) {
      t.start();
    }
  };
  if (typeof exitDialog.showModal === "function") {
    exitDialog.returnValue = "";
    exitDialog.addEventListener("close", onClose);
    exitDialog.showModal();
  } else {
    exitDialog.returnValue = confirm("End session? Progress won't be logged.") ? "end" : "cancel";
    onClose();
  }
}

function describeStep(s) {
  if (!s) return "";
  return s.side ? `${s.name} — ${s.side}` : s.name;
}

/** Called by the timer every frame and on every state change. */
function renderSessionFrame(t) {
  if (!session?.els) return;
  const e = session.els;
  const s = t.step;
  if (!s) return;

  // Structural updates only when the step changes.
  if (session.renderedIndex !== t.index) {
    session.renderedIndex = t.index;
    const isPrep = s.kind === "prep";
    e.root.classList.toggle("is-prep", isPrep);
    e.phase.textContent = isPrep ? "Get ready" : "Hold";
    e.name.textContent = s.name;
    const chips = [];
    if (s.side) chips.push(`<span class="chip side">${esc(s.side)}</span>`);
    if (s.setCount > 1) chips.push(`<span class="chip">Set ${s.setIndex + 1} of ${s.setCount}</span>`);
    e.chips.innerHTML = chips.join("");
    e.count.textContent = `${s.holdIndex + 1} / ${session.holds}`;

    const nextHold = session.steps.find((x) => x.kind === "hold" && x.holdIndex > s.holdIndex);
    e.next.textContent = nextHold ? `Next: ${describeStep(nextHold)}${nextHold.setCount > 1 ? ` · set ${nextHold.setIndex + 1}` : ""}` : "Last one";

    if (s.notes) {
      e.howto.hidden = false;
      e.howtoBody.textContent = s.notes;
    } else {
      e.howto.hidden = true;
    }

    e.segs.forEach((seg, i) => {
      seg.classList.toggle("done", i < s.holdIndex);
      seg.classList.toggle("cur", i === s.holdIndex);
      if (i !== s.holdIndex) seg.style.removeProperty("--p");
    });
  }

  const remaining = t.remaining / 1000;
  const sec = Math.ceil(remaining);
  if (sec !== session.lastSecond) {
    // 3-2-1 ticks at the end of a prep countdown
    if (t.running && s.kind === "prep" && session.lastSecond !== null && sec <= 3 && sec >= 1 && sec < session.lastSecond) cue("tick");
    session.lastSecond = sec;
    e.clock.textContent = formatClock(remaining);
  }

  const frac = t.fraction;
  e.bar.style.strokeDashoffset = String(e.circ * frac);
  const curSeg = e.segs[s.holdIndex];
  if (curSeg) curSeg.style.setProperty("--p", s.kind === "hold" ? frac : 0);

  if (session.renderedRunning !== t.running) {
    session.renderedRunning = t.running;
    e.root.classList.toggle("is-paused", !t.running);
    e.run.innerHTML = t.running ? ICONS.pause : ICONS.play;
    e.run.setAttribute("aria-label", t.running ? "Pause" : "Resume");
    e.runLabel.textContent = t.running ? "Pause" : "Resume";
  }
}

function onSessionStep(prev, next, cueName) {
  if (cueName) {
    cue(cueName);
    flash(next.kind);
  }
  if (session) session.lastSecond = null;
  persistSession();
}

function onSessionDone() {
  const s = session;
  cue("done");
  flash("hold");
  lastResult = {
    programId: s.program.id,
    finishedAt: Date.now(),
    durationSec: Math.round((Date.now() - s.startedAt) / 1000),
    holdsCompleted: s.holds,
    holdsTotal: s.holds,
    logged: false,
  };
  store.setActive(null);
  destroySession();
  go(`#/done/${lastResult.programId}`);
}

// ---------------------------------------------------------------- done

function renderDone() {
  const r = lastResult;
  const program = getProgram(r.programId);
  app.innerHTML = `
    <section class="view">
      <div class="done-wrap">
        <div class="done-mark">${ICONS.check}</div>
        <h1 class="done-title">Session complete</h1>
        <p class="muted">${esc(program.name)}</p>
        <div class="done-stats">
          <div><strong>${formatClock(r.durationSec)}</strong><span>time</span></div>
          <div><strong>${r.holdsCompleted}</strong><span>holds</span></div>
        </div>
        <p class="saved-note" data-saved>${r.logged ? "Saved to history" : ""}</p>
      </div>
      <div class="done-actions">
        ${r.logged
          ? `<button class="btn btn-primary btn-block" data-home>Done</button>`
          : `<button class="btn btn-primary btn-block" data-log>Log session</button>
             <button class="btn btn-secondary btn-block" data-home>Skip</button>`}
      </div>
    </section>`;

  app.querySelector("[data-log]")?.addEventListener("click", () => {
    const { logged, ...entry } = r;
    store.addHistory(entry);
    r.logged = true;
    renderDone();
  });
  app.querySelector("[data-home]").addEventListener("click", () => go("#/"));
}

// ---------------------------------------------------------------- lifecycle

document.addEventListener("visibilitychange", () => {
  if (!session) return;
  if (document.visibilityState === "visible") {
    resumeAudio();
    session.timer.sync();
    if (session && session.timer.running) requestWakeLock();
  } else {
    persistSession();
  }
});

window.addEventListener("pagehide", persistSession);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// Test hook (used by the headless checks; harmless in production).
window.__strechy = {
  get session() { return session; },
  setSpeed(n) {
    if (!session) return;
    const t = session.timer;
    const rem = t.remaining;
    t.speed = n;
    if (t.running) t.deadline = t.now() + rem / n;
  },
};

route();
