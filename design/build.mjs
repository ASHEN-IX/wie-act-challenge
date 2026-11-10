#!/usr/bin/env node
/**
 * Builds design/design.figcraft — the Noveris design system.
 *
 *   node design/build.mjs [--dry-run] [--trace]
 *
 * The file is generated, never hand-edited: every board is reproducible from
 * the tokens and the builder in this folder, so the design system cannot drift
 * from apps/web. The generated .figcraft is committed; the renders in
 * design/exports/ are the reference sheet designers read.
 */

import { writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Doc } from "./builder.mjs";
import { foundationsBoards } from "./boards/foundations.mjs";
import { brandBoards } from "./boards/brand.mjs";
import { componentBoards } from "./boards/components.mjs";
import { templateBoards } from "./boards/templates.mjs";

const OUT_DIR = new URL(".", import.meta.url).pathname;
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const doc = new Doc();
const boards = [];

// Foundation pages share one semantic variable collection so a colour can be
// retargeted in one place instead of hunting swatches.
doc.raw("variable.createCollection", { name: "Semantic", modes: ["Dark", "Light"] });

boards.push(...foundationsBoards(doc));
boards.push(...brandBoards(doc));
boards.push(...componentBoards(doc));
boards.push(...templateBoards(doc));

// Shared text styles, so a designer applies the scale instead of retyping it.
// The document opens with an empty page; delete it once the boards exist so the
// file starts on board 01. (A file must always keep at least one page.)
const styles = [
  ["Display", { fontFamily: "Sora", fontStyle: "ExtraBold", fontSize: 128, lineHeight: "100%", letterSpacing: "-3.1%" }],
  ["Heading/H1", { fontFamily: "Sora", fontStyle: "ExtraBold", fontSize: 76, lineHeight: "104%", letterSpacing: "-3.3%" }],
  ["Heading/H2", { fontFamily: "Sora", fontStyle: "Bold", fontSize: 52, lineHeight: "110%", letterSpacing: "-3.1%" }],
  ["Heading/H3", { fontFamily: "Sora", fontStyle: "SemiBold", fontSize: 34, lineHeight: "118%", letterSpacing: "-2.4%" }],
  ["Heading/H4", { fontFamily: "Sora", fontStyle: "SemiBold", fontSize: 24, lineHeight: "126%", letterSpacing: "-1.7%" }],
  ["Body/Lead", { fontFamily: "Inter", fontStyle: "Regular", fontSize: 22, lineHeight: "150%", letterSpacing: "-0.9%" }],
  ["Body/Default", { fontFamily: "Inter", fontStyle: "Regular", fontSize: 17, lineHeight: "160%", letterSpacing: "-0.6%" }],
  ["Body/Strong", { fontFamily: "Inter", fontStyle: "SemiBold", fontSize: 17, lineHeight: "160%", letterSpacing: "-0.6%" }],
  ["Body/Small", { fontFamily: "Inter", fontStyle: "Regular", fontSize: 14, lineHeight: "150%", letterSpacing: "0%" }],
  ["Label/Eyebrow", { fontFamily: "Inter", fontStyle: "Bold", fontSize: 11, lineHeight: "100%", letterSpacing: "14.5%", textCase: "upper" }],
];
for (const [name, value] of styles) {
  doc.raw("style.create", { type: "text", name, value });
}

doc.raw("page.delete", { id: 1 });

// The op log is a build intermediate: it exists only for the duration of the run.
const scriptPath = `${OUT_DIR}build.script.json`;
const script = doc.ops.map(({ command, params }) => ({ command, params }));
writeFileSync(scriptPath, JSON.stringify(script));

if (args["trace"]) {
  const expected = doc.ops.map((o, i) => ({ step: i, command: o.command, expected: o.expected ?? null }));
  writeFileSync(`${OUT_DIR}build.expected.json`, JSON.stringify(expected));
}

if (!args["dry-run"]) {
  const out = `${OUT_DIR}design.figcraft`;
  try {
    execFileSync("figcraft-cli", ["run", scriptPath, "--out", out], { stdio: "inherit" });
  } finally {
    unlinkSync(scriptPath);
  }
  console.log(`wrote ${out} (${boards.length} boards, ${doc.ops.length} ops)`);
}

mkdirSync(`${OUT_DIR}exports`, { recursive: true });
