import { renderInline, escapeText } from './inline.js';
import { fence, leadCols, stripCols, isHr, setextLevel, atxHeading, blockquote } from './blocks.js';

export function parse(markdown) {
  return renderBlocks(String(markdown).replace(/\r\n|\r/g, '\n'));
}

export function renderBlocks(src) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  const isBlank = (l) => /^[ \t]*$/.test(l);
  const isBq = (l) => /^ {0,3}>/.test(l);
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
    if (isBq(line)) {
      const bq = blockquote(lines, i);
      const extra = para.slice(1);
      const inner = extra.length ? extra.join('\n') + '\n' + bq.inner : bq.inner;
      out.push('<blockquote>\n' + renderBlocks(inner) + '</blockquote>');
      i = bq.next;
      continue;
    }
    let setext = 0;
    let paraBq = null;
    while (i < lines.length && !isBlank(lines[i])) {
      const nx = lines[i].replace(/^ {0,3}/, '');
      const lv = setextLevel(nx);
      if (lv) { setext = lv; i++; break; }
      if (isHr(nx)) break;
      { const pm = nx.match(/^(#{1,6})(?:[ \t]+|$)/); if (pm) break; }
      { let bqm = 0; for (const ch of nx) { if (ch === ' ') bqm++; else break; } if (bqm >= 4) break; }
      { const bq2 = blockquote(lines, i); const ex = para.slice(1); paraBq = (ex.length ? ex.join('\n') + '\n' : '') + bq2.inner; i = bq2.next; break; }
      para.push(lines[i]); i++;
    }
    if (paraBq !== null) {
      if (setext) out.push('<h' + setext + '>' + renderInline(para.join('\n')) + '</h' + setext + '>');
      out.push('<p>' + renderInline(para.join('\n')) + '</p>');
      out.push('<blockquote>\n' + renderBlocks(paraBq) + '</blockquote>');
    } else if (setext) out.push('<h' + setext + '>' + renderInline(para.join('\n')) + '</h' + setext + '>');
    else out.push('<p>' + renderInline(para.join('\n')) + '</p>');
  }
  return out.join('\n') + (out.length ? '\n' : '');
}
