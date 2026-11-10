/**
 * Foundations: colour, typography, spacing, radius, elevation.
 *
 * These boards are the reference an editor reads before drawing anything —
 * the same three-layer structure the product uses (primitive → semantic →
 * component), so a new post can be assembled without inventing values.
 */

import { Board, surface, grid, color, radius, space, stroke, type, elevation } from "../builder.mjs";
import { board, brandGradient, violetGradient, cyanVioletGradient } from "../tokens.mjs";

const SWATCH_W = 268;
const SWATCH_H = 132;

/** One labelled colour swatch: chip of the value, name, hex. */
function swatch(doc, parent, { x, y, name, token, value, w = SWATCH_W, dark = false }) {
  const card = doc.frame({
    name: `swatch/${token}`,
    x,
    y,
    width: w,
    height: SWATCH_H,
    parent,
    props: {
      ...surface({ fill: "rgba(255,255,255,0.02)", radius: radius.md }),
      layout: "vertical",
      padding: 0,
      gap: 0,
    },
  });
  doc.rect({
    name: `${token}/fill`,
    x: 0,
    y: 0,
    width: w,
    height: 74,
    parent: card,
    props: {
      fills: [value],
      cornerRadius: [radius.md, radius.md, 0, 0],
      strokes: value === color.mBg ? [stroke.hairline.color] : undefined,
      strokeWeight: 1,
    },
  });
  doc.text({
    name: `${token}/name`,
    text: name,
    x: 16,
    y: 88,
    parent: card,
    type: { ...type.small, style: "SemiBold", size: 13 },
    fill: color.mInk,
  });
  doc.text({
    name: `${token}/value`,
    text: token,
    x: 16,
    y: 108,
    parent: card,
    type: { ...type.mono, size: 11 },
    fill: color.mQuiet,
  });
  return card;
}

/** Section header used on every foundations board. */
export function sectionHead(doc, parent, { y, index, title, note }) {
  doc.text({
    name: `head/${title}/index`,
    text: index,
    x: board.pad,
    y,
    parent,
    type: { family: "Inter", style: "Bold", size: 12, lineHeight: "100%", tracking: 1.6 },
    fill: color.violetSoft,
  });
  doc.text({
    name: `head/${title}`,
    text: title,
    x: board.pad + 44,
    y: y - 12,
    parent,
    type: { ...type.h3 },
    fill: color.mInk,
  });
  if (note) {
    doc.text({
      name: `head/${title}/note`,
      text: note,
      x: board.pad + 44,
      y: y + 36,
      width: 760,
      parent,
      type: { ...type.small, size: 14 },
      fill: color.mQuiet,
    });
  }
}

