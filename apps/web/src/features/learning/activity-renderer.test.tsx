import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ActivityRenderer,
  type AssessmentResultView,
} from "./activity-renderer";
import type { ActivityDefinition } from "@/lib/activity-contracts";

const sampleQuiz: Extract<
  ActivityDefinition,
  { activityType: "InteractiveQuiz" }
> = {
  schemaVersion: "1.0.0",
  activityId: "quiz-chem-101",
  courseId: "course-123",
  revisionId: "rev-456",
  activityType: "InteractiveQuiz",
  title: "Stoichiometry Quick Check",
  instructions: "Select the single best answer for the reaction yield.",
  timeLimitSeconds: 300,
  presentationData: {
    activityType: "InteractiveQuiz",
    question: "What is the molar mass of water (H2O)?",
    options: [
      { id: "opt-1", label: "18.015 g/mol" },
      { id: "opt-2", label: "16.000 g/mol" },
      { id: "opt-3", label: "2.016 g/mol" },
    ],
    isMultiSelect: false,
  },
};

const sampleGuided: Extract<
  ActivityDefinition,
  { activityType: "GuidedProblem" }
> = {
  schemaVersion: "1.0.0",
  activityId: "guided-phys-201",
  courseId: "course-123",
  revisionId: "rev-456",
  activityType: "GuidedProblem",
  title: "Newton's Second Law Analysis",
  instructions: "Derive the acceleration vector step-by-step.",
  presentationData: {
    activityType: "GuidedProblem",
    problem:
      "A 5 kg block rests on an incline of 30 degrees with friction coefficient 0.2.",
    steps: [
      {
        stepId: "s1",
        prompt: "Identify the normal force acting on the block.",
      },
      {
        stepId: "s2",
        prompt: "Calculate the net parallel force along the incline.",
      },
    ],
  },
};

const sampleResult: AssessmentResultView = {
  schemaVersion: "1.0.0",
  visibility: "recipient_only",
  userId: "user-student-1",
  attemptId: "att-xyz-999",
  status: "graded",
  score: 1.0,
  isCorrect: true,
  feedback: "Spot on! The molar mass is indeed ~18 g/mol.",
  socraticHint: "Remember to sum 2 hydrogen atoms and 1 oxygen atom.",
  recommendedNextStep: {
    type: "advance",
    nextObjectiveId: "obj-chem-102",
    title: "Limiting Reactants",
  },
  evaluatedAt: "2026-10-23T20:00:00.000Z",
};

