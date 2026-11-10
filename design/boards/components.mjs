/**
 * Components: buttons, inputs, cards, chips, the stage badge system, and the
 * mascot scale.
 *
 * Every component here exists as a main component on the page canvas, so a post
 * or deck drags an instance instead of rebuilding a button by hand.
 */

import { Board, surface, grid, symbolComponent, color, radius, type, elevation } from "../builder.mjs";
import { board, brand, violetGradient, brandGradient, stages, mascot } from "../tokens.mjs";

function head(doc, root, { y, index, title, x = board.pad, note }) {
  doc.text({
    name: `head/${title}/index`,
    text: index,
    x,
    y,
    parent: root,
    type: { ...type.label, family: "Inter", style: "Bold", size: 12, tracking: 1.6 },
    fill: color.violetSoft,
  });
  doc.text({
    name: `head/${title}`,
    text: title,
    x: x + 44,
    y: y - 12,
    parent: root,
    type: { ...type.h3 },
    fill: color.mInk,
  });
  if (note) {
    doc.text({
      name: `head/${title}/note`,
      text: note,
      x: x + 44,
      y: y + 36,
      width: grid.width - 44,
      parent: root,
      type: { ...type.small, size: 14 },
      fill: color.mQuiet,
    });
  }
}

/** A button: `variant` picks fill, text colour and border from the system. */
function button(doc, parent, b, { x, y, label, variant = "primary", icon = false }) {
  const pad = variant === "primary" ? [0, 26] : [0, 24];
  const h = 48;
  const w = label.length * (variant === "primary" ? 8.6 : 8.2) + (icon ? 58 : 46);
  const styles = {
    primary: {
      props: {
        fills: [violetGradient],
        strokes: ["#B48CFF"],
        strokeWeight: 1,
        cornerRadius: radius.base,
        effects: [elevation.glow],
      },
      text: "#FFFFFF",
    },
    secondary: {
      props: {
        fills: ["rgba(255,255,255,0.035)"],
        strokes: ["rgba(213,204,255,0.68)"],
        strokeWeight: 1,
        cornerRadius: radius.base,
      },
      text: "#FFFFFF",
    },
    ghost: {
      props: { fills: ["rgba(255,255,255,0.04)"], cornerRadius: radius.base },
      text: color.mInk,
    },
    light: {
      props: {
        fills: ["#FFFFFF"],
        strokes: ["#FFFFFF"],
        strokeWeight: 1,
        cornerRadius: radius.base,
        effects: [elevation.soft],
      },
      text: color.ink,
    },
    disabled: {
      props: {
        fills: ["rgba(169,135,255,0.16)"],
        strokes: ["rgba(169,135,255,0.20)"],
        strokeWeight: 1,
        cornerRadius: radius.base,
      },
      text: "rgba(247,249,255,0.45)",
    },
  }[variant];

  const id = b.frame({
    name: `button/${variant}/${label}`,
    x,
    y,
    width: w,
    height: h,
    parent,
    props: {
      ...styles.props,
      layout: "horizontal",
      padding: pad,
      gap: 10,
      mainAlign: "center",
      crossAlign: "center",
      sizingH: "hug",
    },
  });
  doc.text({
    name: `button/${variant}/label`,
    text: label,
    x: 0,
    y: 0,
    parent: id,
    type: { family: "Inter", style: "SemiBold", size: 14, lineHeight: "100%", tracking: -0.1 },
    fill: styles.text,
  });
  return id;
}

