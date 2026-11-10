/**
 * A thin builder over the FigCraft scripting API.
 *
 * Every figure in the design system is authored as a sequence of these calls.
 * Node ids are assigned by FigCraft in creation order, so `Board` tracks the
 * counter itself — creations return their id and later calls reference it.
 */

import { board, color, font, radius, stroke, type } from "./tokens.mjs";
import * as tokens from "./tokens.mjs";

export { color, radius, stroke, type, board, tokens };
export const { space, elevation, alpha } = tokens;

export class Doc {
  constructor() {
    this.ops = [];
    this.nextId = 2; // node id 1 is the initial page
  }

  _push(command, params) {
    const id = this.nextId++;
    this.ops.push({ command, params, expected: id });
    return id;
  }

  raw(command, params) {
    this.ops.push({ command, params });
  }

  /** Records the id a page will take, so the trace can be diffed. */
  _page(name) {
    const id = this.nextId++;
    this.ops.push({ command: "page.add", params: { name }, expected: id });
    return id;
  }

  /**
   * Adds a page and leaves it current — `page.add` already switches to it, so
   * there is no separate select step (and no id to track: pages get their own
   * id space that overlaps with node ids).
   */
  page(name) {
    return this._page(name);
  }

  /** A main component: created like a node, then sized to its contents. */
  _component({ name, x = 0, y = 0, width = 106, height = 88 }) {
    const id = this.nextId++;
    this.ops.push({
      command: "node.create",
      params: { type: "component", name, x, y, width, height },
      expected: id,
    });
    return id;
  }

  frame(o) {
    const id = this._push("frame.create", {
      name: o.name,
      x: o.x ?? 0,
      y: o.y ?? 0,
      width: o.width,
      height: o.height,
      parent: o.parent,
      props: o.props ?? {},
    });
    return id;
  }

  rect(o) {
    return this._push("shape.rectangle", {
      name: o.name,
      x: o.x ?? 0,
      y: o.y ?? 0,
      width: o.width,
      height: o.height,
      parent: o.parent,
      props: o.props ?? {},
    });
  }

  ellipse(o) {
    return this._push("shape.ellipse", {
      name: o.name,
      x: o.x ?? 0,
      y: o.y ?? 0,
      width: o.width,
      height: o.height,
      parent: o.parent,
      props: o.props ?? {},
    });
  }

  line(o) {
    return this._push("shape.line", {
      name: o.name,
      x: o.x ?? 0,
      y: o.y ?? 0,
      width: o.width ?? 100,
      parent: o.parent,
      props: o.props ?? {},
    });
  }

  vector(o) {
    return this._push("vector.create", {
      name: o.name,
      path: o.path,
      x: o.x ?? 0,
      y: o.y ?? 0,
      width: o.width,
      height: o.height,
      parent: o.parent,
      props: o.props ?? {},
    });
  }

  image(o) {
    return this._push("image.place", {
      name: o.name,
      path: o.path,
      x: o.x ?? 0,
      y: o.y ?? 0,
      width: o.width,
      height: o.height,
      parent: o.parent,
      mode: o.mode ?? "fit",
    });
  }

  /** Mutates an existing layer; creates nothing, so it takes no id. */
  set(id, props) {
    this.ops.push({ command: "node.set", params: { id, ...props } });
  }

  text(o) {
    const t = o.type ?? type.body;
    const props = {
      fontFamily: t.family,
      fontStyle: t.style,
      fontSize: t.size,
      lineHeight: t.lineHeight,
      letterSpacing: t.tracking,
      textAlign: o.align ?? "left",
      textAutoResize: o.width ? "height" : "widthAndHeight",
      ...(t.upper ? { textCase: "upper" } : {}),
      // Text fills take a paint list; a bare string is treated as a solid.
      ...(o.fill ? { fills: Array.isArray(o.fill) || typeof o.fill === "object" ? [o.fill] : [o.fill] } : {}),
      ...(o.props ?? {}),
    };
    return this._push("text.create", {
      name: o.name,
      text: o.text,
      x: o.x ?? 0,
      y: o.y ?? 0,
      width: o.width,
      parent: o.parent,
      props,
    });
  }

