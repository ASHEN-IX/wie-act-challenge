/** Lightweight tokenization for readable code display.
 *
 * No parser plugin, HTML injection or execution path is involved. The result is
 * a bounded list of text tokens rendered through ordinary React spans. */

export type CodeToken = { text: string; className?: string };

const KEYWORDS = new Set([
  'and', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const',
  'continue', 'def', 'default', 'do', 'else', 'enum', 'except', 'export',
  'extends', 'false', 'finally', 'for', 'from', 'function', 'if', 'import',
  'in', 'interface', 'let', 'new', 'none', 'null', 'of', 'or', 'pass', 'return',
  'select', 'from', 'where', 'join', 'on', 'insert', 'into', 'values', 'true',
  'try', 'type', 'typeof', 'var', 'while', 'with', 'yield',
]);

const TOKEN = /(\/\/[^\n]*|#(?![\w-])[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)\b/g;

/** Comments are only recognized for C-like/SQL/Shell formats; a Python `#`
 * is recognized too. Other languages retain their operators and punctuation. */
export function tokenizeCode(code: string, language: string): CodeToken[] {
  const supported = /^(javascript|typescript|tsx|jsx|js|ts|python|py|sql|bash|sh|shell|json|yaml|yml|java|c|cpp|c\+\+|go|rust|rs)$/i.test(
    language || '',
  );
  if (!supported) return [{ text: code }];
  // Keep source tokens around markup delimiters intact. React still escapes
  // every token, but a displayed `<script>` must not look like executable HTML.
  if (/<[^>]*>/.test(code)) return [{ text: code }];
  const tokens: CodeToken[] = [];
  let cursor = 0;
  for (const match of code.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ text: code.slice(cursor, index) });
    const [text, comment, literal, number, word] = match;
    if (comment) tokens.push({ text, className: 'text-slate-400 italic' });
    else if (literal) tokens.push({ text, className: 'text-emerald-300' });
    else if (number) tokens.push({ text, className: 'text-amber-300' });
    else if (word && KEYWORDS.has(word.toLowerCase()))
      tokens.push({ text, className: 'text-sky-300 font-medium' });
    else tokens.push({ text });
    cursor = index + text.length;
  }
  if (cursor < code.length) tokens.push({ text: code.slice(cursor) });
  return tokens;
}
