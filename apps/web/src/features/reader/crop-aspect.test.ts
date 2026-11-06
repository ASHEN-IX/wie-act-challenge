import { describe, expect, it } from "vitest";
import { cropAspect } from "./crop-aspect";

describe("crop aspect reservation", () => {
  it("derives an aspect ratio from a normal bounding box", () => {
    // 460 wide by 60 tall.
    const result = cropAspect([40, 60, 500, 120]);
    expect(result.reserved).toBe(true);
    expect(result.ratio).toBe("7.667");
  });

  it("is symmetric in the corner order", () => {
    expect(cropAspect([500, 120, 40, 60]).ratio).toBe(cropAspect([40, 60, 500, 120]).ratio);
  });

  it("does not reserve for a degenerate box", () => {
    expect(cropAspect([10, 10, 10, 10]).reserved).toBe(false);
    expect(cropAspect([10, 10, 10.5, 10]).reserved).toBe(false);
    expect(cropAspect([10, 10, 10, 10.5]).reserved).toBe(false);
  });

  it("does not reserve for a malformed box", () => {
    expect(cropAspect(undefined).reserved).toBe(false);
    expect(cropAspect([1, 2, 3]).reserved).toBe(false);
    expect(cropAspect([1, 2, 3, "4"]).reserved).toBe(false);
    expect(cropAspect([1, 2, 3, Number.NaN]).reserved).toBe(false);
    expect(cropAspect([1, 2, 3, Number.POSITIVE_INFINITY]).reserved).toBe(false);
    expect(cropAspect("box").reserved).toBe(false);
  });

  it("rejects an implausible ratio rather than reserving a broken box", () => {
    expect(cropAspect([0, 0, 100_000, 1]).reserved).toBe(false);
    expect(cropAspect([0, 0, 1, 100_000]).reserved).toBe(false);
    // Beyond the documented sanity bounds.
    expect(cropAspect([0, 0, 1000, 1]).reserved).toBe(false);
  });

  it("accepts a wide but plausible crop", () => {
    const result = cropAspect([0, 0, 800, 100]);
    expect(result.reserved).toBe(true);
    expect(result.ratio).toBe("8.000");
  });

  it("is deterministic", () => {
    const box = [12, 34, 560, 90];
    expect(cropAspect(box)).toEqual(cropAspect(box));
  });
});
