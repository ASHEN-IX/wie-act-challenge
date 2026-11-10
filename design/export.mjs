#!/usr/bin/env node
/**
 * Renders every board to design/exports/ at 1x.
 *
 * Exports by root node rather than by page: the Logo and Components pages also
 * hold their main components on the canvas, which would otherwise widen the
 * export bounds.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";

const DIR = new URL(".", import.meta.url).pathname;
const FILE = `${DIR}design.figcraft`;
const OUT = `${DIR}exports/`;

mkdirSync(OUT, { recursive: true });

// Board order defines both the page name and the export filename's slug.
const BOARDS = [
  ["01 · Colour", "01-Colour"],
  ["02 · Typography", "02-Typography"],
  ["03 · Space & surface", "03-Space-surface"],
  ["04 · Layout", "04-Layout"],
  ["05 · Logo", "05-Logo"],
  ["06 · Components", "06-Components"],
  ["07 · Post 1:1", "07-Post-1x1"],
  ["08 · Badge 1:1", "08-Badge-1x1"],
  ["09 · Story 9:16", "09-Story-9x16"],
  ["10 · Link card", "10-Link-card"],
  ["11 · Wide 4:5", "11-Wide-4x5"],
  ["12 · Slide 16:9", "12-Slide-16x9"],
  ["13 · Badge set", "13-Badge-set"],
];

// The root frame's name is the page name with dots and spaces turned to dashes.
const rootName = (page) => `${page.replace(/\./g, "-").replace(/\s+/g, "-")}/root`;

const only = process.argv[2];
let failures = 0;

for (const [page, slug] of BOARDS) {
  if (only && !slug.includes(only)) continue;
  try {
    execFileSync(
      "figcraft-cli",
      ["export", FILE, "--page", page, "--node", rootName(page), "--out", `${OUT}${slug}.png`, "--scale", "1"],
      { stdio: "pipe" },
    );
    console.log(`✓ ${slug}.png`);
  } catch (error) {
    failures++;
    console.error(`✗ ${slug}: ${error.stderr?.toString().trim() ?? error.message}`);
  }
}

if (failures) process.exit(1);
