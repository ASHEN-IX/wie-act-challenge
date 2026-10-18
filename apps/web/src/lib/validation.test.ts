import { describe, expect, it } from "vitest";
import { text, optionalText, integer, choice } from "./validation";
const form = (value: string) => {
  const data = new FormData();
  data.set("value", value);
  return data;
};
describe("Server Action input boundaries", () => {
  it("rejects empty and oversized text", () => {
    expect(() => text(form(" "), "value")).toThrow();
    expect(() => text(form("abcd"), "value", 3)).toThrow();
  });
  it("normalizes valid text without accepting files", () => {
    expect(text(form(" hello "), "value")).toBe("hello");
    const data = new FormData();
    data.set("value", new Blob(["x"]), "x.txt");
    expect(() => text(data, "value")).toThrow();
  });
  it("validates finite bounded integers", () => {
    for (const value of ["NaN", "Infinity", "1.5", "0", "601"])
      expect(() => integer(form(value), "value", 1, 600)).toThrow();
    expect(integer(form("30"), "value", 1, 600)).toBe(30);
  });
  it("accepts only declared enums", () => {
    expect(choice(form("low"), "value", ["low", "high"])).toBe("low");
    expect(() => choice(form("admin"), "value", ["low", "high"])).toThrow();
  });
  it("keeps optional text bounded", () => {
    expect(optionalText(new FormData(), "value")).toBe("");
    expect(() => optionalText(form("abcd"), "value", 3)).toThrow();
  });
});
