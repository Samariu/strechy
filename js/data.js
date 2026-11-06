// Program definitions. To add a program, append an object to PROGRAMS.
// Each exercise: { name, sides: "bilateral" | "unilateral", sets, duration_seconds, notes? }
// `id` must be unique and URL-safe; it is used in routes and in saved history.

export const PROGRAMS = [
  {
    id: "set-a",
    name: "Set A – Squat / Bench / Row",
    exercises: [
      { name: "Hamstrings", sides: "unilateral", sets: 2, duration_seconds: 45,
        notes: "Standing, one leg elevated on a box/step. Keep back straight, hinge forward from the hip until you feel a stretch in the back of the raised leg. Slight knee bend, don't lock it out." },
      { name: "Glutes (Figure-4)", sides: "unilateral", sets: 2, duration_seconds: 45,
        notes: "Lying on back, ankle crossed over opposite knee, foot dorsiflexed. Reach through the triangle and pull the other thigh toward chest, keeping lower back flat on the floor — stop pulling once the pelvis tilts. Seated chair variant works too if lying down isn't giving you a stretch." },
      { name: "Hip Flexor", sides: "unilateral", sets: 1, duration_seconds: 30,
        notes: "Kneeling lunge, back knee on the ground, gently tuck the pelvis. Stop at a mild stretch — don't push to end range." },
      { name: "Adductors / Groin", sides: "unilateral", sets: 1, duration_seconds: 30,
        notes: "Seated butterfly or standing side lunge with straight leg to the side. Ease in slowly, stop immediately on any pulling sensation in the groin." },
      { name: "Pec / Shoulder", sides: "unilateral", sets: 2, duration_seconds: 30,
        notes: "Forearm against a door frame at 90°, rotate body forward until stretch is felt in the front shoulder/chest." },
      { name: "Lats (Child's Pose)", sides: "bilateral", sets: 1, duration_seconds: 45,
        notes: "Kneeling, arms extended far forward, chest sinking toward the floor." },
      { name: "Thoracic Extension", sides: "bilateral", sets: 6, duration_seconds: 3,
        notes: "Over a chair back or foam roller, extend the upper back. Controlled reps, not a static hold." },
      { name: "Calves – Gastrocnemius (straight knee)", sides: "unilateral", sets: 1, duration_seconds: 45,
        notes: "Wall lunge, back leg straight, heel down." },
      { name: "Calves – Soleus (bent knee)", sides: "unilateral", sets: 1, duration_seconds: 45,
        notes: "Same position, back knee slightly bent, heel stays down. Hold right side longer — right soleus tends to be tighter." },
    ],
  },
  {
    id: "set-b",
    name: "Set B – Squat / OHP / Deadlift",
    exercises: [
      { name: "Hamstrings", sides: "unilateral", sets: 2, duration_seconds: 45,
        notes: "Same as Set A — standing, one leg elevated, hinge from the hip." },
      { name: "Glutes (Figure-4)", sides: "unilateral", sets: 2, duration_seconds: 45,
        notes: "Same technique as Set A." },
      { name: "Hip Flexor", sides: "unilateral", sets: 1, duration_seconds: 30,
        notes: "Conservative version — mild stretch only, stop immediately if any groin pulling occurs." },
      { name: "Adductors / Groin", sides: "unilateral", sets: 1, duration_seconds: 30,
        notes: "Ease in slowly, moderate intensity, abort on any groin pulling." },
      { name: "Lats (Child's Pose)", sides: "bilateral", sets: 1, duration_seconds: 45,
        notes: "Important after deadlifts and overhead press — lats stabilize isometrically in both lifts." },
      { name: "Thoracic Extension", sides: "bilateral", sets: 6, duration_seconds: 3,
        notes: "Especially relevant for overhead press mobility." },
      { name: "Triceps – Overhead", sides: "unilateral", sets: 1, duration_seconds: 30,
        notes: "Bend one arm behind the head, use the other hand to gently press the elbow further down." },
      { name: "Shoulder – Cross-body", sides: "unilateral", sets: 1, duration_seconds: 30,
        notes: "Pull straight arm across the chest, support with the other arm." },
      { name: "Calves – Gastrocnemius (straight knee)", sides: "unilateral", sets: 1, duration_seconds: 45,
        notes: "Wall lunge, back leg straight, heel down." },
      { name: "Calves – Soleus (bent knee)", sides: "unilateral", sets: 1, duration_seconds: 45,
        notes: "Hold right side longer — right soleus tends to be tighter." },
    ],
  },
];

export function getProgram(id) {
  return PROGRAMS.find((p) => p.id === id) || null;
}