/** A stage badge: the product's five-step growth system as a reusable chip. */
function stageBadge(doc, b, parent, { x, y, stage, active, size = "md" }) {
  const dims = size === "lg" ? { w: 264, h: 92 } : { w: 170, h: 56 };
  const id = b.frame({
    name: `badge/${stage.id}${active ? "/active" : ""}`,
    x,
    y,
    width: dims.w,
    height: dims.h,
    parent,
    // Placed absolutely: auto layout would recompute the dot and the two-line
    // label against each other and squeeze the threshold under the name.
    props: {
      fills: [active ? "rgba(123,63,242,0.20)" : "rgba(255,255,255,0.035)"],
      strokes: [active ? stage.accent : "rgba(178,147,255,0.24)"],
      strokeWeight: active ? 1.5 : 1,
      cornerRadius: radius.pill,
      clipsContent: false,
    },
  });
  // A dot carries the stage accent so the badge reads at thumbnail size.
  doc.ellipse({
    name: `badge/${stage.id}/dot`,
    x: size === "lg" ? 20 : 18,
    y: dims.h / 2 - (size === "lg" ? 7 : 5),
    width: size === "lg" ? 14 : 10,
    height: size === "lg" ? 14 : 10,
    parent: id,
    props: { fills: [stage.accent] },
  });
  doc.text({
    name: `badge/${stage.id}/name`,
    text: stage.name,
    x: size === "lg" ? 46 : 38,
    y: size === "lg" ? 22 : 16,
    parent: id,
    type: {
      family: "Sora",
      style: "SemiBold",
      size: size === "lg" ? 20 : 15,
      lineHeight: "100%",
      tracking: -0.3,
    },
    fill: active ? color.mInk : color.mMuted,
  });
  if (size === "lg") {
    doc.text({
      name: `badge/${stage.id}/threshold`,
      text: stage.threshold,
      x: 46,
      y: 54,
      width: dims.w - 66,
      parent: id,
      type: { ...type.small, size: 11 },
      fill: color.mQuiet,
    });
  }
  return id;
}

