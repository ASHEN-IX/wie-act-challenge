import { describe, expect, it } from "vitest";
import type { LessonBlockV2 } from "@ednova/shared/ednova/learningDocumentV2";
import { parseExpression, sampleFunction } from "./math/expression";
import {
  EXPLORATIONS,
  EXPLORATION_DISCLOSURE,
  explorationsForLesson,
} from "./explorations";

const paragraph = (text: string): LessonBlockV2 => ({
  type: "paragraph",
  id: "p1",
  text,
  evidence: ["c1"],
});

const math: LessonBlockV2 = {
  type: "math",
  id: "m1",
  expression: "S_n = \\sum_{p=0}^{n} u_p",
  notation: "latex",
  review: {
    state: "accepted",
    originalExpression: "Sn",
    modelExpression: "S_n",
    reviewer: "r",
  },
};

describe("deterministic explorations", () => {
  it("matches a series lesson to a sequence exploration", () => {
    const matched = explorationsForLesson(
      [
        paragraph("Une série numérique converge lorsque ses sommes partielles convergent."),
        math,
      ],
      "Séries de fonctions",
    );
    expect(matched.some((entry) => entry.kind === "sequence")).toBe(true);
  });

  it("matches a monotone-sequence lesson to a derivation outline", () => {
    const matched = explorationsForLesson(
      [paragraph("Toute suite croissante et bornée converge."), math],
      "Suites",
    );
    expect(matched.some((entry) => entry.id === "bounded-monotone")).toBe(true);
  });

  it("offers nothing for a prose lesson with no matching concept", () => {
    const matched = explorationsForLesson(
      [paragraph("The TCP handshake establishes a connection with three messages.")],
      "Transport layer",
    );
    expect(matched).toEqual([]);
  });

  it("offers nothing to prose that merely mentions a mathematical word", () => {
    // "theorem" and "sequence" appear in ordinary writing about proofs; a
    // lesson with no formula, table or chart must not receive an interaction.
    const matched = explorationsForLesson(
      [
        paragraph(
          "A proof is a finite sequence of statements. Every theorem needs a justification, and the notion of a limit is discussed later.",
        ),
      ],
      "What a proof is",
    );
    expect(matched).toEqual([]);
  });

  it("still offers a visualisation when the lesson carries real mathematics", () => {
    const mathBlock: LessonBlockV2 = {
      type: "math",
      id: "m1",
      expression: "S_n = \\sum u_p",
      notation: "latex",
      review: {
        state: "accepted",
        originalExpression: "Sn",
        modelExpression: "S_n",
        reviewer: "r",
      },
    };
    expect(
      explorationsForLesson([paragraph("La série converge."), mathBlock], "Séries").length,
    ).toBeGreaterThan(0);
  });

  it("is order-stable and bounded", () => {
    const blocks = [
      paragraph("série series somme convergence fonction curve suite theorem"),
    ];
    const first = explorationsForLesson(blocks, "Mixed", 2);
    const second = explorationsForLesson(blocks, "Mixed", 2);
    expect(first.map((entry) => entry.id)).toEqual(second.map((entry) => entry.id));
    expect(first.length).toBeLessThanOrEqual(2);
  });

  it("keeps the disclosure explicit about provenance", () => {
    expect(EXPLORATION_DISCLOSURE).toContain("not source content");
    expect(EXPLORATION_DISCLOSURE).toContain("not instructor-reviewed");
    expect(EXPLORATION_DISCLOSURE).toContain("not a proof");
  });

  it("uses only restricted expressions that the parser actually accepts", () => {
    // The evaluator is the security boundary; every shipped expression must
    // parse and sample, rather than failing at render time.
    for (const exploration of EXPLORATIONS) {
      if (exploration.kind === "sequence") {
        const parsed = parseExpression(exploration.term);
        expect(parsed.variables.every((name) => name === "n"), exploration.term).toBe(true);
        const points = sampleFunction(parsed, {
          variable: "n",
          from: 1,
          to: 5,
          samples: 5,
        });
        expect(points.some((point) => point.y !== null), exploration.term).toBe(true);
      }
      if (exploration.kind === "function") {
        const parsed = parseExpression(exploration.expression);
        const parameters = Object.fromEntries(
          (exploration.parameters ?? []).map((parameter) => [
            parameter.name,
            parameter.defaultValue,
          ]),
        );
        const points = sampleFunction(parsed, {
          variable: exploration.variable ?? "x",
          from: exploration.domain?.from ?? -1,
          to: exploration.domain?.to ?? 1,
          samples: 9,
          parameters,
        });
        expect(points.some((point) => point.y !== null), exploration.expression).toBe(true);
      }
    }
  });

  it("freezes the exploration set so it cannot be extended at runtime", () => {
    expect(Object.isFrozen(EXPLORATIONS)).toBe(true);
  });
});
