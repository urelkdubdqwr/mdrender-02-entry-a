import { renderInline } from './inline.js';

export function parse(markdown) {
  const src = String(markdown).replace(/\r\n|\r/g, '\n');
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  const isBlank = (l) => /^[ \t]*$/.test(l);
  const leadCols = (l) => { let c = 0; for (const ch of l) { if (ch === ' ') c++; else if (ch === '\t') c += 4 - (c % 4); else break; } return c; };
  const stripCols = (l, n) => { let c = 0, k = 0; while (k < l.length && c < n) { const ch = l[k]; if (ch === ' ') c++; else if (ch === '\t') c += 4 - (c % 4); else break; k++; } return l.slice(k); };
  const decode = (t) => t.replace(/[&<>"']/g, (c) => "&" + ({ '&': "amp;", '<': "lt;", '>': "gt;", '"': "quot;", "'": "#39;" }[c]));
  while (i < lines.length) {
    let raw = lines[i];
    if (isBlank(raw)) { i++; continue; }
    if (leadCols(raw) >= 4) {
      const buf = [];
      while (i < lines.length && (leadCols(lines[i]) >= 4 || isBlank(lines[i]))) {
        if (isBlank(lines[i])) { buf.push(""); i++; continue; }
        buf.push(stripCols(lines[i], 4)); i++;
      }
      while (buf.length && isBlank(buf[buf.length - 1])) buf.pop();
      out.push("<pre><code>" + decode(buf.join("\n")) + "\n</code></pre>");
      continue;
    }
    const indent = raw.match(/^ {0,3}/)[0].length;
    const line = raw.slice(indent);
    if (/^#{1,6}([ \t]|$)/.test(line)) {
      const m = line.match(/^(#{1,6})([ \t]*)(.*)$/);
      const level = m[1].length;
      let text = m[3].replace(/[ \t]+#+[ \t]*$/, '').replace(/[ \t]+$/, '');
      out.push('<h' + level + '>' + renderInline(text) + '</h' + level + '>');
      i++;
      continue;
    }
    const para = [raw];
    i++;
    while (i < lines.length && !isBlank(lines[i])) { para.push(lines[i]); i++; }
    out.push('<p>' + renderInline(para.join('\n')) + '</p>');
  }
  return out.join('\n') + (out.length ? '\n' : '');
}
