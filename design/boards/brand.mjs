/**
 * Brand: the logo as live components, its lockups, clear space and the mascot.
 *
 * The symbol is built from the shipped SVG's own path data
 * (apps/web/public/brand/noveris-symbol.svg) rather than imported as an image,
 * so it stays editable and cannot drift from the product.
 */

import { Board, surface, grid, symbolComponent, color, radius, type } from "../builder.mjs";
import { board, brand } from "../tokens.mjs";

/** The wordmark, set in the brand face at the shipped tracking. */
function wordmark(doc, parent, { x, y, size, fill = "#FFFFFF", name = "logo/wordmark" }) {
  return doc.text({
    name,
    text: brand.name,
    x,
    y,
    parent,
    type: { family: "Sora", style: "Bold", size, lineHeight: "100%", tracking: size * -0.045 },
    fill,
  });
}

/** Section eyebrow + title, matching the foundations boards. */
function head(doc, root, { y, index, title, x = board.pad }) {
  doc.text({
    name: `head/${title}/index`,
    text: index,
    x,
    y,
    parent: root,
    type: { family: "Inter", style: "Bold", size: 12, lineHeight: "100%", tracking: 1.6 },
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
}

export function brandBoards(doc) {
  const b = new Board(doc, "05 · Logo").at(4);
  const root = b.root({ height: 1660 });

  doc.text({
    name: "board/title",
    text: "Logo",
    x: board.pad,
    y: board.pad,
    parent: root,
    type: { ...type.h1 },
    fill: color.mInk,
  });
  doc.text({
    name: "board/subtitle",
    text: "The symbol is the letter N drawn as one continuous stroke, with a star at the peak of the climb. The wordmark is live Sora Bold — never outlined for digital.",
    x: board.pad,
    y: board.pad + 96,
    width: 900,
    parent: root,
    type: { ...type.lead, size: 20 },
    fill: color.mMuted,
  });

  // ── Components live on the board, off to the right ──────────────────────
  const symbolComp = symbolComponent(doc, { name: "logo/symbol", x: 1520, y: 240 });
  const monoComp = symbolComponent(doc, { name: "logo/symbol-mono", x: 1520, y: 420, mono: "#F7F9FF" });

  // ── Primary lockup ──────────────────────────────────────────────────────
  const hero = b.frame({
    name: "logo/primary-lockup",
    x: board.pad,
    y: 300,
    width: grid.width,
    height: 320,
    parent: root,
    props: surface({ fill: "rgba(255,255,255,0.02)", radius: radius.xl }),
  });
  b.symbol(hero, { x: 76, y: 70, width: 128, componentId: symbolComp });
  wordmark(doc, hero, { x: 232, y: 82, size: 92 });
  doc.text({
    name: "logo/tagline",
    text: brand.slogan,
    x: 236,
    y: 196,
    parent: hero,
    type: { family: "Inter", style: "SemiBold", size: 17, lineHeight: "120%", tracking: 2.4, upper: true },
    fill: color.violetSoft,
  });
  doc.text({
    name: "logo/primary-caption",
    text: "Primary lockup · symbol + wordmark + slogan · vertical gap equals ½ cap height",
    x: 76,
    y: 268,
    parent: hero,
    type: { ...type.small, size: 13 },
    fill: color.mQuiet,
  });

  // ── Lockups ─────────────────────────────────────────────────────────────
  head(doc, root, { y: 700, index: "01", title: "Lockups" });

  const variants = [
    { name: "Symbol", note: "App icon, avatar, favicon" },
    { name: "Wordmark", note: "Where the mark is already present" },
    { name: "Stacked", note: "Certificates, booth and print" },
  ];
  variants.forEach((v, i) => {
    const x = grid.x(i, 3);
    const w = grid.col(3);
    const card = b.frame({
      name: `logo/variant/${v.name}`,
      x,
      y: 770,
      width: w,
      height: 320,
      parent: root,
      props: surface({ fill: "rgba(255,255,255,0.02)", radius: radius.lg }),
    });

    if (i === 0) {
      b.symbol(card, { x: (w - 116) / 2, y: 56, width: 116, componentId: symbolComp });
    } else if (i === 1) {
      wordmark(doc, card, { x: 32, y: 96, size: 54 });
    } else {
      b.symbol(card, { x: (w - 88) / 2, y: 40, width: 88, componentId: symbolComp });
      wordmark(doc, card, { x: 32, y: 144, size: 36 });
      doc.text({
        name: "logo/variant/Stacked/tagline",
        text: brand.slogan,
        x: 32,
        y: 192,
        width: w - 64,
        parent: card,
        type: { family: "Inter", style: "SemiBold", size: 10, lineHeight: "120%", tracking: 1.8, upper: true },
        fill: color.violetSoft,
        align: "center",
      });
    }

    doc.text({
      name: `logo/variant/${v.name}/label`,
      text: v.name,
      x: 26,
      y: 262,
      parent: card,
      type: { ...type.small, style: "SemiBold", size: 13 },
      fill: color.mInk,
    });
    doc.text({
      name: `logo/variant/${v.name}/note`,
      text: v.note,
      x: 26,
      y: 282,
      width: w - 52,
      parent: card,
      type: { ...type.small, size: 12 },
      fill: color.mQuiet,
    });
  });

  // ── Clear space ─────────────────────────────────────────────────────────
  const thirdW = grid.col(3);
  head(doc, root, { y: 1180, index: "02", title: "Clear space" });

  const clear = b.frame({
    name: "logo/clearspace",
    x: board.pad,
    y: 1250,
    width: thirdW,
    height: 280,
    parent: root,
    props: surface({ fill: "rgba(123,63,242,0.06)", radius: radius.lg }),
  });
  doc.rect({
    name: "logo/clearspace/zone",
    x: 40,
    y: 40,
    width: thirdW - 80,
    height: 148,
    parent: clear,
    props: {
      fill: "none",
      strokes: [color.violetSoft],
      strokeWeight: 1,
      dashes: [6, 6],
      cornerRadius: radius.sm,
    },
  });
  b.symbol(clear, { x: 52, y: 82, width: 34, componentId: symbolComp });
  wordmark(doc, clear, { x: 96, y: 88, size: 24 });
  doc.text({
    name: "logo/clearspace/label",
    text: "½ symbol height on all sides.\nMinimum 24px digital, 12mm print.",
    x: 40,
    y: 212,
    width: thirdW - 80,
    parent: clear,
    type: { ...type.small, size: 12 },
    fill: color.mQuiet,
  });

  // ── One colour ──────────────────────────────────────────────────────────
  const monoX = grid.x(1, 3);
  head(doc, root, { y: 1180, index: "03", title: "One colour", x: monoX });
  const mono = b.frame({
    name: "logo/monochrome",
    x: monoX,
    y: 1250,
    width: thirdW,
    height: 280,
    parent: root,
    props: surface({ fill: "#F7F9FF", radius: radius.lg }),
  });
  doc.rect({
    name: "logo/monochrome/panel",
    x: 40,
    y: 40,
    width: thirdW - 80,
    height: 116,
    parent: mono,
    props: { fills: [color.night], cornerRadius: radius.md },
  });
  b.symbol(mono, { x: 76, y: 70, width: 40, componentId: monoComp });
  wordmark(doc, mono, { x: 130, y: 76, size: 26 });
  doc.text({
    name: "logo/monochrome/label",
    text: "One-colour print and dark grounds.\nNever tint or re-stroke the symbol.",
    x: 40,
    y: 212,
    width: thirdW - 80,
    parent: mono,
    type: { ...type.small, size: 12 },
    fill: color.lMutedFg,
  });

  // ── Misuse ──────────────────────────────────────────────────────────────
  const dontX = grid.x(2, 3);
  head(doc, root, { y: 1180, index: "04", title: "Never", x: dontX });
  [
    "Recolour or flatten the symbol",
    "Stretch, rotate or re-stroke it",
    "Set the wordmark in another face",
    "Place it on a busy field without a scrim",
  ].forEach((d, i) => {
    const y = 1258 + i * 46;
    doc.rect({
      name: `logo/misuse/${i}/mark`,
      x: dontX,
      y: y + 6,
      width: 13,
      height: 13,
      parent: root,
      props: { fill: "rgba(240,86,123,0.20)", cornerRadius: 3, strokes: [color.rose], strokeWeight: 1 },
    });
    doc.text({
      name: `logo/misuse/${i}`,
      text: d,
      x: dontX + 28,
      y,
      width: thirdW - 28,
      parent: root,
      type: { ...type.body, size: 15 },
      fill: color.mMuted,
    });
  });

  doc.text({
    name: "board/footer",
    text: "Source · apps/web/public/brand/noveris-symbol.svg. The symbol and wordmark are main components on this page's canvas — drag instances rather than redrawing.",
    x: board.pad,
    y: 1566,
    width: grid.width,
    parent: root,
    type: { ...type.small, size: 13 },
    fill: color.mQuiet,
  });

  return [b];
}
