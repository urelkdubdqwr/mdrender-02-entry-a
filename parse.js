import { renderInline, escapeText } from './inline.js';
import { fence, leadCols, stripCols, isHr, setextLevel, atxHeading } from './blocks.js';

export function parse(markdown) {
  const src = String(markdown).replace(/\r\n|\r/g, '\n');
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  const isBlank = (l) => /^[ \t]*$/.test(l);
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
    if (raw.trimStart().startsWith('```') || raw.trimStart().startsWith('~~~')) {
      const f = fence(lines, i);
      if (f) { out.push(f.html); i = f.next; continue; }
    }
    const indent = raw.match(/^ {0,3}/)[0].length;
    const line = raw.slice(indent);
    if (isHr(line)) { out.push('<hr>'); i++; continue; }
    const h = atxHeading(line);
    if (h) { out.push('<h' + h.level + '>' + renderInline(h.text) + '</h' + h.level + '>'); i++; continue; }
    const para = [raw];
    i++;
    let setext = 0;
    while (i < lines.length && !isBlank(lines[i])) {
      const nx = lines[i].replace(/^ {0,3}/, '');
      const lv = setextLevel(nx);
      if (lv) { setext = lv; i++; break; }
      if (isHr(nx)) break;
      para.push(lines[i]); i++;
    }
    if (setext) out.push('<h' + setext + '>' + renderInline(para.join('\n')) + '</h' + setext + '>');
    else out.push('<p>' + renderInline(para.join('\n')) + '</p>');
  }
  return out.join('\n') + (out.length ? '\n' : '');
}