describe("ActivityRenderer - InteractiveQuiz", () => {
  it("renders quiz title, question, options and accessibility roles", () => {
    const html = renderToStaticMarkup(
      <ActivityRenderer
        activity={sampleQuiz}
        authenticatedUserId="user-student-1"
        mode="solo"
      />,
    );

    expect(html).toContain("Stoichiometry Quick Check");
    expect(html).toContain("What is the molar mass of water (H2O)?");
    expect(html).toContain("18.015 g/mol");
    expect(html).toContain("16.000 g/mol");
    expect(html).toContain("Limit: 5 min");
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('role="radio"');
    expect(html).toContain("Submit Answer");
  });

  it("renders multi-select quiz with group and checkbox roles", () => {
    const multiQuiz: Extract<
      ActivityDefinition,
      { activityType: "InteractiveQuiz" }
    > = {
      ...sampleQuiz,
      presentationData: {
        ...sampleQuiz.presentationData,
        isMultiSelect: true,
      },
    };

    const html = renderToStaticMarkup(
      <ActivityRenderer
        activity={multiQuiz}
        authenticatedUserId="user-student-1"
        mode="solo"
      />,
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('role="checkbox"');
  });

  it("escapes malicious scripts in quiz questions and options (zero HTML injection)", () => {
    const maliciousQuiz: Extract<
      ActivityDefinition,
      { activityType: "InteractiveQuiz" }
    > = {
      ...sampleQuiz,
      title: '<script>alert("pwned-title")</script>',
      instructions: '<img src=x onerror="alert(1)">',
      presentationData: {
        ...sampleQuiz.presentationData,
        question: '<b onmouseover="alert(2)">Danger Question</b>',
        options: [{ id: "opt-x", label: '<script>eval("evil")</script>' }],
      },
    };

    const html = renderToStaticMarkup(
      <ActivityRenderer
        activity={maliciousQuiz}
        authenticatedUserId="user-student-1"
        mode="solo"
      />,
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert");
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("&lt;b onmouseover=");
  });

  it("disables submission buttons in preview mode", () => {
    const html = renderToStaticMarkup(
      <ActivityRenderer
        activity={sampleQuiz}
        authenticatedUserId="user-instructor-1"
        mode="preview"
      />,
    );

    expect(html).not.toContain("Submit Answer");
    expect(html).toContain("disabled");
  });
});

describe("ActivityRenderer - GuidedProblem", () => {
  it("renders guided problem scenarios, step prompts, and input textareas", () => {
    const html = renderToStaticMarkup(
      <ActivityRenderer
        activity={sampleGuided}
        authenticatedUserId="user-student-1"
        mode="solo"
      />,
    );

    expect(html).toContain("Newton&#x27;s Second Law Analysis");
    expect(html).toContain("2 Steps");
    expect(html).toContain("A 5 kg block rests on an incline");
    expect(html).toContain("Step 1");
    expect(html).toContain("Identify the normal force acting on the block.");
    expect(html).toContain("Step 2");
    expect(html).toContain(
      "Calculate the net parallel force along the incline.",
    );
    expect(html).toContain("Submit Steps for Feedback");
  });
});

describe("ActivityRenderer - Privacy Isolation & Feedback Handling", () => {
  it("renders assessment feedback and hints in solo mode when initialResult is provided", () => {
    const html = renderToStaticMarkup(
      <ActivityRenderer
        activity={sampleQuiz}
        authenticatedUserId="user-student-1"
        initialResult={sampleResult}
        mode="solo"
      />,
    );

    expect(html).toContain("Correct");
    expect(html).toContain("Score: 100%");
    expect(html).toContain("Spot on! The molar mass is indeed ~18 g/mol.");
    expect(html).toContain("Pedagogical Socratic Hint:");
    expect(html).toContain(
      "Remember to sum 2 hydrogen atoms and 1 oxygen atom.",
    );
    expect(html).toContain("Recommended Next Step:");
    expect(html).toContain("Limiting Reactants");
    expect(html).toContain("Try Again");
  });

  it("shows authenticated recipient feedback locally in room mode", () => {
    const html = renderToStaticMarkup(
      <ActivityRenderer
        activity={sampleQuiz}
        authenticatedUserId="user-student-1"
        initialResult={sampleResult}
        mode="room"
      />,
    );

    expect(html).toContain("Spot on! The molar mass is indeed ~18 g/mol.");
    expect(html).toContain("Private feedback.");
    const peerHtml = renderToStaticMarkup(
      <ActivityRenderer
        activity={sampleQuiz}
        authenticatedUserId="different-recipient"
        initialResult={sampleResult}
        mode="room"
      />,
    );
    expect(peerHtml).not.toContain("Spot on!");
    expect(peerHtml).not.toContain("Score: 100%");
  });

  it("renders safe fallback card without error for unsupported or legacy activity types", () => {
    const unknownActivity = {
      schemaVersion: "1.0.0",
      activityId: "unknown-act-1",
      courseId: "course-123",
      revisionId: "rev-456",
      activityType: "LegacyFlashcards" as unknown as "InteractiveQuiz",
      title: "Flashcard Deck",
      instructions: "Review these terms carefully.",
      presentationData: {} as unknown as ActivityDefinition["presentationData"],
    };

    const html = renderToStaticMarkup(
      <ActivityRenderer
        activity={unknownActivity}
        authenticatedUserId="user-student-1"
        mode="solo"
      />,
    );

    expect(html).toContain("Unsupported Activity Type");
    expect(html).toContain("This activity cannot be rendered interactively.");
    expect(html).toContain("Review these terms carefully.");
  });

  it("ED-16-A001 & ED-16-A002: preserves canonical mathematical formulas, code tokens and source quotes across multilingual RTL layouts", () => {
    const formulaQuiz: Extract<
      ActivityDefinition,
      { activityType: "InteractiveQuiz" }
    > = {
      ...sampleQuiz,
      title: "Complexity of Binary Search / تحليل التعقيد",
      instructions: "Identify the asymptotic time complexity / حدد التعقيد الزمني",
      presentationData: {
        activityType: "InteractiveQuiz",
        question: "What is the worst-case runtime complexity T(n) / ما هو التعقيد الزمني لـ O(log n)?",
        options: [
          { id: "opt-1", label: "O(log n) logarithmic time" },
          { id: "opt-2", label: "O(n) linear scan" },
          { id: "opt-3", label: "O(1) constant lookup" },
        ],
        isMultiSelect: false,
      },
    };

    // Render in RTL container (Arabic/Darija context)
    const rtlHtml = renderToStaticMarkup(
      <div dir="rtl" lang="ar">
        <ActivityRenderer
          activity={formulaQuiz}
          authenticatedUserId="user-student-1"
          mode="solo"
        />
      </div>,
    );

    // Assert exact formula preservation without entity corruption
    expect(rtlHtml).toContain("T(n)");
    expect(rtlHtml).toContain("O(log n)");
    expect(rtlHtml).toContain("O(n)");
    expect(rtlHtml).toContain("O(1)");
    // Assert both languages / source meaning remain preserved
    expect(rtlHtml).toContain("تحليل التعقيد");
    expect(rtlHtml).toContain("حدد التعقيد الزمني");
    expect(rtlHtml).toContain("Complexity of Binary Search");
  });
});
