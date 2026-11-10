import { describe, it, expect } from "vitest";
import type { LessonBlockV2 } from "@noveris/shared/ednova/learningDocumentV2";
import { structureLesson, clean, splitConceptTitle } from "./lesson-structure";

let n = 0;
const p = (text: string, extra: object = {}): LessonBlockV2 =>
  ({ type: "paragraph", id: `p${n++}`, text, evidence: [`c${n}`], ...extra }) as LessonBlockV2;
const callout = (kind: string, title: string, text = ""): LessonBlockV2 =>
  ({ type: "callout", id: `k${n++}`, kind, title, text, evidence: [] }) as LessonBlockV2;
const math = (): LessonBlockV2 =>
  ({ type: "math", id: `m${n++}`, expression: "x", notation: "plain", evidence: [] }) as LessonBlockV2;
const filler = (label: string) => p(`${label} ${"Une phrase complète qui explique le sujet avec assez de mots. ".repeat(5)}`);

describe("structureLesson", () => {
  it("merges one-line-per-block extraction into sentences and keeps the text", () => {
    const { steps } = structureLesson(
      [p("La suite converge"), p("vers la fonction f sur I."), p("Cette définition appelle des remarques.")],
      "Lesson",
    );
    const prose = steps[0].items.filter((i) => i.kind === "prose");
    expect(prose.map((i) => (i as { text: string }).text)).toEqual([
      "La suite converge vers la fonction f sur I.",
      "Cette définition appelle des remarques.",
    ]);
  });

  it("hides page furniture and counts it, never touching real sentences", () => {
    const blocks = [
      p("Année 2026/2027"), filler("Intro."), p("Année 2026/2027"), p("12"),
      p("Plan . . . . . . . . . . . . . . . 7"), filler("Suite."), p("Année 2026/2027"),
    ];
    const { steps, omitted } = structureLesson(blocks, "Lesson");
    expect(omitted).toBe(5);
    expect(JSON.stringify(steps)).not.toContain("Année");
    expect(JSON.stringify(steps)).toContain("Intro.");
  });

  it("turns paragraph-shaped headings into groups and steps", () => {
    const { steps } = structureLesson(
      [
        p("I | Suites de fonctions"),
        p("A – Modes de convergence"), filler("Un."),
        p("B – Théorèmes"), filler("Deux."),
        p("II | Séries de fonctions"), filler("Trois."),
      ],
      "Lesson",
    );
    expect(steps.map((s) => [s.group, s.title])).toEqual([
      ["I · Suites de fonctions", "Modes de convergence"],
      ["I · Suites de fonctions", "Théorèmes"],
      ["II · Séries de fonctions", "Séries de fonctions"],
    ]);
    expect(new Set(steps.map((s) => s.id)).size).toBe(3);
  });

  it("folds a tiny title page into the next step instead of showing a near-empty screen", () => {
    const { steps } = structureLesson(
      [p("MATHÉMATIQUES"), p("A – Début"), filler("Corps.")],
      "Lesson",
    );
    expect(steps).toHaveLength(1);
    expect(JSON.stringify(steps[0].items)).toContain("MATHÉMATIQUES");
  });

  it("attaches the statement to a title-only exercise and counts concepts", () => {
    const { steps } = structureLesson(
      [
        callout("definition", "Définition 8.1 : Convergence simple", "On dit que la suite converge simplement vers f."),
        callout("exercise", "Exercice 1"),
        p("Étudier la convergence"), p("simple de la suite."), math(),
        filler("Après l'exercice."),
        callout("example", "Exemple"), p("Considérons une suite."), filler("Détail de l'exemple."),
      ],
      "Lesson",
    );
    const [step] = steps;
    const exercise = step.items.find((i) => i.kind === "concept" && i.conceptKind === "exercise");
    expect(exercise && exercise.kind === "concept" && exercise.body).toHaveLength(2);
    expect(step.counts).toMatchObject({ definitions: 1, exercises: 1, examples: 1 });
    expect(step.concepts[0].title).toBe("Définition 8.1 : Convergence simple");
  });

  it("splits an oversized unstructured lesson into parts at paragraph boundaries", () => {
    const blocks = Array.from({ length: 30 }, (_, i) => filler(`Paragraphe ${i}.`));
    const { steps } = structureLesson(blocks, "Long");
    expect(steps.length).toBeGreaterThan(1);
    expect(steps[0].title).toMatch(/Long \(1\/\d+\)/);
    expect(steps.flatMap((s) => s.items).length).toBe(30);
  });

  it("drops generic extractor headings and the generated objective echo", () => {
    const { steps } = structureLesson(
      [
        { type: "heading", id: "h", level: 2, text: "Course source" } as LessonBlockV2,
        callout("note", "Learning objective", "Explain the main ideas."),
        filler("Vrai contenu."),
      ],
      "Lesson",
    );
    expect(JSON.stringify(steps)).not.toContain("Course source");
    expect(JSON.stringify(steps)).not.toContain("Learning objective");
  });

  it("strips PDF control characters", () => {
    expect(clean("On dit \u0001 que")).toBe("On dit que");
  });

  it("moves the printed title of a definition out of its body", () => {
    expect(splitConceptTitle("Definition", "Définition 8.1 : Convergence simple On dit que la suite converge.")).toEqual({
      title: "Définition 8.1 : Convergence simple",
      text: "On dit que la suite converge.",
    });
    expect(splitConceptTitle("Theorem", "Théorème 8.6 Soit (fn) une suite continue.")).toEqual({
      title: "Théorème 8.6",
      text: "Soit (fn) une suite continue.",
    });
    expect(splitConceptTitle("Note", "Texte libre sans numéro.")).toEqual({ title: "Note", text: "Texte libre sans numéro." });
  });
});