/** Colour board: the brand ramp, then dark and light semantic layers. */
export function colorBoard(doc) {
  const b = new Board(doc, "01 · Colour").at(0);
  const root = b.root({ height: 1900, gap: 0 });

  doc.text({
    name: "board/title",
    text: "Colour",
    x: board.pad,
    y: board.pad,
    parent: root,
    type: { ...type.h1 },
    fill: color.mInk,
  });
  doc.text({
    name: "board/subtitle",
    text: "The Noveris palette is one violet family over a deep navy ground, with cyan as the single accent that marks progress.",
    x: board.pad,
    y: board.pad + 96,
    width: 820,
    parent: root,
    type: { ...type.lead, size: 20 },
    fill: color.mMuted,
  });

  // ── Brand ramp ──────────────────────────────────────────────────────────
  sectionHead(doc, root, {
    y: 280,
    index: "01",
    title: "Brand ramp",
    note: "Fixed primitives. Never used directly in UI copy — the semantic layer below aliases them.",
  });

  const ramp = [
    ["Night", "brand/night", color.night],
    ["Navy", "brand/navy", color.navy],
    ["Ink", "brand/ink", color.ink],
    ["Violet 600", "brand/violet", color.violet],
    ["Violet 400", "brand/violet-soft", color.violetSoft],
    ["Violet 300", "brand/violet-light", color.violetLight],
    ["Cyan", "brand/cyan", color.cyan],
    ["Amber", "brand/amber", color.amber],
    ["Pink", "brand/pink", color.pink],
  ];
  const RAMP_W = grid.col(5);
  ramp.forEach(([name, token, value], i) => {
    swatch(doc, root, {
      x: grid.x(i % 5, 5),
      y: 370 + Math.floor(i / 5) * (SWATCH_H + 20),
      name,
      token,
      value,
      w: RAMP_W,
    });
  });

  // ── Gradients ───────────────────────────────────────────────────────────
  sectionHead(doc, root, {
    y: 720,
    index: "02",
    title: "Gradients",
    note: "Two gradients carry the brand. Orbit (violet → cyan) is for logos and emphasis; action (violet 500 → 700) is for buttons only.",
  });

  const grads = [
    ["brand/gradient · Orbit", brandGradient, "Logos, headline emphasis, progress"],
    ["brand/action · Action", violetGradient, "Primary buttons, never text"],
    ["brand/rule · Divider", cyanVioletGradient, "Reading progress, active rules"],
  ];
  const GRAD_W = grid.col(3);
  grads.forEach(([name, grad, use], i) => {
    const x = grid.x(i, 3);
    const card = doc.frame({
      name: `gradient/${name}`,
      x,
      y: 800,
      width: GRAD_W,
      height: 190,
      parent: root,
      props: surface({ fill: "rgba(255,255,255,0.02)", radius: radius.md }),
    });
    doc.rect({
      name: `${name}/ramp`,
      x: 0,
      y: 0,
      width: GRAD_W,
      height: 104,
      parent: card,
      props: { fills: [grad], cornerRadius: [radius.md, radius.md, 0, 0] },
    });
    doc.text({
      name: `${name}/label`,
      text: name,
      x: 20,
      y: 118,
      parent: card,
      type: { ...type.small, style: "SemiBold", size: 12 },
      fill: color.mInk,
    });
    doc.text({
      name: `${name}/use`,
      text: use,
      x: 20,
      y: 140,
      width: GRAD_W - 40,
      parent: card,
      type: { ...type.small, size: 12 },
      fill: color.mQuiet,
    });
  });

  // ── Dark semantic ───────────────────────────────────────────────────────
  sectionHead(doc, root, {
    y: 1070,
    index: "03",
    title: "Semantic · dark (default)",
    note: "The product's base theme. Surfaces step up in lightness; violet-tinted borders stay under 30% alpha so stacking never muddies.",
  });

  const darkSem = [
    ["Background", "background", color.night],
    ["Card", "card", color.card],
    ["Secondary", "secondary", color.secondary],
    ["Muted", "muted", color.muted],
    ["Accent", "accent", color.accent],
    ["Foreground", "foreground", color.white],
    ["Muted text", "muted-foreground", color.mutedFg],
    ["Primary", "primary", color.violet],
    ["Ring", "ring", color.violetSoft],
  ];
  const SW = grid.col(6);
  darkSem.forEach(([name, token, value], i) => {
    swatch(doc, root, {
      x: grid.x(i % 6, 6),
      y: 1160 + Math.floor(i / 6) * (SWATCH_H + 16),
      name,
      token,
      value,
      w: SW,
    });
  });

  // Border swatch needs a real surface behind it, so it gets its own row.
  const borderCard = doc.frame({
    name: "swatch/border",
    x: grid.x(3, 6),
    y: 1160 + SWATCH_H + 16,
    width: SW,
    height: SWATCH_H,
    parent: root,
    props: surface({ fill: "rgba(255,255,255,0.02)", radius: radius.md }),
  });
  doc.rect({
    name: "border/fill",
    x: 12,
    y: 12,
    width: SW - 24,
    height: 50,
    parent: borderCard,
    props: {
      fill: "rgba(123,63,242,0.10)",
      cornerRadius: radius.sm,
      strokes: [color.border],
      strokeWeight: 1,
    },
  });
  doc.text({
    name: "border/name",
    text: "Border",
    x: 16,
    y: 88,
    parent: borderCard,
    type: { ...type.small, style: "SemiBold", size: 13 },
    fill: color.mInk,
  });
  doc.text({
    name: "border/value",
    text: "violet 26%",
    x: 16,
    y: 108,
    parent: borderCard,
    type: { ...type.mono, size: 11 },
    fill: color.mQuiet,
  });

  // ── Light semantic ──────────────────────────────────────────────────────
  sectionHead(doc, root, {
    y: 1520,
    index: "04",
    title: "Semantic · light (opt-in)",
    note: "Used for print, deck handouts and light-mode screens. Primary deepens to violet 700 to hold contrast on white.",
  });

  const lightSem = [
    ["Background", "background", color.lBg],
    ["Foreground", "foreground", color.lFg],
    ["Card", "card", color.lCard],
    ["Secondary", "secondary", color.lSecondary],
    ["Muted", "muted", color.lMuted],
    ["Muted text", "muted-foreground", color.lMutedFg],
    ["Primary", "primary", color.lPrimary],
    ["Accent", "accent", color.lAccent],
  ];
  lightSem.forEach(([name, token, value], i) => {
    swatch(doc, root, {
      x: grid.x(i % 6, 6),
      y: 1610 + Math.floor(i / 6) * (SWATCH_H + 16),
      name,
      token,
      value,
      w: SW,
    });
  });

  doc.text({
    name: "board/footer",
    text: "Contrast · body text on background 12.4:1 · muted text 6.2:1 · primary on card 4.9:1 — all above WCAG AA for their size.",
    x: board.pad,
    y: 1950,
    width: 1100,
    parent: root,
    type: { ...type.small, size: 13 },
    fill: color.mQuiet,
  });

  return b;
}

