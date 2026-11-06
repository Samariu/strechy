// Deadline-based step timer. Remaining time is always derived from the clock,
// so throttled or suspended JS (iOS background, locked screen) never causes drift.

import { transitionCue } from "./session.js";

export class SessionTimer {
  /**
   * @param {import("./session.js").Step[]} steps
   * @param {{ onRender?: Function, onStep?: Function, onDone?: Function, now?: () => number }} hooks
   */
  constructor(steps, hooks = {}) {
    this.steps = steps;
    this.hooks = hooks;
    this.now = hooks.now || (() => Date.now());
    this.speed = 1; // test hook: >1 makes time pass faster
    this.index = 0;
    this.remainingMs = steps.length ? steps[0].seconds * 1000 : 0;
    this.deadline = 0;
    this.running = false;
    this.finished = false;
    this._raf = 0;
    this._interval = 0;
    this._loop = this._loop.bind(this);
  }

  get step() { return this.steps[this.index]; }

  get remaining() {
    if (!this.running) return this.remainingMs;
    return Math.max(0, (this.deadline - this.now()) * this.speed);
  }

  /** 0..1 fraction of the current step elapsed. */
  get fraction() {
    const total = (this.step?.seconds || 1) * 1000;
    return Math.min(1, Math.max(0, 1 - this.remaining / total));
  }

  start() {
    if (this.running || this.finished || !this.steps.length) return;
    this.running = true;
    this.deadline = this.now() + this.remainingMs / this.speed;
    this._schedule();
    this._render();
  }

  pause() {
    if (!this.running) return;
    this.remainingMs = this.remaining;
    this.running = false;
    this._unschedule();
    this._render();
  }

  toggle() { this.running ? this.pause() : this.start(); }

  /** Jump to a step index (manual navigation). Keeps running/paused state. */
  goTo(i, { cue = false } = {}) {
    if (this.finished) return;
    if (i >= this.steps.length) return this._finish();
    i = Math.max(0, i);
    const prev = this.step;
    this.index = i;
    this.remainingMs = this.step.seconds * 1000;
    if (this.running) this.deadline = this.now() + this.remainingMs / this.speed;
    this.hooks.onStep?.(prev, this.step, cue ? transitionCue(prev, this.step) : null);
    this._render();
  }

  next() { this.goTo(this.index + 1); }

  /** One step back; on the first step, restart it. */
  prev() { this.goTo(this.index > 0 ? this.index - 1 : 0); }

  /** Re-check the clock now (e.g. after returning from background). */
  sync() { if (this.running) this._loop(); }

  destroy() {
    this.running = false;
    this._unschedule();
  }

  _finish() {
    this.running = false;
    this.finished = true;
    this.remainingMs = 0;
    this._unschedule();
    this.hooks.onDone?.();
  }

  _schedule() {
    this._unschedule();
    this._raf = requestAnimationFrame(this._loop);
    // rAF stops entirely when hidden; the interval keeps transitions firing
    // wherever the browser still runs timers.
    this._interval = setInterval(() => this.sync(), 250);
  }

  _unschedule() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._interval) clearInterval(this._interval);
    this._raf = 0;
    this._interval = 0;
  }

  _loop() {
    if (!this.running) return;
    const now = this.now();
    if (now >= this.deadline) {
      // Advance through every step whose time has fully elapsed, carrying
      // overflow forward. Only the last transition gets a cue.
      const prev = this.step;
      let deadline = this.deadline;
      let i = this.index;
      while (now >= deadline) {
        i++;
        if (i >= this.steps.length) {
          this.index = this.steps.length - 1;
          return this._finish();
        }
        deadline += (this.steps[i].seconds * 1000) / this.speed;
      }
      this.index = i;
      this.deadline = deadline;
      this.hooks.onStep?.(prev, this.step, transitionCue(prev, this.step));
    }
    this._render();
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
  }

  _render() { this.hooks.onRender?.(this); }
}
