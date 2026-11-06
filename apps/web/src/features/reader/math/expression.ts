/** Restricted mathematical expression parser (Batch 3, Milestone 3.4).
 *
 * Source documents and model output are untrusted. This module never calls
 * `eval`, `Function`, or any string-to-code path. It parses a deliberately
 * small arithmetic grammar into an AST and evaluates that AST against a
 * numeric scope with hard limits.
 *
 * Grammar (whitespace-insensitive):
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('*' | '/') unary)*
 *   unary   := ('-' | '+')? power
 *   power   := primary ('^' unary)?
 *   primary := number | identifier | identifier '(' args? ')'
 *            | '(' expr ')' | '|' expr '|'
 *
 * Identifiers resolve only from an explicit allowlist. Unknown identifiers are
 * a parse error, never an implicit global lookup.
 */

export type MathNode =
  | { kind: 'number'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'unary'; op: '-' | '+'; operand: MathNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: MathNode; right: MathNode }
  | { kind: 'call'; name: AllowedFunction; args: MathNode[] }
  | { kind: 'abs'; operand: MathNode };

export const ALLOWED_FUNCTIONS = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'exp',
  'ln',
  'log',
  'sqrt',
  'abs',
  'floor',
  'ceil',
  'sign',
] as const;
export type AllowedFunction = (typeof ALLOWED_FUNCTIONS)[number];

export const ALLOWED_CONSTANTS = ['pi', 'e', 'tau'] as const;

/** Identifiers that must never reach evaluation, even as a variable. They are
 * prototype members or host globals; a mathematical formula has no use for
 * them, and rejecting them removes a whole class of confusion. */
const RESERVED_IDENTIFIERS = new Set([
  'constructor',
  'prototype',
  '__proto__',
  'globalThis',
  'window',
  'document',
  'self',
  'top',
  'parent',
  'process',
  'require',
  'module',
  'exports',
  'eval',
  'Function',
  'import',
  'this',
  'arguments',
]);

export class ExpressionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const MAX_EXPRESSION_LENGTH = 400;
const MAX_NODES = 400;
const MAX_DEPTH = 32;

const FUNCTION_ARITY: Record<AllowedFunction, [number, number]> = {
  sin: [1, 1],
  cos: [1, 1],
  tan: [1, 1],
  asin: [1, 1],
  acos: [1, 1],
  atan: [1, 1],
  exp: [1, 1],
  ln: [1, 1],
  log: [1, 1],
  sqrt: [1, 1],
  abs: [1, 1],
  floor: [1, 1],
  ceil: [1, 1],
  sign: [1, 1],
};

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' | '(' | ')' | ',' | '|' };

const IDENT = /^[A-Za-z][A-Za-z0-9_]*/;
const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const char = source[index];
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      index += 1;
      continue;
    }
    const number = NUMBER.exec(rest);
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value))
        throw new ExpressionError('INVALID_NUMBER', 'A numeric literal is out of range.');
      tokens.push({ type: 'number', value });
      index += number[0].length;
      continue;
    }
    const ident = IDENT.exec(rest);
    if (ident) {
      tokens.push({ type: 'ident', value: ident[0] });
      index += ident[0].length;
      continue;
    }
    if ('+-*/^(),|'.includes(char)) {
      tokens.push({ type: 'op', value: char as '+' });
      index += 1;
      continue;
    }
    throw new ExpressionError('UNEXPECTED_CHARACTER', `Unsupported character at position ${index}.`);
  }
  return tokens;
}

type Parser = { tokens: Token[]; position: number; nodes: number; depth: number };

function peek(parser: Parser): Token | undefined {
  return parser.tokens[parser.position];
}

function consume(parser: Parser): Token {
  const token = parser.tokens[parser.position];
  if (!token) throw new ExpressionError('UNEXPECTED_END', 'The expression ends unexpectedly.');
  parser.position += 1;
  return token;
}

function makeNode(parser: Parser, node: MathNode): MathNode {
  parser.nodes += 1;
  if (parser.nodes > MAX_NODES)
    throw new ExpressionError('EXPRESSION_TOO_COMPLEX', 'The expression is too complex to evaluate.');
  return node;
}

function enter(parser: Parser) {
  parser.depth += 1;
  if (parser.depth > MAX_DEPTH)
    throw new ExpressionError('EXPRESSION_TOO_DEEP', 'The expression nests too deeply.');
}

function parseExpressionNode(parser: Parser): MathNode {
  enter(parser);
  let left = parseTerm(parser);
  for (;;) {
    const token = peek(parser);
    if (token?.type !== 'op' || (token.value !== '+' && token.value !== '-')) break;
    consume(parser);
    const right = parseTerm(parser);
    left = makeNode(parser, { kind: 'binary', op: token.value, left, right });
  }
  parser.depth -= 1;
  return left;
}

function parseTerm(parser: Parser): MathNode {
  let left = parseUnary(parser);
  for (;;) {
    const token = peek(parser);
    if (token?.type !== 'op' || (token.value !== '*' && token.value !== '/')) break;
    consume(parser);
    const right = parseUnary(parser);
    left = makeNode(parser, { kind: 'binary', op: token.value, left, right });
  }
  return left;
}