/** Typography board: the scale as a specimen you can read and copy. */
export function typeBoard(doc) {
  const b = new Board(doc, "02 · Typography").at(1);
  const root = b.root({ height: 1560 });

  doc.text({
    name: "board/title",
    text: "Typography",
    x: board.pad,
    y: board.pad,
    parent: root,
    type: { ...type.h1 },
    fill: color.mInk,
  });
  doc.text({
    name: "board/subtitle",
    text: "Sora sets every heading and number. Inter sets running text, labels and captions. Two families, one hierarchy.",
    x: board.pad,
    y: board.pad + 96,
    width: 820,
    parent: root,
    type: { ...type.lead, size: 20 },
    fill: color.mMuted,
  });

  // ── Families ────────────────────────────────────────────────────────────
  sectionHead(doc, root, { y: 280, index: "01", title: "Families" });

  const families = [
    {
      x: board.pad,
      name: "Sora",
      role: "Headings · numbers · display",
      sample: "Aa",
      family: "Sora",
      style: "ExtraBold",
    },
    {
      x: board.pad + 660,
      name: "Inter",
      role: "Body · labels · UI",
      sample: "Aa",
      family: "Inter",
      style: "Regular",
    },
  ];
  families.forEach((f) => {
    const card = doc.frame({
      name: `family/${f.name}`,
      x: f.x,
      y: 356,
      width: 620,
      height: 250,
      parent: root,
      props: surface({ fill: "rgba(255,255,255,0.02)", radius: radius.lg, layout: "vertical", padding: 32, gap: 8 }),
    });
    doc.text({
      name: `${f.name}/name`,
      text: f.name,
      x: 32,
      y: 32,
      parent: card,
      type: { family: "Sora", style: "Bold", size: 22, lineHeight: "120%", tracking: -0.4 },
      fill: color.mInk,
    });
    doc.text({
      name: `${f.name}/role`,
      text: f.role,
      x: 32,
      y: 64,
      parent: card,
      type: { ...type.label, size: 11 },
      fill: color.violetSoft,
    });
    doc.text({
      name: `${f.name}/sample`,
      text: f.sample,
      x: 32,
      y: 96,
      parent: card,
      type: { family: f.family, style: f.style, size: 96, lineHeight: "100%", tracking: -3 },
      fill: color.mInk,
    });
    doc.text({
      name: `${f.name}/tokens`,
      text: `${f.family} · Regular 400 · SemiBold 600 · Bold 700`,
      x: 32,
      y: 210,
      parent: card,
      type: { ...type.mono, size: 11 },
      fill: color.mQuiet,
    });
  });

  // ── Scale ───────────────────────────────────────────────────────────────
  sectionHead(doc, root, {
    y: 700,
    index: "02",
    title: "Scale",
    note: "A 1.28 ratio at display sizes, flattening to 1.2 in body text. Tracking tightens as size grows.",
  });

  // Every sample is kept to one line so the specimen reads as a scale rather
  // than as wrapped paragraphs; the widths are the column, not the content.
  const rows = [
    ["Display", type.display, "Learn Together.", "Sora ExtraBold · 128 / 100% / −4"],
    ["H1", type.h1, "Grow Further.", "Sora ExtraBold · 76 / 104% / −2.5"],
    ["H2", type.h2, "Every course, shared", "Sora Bold · 52 / 110% / −1.6"],
    ["H3", type.h3, "Your companion grows", "Sora SemiBold · 34 / 118% / −0.8"],
    ["H4", type.h4, "Study circles, guided", "Sora SemiBold · 24 / 126% / −0.4"],
    ["Lead", type.lead, "Study with your peers, get AI guidance.", "Inter Regular · 22 / 150% / −0.2"],
    ["Body", type.body, "The space for curious university minds.", "Inter Regular · 17 / 160% / −0.1"],
    ["Small", type.small, "Captions, metadata and secondary rows.", "Inter Regular · 14 / 150% / 0"],
    ["Label", type.label, "Eyebrow · uppercase", "Inter Bold · 11 / 100% / +1.6"],
  ];

  const colX = board.pad + 220;
  const colW = board.pad + grid.width - colX;
  let y = 780;
  rows.forEach(([label_, spec, sample, metrics], i) => {
    doc.text({
      name: `scale/${label_}/tag`,
      text: label_,
      x: board.pad,
      y: y + 6,
      parent: root,
      type: { ...type.mono, size: 12 },
      fill: color.violetSoft,
    });
    doc.text({
      name: `scale/${label_}/metrics`,
      text: metrics,
      x: board.pad,
      y: y + 26,
      parent: root,
      type: { ...type.mono, size: 10 },
      fill: color.mQuiet,
    });
    doc.text({
      name: `scale/${label_}/sample`,
      text: sample,
      x: colX,
      y,
      width: colW,
      parent: root,
      type: spec,
      fill: color.mInk,
    });
    // Advance on the step's own line box plus the gutter that separates rows.
    y += Math.round(spec.size * 1.3) + 34;
    if (i < rows.length - 1) {
      doc.line({
        name: `scale/${label_}/rule`,
        x: board.pad,
        y: y - 17,
        width: grid.width,
        parent: root,
        props: { strokes: ["rgba(169,135,255,0.14)"], strokeWeight: 1 },
      });
    }
  });

  const footerY = y + 28;
  doc.text({
    name: "board/footer",
    text: "Every step exists as a shared text style (Display, Heading/H1–H4, Body/Lead–Small, Label/Eyebrow) — apply it from the Assets panel instead of retyping a size.",
    x: board.pad,
    y: footerY,
    width: grid.width,
    parent: root,
    type: { ...type.small, size: 13 },
    fill: color.mQuiet,
  });
  doc.set(root, { height: Math.round(footerY + 120) });

  return b;
}