  group(ids, name) {
    return this._push("object.frameSelection", { ids, name });
  }

  /** Auto layout on an existing frame; like `set`, it creates no layer. */
  layout(id, o) {
    this.ops.push({ command: "layout.add", params: { ids: [id], direction: o.direction ?? "vertical" } });
  }

  exportFrames(ids, settings) {
    this.ops.push({ command: "export.add", params: { ids, setting: settings } });
  }
}

/**
 * A board is one page in the design file. `at` takes an index in the board
 * sequence; `x` is where it lands on the canvas.
 */
export class Board {
  constructor(doc, name) {
    this.doc = doc;
    this.name = name;
    this.children = [];
    this.abs = new Map();
    this._id = doc.page(name);
  }

  activate() {
    // A board's page is made current by `page.add` and stays current until the
    // next board is created, so boards must be authored in order.
  }

  /** Position a board on the horizontal canvas strip. */
  at(index) {
    this.x = index * (board.width + board.gap);
    return this;
  }

  /**
   * The board's root: a fixed 1440-wide column with generous padding. All
   * sections stack inside it with an explicit gap, so a board's height grows
   * with its content instead of being guessed.
   */
  /**
   * Absolute page position of a layer this board created, so `instance` can
   * convert a parent-relative slot into the page coordinates edit.paste wants.
   */
  originOf(id) {
    return this.abs.get(id) ?? [0, 0];
  }

  root({ width = board.width, height, fill = color.mBg, pad = board.pad } = {}) {
    this.activate();
    // Absolute positioning: every board places its own layers on the 12-column
    // grid, so the root must not be an auto-layout frame.
    this.rootId = this.doc.frame({
      name: `${this.name.replace(/\s+/g, "-")}/root`,
      x: this.x ?? 0,
      y: 0,
      width,
      height,
      props: { fills: [fill], clip: true },
    });
    this.pad = pad;
    this.abs.set(this.rootId, [this.x ?? 0, 0]);
    return this.rootId;
  }

  /**
   * A frame inside this board. Its absolute page position is recorded so a
   * symbol instance pasted into it can be placed with page coordinates.
   */
  frame(o) {
    const id = this.doc.frame(o);
    const [ox, oy] = this.originOf(o.parent);
    this.abs.set(id, [ox + (o.x ?? 0), oy + (o.y ?? 0)]);
    return id;
  }

  /** Place a symbol instance inside `parent` at parent-relative x/y. */
  symbol(parent, opts) {
    const [ox, oy] = this.originOf(parent);
    return symbolInstance(this.doc, parent, { ...opts, origin: [ox, oy] });
  }
}

/**
 * Column geometry. Boards place layers absolutely, so every row of cards is
 * computed from these rather than by eye — that is what keeps the right edge
 * of every board flush at 1200.
 */
export const grid = {
  pad: board.pad,
  width: board.width - board.pad * 2, // 1296 on a 1440 board
  gap: 24,
  /** Width of one card in an `n`-up row. */
  col(n, gap = grid.gap) {
    return (grid.width - gap * (n - 1)) / n;
  },
  /** Left edge of the `i`-th card (0-based) in an `n`-up row. */
  x(i, n, gap = grid.gap) {
    return grid.pad + i * (grid.col(n, gap) + gap);
  },
};

const SYMBOL_PATHS = {
  n: "M23 95 C29 78 40 44 49 32 C52 28 56 28 59 32 C67 43 77 74 84 79 C90 82 97 51 107 29",
  orbit: "M14 90 C40 112 92 87 116 42",
  star: "M107 10 L110.8 19.2 L120 23 L110.8 26.8 L107 36 L103.2 26.8 L94 23 L103.2 19.2Z",
};

const SYMBOL_RATIO = 106 / 88.11;

/**
 * The Noveris symbol as a main component, built from the shipped SVG's own
 * path data. `mono` drops the gradients for one-colour print.
 */