function parseUnary(parser: Parser): MathNode {
  const token = peek(parser);
  if (token?.type === 'op' && (token.value === '-' || token.value === '+')) {
    consume(parser);
    const operand = parseUnary(parser);
    return makeNode(parser, { kind: 'unary', op: token.value, operand });
  }
  return parsePower(parser);
}

function parsePower(parser: Parser): MathNode {
  const base = parsePrimary(parser);
  const token = peek(parser);
  if (token?.type === 'op' && token.value === '^') {
    consume(parser);
    // Right-associative, and the exponent may itself be signed.
    const exponent = parseUnary(parser);
    return makeNode(parser, { kind: 'binary', op: '^', left: base, right: exponent });
  }
  return base;
}

function parsePrimary(parser: Parser): MathNode {
  const token = consume(parser);
  if (token.type === 'number') return makeNode(parser, { kind: 'number', value: token.value });
  if (token.type === 'op' && token.value === '(') {
    const inner = parseExpressionNode(parser);
    const close = consume(parser);
    if (close.type !== 'op' || close.value !== ')')
      throw new ExpressionError('UNBALANCED_PARENTHESIS', 'A closing parenthesis is missing.');
    return inner;
  }
  if (token.type === 'op' && token.value === '|') {
    const inner = parseExpressionNode(parser);
    const close = consume(parser);
    if (close.type !== 'op' || close.value !== '|')
      throw new ExpressionError('UNBALANCED_ABSOLUTE', 'A closing | is missing.');
    return makeNode(parser, { kind: 'abs', operand: inner });
  }
  if (token.type === 'ident') {
    const name = token.value;
    if (RESERVED_IDENTIFIERS.has(name))
      throw new ExpressionError('RESERVED_IDENTIFIER', `"${name}" is not a mathematical name.`);
    const next = peek(parser);
    if (next?.type === 'op' && next.value === '(') {
      if (!(ALLOWED_FUNCTIONS as readonly string[]).includes(name))
        throw new ExpressionError('UNKNOWN_FUNCTION', `"${name}" is not an allowed function.`);
      consume(parser);
      const args: MathNode[] = [];
      const closing = peek(parser);
      if (!(closing?.type === 'op' && closing.value === ')')) {
        for (;;) {
          args.push(parseExpressionNode(parser));
          const separator = peek(parser);
          if (separator?.type === 'op' && separator.value === ',') {
            consume(parser);
            continue;
          }
          break;
        }
      }
      const close = consume(parser);
      if (close.type !== 'op' || close.value !== ')')
        throw new ExpressionError('UNBALANCED_PARENTHESIS', 'A closing parenthesis is missing.');
      const [min, max] = FUNCTION_ARITY[name as AllowedFunction];
      if (args.length < min || args.length > max)
        throw new ExpressionError('BAD_ARITY', `"${name}" takes ${min} argument(s).`);
      return makeNode(parser, { kind: 'call', name: name as AllowedFunction, args });
    }
    if ((ALLOWED_CONSTANTS as readonly string[]).includes(name))
      return makeNode(parser, { kind: 'number', value: constantValue(name) });
    // Variables are validated against the caller's scope at evaluation time.
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name))
      throw new ExpressionError('UNKNOWN_IDENTIFIER', `"${name}" is not a valid variable.`);
    return makeNode(parser, { kind: 'variable', name });
  }
  throw new ExpressionError('UNEXPECTED_TOKEN', 'The expression is not a valid mathematical formula.');
}

function constantValue(name: string): number {
  if (name === 'pi') return Math.PI;
  if (name === 'e') return Math.E;
  return Math.PI * 2;
}

export type ParsedExpression = {
  ast: MathNode;
  /** Variable names the caller must supply. Sorted for determinism. */
  variables: string[];
};

/** Parse a restricted arithmetic expression. Throws ExpressionError. */
export function parseExpression(source: string): ParsedExpression {
  if (typeof source !== 'string' || !source.trim())
    throw new ExpressionError('EMPTY_EXPRESSION', 'The expression is empty.');
  if (source.length > MAX_EXPRESSION_LENGTH)
    throw new ExpressionError('EXPRESSION_TOO_LONG', 'The expression is too long.');
  const parser: Parser = { tokens: tokenize(source), position: 0, nodes: 0, depth: 0 };
  if (!parser.tokens.length)
    throw new ExpressionError('EMPTY_EXPRESSION', 'The expression is empty.');
  const ast = parseExpressionNode(parser);
  if (parser.position !== parser.tokens.length)
    throw new ExpressionError('TRAILING_TOKEN', 'The expression has unexpected trailing input.');
  const variables = new Set<string>();
  collectVariables(ast, variables);
  return { ast, variables: [...variables].sort() };
}

function collectVariables(node: MathNode, into: Set<string>) {
  switch (node.kind) {
    case 'variable':
      into.add(node.name);
      return;
    case 'unary':
    case 'abs':
      collectVariables(node.operand, into);
      return;
    case 'binary':
      collectVariables(node.left, into);
      collectVariables(node.right, into);
      return;
    case 'call':
      for (const arg of node.args) collectVariables(arg, into);
      return;
    default:
      return;
  }
}

