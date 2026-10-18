/* eslint-disable import/first */
import React, { StrictMode } from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import SocraticEvaluation from "../SocraticEvaluation";

const mockSubmit = vi.fn();
const mockGet = vi.fn();

vi.mock("@/services/api", () => ({
  aiAPI: {
    submitEvalStep: (...args) => mockSubmit(...args),
    getEvalJob: (...args) => mockGet(...args),
    socraticStart: vi.fn(),
    socraticAnswer: vi.fn(),
  },
}));

Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function renderEval(onComplete = vi.fn()) {
  render(
    <SocraticEvaluation
      taskTitle="Explain recursion"
      taskDescription="Describe base and recursive cases"
      onComplete={onComplete}
    />,
  );
  return onComplete;
}

function submitAnswer(text) {
  fireEvent.change(screen.getByPlaceholderText("Type your answer..."), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));
}

function completedResult(overrides = {}) {
  return {
    status: "COMPLETED",
    result: {
      state: "continue",
      mastery_score: 0.6,
      feedback: "Solid start.",
      next_question: "When does recursion stop?",
      ...overrides,
    },
  };
}

describe("SocraticEvaluation (async job API — EVAL-09)", () => {
  test("renders the task prompt as the first question, no API call on mount", () => {
    renderEval();
    expect(screen.getByText("Explain recursion")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type your answer...")).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  test("submits step 1, polls the job, and advances to the next question on CONTINUE", async () => {
    mockSubmit.mockResolvedValue({
      data: { jobId: "job-1", status: "PENDING", sessionId: "sess-1", step: 1 },
    });
    mockGet.mockResolvedValue({ data: completedResult() });
    vi.useFakeTimers();

    renderEval();
    await act(async () => {
      submitAnswer("A base case stops the recursion");
      await Promise.resolve();
    });

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.any(String),
        step: 1,
        contextId: "Explain recursion",
        studentAnswer: "A base case stops the recursion",
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText("When does recursion stop?")).toBeInTheDocument();
    expect(screen.getByText("Q2")).toBeInTheDocument();
  });

  test("polls until master confirming and completes with mastery score", async () => {
    const onComplete = vi.fn();
    mockSubmit.mockResolvedValue({
      data: { jobId: "job-2", status: "PENDING", sessionId: "sess-1", step: 1 },
    });
    mockGet.mockResolvedValue({
      data: {
        status: "COMPLETED",
        result: {
          state: "failed",
          mastery_score: 0.35,
          feedback: "Missed the base case.",
          next_question: null,
        },
      },
    });
    vi.useFakeTimers();

    renderEval(onComplete);
    await act(async () => {
      submitAnswer("Recursion repeats");
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(/Needs Review/)).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "failed",
        mastery_score: 0.35,
        questions_asked: 1,
      }),
    );
  });

  test("surfaces a failed job as an error with retry", async () => {
    mockSubmit.mockResolvedValue({
      data: { jobId: "job-3", status: "PENDING", sessionId: "sess-1", step: 1 },
    });
    mockGet.mockResolvedValue({
      data: { status: "FAILED", error: "LLM unavailable after retries" },
    });
    vi.useFakeTimers();

    renderEval();
    await act(async () => {
      submitAnswer("I do not know");
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText("LLM unavailable after retries")).toBeInTheDocument();
  });

  test("empty answer shows validation feedback and never creates a job", () => {
    renderEval();
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(screen.getByText("Please enter your answer before submitting.")).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  test("validation feedback clears once the user types", () => {
    renderEval();
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));
    expect(screen.getByText("Please enter your answer before submitting.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Type your answer..."), {
      target: { value: "Base case stops it" },
    });
    expect(screen.queryByText("Please enter your answer before submitting.")).not.toBeInTheDocument();
  });

  test("is still functional under StrictMode double-mount (ref not left dead)", async () => {
    mockSubmit.mockResolvedValue({
      data: { jobId: "job-4", status: "PENDING", sessionId: "sess-1", step: 1 },
    });
    mockGet.mockResolvedValue({ data: completedResult() });
    vi.useFakeTimers();

    render(
      <StrictMode>
        <SocraticEvaluation
          taskTitle="Explain recursion"
          taskDescription="Describe base and recursive cases"
          onComplete={() => {}}
        />
      </StrictMode>,
    );

    await act(async () => {
      submitAnswer("The base case returns without recursing");
      await Promise.resolve();
    });

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText("When does recursion stop?")).toBeInTheDocument();
  });
});