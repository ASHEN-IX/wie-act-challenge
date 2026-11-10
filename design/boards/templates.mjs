/**
 * Marketing templates: the social and print formats, built and ready to
 * duplicate.
 *
 * Each template is a top-level frame at its true pixel size (1080×1080 and
 * friends), so it can be exported at 1x and posted without rescaling. A
 * reference sheet on the final board shows every format side by side.
 */

import { Board, grid, symbolComponent, color, radius, type, elevation } from "../builder.mjs";
import { board, brand, violetGradient, brandGradient, stages, mascot } from "../tokens.mjs";

/** Absolute-positioned surface, since templates place their own art. */
const card = (fill, r = radius.xl, extra = {}) => ({ fills: [fill], cornerRadius: r, ...extra });

/** Small eyebrow in the marketing voice. */
function eyebrow(doc, parent, { x, y, text, fill = color.violetSoft, width }) {
  doc.text({
    name: `eyebrow/${text.slice(0, 24)}`,
    text,
    x,
    y,
    width,
    parent,
    type: { family: "Inter", style: "Bold", size: 14, lineHeight: "100%", tracking: 2.2, upper: true },
    fill,
  });
}

/**
 * The brand ground: a deep navy field with two soft violet/cyan glows and an
 * orbit arc. Used behind every social template so the feed reads as one set.
 */
function ground(doc, parent, { width, height }) {
  doc.rect({
    name: "ground/field",
    x: 0,
    y: 0,
    width,
    height,
    parent,
    props: { fills: [color.mBg] },
  });
  // Glows are radial gradients that fade to transparent — a solid ellipse
  // reads as a hard disc, which is exactly the "cheap" look to avoid.
  doc.ellipse({
    name: "ground/glow-violet",
    x: Math.round(width * 0.26),
    y: Math.round(-height * 0.26),
    width: Math.round(width * 1.06),
    height: Math.round(height * 0.92),
    parent,
    props: {
      fills: [
        {
          type: "radialGradient",
          stops: ["#3E2C86", "#1E1B4E", "#0B0E28"],
                  },
      ],
    },
  });
  doc.ellipse({
    name: "ground/glow-cyan",
    x: Math.round(-width * 0.34),
    y: Math.round(height * 0.5),
    width: Math.round(width * 0.94),
    height: Math.round(height * 0.78),
    parent,
    props: {
      fills: [
        {
          type: "radialGradient",
          stops: ["#0C3D50", "#0A1E30", "#0B0E28"],
                  },
      ],
    },
  });
}

/** The mascot on its stage-tinted pod — the recurring marketing hero shot. */
function mascotPod(doc, parent, { x, y, size, stage }) {
  doc.ellipse({
    name: `pod/${stage}/glow`,
    x,
    y: y + size * 0.5,
    width: size,
    height: size * 0.4,
    parent,
    props: {
      fills: [
        {
          type: "radialGradient",
          stops: ["#8F52FF", "#0B0E28"],
                  },
      ],
    },
  });
  doc.ellipse({
    name: `pod/${stage}/platform`,
    x: x + size * 0.2,
    y: y + size * 0.78,
    width: size * 0.6,
    height: size * 0.13,
    parent,
    props: { fills: ["rgba(169,135,255,0.22)"], corners: undefined, cornerRadius: radius.pill },
  });
  doc.image({
    name: `pod/${stage}/art`,
    path: mascot(stage),
    x,
    y,
    width: size,
    height: size,
    parent,
    mode: "fit",
  });
}