/** Spacing, radius and elevation on one board. */
export function spaceBoard(doc) {
  const b = new Board(doc, "03 · Space & surface").at(2);
  const root = b.root({ height: 1270 });

  doc.text({
    name: "board/title",
    text: "Space & surface",
    x: board.pad,
    y: board.pad,
    parent: root,
    type: { ...type.h1 },
    fill: color.mInk,
  });
  doc.text({
    name: "board/subtitle",
    text: "An 8-point grid, four radii, three elevations. If a measurement is not on this board, it is not part of the system.",
    x: board.pad,
    y: board.pad + 96,
    width: 820,
    parent: root,
    type: { ...type.lead, size: 20 },
    fill: color.mMuted,
  });

  // ── Spacing ─────────────────────────────────────────────────────────────
  sectionHead(doc, root, { y: 280, index: "01", title: "Spacing scale", note: "4 → 120. Boards use 72 page padding, 32 card padding, 24 internal gap." });

  space.forEach((v, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = grid.pad + col * ((grid.width - 120) / 6);
    const y = 380 + row * 120;
    doc.rect({
      name: `space/${v}`,
      x,
      y,
      width: v,
      height: 28,
      parent: root,
      props: { fills: [brandGradient], cornerRadius: 3 },
    });
    doc.text({
      name: `space/${v}/label`,
      text: `${v}`,
      x,
      y: y + 40,
      parent: root,
      type: { ...type.mono, size: 12 },
      fill: color.mInk,
    });
  });

  // ── Radius ──────────────────────────────────────────────────────────────
  sectionHead(doc, root, { y: 660, index: "02", title: "Radius", note: "Cards 16 · inputs and buttons 10–12 · chips and progress pills 999." });

  const radii = [
    ["sm", radius.sm],
    ["md", radius.md],
    ["base", radius.base],
    ["lg", radius.lg],
    ["xl", radius.xl],
    ["pill", radius.pill],
  ];
  const RAD_W = grid.col(6);
  radii.forEach(([name, r], i) => {
    const x = grid.x(i, 6);
    doc.rect({
      name: `radius/${name}`,
      x,
      y: 736,
      width: RAD_W,
      height: 104,
      parent: root,
      props: {
        fills: ["rgba(123,63,242,0.14)"],
        cornerRadius: r,
        strokes: [color.violetSoft],
        strokeWeight: 1.5,
      },
    });
    doc.text({
      name: `radius/${name}/label`,
      text: name,
      x,
      y: 856,
      parent: root,
      type: { ...type.small, style: "SemiBold", size: 13 },
      fill: color.mInk,
    });
  });

  // ── Elevation ───────────────────────────────────────────────────────────
  sectionHead(doc, root, { y: 940, index: "03", title: "Elevation", note: "Shadows are violet-tinted, never neutral grey. Glow marks the one primary action on a screen." });

  const elevs = [
    ["soft", elevation.soft, "Hover · menus"],
    ["card", elevation.card, "Cards · sheets"],
    ["glow", elevation.glow, "Primary CTA"],
  ];
  const ELEV_W = grid.col(3);
  elevs.forEach(([name, eff, use], i) => {
    const x = grid.x(i, 3);
    doc.rect({
      name: `elev/${name}`,
      x,
      y: 1016,
      width: ELEV_W,
      height: 120,
      parent: root,
      props: {
        fills: [name === "glow" ? violetGradient : "rgba(255,255,255,0.04)"],
        cornerRadius: radius.lg,
        strokes: [stroke.hairline.color],
        strokeWeight: 1,
        effects: [eff],
      },
    });
    doc.text({
      name: `elev/${name}/label`,
      text: name,
      x,
      y: 1156,
      parent: root,
      type: { ...type.small, style: "SemiBold", size: 13 },
      fill: color.mInk,
    });
    doc.text({
      name: `elev/${name}/use`,
      text: use,
      x,
      y: 1178,
      parent: root,
      type: { ...type.small, size: 12 },
      fill: color.mQuiet,
    });
  });

  return b;
}

