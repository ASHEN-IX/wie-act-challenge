/**
 * Noveris design tokens.
 *
 * Single source of truth for the FigCraft design system. Values are transcribed
 * from the product itself so the design file cannot drift from the shipped UI:
 *   - apps/web/src/app/globals.css        (semantic colour, radius, brand ramp)
 *   - apps/web/src/components/marketing/marketing.css (marketing surfaces)
 *   - apps/web/public/brand/*.svg         (logo geometry)
 *   - apps/web/src/lib/brand.ts           (product copy, stage names)
 */

export const color = {
  // Brand ramp
  night: "#0B1026",
  navy: "#0B1A3C",
  ink: "#10162D",
  white: "#F7F9FF",
  violet: "#7B3FF2",
  violetSoft: "#A987FF",
  violetLight: "#BC96FF",
  cyan: "#06D6FF",
  cyanSoft: "#65E4FF",
  amber: "#FFB547",
  pink: "#FF7AB8",
  rose: "#F0567B",

  // Dark semantic surfaces
  card: "#151C3A",
  secondary: "#1C2547",
  muted: "#1A2244",
  mutedFg: "#A0A7B8",
  accent: "#222C52",
  border: "rgba(178, 147, 255, 0.26)",

  // Marketing surfaces
  mBg: "#0B0E28",
  mSurface: "#11132F",
  mSurfaceDeep: "#15183B",
  mInk: "#F8F7FF",
  mMuted: "#B9BEDB",
  mQuiet: "#8E96BD",
  mPurple: "#9B59FC",
  mLavender: "#CC91FF",

  // Light semantic surfaces
  lBg: "#F6F5FF",
  lFg: "#10162D",
  lCard: "#FFFFFF",
  lSecondary: "#EEE9FB",
  lMuted: "#F1EEFB",
  lMutedFg: "#616682",
  lAccent: "#ECE5FC",
  lPrimary: "#6B32D9",
  lBorder: "rgba(72, 43, 137, 0.17)",
};

/** rgba helper so hairline borders stay readable in the token file. */
export const alpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const brandGradient = {
  type: "linearGradient",
  stops: [color.violetLight, color.violet, color.cyan],
  from: [0, 0],
  to: [1, 1],
};

export const violetGradient = {
  type: "linearGradient",
  stops: ["#AB65FF", "#873BF0", "#8453F8"],
  from: [0, 0],
  to: [1, 0],
};

export const cyanVioletGradient = {
  type: "linearGradient",
  stops: ["#BC64FF", "#40E4FA"],
  from: [0, 0],
  to: [1, 0],
};

export const font = {
  heading: { family: "Sora", regular: "Regular", semibold: "SemiBold", bold: "Bold", black: "ExtraBold" },
  body: { family: "Inter", regular: "Regular", semibold: "SemiBold", bold: "Bold" },
};

/**
 * Type scale. `tracking` is negative because Sora is optically loose at display
 * sizes; the shipped UI does the same thing with letter-spacing on headings.
 */
export const type = {
  display: { family: "Sora", style: "ExtraBold", size: 128, lineHeight: "100%", tracking: -4 },
  h1: { family: "Sora", style: "ExtraBold", size: 76, lineHeight: "104%", tracking: -2.5 },
  h2: { family: "Sora", style: "Bold", size: 52, lineHeight: "110%", tracking: -1.6 },
  h3: { family: "Sora", style: "SemiBold", size: 34, lineHeight: "118%", tracking: -0.8 },
  h4: { family: "Sora", style: "SemiBold", size: 24, lineHeight: "126%", tracking: -0.4 },
  lead: { family: "Inter", style: "Regular", size: 22, lineHeight: "150%", tracking: -0.2 },
  body: { family: "Inter", style: "Regular", size: 17, lineHeight: "160%", tracking: -0.1 },
  bodyStrong: { family: "Inter", style: "SemiBold", size: 17, lineHeight: "160%", tracking: -0.1 },
  small: { family: "Inter", style: "Regular", size: 14, lineHeight: "150%", tracking: 0 },
  label: { family: "Inter", style: "Bold", size: 11, lineHeight: "100%", tracking: 1.6, upper: true },
  mono: { family: "Inter", style: "Regular", size: 13, lineHeight: "150%", tracking: 0.2 },
};

export const radius = { sm: 8, md: 10, base: 12, lg: 16, xl: 22, xxl: 28, pill: 999 };

export const space = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120];

export const stroke = {
  hairline: { color: alpha(color.violetSoft, 0.26), weight: 1 },
  outline: { color: alpha(color.violetSoft, 0.34), weight: 1 },
  strong: { color: alpha(color.violetSoft, 0.55), weight: 1.5 },
};

export const elevation = {
  glow: { type: "dropShadow", color: alpha(color.violet, 0.55), offset: [0, 14], radius: 44, spread: 4, visible: true, blend: "normal" },
  card: { type: "dropShadow", color: "rgba(5, 3, 24, 0.32)", offset: [0, 26], radius: 70, spread: 0, visible: true, blend: "normal" },
  soft: { type: "dropShadow", color: "rgba(5, 3, 24, 0.22)", offset: [0, 10], radius: 28, spread: 0, visible: true, blend: "normal" },
};

export const stages = [
  { id: "baby", name: "Baby", threshold: "Start a course", accent: color.violetSoft, copy: "A fresh companion for every new course." },
  { id: "learner", name: "Learner", threshold: "First lesson", accent: color.cyan, copy: "Curiosity becomes a habit." },
  { id: "explorer", name: "Explorer", threshold: "40% of lessons", accent: color.amber, copy: "Momentum takes hold." },
  { id: "expert", name: "Expert", threshold: "75% of lessons", accent: color.pink, copy: "Range and depth begin to show." },
  { id: "graduate", name: "Graduate", threshold: "Finish & pass checks", accent: color.violet, copy: "Every objective proven." },
];

export const brand = {
  name: "Noveris",
  slogan: "Learn Together. Grow Further.",
  product: "GenAI peer-learning companion",
  challenge: "EdNova Challenge",
  event: "IEEE WIE ACT 5.0",
  description:
    "Study with your peers, get AI guidance, and turn every course into a shared breakthrough.",
};

/** Paths are resolved from the repo root, where the generator runs. */
export const mascot = (stage) =>
  new URL(`../apps/web/public/images/nardouch-${stage}-transparent.png`, import.meta.url).pathname;
export const symbolPath = new URL(
  "../apps/web/public/brand/noveris-symbol.svg",
  import.meta.url,
).pathname;
export const lockupPath = new URL(
  "../apps/web/public/brand/noveris-lockup-dark.svg",
  import.meta.url,
).pathname;

// Board geometry. Boards are laid out left to right, 120px apart.
export const board = { width: 1440, pad: 72, gap: 120 };
