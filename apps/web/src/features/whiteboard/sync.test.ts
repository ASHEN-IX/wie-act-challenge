import { describe, expect, it } from "vitest";
import { changedSince, inBatches, remember, tombstoneAll, type KnownElements } from "./sync";

const el = (id: string, version = 1, versionNonce = 1) => ({ id, version, versionNonce });

describe("whiteboard sync tracking", () => {
  it("sends only elements that changed since last seen", () => {
    const known: KnownElements = new Map();
    remember(known, [el("a"), el("b")]);
    expect(changedSince(known, [el("a"), el("b", 2), el("c")]).map((e) => e.id)).toEqual(["b", "c"]);
  });

  it("does not echo back what the server already has", () => {
    const known: KnownElements = new Map();
    const remote = [el("a", 4, 9)];
    remember(known, remote);
    expect(changedSince(known, remote)).toEqual([]);
  });

  it("treats a changed nonce at the same version as a change", () => {
    const known: KnownElements = new Map();
    remember(known, [el("a", 1, 1)]);
    expect(changedSince(known, [el("a", 1, 2)])).toHaveLength(1);
  });

  it("splits large saves into bounded batches", () => {
    const items = Array.from({ length: 1201 }, (_, i) => i);
    const batches = inBatches(items);
    expect(batches.map((b) => b.length)).toEqual([500, 500, 201]);
  });

  it("clears by deleting live elements with a newer version", () => {
    let n = 100;
    const cleared = tombstoneAll(
      [{ ...el("a", 3), isDeleted: false }, { ...el("gone", 2), isDeleted: true }],
      () => ++n,
    );
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toMatchObject({ id: "a", isDeleted: true, version: 4, versionNonce: 101 });
  });
});
