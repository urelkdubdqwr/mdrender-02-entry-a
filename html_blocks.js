import { BLOCK_TAGS } from './html_blocks_tags.js';

const OPEN_ONLY = /^<(script|pre|style|textarea)(?=[\s>\/]|$)/i;
const CLOSE_BLOCK = /^<\/(address|article|aside|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \t]|\/?>|$)/i;
const OPEN_TAG = /^<(?:[a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?\/?>/;
const CLOSE_TAG = /^<\/[a-zA-Z][a-zA-Z0-9-]*\s*>/;
const CLOSE_FIRST = /^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/;

const strip3 = (s) => s.replace(/^ {0,3}/, '');

// Resolve one HTML block starting at line i. Returns {html,next} or null.
// type 1-5: end at a particular marker (or document end). type 6/7: end at blank line (or document end).
export function htmlBlock(lines, i, isBlank) {
  const n = lines.length;
  const line = lines[i];
  if (line[0] !== '<') return null;
  let m = OPEN_ONLY.exec(line);
  if (m) {
    const re = new RegExp('</' + m[1] + '[ \\t>]', 'i');
    for (let k = i; k < n; k++) if (re.test(lines[k])) return { html: join(lines, i, k + 1), next: k + 1 };
    return { html: join(lines, i, n), next: n };
  }
  if (/^<!--/.test(line)) return until(lines, i, (t) => t.includes('-->', 4) ? 4 : -1);
  if (/^<\?/.test(line)) return until(lines, i, (t) => t.includes('?>', 2) ? 2 : -1);
  if (/^<![A-Za-z]/.test(line)) return until(lines, i, (t) => t.includes('>', 2) ? 2 : -1);
  if (/^<!\[CDATA\[/.test(line)) return until(lines, i, (t) => t.includes(']]>', 9) ? 9 : -1);
  if (CLOSE_BLOCK.test(line)) return blankPend(lines, i, isBlank);
  const om = /^<([a-zA-Z][a-zA-Z0-9-]*)(?:[ \t]|>|\/>|$)/.exec(line);
  if (om) {
    if (om[1].toLowerCase() === 'script' || om[1].toLowerCase() === 'pre' || om[1].toLowerCase() === 'style' || om[1].toLowerCase() === 'textarea') {
      const re = new RegExp('</' + om[1] + '[ \\t>]', 'i');
      for (let k = i; k < n; k++) if (re.test(lines[k])) return { html: join(lines, i, k + 1), next: k + 1 };
      return { html: join(lines, i, n), next: n };
    }
    if (BLOCK_TAGS.has(om[1].toLowerCase())) return blankPend(lines, i, isBlank);
  }
  if (completeTag(line)) return blankPend(lines, i, isBlank);
  return null;
}

// Find the end of a single marker line (inline terminator). Returns {html,next} or null.
function until(lines, i, hit) {
  const n = lines.length;
  for (let k = i; k < n; k++) {
    const t = lines.slice(i, k + 1).join('\n');
    if (hit(t) >= 0) return { html: join(lines, i, k + 1), next: k + 1 };
  }
  return { html: join(lines, i, n), next: n };
}

// type 6/7: consume to the first blank line, but a blank line ends before it.
function blankPend(lines, i, isBlank) {
  const n = lines.length;
  for (let k = i + 1; k < n; k++) if (isBlank(lines[k])) return { html: join(lines, i, k), next: k };
  return { html: join(lines, i, n), next: n };
}

// type 7: a complete open/close tag on the line, ignoring quoted > and <>-free text.
export function completeTag(line) {
  const t = strip3(line);
  let j = 0;
  if (t[j] !== '<') return false;
  if (t[1] === '/') j = 2; else j = 1;
  if (!/[a-zA-Z]/.test(t[j])) return false;
  while (j < t.length && /[a-zA-Z0-9-]/.test(t[j])) j++;
  if (!/[ \t/]/.test(t[j]) && t[j] !== '>') return false;
  let q = 0;
  for (; j < t.length; j++) {
    const c = t[j];
    if (q) { if (c === q) q = 0; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '<') return false;
    if (c === '>') return true;
  }
  return false;
}

function join(lines, a, b) {
  const o = [];
  for (let k = a; k < b; k++) o.push(k === a ? strip3(lines[k]) : lines[k]);
  return o.join('\n');
}
