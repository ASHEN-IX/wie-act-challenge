import { describe, expect, it } from "vitest";
import { safeNext } from "./options";

describe("safeNext", () => {
  it("keeps same-origin paths, including an invitation destination", () => {
    expect(safeNext("/courses?invite=abc")).toBe("/courses?invite=abc");
  });
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "javascript:1", 5, undefined])(
    "rejects %s",
    (value) => expect(safeNext(value)).toBe("/dashboard"),
  );
});
