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

const blocks = [];
function listItem(l) { return /^([-+*]|\d{1,9}[.)])([ \t]+|$)/.test(l); }
function bqStrip(l) { const m = l.match(/^ {0,3}> ?/); return m ? l.slice(m[0].length) : null; }
function bqIndent(l) { const m = l.match(/^ {0,3}> ?/); return m ? l.slice(m[0].length) : null; }
function isEmptyQuote(l) { return /^ {0,3}>[ \t]*$/.test(l); }
function isMarkerLine(l) { return /^ {0,3}>( |$)/.test(l); }
function blank(l) { return /^[ \t]*$/.test(l); }
function codeIndent(l) { const st = bqStrip(l); const rest = st !== null ? st : l; return leadCols(rest) >= 4; }
function isHrLine(l) { return isHr(bqIndent(l) || ''); }
function isSkipStart(l) { return nonPara(l); }
function isFenceLine(l) { const t = bqIndent(l); if (t === null) return false; return /^(`{3,}|~{3,})/.test(t); }
function nonPara(l) {
  const t = bqIndent(l); if (t === null) return false;
  if (isHr(t) || listItem(t) || isFenceLine(l)) return true;
  if (setextLevel(t)) return true;
  return atxHeading(t) !== null;
}
export function blockquote(lines, i) {
  const inner = [];
  let j = i;
  while (j < lines.length) {
    const st = bqIndent(lines[j]);
    if (st !== null) { inner.push(st); j++; continue; }
    if (blank(lines[j])) {
      let k = j + 1;
      while (k < lines.length && blank(lines[k])) k++;
      break;
    }
    const prev = inner.length ? inner[inner.length - 1] : '';
    if (prev === '') break;
    if (isHr(lines[j]) || setextLevel(lines[j]) || listItem(lines[j]) || nonPara(lines[j - 1])) break;
    const st2 = bqStrip(lines[j]);
    if (st2 !== null) inner.push(st2);
    else { let t = j; while (t < lines.length && blank(lines[t])) t++; const nxt = t < lines.length && bqIndent(lines[t]) !== null && !isEmptyQuote(lines[t]); inner.push(nxt ? stripCols(lines[j], 4) : lines[j]); }
    j++;
    if (nonPara(lines[j - 1]) || isSkipStart(inner[inner.length - 1])) { const last2 = inner[inner.length - 1]; let t = j; while (t < lines.length && blank(lines[t])) t++; if (t < lines.length && bqIndent(lines[t]) !== null && !isEmptyQuote(lines[t])) { j = t; } }
  }
  const last = inner.length ? inner[inner.length - 1] : null;
  if (last !== null && !blank(last) && !nonPara(last) && !setextLevel(last)) {
    let k = j;
    while (k < lines.length && blank(lines[k])) k++;
    if (k < lines.length && bqIndent(lines[k]) !== null && !isEmptyQuote(lines[k])) {
      for (let t = j; t < k; t++) inner.push('');
      j = k;
    }
  }
  return { inner: inner.join('\n'), next: j };
}
