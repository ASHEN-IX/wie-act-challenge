import { describe, expect, it } from "vitest";
import {
  ExpressionError,
  evaluateExpression,
  parseExpression,
  sampleFunction,
} from "./expression";

const value = (source: string, scope: Record<string, number> = {}) => {
  const parsed = parseExpression(source);
  return evaluateExpression(parsed.ast, scope);
};

describe("restricted mathematical expression parser", () => {
  it("evaluates arithmetic with correct precedence", () => {
    expect(value("1 + 2 * 3")).toBe(7);
    expect(value("(1 + 2) * 3")).toBe(9);
    expect(value("2 ^ 3 ^ 2")).toBe(512); // right-associative
    expect(value("-2 ^ 2")).toBe(-4); // unary binds outside power
    expect(value("10 / 4")).toBe(2.5);
    expect(value("| -3 |")).toBe(3);
  });

  it("resolves only allowlisted constants and functions", () => {
    expect(value("pi")).toBeCloseTo(Math.PI);
    expect(value("e")).toBeCloseTo(Math.E);
    expect(value("sqrt(9)")).toBe(3);
    expect(value("ln(e)")).toBeCloseTo(1);
    expect(value("cos(0)")).toBe(1);
  });

  it("binds caller-supplied variables and reports them", () => {
    const parsed = parseExpression("a * x ^ 2 + b");
    expect(parsed.variables).toEqual(["a", "b", "x"]);
    expect(evaluateExpression(parsed.ast, { a: 2, b: 1, x: 3 })).toBe(19);
  });

  it("returns null outside the domain instead of a fabricated value", () => {
    expect(value("sqrt(x)", { x: -1 })).toBeNull();
    expect(value("1 / x", { x: 0 })).toBeNull();
    expect(value("ln(x)", { x: 0 })).toBeNull();
  });

  it("never executes injected code", () => {
    for (const payload of [
      "constructor",
      "process.exit(1)",
      "eval('1+1')",
      "Function('return 1')",
      "__proto__",
      "this.alert(1)",
      "globalThis",
      "require('fs')",
      "x.constructor.constructor('return process')()",
      "import('fs')",
    ]) {
      expect(() => parseExpression(payload), payload).toThrow(ExpressionError);
    }
  });

  it("rejects non-mathematical characters outright", () => {
    expect(() => parseExpression("<script>")).toThrow(ExpressionError);
    expect(() => parseExpression("a; b")).toThrow(ExpressionError);
    expect(() => parseExpression("a = 1")).toThrow(ExpressionError);
    expect(() => parseExpression("x\ny")).toThrow(ExpressionError);
  });

  it("rejects an empty or oversized expression", () => {
    expect(() => parseExpression("")).toThrow(ExpressionError);
    expect(() => parseExpression("   ")).toThrow(ExpressionError);
    expect(() => parseExpression("1+".repeat(300) + "1")).toThrow(ExpressionError);
  });

  it("rejects unbalanced or trailing input", () => {
    expect(() => parseExpression("(1 + 2")).toThrow(ExpressionError);
    expect(() => parseExpression("1 + 2)")).toThrow(ExpressionError);
    expect(() => parseExpression("1 2")).toThrow(ExpressionError);
    expect(() => parseExpression("sqrt 9")).toThrow(ExpressionError);
  });

  it("bounds evaluation work so a hostile expression cannot hang the browser", () => {
    const parsed = parseExpression("x * x + x");
    const result = evaluateExpression(parsed.ast, { x: 2 }, { maxSteps: 2 });
    expect(result).toBeNull();
  });

  it("rejects a final value beyond the magnitude limit", () => {
    const parsed = parseExpression("x ^ 3");
    expect(evaluateExpression(parsed.ast, { x: 1e6 }, { maxMagnitude: 1e12 })).toBeNull();
  });

  it("keeps a small result whose intermediates are large", () => {
    // Regression: `1 / 2^n` passes through 2^n. Rejecting intermediates made
    // every term from n=40 onward undefined even though the value is tiny.
    const parsed = parseExpression("1 / 2 ^ n");
    for (const n of [1, 10, 39, 40, 41, 60, 100]) {
      const value = evaluateExpression(parsed.ast, { n }, {}, { steps: 0 });
      expect(value, `n=${n}`).not.toBeNull();
      expect(value!, `n=${n}`).toBeCloseTo(Math.pow(2, -n), 15);
    }
  });
});

describe("function sampling", () => {
  it("samples a continuous function and keeps domain gaps as null", () => {
    const parsed = parseExpression("sqrt(x)");
    const points = sampleFunction(parsed, { variable: "x", from: -1, to: 4, samples: 11 });
    expect(points).toHaveLength(11);
    expect(points[0].x).toBe(-1);
    expect(points[0].y).toBeNull();
    expect(points.at(-1)?.y).toBeCloseTo(2);
  });

  it("applies caller parameters", () => {
    const parsed = parseExpression("a * x");
    const points = sampleFunction(parsed, {
      variable: "x",
      from: 0,
      to: 2,
      samples: 3,
      parameters: { a: 3 },
    });
    expect(points.map((point) => point.y)).toEqual([0, 3, 6]);
  });

  it("caps the sample count regardless of the requested value", () => {
    const parsed = parseExpression("x");
    const points = sampleFunction(parsed, {
      variable: "x",
      from: 0,
      to: 1,
      samples: 1_000_000,
      maxSamples: 50,
    });
    expect(points).toHaveLength(50);
  });

  it("returns nothing for a degenerate interval", () => {
    const parsed = parseExpression("x");
    expect(sampleFunction(parsed, { variable: "x", from: 1, to: 1, samples: 10 })).toEqual([]);
    expect(
      sampleFunction(parsed, { variable: "x", from: Number.NaN, to: 1, samples: 10 }),
    ).toEqual([]);
  });
});