export function componentBoards(doc) {
  const b = new Board(doc, "06 · Components").at(5);
  const root = b.root({ height: 2340 });

  doc.text({
    name: "board/title",
    text: "Components",
    x: board.pad,
    y: board.pad,
    parent: root,
    type: { ...type.h1 },
    fill: color.mInk,
  });
  doc.text({
    name: "board/subtitle",
    text: "Assembled from the tokens, not eyeballed. Each component below is a main component on this page — drag an instance into a post, slide or certificate.",
    x: board.pad,
    y: board.pad + 96,
    width: 900,
    parent: root,
    type: { ...type.lead, size: 20 },
    fill: color.mMuted,
  });

  // ── Buttons ─────────────────────────────────────────────────────────────
  head(doc, root, {
    y: 280,
    index: "01",
    title: "Buttons",
    note: "One primary action per surface. Height 48, radius 12, label Inter SemiBold 14.",
  });

  const variants = ["primary", "secondary", "ghost", "light", "disabled"];
  let bx = board.pad;
  variants.forEach((v) => {
    const id = button(doc, root, b, {
      x: bx,
      y: 366,
      label: v === "primary" ? "Start learning" : v === "disabled" ? "Unavailable" : v[0].toUpperCase() + v.slice(1),
      variant: v,
    });
    bx += (v === "primary" ? 220 : 190);
    return id;
  });

  doc.text({
    name: "button/state-note",
    text: "Hover · brightness 110% + shadow grows · Active · 1px down · Focus · 3px cyan ring at 50%",
    x: board.pad,
    y: 432,
    parent: root,
    type: { ...type.small, size: 13 },
    fill: color.mQuiet,
  });

  // ── Chips ───────────────────────────────────────────────────────────────
  head(doc, root, { y: 520, index: "02", title: "Chips & fields" });

  const chips = ["Peer learning", "AI guidance", "Progress", "Darija · FR · EN"];
  let cx = board.pad;
  chips.forEach((c) => {
    const w = c.length * 8 + 44;
    const id = b.frame({
      name: `chip/${c}`,
      x: cx,
      y: 596,
      width: w,
      height: 34,
      parent: root,
      props: {
        fills: ["rgba(123,63,242,0.16)"],
        strokes: ["rgba(169,135,255,0.42)"],
        strokeWeight: 1,
        cornerRadius: radius.pill,
        layout: "horizontal",
        padding: [0, 16],
        mainAlign: "center",
        crossAlign: "center",
      },
    });
    doc.text({
      name: `chip/${c}/label`,
      text: c,
      x: 0,
      y: 0,
      parent: id,
      type: { family: "Inter", style: "SemiBold", size: 12, lineHeight: "100%", tracking: 0 },
      fill: color.violetSoft,
    });
    cx += w + 12;
  });

  // Input
  const input = b.frame({
    name: "field/default",
    x: board.pad,
    y: 662,
    width: grid.col(3),
    height: 76,
    parent: root,
    props: {
      fills: ["rgba(255,255,255,0.03)"],
      strokes: [color.border],
      strokeWeight: 1,
      cornerRadius: radius.md,
      layout: "vertical",
      padding: [12, 16],
      gap: 2,
    },
  });
  doc.text({
    name: "field/label",
    text: "University e-mail",
    x: 16,
    y: 12,
    parent: input,
    type: { ...type.label, size: 10, tracking: 1.4 },
    fill: color.mQuiet,
  });
  doc.text({
    name: "field/value",
    text: "you@univ.dz",
    x: 16,
    y: 32,
    parent: input,
    type: { ...type.body, size: 15 },
    fill: color.mInk,
  });

  // Focused input
  const focus = b.frame({
    name: "field/focus",
    x: grid.x(1, 3),
    y: 662,
    width: grid.col(3),
    height: 76,
    parent: root,
    props: {
      fills: ["rgba(123,63,242,0.10)"],
      strokes: [color.cyan],
      strokeWeight: 1.5,
      cornerRadius: radius.md,
      layout: "vertical",
      padding: [12, 16],
      gap: 2,
    },
  });
  doc.text({
    name: "field/focus/label",
    text: "University e-mail",
    x: 16,
    y: 12,
    parent: focus,
    type: { ...type.label, size: 10, tracking: 1.4 },
    fill: color.cyan,
  });
  doc.text({
    name: "field/focus/value",
    text: "amira@univ.dz",
    x: 16,
    y: 32,
    parent: focus,
    type: { ...type.body, size: 15 },
    fill: color.mInk,
  });

  // Progress
  doc.text({
    name: "progress/label",
    text: "Course progress",
    x: grid.x(2, 3),
    y: 662,
    parent: root,
    type: { ...type.small, style: "SemiBold", size: 13 },
    fill: color.mInk,
  });
  doc.rect({
    name: "progress/track",
    x: grid.x(2, 3),
    y: 690,
    width: grid.col(3),
    height: 8,
    parent: root,
    props: { fills: ["rgba(123,63,242,0.16)"], cornerRadius: radius.pill },
  });
  doc.rect({
    name: "progress/fill",
    x: grid.x(2, 3),
    y: 690,
    width: grid.col(3) * 0.72,
    height: 8,
    parent: root,
    props: { fills: [brandGradient], cornerRadius: radius.pill },
  });
  doc.text({
    name: "progress/value",
    text: "72% · Expert",
    x: grid.x(2, 3),
    y: 710,
    parent: root,
    type: { ...type.small, size: 12 },
    fill: color.mQuiet,
  });

  // ── Cards ───────────────────────────────────────────────────────────────
  head(doc, root, {
    y: 830,
    index: "03",
    title: "Cards",
    note: "Radius 16, 1px violet hairline at 26%, 32 padding. Shadows are violet, never neutral.",
  });

  const cards = [
    { title: "Study Circles", copy: "Study together, exchange ideas, and solve problems as a team." },
    { title: "AI Learning Guide", copy: "Get personalized explanations, practice and guidance when you need it." },
    { title: "Course Resources", copy: "Organize notes, slides, exercises and shared learning materials." },
  ];
  cards.forEach((c, i) => {
    const x = grid.x(i, 3);
    const w = grid.col(3);
    const id = b.frame({
      name: `card/${c.title}`,
      x,
      y: 910,
      width: w,
      height: 210,
      parent: root,
      props: surface({ fill: color.mSurface, radius: radius.lg }),
    });
    // A 40px icon tile with the brand gradient as a centred glyph.
    doc.rect({
      name: `card/${c.title}/icon`,
      x: 28,
      y: 28,
      width: 40,
      height: 40,
      parent: id,
      props: {
        fills: ["rgba(123,63,242,0.18)"],
        strokes: ["rgba(169,135,255,0.34)"],
        strokeWeight: 1,
        cornerRadius: radius.md,
      },
    });
    doc.ellipse({
      name: `card/${c.title}/glyph`,
      x: 42,
      y: 42,
      width: 12,
      height: 12,
      parent: id,
      props: { fills: [brandGradient] },
    });
    doc.text({
      name: `card/${c.title}/title`,
      text: c.title,
      x: 28,
      y: 92,
      parent: id,
      type: { ...type.h4, size: 21 },
      fill: color.mInk,
    });
    doc.text({
      name: `card/${c.title}/copy`,
      text: c.copy,
      x: 28,
      y: 128,
      width: w - 56,
      parent: id,
      type: { ...type.small, size: 14 },
      fill: color.mMuted,
    });
  });

  // ── Stage badges ────────────────────────────────────────────────────────
  head(doc, root, {
    y: 1210,
    index: "04",
    title: "Stage badges",
    note: "Nardouch's five growth stages. The dot carries the stage colour; the active badge takes it for the ring too.",
  });

  stages.forEach((stage, i) => {
    stageBadge(doc, b, root, { x: grid.x(i % 5, 5), y: 1290, stage, active: stage.id === "explorer" });
  });

  // Large badge, with its threshold, used on certificates and booth graphics.
  stageBadge(doc, b, root, { x: board.pad, y: 1390, stage: stages[4], active: true, size: "lg" });
  doc.text({
    name: "badge/graduate/explain",
    text: "Graduation is a real reviewed result, not a percentage: every objective check must pass. The badge is never used as decoration on a course that has not graduated.",
    x: board.pad + 288,
    y: 1404,
    width: grid.width - 288,
    parent: root,
    type: { ...type.small, size: 13 },
    fill: color.mQuiet,
  });

  // ── Mascot scale ────────────────────────────────────────────────────────
  head(doc, root, {
    y: 1550,
    index: "05",
    title: "Nardouch",
    note: "One transparent PNG per stage, 1254px source. Never recolour, crop or add a background.",
  });

  stages.forEach((stage, i) => {
    const x = grid.x(i, 5);
    const w = grid.col(5);
    const tile = b.frame({
      name: `mascot/${stage.id}`,
      x,
      y: 1626,
      width: w,
      height: 300,
      parent: root,
      props: {
        fills: ["rgba(255,255,255,0.02)"],
        strokes: ["rgba(169,135,255,0.18)"],
        strokeWeight: 1,
        cornerRadius: radius.lg,
        clip: true,
      },
    });
    // A stage-tinted glow behind the mascot, matching the product's card.
    doc.ellipse({
      name: `mascot/${stage.id}/glow`,
      x: w / 2 - 90,
      y: 118,
      width: 180,
      height: 120,
      parent: tile,
      props: { fills: [stage.accent], opacity: 0.10 },
    });
    doc.image({
      name: `mascot/${stage.id}/art`,
      path: mascot(stage.id),
      x: 20,
      y: 34,
      width: w - 40,
      height: w - 40,
      parent: tile,
      mode: "fit",
    });
    doc.text({
      name: `mascot/${stage.id}/name`,
      text: stage.name,
      x: 20,
      y: 234,
      parent: tile,
      type: { ...type.h4, size: 18 },
      fill: color.mInk,
    });
    doc.text({
      name: `mascot/${stage.id}/copy`,
      text: stage.copy,
      x: 20,
      y: 258,
      width: w - 40,
      parent: tile,
      type: { ...type.small, size: 12 },
      fill: color.mQuiet,
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────
  head(doc, root, { y: 2010, index: "06", title: "Empty state" });

  const empty = b.frame({
    name: "empty-state",
    x: board.pad,
    y: 2086,
    width: grid.width,
    height: 180,
    parent: root,
    props: {
      fills: ["rgba(255,255,255,0.02)"],
      strokes: ["rgba(169,135,255,0.20)"],
      strokeWeight: 1,
      dashes: [8, 8],
      cornerRadius: radius.lg,
      layout: "vertical",
      padding: 32,
      gap: 8,
      mainAlign: "center",
      crossAlign: "center",
    },
  });
  doc.text({
    name: "empty/title",
    text: "No study circles yet",
    x: 32,
    y: 48,
    parent: empty,
    type: { ...type.h4, size: 20 },
    fill: color.mInk,
  });
  doc.text({
    name: "empty/copy",
    text: "Create the first circle for this course and invite the people you study with.",
    x: 32,
    y: 78,
    parent: empty,
    type: { ...type.small, size: 14 },
    fill: color.mQuiet,
  });
  button(doc, empty, b, { x: 32, y: 110, label: "Create a circle", variant: "primary" });

  doc.text({
    name: "board/footer",
    text: "All components are main components on this page's canvas. Text styles are shared; colours reference the semantic layer.",
    x: board.pad,
    y: 2300,
    width: grid.width,
    parent: root,
    type: { ...type.small, size: 13 },
    fill: color.mQuiet,
  });

  return [b];
}
