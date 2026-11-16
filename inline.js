const ENT = /&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/;
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeLt(text) {
  return text.replace(/</g, '&lt;');
}
export function escapeText(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '&') {
      const m = ENT.exec(text.slice(i));
      if (m && m.index === 0) { out += m[0]; i += m[0].length; continue; }
      out += '&amp;'; i++; continue;
    }
    if (ch === '<') { out += '&lt;'; i++; continue; }
    out += ch; i++;
  }
  return out;
}
export function renderInline(text, refs) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length && isCodeSpecial(text[i + 1])) {
      out += '\\' + text[i + 1]; i += 2; continue;
    }
    if (ch === '`') {
      const n = runLen(text, i, '`');
      const close = findTick(text, i + n, n);
      if (close >= 0) { out += text.slice(i, close + n); i = close + n; continue; }
      out += escapeText(text.slice(i, i + n)); i += n; continue;
    }
    out += escapeText(ch); i++;
  }
  return out;
}
export function finishInline(text, refs) {
  return text.replace(/\\([\\`*{}\[\]()#+\-.!_>~|"$%&'/:;<=?@^])/g, '$1');
}
function isCodeSpecial(c) { return c === '`' || c === '\\' || c === '<' || c === '&'; }
function runLen(text, i, ch) {
  let n = 0;
  while (text[i + n] === ch) n++;
  return n;
}
function findTick(text, from, n) {
  for (let j = from; j < text.length; j++) {
    if (text[j] === '`') {
      const k = runLen(text, j, '`');
      if (k === n) return j;
      j += k - 1;
    }
  }
  return -1;
}
