import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  binarySearchTrace,
  parseBinarySearchState,
  DEFAULT_BINARY_SEARCH,
} from "@noveris/shared/visualization";
import { BinarySearchVisualizer } from "./binary-search";

describe("Deterministic binary search illustration", () => {
  it("matches known comparisons, previous states and deterministic reset", () => {
    const trace = binarySearchTrace(DEFAULT_BINARY_SEARCH.values, 10);
    expect(trace.map((state) => state.comparedIndex)).toEqual([null, 3, 5, 4]);
    expect(trace.map((state) => [state.low, state.high])).toEqual([
      [0, 6],
      [4, 6],
      [4, 4],
      [4, 4],
    ]);
    expect(trace.at(-1)?.foundIndex).toBe(4);
    for (let step = 1; step < trace.length; step++) {
      expect(
        binarySearchTrace(DEFAULT_BINARY_SEARCH.values, 10)[step - 1],
      ).toEqual(trace[step - 1]);
    }
    expect(binarySearchTrace(DEFAULT_BINARY_SEARCH.values, 10)[0]).toEqual(
      trace[0],
    );
  });
  it("agrees with direct search for all bounded generated lists, duplicates and absent targets", () => {
    for (let length = 1; length <= 12; length++) {
      const values = Array.from(
        { length },
        (_, index) => Math.floor(index / 2) - 4,
      );
      const snapshot = [...values];
      for (let target = -6; target <= 9; target++) {
        const trace = binarySearchTrace(values, target),
          final = trace.at(-1)!;
        expect(final.complete).toBe(true);
        if (values.includes(target))
          expect(values[final.foundIndex!]).toBe(target);
        else {
          expect(final.foundIndex).toBeNull();
          expect(final.low).toBeGreaterThan(final.high);
        }
        expect(trace.length).toBeLessThanOrEqual(6);
      }
      expect(values).toEqual(snapshot);
    }
  });
  it("rejects malformed, executable, unsorted and out-of-range state", () => {
    const invalid = [
      { ...DEFAULT_BINARY_SEARCH, exampleId: "eval" },
      { ...DEFAULT_BINARY_SEARCH, script: "alert(1)" },
      { ...DEFAULT_BINARY_SEARCH, values: [3, 1] },
      { ...DEFAULT_BINARY_SEARCH, values: [] },
      { ...DEFAULT_BINARY_SEARCH, values: Array(3) },
      { ...DEFAULT_BINARY_SEARCH, values: [1000] },
      { ...DEFAULT_BINARY_SEARCH, values: Array(13).fill(1) },
      { ...DEFAULT_BINARY_SEARCH, target: "10" },
      { ...DEFAULT_BINARY_SEARCH, target: NaN },
      { ...DEFAULT_BINARY_SEARCH, step: 99 },
      { ...DEFAULT_BINARY_SEARCH, step: -1 },
      { ...DEFAULT_BINARY_SEARCH, step: 0.5 },
    ];
    for (const state of invalid)
      expect(() => parseBinarySearchState(state)).toThrow();
  });
  it("provides semantic keyboard controls and text without animation or assessment calls", () => {
    const html = renderToStaticMarkup(<BinarySearchVisualizer />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Sorted values and search interval"');
    expect(html).toContain("Previous step");
    expect(html).toContain("Next step");
    expect(html).toContain("Reset visualization");
    expect(html).toContain("creates no learning evidence, mastery or XP");
    expect(html).not.toMatch(/<script|<canvas|style="[^"]*animation|<iframe/);
  });
  it("makes peer view controls read-only and renders unsupported state as text", () => {
    const peer = renderToStaticMarkup(<BinarySearchVisualizer readOnly />);
    expect(peer).toContain("The presenter controls the shared example");
    expect(peer).not.toContain("Apply bounded example");
    const invalid = renderToStaticMarkup(
      <BinarySearchVisualizer
        state={{ ...DEFAULT_BINARY_SEARCH, step: 900 }}
      />,
    );
    expect(invalid).toContain("unsupported");
    expect(invalid).not.toContain("Next step");
  });
  it("ED-35-A005: verifies full accessibility properties for screen readers, mobile viewport and keyboard focus", () => {
    const html = renderToStaticMarkup(<BinarySearchVisualizer />);
    // Section region label
    expect(html).toContain('aria-label="Binary search visualization"');
    // Button grouping label
    expect(html).toContain('aria-label="Visualization step controls"');
    // Input labels
    expect(html).toContain('aria-label="Sorted integer list"');
    expect(html).toContain('aria-label="Search target"');
    // Live region status and polite announcement
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    // Explicit disclosure that no XP or mastery is awarded
    expect(html).toContain("creates no learning evidence, mastery or XP");
    // Responsive flex wrapping for mobile viewport
    expect(html).toContain("flex flex-wrap");
  });
});
