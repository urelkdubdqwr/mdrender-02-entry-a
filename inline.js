const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeText(text) {
  return text.replace(/[&<>"']/g, (c) => ESC[c]);
}
export function renderInline(text, refs) {
  return escapeText(text).replace(/\\([\\`*{}\[\]()#+\-.!_>~|"$%&'/:;<=?@^])/g, '$1');
}