export type EvaluationLimits = {
  /** Maximum evaluation steps across one sampling run. */
  maxSteps: number;
  /** Values whose magnitude exceeds this are treated as non-finite. */
  maxMagnitude: number;
};

const DEFAULT_LIMITS: EvaluationLimits = { maxSteps: 20_000, maxMagnitude: 1e12 };

/** Evaluate a parsed expression. Returns null when the point is outside the
 * domain or the computation exceeds a limit — callers must render that as a
 * gap, never as a fabricated value. */
export function evaluateExpression(
  node: MathNode,
  scope: Readonly<Record<string, number>>,
  limits: Partial<EvaluationLimits> = {},
  budget: { steps: number } = { steps: 0 },
): number | null {
  const value = evaluateNode(node, scope, limits, budget);
  if (value === null) return null;
  const resolved: EvaluationLimits = { ...DEFAULT_LIMITS, ...limits };
  return Math.abs(value) <= resolved.maxMagnitude ? value : null;
}

function evaluateNode(
  node: MathNode,
  scope: Readonly<Record<string, number>>,
  limits: Partial<EvaluationLimits>,
  budget: { steps: number },
): number | null {
  const resolved: EvaluationLimits = { ...DEFAULT_LIMITS, ...limits };
  budget.steps += 1;
  if (budget.steps > resolved.maxSteps) return null;

  // Only non-finite values are rejected here. Magnitude is checked on the
  // final result, not on intermediates: `1 / 2^n` legitimately passes through
  // large powers while its value stays tiny, and rejecting intermediates
  // would silently truncate an ordinary series.
  const finite = (value: number) => (Number.isFinite(value) ? value : null);

  switch (node.kind) {
    case 'number':
      return finite(node.value);
    case 'variable': {
      const value = scope[node.name];
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      return finite(value);
    }
    case 'unary': {
      const operand = evaluateNode(node.operand, scope, limits, budget);
      if (operand === null) return null;
      return finite(node.op === '-' ? -operand : operand);
    }
    case 'abs': {
      const operand = evaluateNode(node.operand, scope, limits, budget);
      if (operand === null) return null;
      return finite(Math.abs(operand));
    }
    case 'binary': {
      const left = evaluateNode(node.left, scope, limits, budget);
      if (left === null) return null;
      const right = evaluateNode(node.right, scope, limits, budget);
      if (right === null) return null;
      switch (node.op) {
        case '+':
          return finite(left + right);
        case '-':
          return finite(left - right);
        case '*':
          return finite(left * right);
        case '/':
          return right === 0 ? null : finite(left / right);
        case '^': {
          const value = Math.pow(left, right);
          return Number.isFinite(value) ? finite(value) : null;
        }
      }
      return null;
    }
    case 'call': {
      const args: number[] = [];
      for (const arg of node.args) {
        const value = evaluateNode(arg, scope, limits, budget);
        if (value === null) return null;
        args.push(value);
      }
      return finite(applyFunction(node.name, args[0]));
    }
    default:
      return null;
  }
}

function applyFunction(name: AllowedFunction, value: number): number {
  switch (name) {
    case 'sin':
      return Math.sin(value);
    case 'cos':
      return Math.cos(value);
    case 'tan':
      return Math.tan(value);
    case 'asin':
      return Math.asin(value);
    case 'acos':
      return Math.acos(value);
    case 'atan':
      return Math.atan(value);
    case 'exp':
      return Math.exp(value);
    case 'ln':
      return Math.log(value);
    case 'log':
      return Math.log10(value);
    case 'sqrt':
      return Math.sqrt(value);
    case 'abs':
      return Math.abs(value);
    case 'floor':
      return Math.floor(value);
    case 'ceil':
      return Math.ceil(value);
    case 'sign':
      return Math.sign(value);
    default:
      return Number.NaN;
  }
}

export type SamplePoint = { x: number; y: number | null };

/** Sample a single-variable function over [from, to]. Returns null for points
 * outside the domain so a discontinuity renders as a gap. The sample count is
 * bounded by the caller's limit. */
export function sampleFunction(
  expression: ParsedExpression,
  options: {
    variable: string;
    from: number;
    to: number;
    samples: number;
    parameters?: Readonly<Record<string, number>>;
    maxSamples?: number;
  },
): SamplePoint[] {
  const maxSamples = Math.min(options.maxSamples ?? 4000, 4000);
  const samples = Math.max(2, Math.min(Math.floor(options.samples), maxSamples));
  if (!Number.isFinite(options.from) || !Number.isFinite(options.to) || options.to === options.from)
    return [];
  const [from, to] = options.from < options.to ? [options.from, options.to] : [options.to, options.from];
  const step = (to - from) / (samples - 1);
  const points: SamplePoint[] = [];
  const budget = { steps: 0 };
  for (let index = 0; index < samples; index += 1) {
    const x = from + step * index;
    const scope = { ...(options.parameters ?? {}), [options.variable]: x };
    points.push({ x, y: evaluateExpression(expression.ast, scope, {}, budget) });
  }
  return points;
}