export function templateBoards(doc) {
  const boards = [];

  // ── Square post · announcement ──────────────────────────────────────────
  {
    const b = new Board(doc, "07 · Post 1:1").at(6);
    const root = b.root({ width: 1080, height: 1080, fill: color.mBg });
    ground(doc, root, { width: 1080, height: 1080 });

    // A faint orbit arc, echoing the symbol's sweep.
    doc.vector({
      name: "ground/orbit",
      path: "M-40 300 C 220 470 760 420 1140 60",
      x: 0,
      y: 0,
      parent: root,
      props: { fill: "none", strokes: ["rgba(169,135,255,0.28)"], strokeWeight: 2, strokeCap: "round" },
    });

    eyebrow(doc, root, { x: 80, y: 96, text: `${brand.challenge} · ${brand.event}` });
    doc.text({
      name: "post/headline",
      text: "Learn\ntogether.",
      x: 80,
      y: 158,
      parent: root,
      type: { ...type.display, size: 112, lineHeight: "94%" },
      fill: color.mInk,
    });
    doc.text({
      name: "post/headline-accent",
      text: "Grow further.",
      x: 82,
      y: 378,
      parent: root,
      type: { ...type.display, size: 88, lineHeight: "100%", tracking: -2.6 },
      fill: brandGradient,
    });
    doc.text({
      name: "post/body",
      text: brand.description,
      x: 84,
      y: 520,
      width: 520,
      parent: root,
      type: { ...type.lead, size: 25, lineHeight: "150%" },
      fill: color.mMuted,
    });

    mascotPod(doc, root, { x: 596, y: 386, size: 388, stage: "graduate" });

    // Footer lockup
    doc.line({
      name: "post/rule",
      x: 80,
      y: 872,
      width: 920,
      parent: root,
      props: { strokes: ["rgba(169,135,255,0.22)"], strokeWeight: 1 },
    });
    const comp = symbolComponent(doc, { name: "post1/symbol", x: 1240, y: 120 });
    b.symbol(root, { x: 80, y: 916, width: 52, componentId: comp });
    doc.text({
      name: "post/wordmark",
      text: brand.name,
      x: 144,
      y: 925,
      parent: root,
      type: { family: "Sora", style: "Bold", size: 30, lineHeight: "100%", tracking: -1.3 },
      fill: color.mInk,
    });
    doc.text({
      name: "post/url",
      text: "noveris.app",
      x: 720,
      y: 930,
      width: 280,
      parent: root,
      type: { family: "Inter", style: "SemiBold", size: 18, lineHeight: "100%", tracking: 0.4 },
      fill: color.violetSoft,
      align: "right",
    });

    boards.push(b);
  }

  // ── Square post · stage badge ───────────────────────────────────────────
  {
    const b = new Board(doc, "08 · Badge 1:1").at(7);
    const root = b.root({ width: 1080, height: 1080, fill: color.mBg });
    ground(doc, root, { width: 1080, height: 1080 });

    doc.text({
      name: "eyebrow/nardouch-growth",
      text: "Nardouch growth",
      x: 0,
      y: 96,
      width: 1080,
      parent: root,
      type: { family: "Inter", style: "Bold", size: 14, lineHeight: "100%", tracking: 2.2, upper: true },
      fill: color.violetSoft,
      align: "center",
    });
    doc.text({
      name: "badge/title",
      text: "You reached\nGraduate",
      x: 0,
      y: 140,
      width: 1080,
      parent: root,
      type: { ...type.h1, size: 88, lineHeight: "100%" },
      fill: color.mInk,
      align: "center",
    });

    // The badge itself, large and centred.
    const badgeW = 560;
    const badge = b.frame({
      name: "badge/plate",
      x: 540 - badgeW / 2,
      y: 400,
      width: badgeW,
      height: 160,
      parent: root,
      props: {
        fills: ["rgba(123,63,242,0.22)"],
        strokes: [stages[4].accent],
        strokeWeight: 2,
        cornerRadius: radius.pill,
      },
    });
    doc.ellipse({
      name: "badge/dot",
      x: 52,
      y: 70,
      width: 20,
      height: 20,
      parent: badge,
      props: { fills: [stages[4].accent] },
    });
    doc.text({
      name: "badge/name",
      text: "Graduate",
      x: 92,
      y: 52,
      parent: badge,
      type: { family: "Sora", style: "Bold", size: 46, lineHeight: "100%", tracking: -1.4 },
      fill: color.mInk,
    });
    doc.text({
      name: "badge/threshold",
      text: "All lessons · every objective check passed",
      x: 94,
      y: 106,
      width: badgeW - 120,
      parent: badge,
      type: { ...type.small, size: 17 },
      fill: color.mutedFg,
    });

    mascotPod(doc, root, { x: 390, y: 610, size: 300, stage: "graduate" });

    doc.text({
      name: "badge/caption",
      text: "Earned, not awarded. Noveris only graduates a course when the reviewed checks are passed.",
      x: 140,
      y: 940,
      width: 800,
      parent: root,
      type: { ...type.body, size: 22, lineHeight: "150%" },
      fill: color.mMuted,
      align: "center",
    });

    boards.push(b);
  }

  // ── Story 9:16 ──────────────────────────────────────────────────────────
  {
    const b = new Board(doc, "09 · Story 9:16").at(8);
    const W = 1080;
    const H = 1920;
    const root = b.root({ width: W, height: H, fill: color.mBg });
    ground(doc, root, { width: W, height: H });

    doc.vector({
      name: "ground/orbit",
      path: "M-60 700 C 300 980 820 900 1160 420",
      x: 0,
      y: 0,
      parent: root,
      props: { fill: "none", strokes: ["rgba(169,135,255,0.24)"], strokeWeight: 2.5, strokeCap: "round" },
    });

    // Story safe areas: keep copy between 250 and 1670.
    eyebrow(doc, root, { x: 96, y: 250, text: `${brand.challenge} · ${brand.event}` });
    doc.text({
      name: "story/headline",
      text: "Study smarter\ntogether.",
      x: 96,
      y: 320,
      parent: root,
      type: { ...type.h1, size: 104, lineHeight: "100%" },
      fill: color.mInk,
    });
    doc.text({
      name: "story/body",
      text: "Peer circles, an AI guide, and a companion that grows with every course you finish.",
      x: 100,
      y: 570,
      width: 780,
      parent: root,
      type: { ...type.lead, size: 30, lineHeight: "150%" },
      fill: color.mMuted,
    });

    mascotPod(doc, root, { x: 180, y: 800, size: 720, stage: "explorer" });

    // CTA pill
    const cta = b.frame({
      name: "story/cta",
      x: 96,
      y: 1620,
      width: 420,
      height: 88,
      parent: root,
      props: {
        fills: [violetGradient],
        strokes: ["#B48CFF"],
        strokeWeight: 1.5,
        cornerRadius: radius.pill,
        effects: [elevation.glow],
      },
    });
    doc.text({
      name: "story/cta/label",
      text: "Join the challenge",
      x: 0,
      y: 32,
      width: 420,
      parent: cta,
      type: { family: "Inter", style: "SemiBold", size: 24, lineHeight: "100%", tracking: -0.2 },
      fill: "#FFFFFF",
      align: "center",
    });

    doc.text({
      name: "story/url",
      text: "noveris.app",
      x: 96,
      y: 1740,
      parent: root,
      type: { family: "Sora", style: "SemiBold", size: 26, lineHeight: "100%", tracking: -0.6 },
      fill: color.violetSoft,
    });

    boards.push(b);
  }

  // ── Link card 1200×630 ──────────────────────────────────────────────────
  {
    const b = new Board(doc, "10 · Link card").at(9);
    const W = 1200;
    const H = 630;
    const root = b.root({ width: W, height: H, fill: color.mBg });
    ground(doc, root, { width: W, height: H });

    eyebrow(doc, root, { x: 72, y: 84, text: brand.slogan });
    doc.text({
      name: "card/headline",
      text: "Every course,\na shared breakthrough.",
      x: 72,
      y: 132,
      width: 640,
      parent: root,
      type: { ...type.h2, size: 60, lineHeight: "106%" },
      fill: color.mInk,
    });
    doc.text({
      name: "card/body",
      text: brand.description,
      x: 74,
      y: 366,
      width: 560,
      parent: root,
      type: { ...type.body, size: 20, lineHeight: "150%" },
      fill: color.mMuted,
    });

    mascotPod(doc, root, { x: 740, y: 90, size: 450, stage: "learner" });

    boards.push(b);
  }

  // ── Wide post 1080×1350 ─────────────────────────────────────────────────
  {
    const b = new Board(doc, "11 · Wide 4:5").at(10);
    const W = 1080;
    const H = 1350;
    const root = b.root({ width: W, height: H, fill: color.mBg });
    ground(doc, root, { width: W, height: H });

    eyebrow(doc, root, { x: 80, y: 96, text: "How it works" });
    doc.text({
      name: "wide/headline",
      text: "Three steps to\na shared breakthrough.",
      x: 80,
      y: 148,
      width: 880,
      parent: root,
      type: { ...type.h1, size: 76, lineHeight: "104%" },
      fill: color.mInk,
    });

    const steps = [
      ["01", "Set up your space", "Add your subjects, courses and learning goals."],
      ["02", "Learn & collaborate", "Join study circles, discuss ideas, help one another learn."],
      ["03", "Track & grow", "Complete courses, strengthen skills, graduate with Nardouch."],
    ];
    steps.forEach(([n, title, copy], i) => {
      const y = 500 + i * 240;
      doc.text({
        name: `wide/step/${n}/num`,
        text: n,
        x: 80,
        y,
        parent: root,
        type: { family: "Sora", style: "ExtraBold", size: 40, lineHeight: "100%", tracking: -1.2 },
        fill: color.violet,
      });
      doc.text({
        name: `wide/step/${n}/title`,
        text: title,
        x: 80,
        y: y + 56,
        parent: root,
        type: { ...type.h3, size: 36 },
        fill: color.mInk,
      });
      doc.text({
        name: `wide/step/${n}/copy`,
        text: copy,
        x: 80,
        y: y + 108,
        width: 600,
        parent: root,
        type: { ...type.body, size: 20 },
        fill: color.mMuted,
      });
      doc.line({
        name: `wide/step/${n}/rule`,
        x: 80,
        y: y + 196,
        width: 920,
        parent: root,
        props: { strokes: ["rgba(169,135,255,0.16)"], strokeWeight: 1 },
      });
    });

    mascotPod(doc, root, { x: 700, y: 470, size: 300, stage: "baby" });

    boards.push(b);
  }

  // ── Slide 16:9 ──────────────────────────────────────────────────────────
  {
    const b = new Board(doc, "12 · Slide 16:9").at(11);
    const W = 1920;
    const H = 1080;
    const root = b.root({ width: W, height: H, fill: color.mBg });
    ground(doc, root, { width: W, height: H });

    eyebrow(doc, root, { x: 120, y: 132, text: `${brand.challenge} · ${brand.event}` });
    doc.text({
      name: "slide/headline",
      text: "Noveris",
      x: 116,
      y: 190,
      parent: root,
      type: { ...type.display, size: 148, lineHeight: "100%" },
      fill: color.mInk,
    });
    doc.text({
      name: "slide/subhead",
      text: brand.slogan,
      x: 122,
      y: 370,
      parent: root,
      type: { ...type.h2, size: 54 },
      fill: brandGradient,
    });
    doc.text({
      name: "slide/body",
      text: brand.description,
      x: 124,
      y: 470,
      width: 760,
      parent: root,
      type: { ...type.lead, size: 28, lineHeight: "150%" },
      fill: color.mMuted,
    });

    // Three proof points along the bottom.
    const points = [
      ["Peer-first", "AI facilitates, peers lead"],
      ["Reviewed", "Evidence stays in server code"],
      ["Multilingual", "Darija · French · English"],
    ];
    points.forEach(([title, copy], i) => {
      const x = 124 + i * 380;
      doc.text({
        name: `slide/point/${i}/title`,
        text: title,
        x,
        y: 790,
        parent: root,
        type: { ...type.h4, size: 26 },
        fill: color.mInk,
      });
      doc.text({
        name: `slide/point/${i}/copy`,
        text: copy,
        x,
        y: 830,
        width: 320,
        parent: root,
        type: { ...type.small, size: 17 },
        fill: color.mQuiet,
      });
    });

    mascotPod(doc, root, { x: 1180, y: 300, size: 540, stage: "explorer" });

    boards.push(b);
  }

  // ── Stage badge set · the printable strip ───────────────────────────────
  {
    const b = new Board(doc, "13 · Badge set").at(12);
    const W = 1440;
    const H = 720;
    const root = b.root({ width: W, height: H, fill: color.mBg });
    ground(doc, root, { width: W, height: H });

    eyebrow(doc, root, { x: 72, y: 76, text: "Nardouch growth stages" });
    doc.text({
      name: "set/title",
      text: "Five stages, one companion",
      x: 72,
      y: 116,
      parent: root,
      type: { ...type.h2, size: 48 },
      fill: color.mInk,
    });

    const tileW = 236;
    stages.forEach((stage, i) => {
      const x = 72 + i * (tileW + 20);
      const tile = b.frame({
        name: `set/${stage.id}`,
        x,
        y: 250,
        width: tileW,
        height: 380,
        parent: root,
        props: {
          fills: ["rgba(255,255,255,0.03)"],
          strokes: ["rgba(169,135,255,0.20)"],
          strokeWeight: 1,
          cornerRadius: radius.lg,
          clip: true,
        },
      });
      doc.ellipse({
        name: `set/${stage.id}/glow`,
        x: tileW / 2 - 80,
        y: 96,
        width: 160,
        height: 110,
        parent: tile,
        props: { fills: [stage.accent], opacity: 0.12 },
      });
      doc.image({
        name: `set/${stage.id}/art`,
        path: mascot(stage.id),
        x: 22,
        y: 26,
        width: tileW - 44,
        height: tileW - 44,
        parent: tile,
        mode: "fit",
      });
      doc.text({
        name: `set/${stage.id}/name`,
        text: stage.name,
        x: 24,
        y: 262,
        parent: tile,
        type: { ...type.h4, size: 24 },
        fill: color.mInk,
      });
      doc.ellipse({
        name: `set/${stage.id}/dot`,
        x: 24,
        y: 304,
        width: 10,
        height: 10,
        parent: tile,
        props: { fills: [stage.accent] },
      });
      doc.text({
        name: `set/${stage.id}/threshold`,
        text: stage.threshold,
        x: 44,
        y: 300,
        width: tileW - 60,
        parent: tile,
        type: { ...type.small, size: 13 },
        fill: color.mQuiet,
      });
      doc.text({
        name: `set/${stage.id}/copy`,
        text: stage.copy,
        x: 24,
        y: 328,
        width: tileW - 48,
        parent: tile,
        type: { ...type.small, size: 12 },
        fill: color.mutedFg,
      });
    });

    boards.push(b);
  }

  return boards;
}
