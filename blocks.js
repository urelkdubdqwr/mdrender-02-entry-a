import { escapeText } from './inline.js';

export function leadCols(l) { let c = 0; for (const ch of l) { if (ch === ' ') c++; else if (ch === '\t') c += 4 - (c % 4); else break; } return c; }
export function stripCols(l, n) {
  let col = 0, k = 0;
  while (k < l.length && col < n) {
    const ch = l[k];
    if (ch === ' ') { col++; k++; }
    else if (ch.charCodeAt(0) === 9) {
      const adv = 4 - (col % 4);
      const rem = n - col;
      if (adv <= rem) { col += adv; k++; }
      else { return ' '.repeat(adv - rem) + l.slice(k + 1); }
    }
    else break;
  }
  return l.slice(k);
}

// returns {html, next} or null
export function fence(lines, i) {
  const raw = lines[i];
  const indent = Math.min(leadCols(raw), 3);
  const line = stripCols(raw, indent);
  const m = line.match(/^(`{3,}|~{3,})(.*)$/);
  if (!m) return null;
  const marker = m[1][0];
  const len = m[1].length;
  let info = m[2].trim();
  if (marker === '`' && info.includes('`')) return null;
  info = info.split(/\s+/)[0] || '';
  const buf = [];
  let j = i + 1;
  for (; j < lines.length; j++) {
    const cl = stripCols(lines[j], indent);
    const cm = cl.match(/^( {0,3})(`{3,}|~{3,})[ \t]*$/);
    if (cm && cm[2][0] === marker && cm[2].length >= len) break;
    buf.push(stripCols(lines[j], indent));
  }
  const cls = info ? ' class="language-' + escapeText(info) + '"' : '';
  const closed = j < lines.length;
  const html = '<pre><code' + cls + '>' + escapeText(buf.join('\n')) + (closed ? '\n' : '') + '</code></pre>';
  return { html, next: j + 1 };
}

export function isHr(line) {
  const t = line.replace(/[ 	]/g, '');
  return /^(\*{3,}|-{3,}|_{3,})$/.test(t);
}
export function setextLevel(line) {
  const t = line.trim();
  if (/^=+$/.test(t)) return 1;
  if (/^-+$/.test(t)) return 2;
  return 0;
}
export function atxHeading(line) {
  const m = line.match(/^(#{1,6})([ \t]+)(.*)$/);
  if (!m) { const e = line.match(/^(#{1,6})[ \t]*$/); if (e) return { level: e[1].length, text: '' }; return null; }
  let text = m[3].replace(/[ \t]+$/, '');
  const c = text.match(/[ \t]+#+$/);
  if (c) text = text.slice(0, text.length - c[0].length);
  return { level: m[1].length, text };
}

function bqStrip(l) { const m = l.match(/^ {0,3}> ?/); return m ? l.slice(m[0].length) : null; }
function blank(l) { return /^[ \t]*$/.test(l); }
function fenceOpen(l) { return /^ {0,3}(`{3,}|~{3,})/.test(l); }
function listStart(l) { return /^([-+*]|\d{1,9}[.)])([ \t]+|$)/.test(l); }
function paraStop(l) {
  const t = l.replace(/^ {0,3}/, '');
  if (/^(#{1,6})([ \t]+|$)/.test(t)) return true;
  if (fenceOpen(t) || isHr(t)) return true;
  return false;
}

// Return the inner text (joined) of a blockquote starting at line i, plus next index.
export function blockquote(lines, i) {
  const inner = [];
  let j = i;
  while (j < lines.length) {
    const l = lines[j];
    if (/^ {0,3}>/.test(l)) { inner.push(bqStrip(l)); j++; continue; }
    if (j > i && blank(l)) {
      const k = j + 1;
      if (k < lines.length && /^ {0,3}>/.test(lines[k])) { inner.push(''); j++; continue; }
      break;
    }
    if (j === i) break;
    const prev = inner[inner.length - 1];
    if (prev === '' || prev === undefined) break;
    // lazy paragraph continuation (never for indented code); must stay in same paragraph
    if (leadCols(l) >= 4) break;
    if (/^ {0,3}(#{1,6})([ \t]+|$)/.test(l) || isHr(l.replace(/^ {0,3}/, ''))) break;
    inner.push(l); j++;
  }
  return { inner: inner.join('\n'), next: j };
}
