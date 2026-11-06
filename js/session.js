// Pure session logic: expands a program into a flat list of timed steps.
// No DOM access here, so it can be unit-tested under Node.

// Order of sides for unilateral exercises.
export const SIDES = ["Left", "Right"];

// "alternate": Set 1 L, Set 1 R, Set 2 L, Set 2 R
// "grouped":   Set 1 L, Set 2 L, Set 1 R, Set 2 R
export const SIDE_ORDER = "alternate";

export const DEFAULT_PREP_SECONDS = 5;

/**
 * @typedef {Object} Step
 * @property {"prep"|"hold"} kind
 * @property {number} exerciseIndex
 * @property {string} name
 * @property {string|null} side       "Left" | "Right" | null for bilateral
 * @property {number} setIndex        0-based
 * @property {number} setCount
 * @property {number} seconds
 * @property {string} notes
 * @property {number} holdIndex       index into hold steps (prep steps carry the index of the hold they precede)
 */

function holdsForExercise(ex) {
  const sets = Math.max(1, Math.floor(ex.sets || 1));
  const sides = ex.sides === "unilateral" ? SIDES : [null];
  const out = [];
  if (SIDE_ORDER === "grouped") {
    for (const side of sides) for (let s = 0; s < sets; s++) out.push({ side, setIndex: s });
  } else {
    for (let s = 0; s < sets; s++) for (const side of sides) out.push({ side, setIndex: s });
  }
  return out.map((h) => ({ ...h, setCount: sets }));
}

/**
 * @param {{exercises: Array}} program
 * @param {{prepSeconds?: number}} [opts]
 * @returns {Step[]}
 */
export function buildSteps(program, opts = {}) {
  const prepSeconds = Math.max(0, Math.floor(opts.prepSeconds ?? DEFAULT_PREP_SECONDS));
  const steps = [];
  let prev = null;
  let holdIndex = 0;

  program.exercises.forEach((ex, exerciseIndex) => {
    for (const h of holdsForExercise(ex)) {
      const hold = {
        kind: "hold",
        exerciseIndex,
        name: ex.name,
        side: h.side,
        setIndex: h.setIndex,
        setCount: h.setCount,
        seconds: Math.max(1, Math.round(ex.duration_seconds)),
        notes: (ex.notes || "").trim(),
        holdIndex,
      };
      const changed = !prev || prev.exerciseIndex !== exerciseIndex || prev.side !== hold.side;
      if (changed && prepSeconds > 0) {
        steps.push({ ...hold, kind: "prep", seconds: prepSeconds });
      }
      steps.push(hold);
      prev = hold;
      holdIndex++;
    }
  });
  return steps;
}

export function holdSteps(steps) {
  return steps.filter((s) => s.kind === "hold");
}

export function totalSeconds(steps) {
  return steps.reduce((sum, s) => sum + s.seconds, 0);
}

/** Seconds of holding only (excludes prep), per exercise — for list display. */
export function exerciseSeconds(ex) {
  const sides = ex.sides === "unilateral" ? 2 : 1;
  return sides * Math.max(1, ex.sets) * ex.duration_seconds;
}

export function formatClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDuration(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return `${m} min`;
}

/** e.g. "2 × 45 s per side" */
export function exerciseSummary(ex) {
  const per = ex.sides === "unilateral" ? " per side" : "";
  const sets = ex.sets > 1 ? `${ex.sets} × ` : "";
  return `${sets}${ex.duration_seconds} s${per}`;
}

/** Cue to play when entering `next` from `prev` (either may be undefined). */
export function transitionCue(prev, next) {
  if (!next) return "done";
  if (next.kind === "prep") return "switch";
  return "go";
}
