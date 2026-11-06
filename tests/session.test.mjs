// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRAMS, getProgram } from "../js/data.js";
import { buildSteps, holdSteps, totalSeconds, formatClock, exerciseSummary } from "../js/session.js";

const A = getProgram("set-a");
const B = getProgram("set-b");

const expectedHolds = (p) =>
  p.exercises.reduce((n, ex) => n + ex.sets * (ex.sides === "unilateral" ? 2 : 1), 0);
const expectedHoldSeconds = (p) =>
  p.exercises.reduce((n, ex) => n + ex.sets * (ex.sides === "unilateral" ? 2 : 1) * ex.duration_seconds, 0);

test("programs have unique ids and valid exercises", () => {
  const ids = PROGRAMS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PROGRAMS) {
    assert.ok(p.exercises.length > 0);
    for (const ex of p.exercises) {
      assert.ok(["bilateral", "unilateral"].includes(ex.sides), ex.name);
      assert.ok(Number.isInteger(ex.sets) && ex.sets > 0, ex.name);
      assert.ok(ex.duration_seconds > 0, ex.name);
    }
  }
});

test("seed data matches the spec", () => {
  assert.equal(A.exercises.length, 9);
  assert.equal(B.exercises.length, 10);
  assert.equal(expectedHolds(A), 27);
  assert.equal(expectedHoldSeconds(A), 843);
  assert.equal(expectedHoldSeconds(B), 843);
});

test("Set A expands to 27 hold steps totalling 843 s", () => {
  const holds = holdSteps(buildSteps(A, { prepSeconds: 5 }));
  assert.equal(holds.length, 27);
  assert.equal(totalSeconds(holds), 843);
  holds.forEach((h, i) => assert.equal(h.holdIndex, i));
});

test("unilateral exercises alternate L/R per set and stay balanced", () => {
  const holds = holdSteps(buildSteps(A, { prepSeconds: 0 }));
  const ham = holds.filter((h) => h.name === "Hamstrings");
  assert.deepEqual(ham.map((h) => [h.setIndex, h.side]),
    [[0, "Left"], [0, "Right"], [1, "Left"], [1, "Right"]]);
  for (const p of PROGRAMS) {
    const hs = holdSteps(buildSteps(p));
    p.exercises.forEach((ex, i) => {
      const mine = hs.filter((h) => h.exerciseIndex === i);
      if (ex.sides === "unilateral") {
        assert.equal(mine.filter((h) => h.side === "Left").length, ex.sets);
        assert.equal(mine.filter((h) => h.side === "Right").length, ex.sets);
      } else {
        assert.ok(mine.every((h) => h.side === null));
      }
    });
  }
});

test("thoracic extension: 6 back-to-back 3 s reps with a single prep", () => {
  const steps = buildSteps(A, { prepSeconds: 5 });
  const idx = A.exercises.findIndex((e) => e.name === "Thoracic Extension");
  const mine = steps.filter((s) => s.exerciseIndex === idx);
  assert.deepEqual(mine.map((s) => s.kind), ["prep", "hold", "hold", "hold", "hold", "hold", "hold"]);
  assert.ok(mine.filter((s) => s.kind === "hold").every((s) => s.seconds === 3));
});

test("prep is inserted exactly when side or exercise changes", () => {
  for (const p of PROGRAMS) {
    const steps = buildSteps(p, { prepSeconds: 5 });
    assert.equal(steps[0].kind, "prep");
    let prevHold = null;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.kind !== "hold") continue;
      const changed = !prevHold || prevHold.exerciseIndex !== s.exerciseIndex || prevHold.side !== s.side;
      const hadPrep = i > 0 && steps[i - 1].kind === "prep";
      assert.equal(hadPrep, changed, `${p.id} step ${i} ${s.name} ${s.side}`);
      if (hadPrep) {
        assert.equal(steps[i - 1].seconds, 5);
        assert.equal(steps[i - 1].holdIndex, s.holdIndex);
        assert.equal(steps[i - 1].name, s.name);
      }
      prevHold = s;
    }
  }
});

test("totals include prep time; prepSeconds 0 removes all preps", () => {
  const withPrep = buildSteps(A, { prepSeconds: 5 });
  const preps = withPrep.filter((s) => s.kind === "prep").length;
  // Unilateral exercises: 2 per set (alternating), bilateral: 1.
  const expectedPreps = A.exercises.reduce((n, ex) => n + (ex.sides === "unilateral" ? 2 * ex.sets : 1), 0);
  assert.equal(preps, expectedPreps);
  assert.equal(totalSeconds(withPrep), 843 + 5 * expectedPreps);
  const none = buildSteps(A, { prepSeconds: 0 });
  assert.ok(none.every((s) => s.kind === "hold"));
  assert.equal(totalSeconds(none), 843);
});

test("formatting helpers", () => {
  assert.equal(formatClock(45), "0:45");
  assert.equal(formatClock(44.2), "0:45");
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(125), "2:05");
  assert.equal(exerciseSummary(A.exercises[0]), "2 × 45 s per side");
  assert.equal(exerciseSummary(A.exercises[5]), "45 s");
});
