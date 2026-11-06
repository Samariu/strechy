// Transition cues: vibration + short synthesized beeps. Both fail silently.
// Note: iOS Safari has no Vibration API; navigator.vibrate is simply absent there.
// WebAudio respects the iOS ring/silent switch, which is the desired behavior.

let ctx = null;
let prefs = { sound: true, vibrate: true };

export const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export function setCuePrefs(p) {
  prefs = { ...prefs, ...p };
}

/** Must be called from inside a user gesture (e.g. the Start button) to unlock audio on iOS. */
export function unlockAudio() {
  try {
    // iOS 17+: "ambient" mixes with the user's music and obeys the silent switch.
    if (navigator.audioSession) navigator.audioSession.type = "ambient";
  } catch {}
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    // Play one silent sample: required by older iOS to fully unlock output.
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    ctx = null;
  }
}

export function resumeAudio() {
  try {
    if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
  } catch {}
}

function tone(freq, startOffset, dur, gain = 0.25) {
  if (!ctx) return;
  const t0 = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const PATTERNS = {
  // Hold begins: one firm pulse.
  go: { vibe: [250], tones: [[880, 0, 0.22]] },
  // Get ready / switch side or exercise: two short pulses.
  switch: { vibe: [100, 80, 100], tones: [[660, 0, 0.1], [660, 0.16, 0.1]] },
  // Prep countdown 3-2-1.
  tick: { vibe: [], tones: [[520, 0, 0.06, 0.12]] },
  // Session complete: long triple, rising chime.
  done: { vibe: [300, 120, 300, 120, 600], tones: [[660, 0, 0.18], [880, 0.2, 0.18], [1175, 0.4, 0.4]] },
};

export function cue(name) {
  const p = PATTERNS[name];
  if (!p) return;
  if (prefs.vibrate && canVibrate && p.vibe.length) {
    try { navigator.vibrate(p.vibe); } catch {}
  }
  if (prefs.sound && ctx) {
    try {
      resumeAudio();
      for (const [f, o, d, g] of p.tones) tone(f, o, d, g);
    } catch {}
  }
}