/** Layout grid and grid rules for decks, posts and print. */
export function gridBoard(doc) {
  const b = new Board(doc, "04 · Layout").at(3);
  const root = b.root({ height: 1400 });

  doc.text({
    name: "board/title",
    text: "Layout",
    x: board.pad,
    y: board.pad,
    parent: root,
    type: { ...type.h1 },
    fill: color.mInk,
  });
  doc.text({
    name: "board/subtitle",
    text: "One 12-column grid at 1296 within 72px margins. Social and print formats inherit the same column logic, so a post and a slide read as siblings.",
    x: board.pad,
    y: board.pad + 96,
    width: 860,
    parent: root,
    type: { ...type.lead, size: 20 },
    fill: color.mMuted,
  });

  // ── 12-column grid ──────────────────────────────────────────────────────
  sectionHead(doc, root, { y: 280, index: "01", title: "12 columns · 1296 content" });

  const gridY = 356;
  const contentW = grid.width;
  const colGap = 24;
  const colW = (contentW - colGap * 11) / 12;
  for (let i = 0; i < 12; i++) {
    doc.rect({
      name: `grid/col-${i + 1}`,
      x: board.pad + i * (colW + colGap),
      y: gridY,
      width: colW,
      height: 240,
      parent: root,
      props: { fills: ["rgba(123,63,242,0.16)"], cornerRadius: 4 },
    });
  }
  doc.text({
    name: "grid/caption",
    text: "1296 content · 12 × 86 columns · 24 gutters · 72 margins on 1440",
    x: board.pad,
    y: gridY + 264,
    parent: root,
    type: { ...type.mono, size: 12 },
    fill: color.mQuiet,
  });

  // ── Common splits ───────────────────────────────────────────────────────
  sectionHead(doc, root, { y: 730, index: "02", title: "Common splits", note: "Measured in columns. Never eyeball a split — pick one of these." });

  // Splits are drawn on a 7-column track so the annotation column sits inside
  // the 1200 content edge rather than running off the board.
  const splitLabelW = 200;
  const splitTrack = grid.width - splitLabelW - grid.gap;
  const splitColW = (splitTrack - colGap * 11) / 12;

  const splits = [
    ["6 / 6", "Symmetric cards", [6]],
    ["7 / 5", "Marketing hero", [7]],
    ["5 / 7", "Feature rows", [5]],
    ["4 / 4 / 4", "Three equal cards", [4, 4]],
    ["8 / 4", "Body + margin note", [8]],
  ];
  splits.forEach(([name, use, cols], i) => {
    const y = 806 + i * 54;
    let cx = board.pad + splitLabelW + grid.gap;
    const segments = [...cols, 12 - cols.reduce((a, c) => a + c, 0)];
    segments.forEach((c) => {
      const w = c * splitColW + (c - 1) * colGap;
      doc.rect({
        name: `split/${name}/${c}`,
        x: cx,
        y: y - 4,
        width: w,
        height: 40,
        parent: root,
        props: {
          fills: [i === 1 ? violetGradient : "rgba(255,255,255,0.06)"],
          cornerRadius: radius.sm,
          strokes: [stroke.hairline.color],
          strokeWeight: 1,
        },
      });
      cx += w + colGap;
    });
    doc.text({
      name: `split/${name}/name`,
      text: name,
      x: board.pad,
      y: y + 2,
      parent: root,
      type: { ...type.small, style: "SemiBold", size: 13 },
      fill: color.mInk,
    });
    doc.text({
      name: `split/${name}/use`,
      text: use,
      x: board.pad,
      y: y + 20,
      width: splitLabelW - 20,
      parent: root,
      type: { ...type.small, size: 12 },
      fill: color.mQuiet,
    });
  });

  // ── Formats ─────────────────────────────────────────────────────────────
  sectionHead(doc, root, { y: 1112, index: "03", title: "Studio formats" });

  const formats = [
    ["Square post", "1080 × 1080", "1:1"],
    ["Story / Reel", "1080 × 1920", "9:16"],
    ["Link card", "1200 × 630", "1.91:1"],
    ["Wide post", "1080 × 1350", "4:5"],
    ["Slide 16:9", "1920 × 1080", "16:9"],
    ["Cert A4", "2480 × 3508", "1:√2"],
  ];
  formats.forEach(([name, dims, ratio], i) => {
    const x = grid.x(i, 6);
    doc.text({
      name: `format/${name}`,
      text: name,
      x,
      y: 1200,
      parent: root,
      type: { ...type.small, style: "SemiBold", size: 13 },
      fill: color.mInk,
    });
    doc.text({
      name: `format/${name}/dims`,
      text: dims,
      x,
      y: 1222,
      parent: root,
      type: { ...type.mono, size: 11 },
      fill: color.violetSoft,
    });
    doc.text({
      name: `format/${name}/ratio`,
      text: ratio,
      x,
      y: 1242,
      parent: root,
      type: { ...type.mono, size: 11 },
      fill: color.mQuiet,
    });
  });

  doc.set(root, { height: 1280 });
  return b;
}

export function foundationsBoards(doc) {
  return [colorBoard(doc), typeBoard(doc), spaceBoard(doc), gridBoard(doc)];
}
