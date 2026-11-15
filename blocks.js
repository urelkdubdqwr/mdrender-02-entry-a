import { escapeText } from './inline.js';

export function leadCols(l) { let c = 0; for (const ch of l) { if (ch === ' ') c++; else if (ch === '\t') c += 4 - (c % 4); else break; } return c; }
export function stripCols(l, n) { let c = 0, k = 0; while (k < l.length && c < n) { const ch = l[k]; if (ch === ' ') c++; else if (ch === '\t') c += 4 - (c % 4); else break; k++; } return l.slice(k); }

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
  const html = '<pre><code' + cls + '>' + escapeText(buf.join('\n')) + (buf.length ? '\n' : '') + '</code></pre>';
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
