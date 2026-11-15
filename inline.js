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
  return escapeText(text).replace(/\\([\\`*{}\[\]()#+\-.!_>~|"$%&'/:;<=?@^])/g, '$1');
}