export function symbolComponent(doc, { name = "logo/symbol", x = 0, y = 0, mono = null } = {}) {
  const id = doc._component({ name, x, y });
  const nStroke = mono ?? {
    type: "linearGradient",
    stops: ["#BC96FF", "#7B3FF2", "#06D6FF"],
    from: [0, 0],
    to: [1, 1],
  };
  doc.vector({
    name: "symbol/stroke",
    path: SYMBOL_PATHS.n,
    x: 0,
    y: 0,
    parent: id,
    props: { fill: "none", strokes: [nStroke], strokeWeight: 17, strokeCap: "round", strokeJoin: "round" },
  });
  doc.vector({
    name: "symbol/orbit",
    path: SYMBOL_PATHS.orbit,
    x: 0,
    y: 0,
    parent: id,
    props: {
      fill: "none",
      strokes: [mono ?? { type: "linearGradient", stops: ["#F6E9FF", "#9C81FF", "#06D6FF"], from: [0, 0], to: [1, 1] }],
      strokeWeight: 3.3,
      strokeCap: "round",
      strokeJoin: "round",
    },
  });
  doc.vector({
    name: "symbol/star",
    path: SYMBOL_PATHS.star,
    x: 0,
    y: 0,
    parent: id,
    props: { fills: [mono ?? color.white] },
  });
  doc.set(id, { fills: [], clip: false });
  doc.raw("object.resizeToFit", { ids: [id] });
  return id;
}

/**
 * Drop an instance of a main component at a given width.
 *
 * FigCraft assigns a fresh id to the instance *and to every child it carries*,
 * so the counter has to advance by `childCount + 1` — not by one — or every
 * later id reference in the script is off.
 */
export function instance(doc, parent, { x, y, width, masterWidth, componentId, childCount, origin }) {
  doc.raw("edit.copy", { ids: [componentId] });
  // edit.paste takes page coordinates even when a parent is given, so the
  // caller passes the parent frame's own page position as `origin`.
  const [ox, oy] = origin ?? [0, 0];
  doc.raw("edit.paste", { parent, x: ox + x, y: oy + y });
  const id = doc.nextId;
  doc.nextId += childCount + 1;
  // Setting width/height on an instance only changes its frame; the children
  // must be scaled with it, or a small symbol renders at its master size.
  doc.raw("transform.scale", { ids: [id], factor: width / masterWidth, cx: ox + x, cy: oy + y });
  return id;
}

/** Symbol instance at a given width, keeping the mark's ratio. */
export function symbolInstance(doc, parent, { x, y, width, componentId, origin }) {
  return instance(doc, parent, {
    x,
    y,
    origin,
    width,
    masterWidth: 106,
    componentId,
    childCount: 3,
  });
}

/** Convenience: a rounded surface with the system's hairline treatment. */
export const surface = (opts = {}) => ({
  fills: opts.fill ? [opts.fill] : [color.mSurface],
  cornerRadius: opts.radius ?? radius.lg,
  ...(opts.stroke === false
    ? {}
    : { strokes: [stroke.hairline.color], strokeWeight: stroke.hairline.weight }),
  ...(opts.clip === false ? {} : { clip: true }),
  ...(opts.effects ? { effects: opts.effects } : {}),
  ...(opts.layout
    ? {
        layout: opts.layout,
        padding: opts.padding ?? 24,
        gap: opts.gap ?? 16,
        mainAlign: opts.mainAlign ?? "min",
        crossAlign: opts.crossAlign ?? "min",
      }
    : {}),
});

/** A pill chip, used for badges and eyebrows. */
export const chip = (opts = {}) => ({
  fills: [opts.fill ?? "rgba(123, 63, 242, 0.16)"],
  cornerRadius: radius.pill,
  strokes: [opts.stroke ?? "rgba(169, 135, 255, 0.42)"],
  strokeWeight: 1,
  layout: "horizontal",
  padding: opts.padding ?? [8, 16],
  gap: 8,
  crossAlign: "center",
  mainAlign: "center",
});

export const heading = (overrides = {}) => ({ ...type.h2, ...overrides });
export const body = (overrides = {}) => ({ ...type.body, ...overrides });
export const label = (overrides = {}) => ({ ...type.label, ...overrides });
