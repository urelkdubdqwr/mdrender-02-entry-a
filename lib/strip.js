export function stripInline(text, refs) {
  let out = ''; let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\\\' && i + 1 < text.length) { out += text[i + 1]; i += 2; continue; }
    if (ch === '`') {
      const n = countRun(text, i, '`');
      const close = findTick(text, i + n, n);
      if (close >= 0) { out += text.slice(i + n, close).trim() === '' ? '' : text.slice(i + n, close); i = close + n; continue; }
      out += text.slice(i, i + n); i += n; continue;
    }
    if (ch === '<') {
      const end = findAngleEnd(text, i);
      if (end > i) { i = end; continue; }
    }
    out += ch; i++;
  }
  return out;
}
function countRun(text, i, ch) { let n = 0; while (text[i + n] === ch) n++; return n; }
function findTick(text, from, n) {
  for (let j = from; j < text.length; j++) {
    if (text[j] === '`') { const k = countRun(text, j, '`'); if (k === n) return j; j += k - 1; }
  }
  return -1;
}
function findAngleEnd(text, i) {
  const re = /^<(\/?[A-Za-z][A-Za-z0-9-]*(?:\\s[^<>]*)?|!--[\\s\\S]*?--|![A-Za-z][^<>]*|\\?[\\s\\S]*?\\?)>/;
  const m = re.exec(text.slice(i));
  return m ? i + m[0].length : -1;
}
