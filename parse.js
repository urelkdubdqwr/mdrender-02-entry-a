import { renderInline, finishInline, escapeText } from './inline.js';
import { htmlBlock, completeTag } from './html_blocks.js';
import { parseRefDefs } from './lib/refdefs.js';
import { tableBlock } from './lib/tables.js';
import { fence, leadCols, stripCols, isHr, setextLevel, atxHeading, blockquote, listBlock } from './blocks.js';

function expandLeadingTabs(l) {
  let col = 0, k = 0, out = '';
  const pushTab = () => { const n = 4 - (col % 4); out += ' '.repeat(n); col += n; k++; };
  while (k < l.length) {
    const ch = l[k];
    if (ch === ' ') { out += ' '; col++; k++; continue; }
    if (ch === '\t') { pushTab(); continue; }
    if (ch === '>' && /^ *>/.test(l.slice(k))) { out += '>'; col++; k++; continue; }
    const rest = l.slice(k);
    const lm = rest.match(/^(\d{1,9}[.)]|[-+*])(?=[ \t])/);
    if (col > 0 || k === 0) {
      if (lm) { out += lm[0]; col += lm[0].length; k += lm[0].length; continue; }
      const hm = rest.match(/^#{1,6}(?=[ \t])/);
      if (k === 0 && hm) { out += hm[0]; col += hm[0].length; k += hm[0].length; continue; }
    }
    break;
  }
  return out + l.slice(k);
}

export function parse(markdown) {
  const src = String(markdown).replace(/\r\n|\r/g, '\n');
  const lines = src.split('\n').map(expandLeadingTabs);
  const defs = parseRefDefs(lines);
  return renderBlocks(lines.join('\n'), defs.map, defs.pass);
}

export function renderBlocks(src, refs, pass) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  const isBlank = (l) => /^[ \t]*$/.test(l);
  const decode = (t) => t.replace(/[&<>"']/g, (c) => "&" + ({ '&': "amp;", '<': "lt;", '>': "gt;", '"': "quot;", "'": "#39;" }[c]));
  const defs = refs === undefined ? parseRefDefs(lines) : { map: refs, pass: pass || new Set() };
  while (i < lines.length) {
    let raw = lines[i];
    if (isBlank(raw)) { i++; continue; }
    if (defs.pass.has(i)) { i++; continue; }
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
    if (leadCols(raw) < 4) {
      const hb = htmlBlock(lines, i, isBlank);
      if (hb && (isBlockTagLine(raw) || completeTag(raw))) { out.push(hb.html); i = hb.next === 0 ? i + 1 : hb.next; continue; }
    }
    { const tb = tableBlock(lines, i, (t) => finishInline(renderInline(t, refs), refs)); if (tb) { out.push(tb.html); i = tb.next; continue; } }
    const indent = raw.match(/^ {0,3}/)[0].length;
    const line = raw.slice(indent);
    if (isHr(line)) { out.push('<hr>'); i++; continue; }
    const h = atxHeading(line);
    if (h) { out.push('<h' + h.level + '>' + renderInline(h.text, refs) + '</h' + h.level + '>'); i++; continue; }
    if (/^ {0,3}[-+*]([ \t]|$)/.test(raw) || /^ {0,3}\d{1,9}[.)]([ \t]|$)/.test(raw)) {
      const lb = listBlock(lines, i);
      const tag = lb.ordered ? 'ol' : 'ul';
      const startAttr = lb.ordered && lb.start !== 1 ? ' start="' + lb.start + '"' : '';
      const parts = [];
      for (const segs of lb.items) {
        const it = [];
        for (let si = 0; si < segs.length; si++) {
          let ls = segs[si].lines;
          if (ls.length && (ls[0] === '> ' || ls[0] === '>')) ls = addPrefix(ls, segs[si].blank);
          it.push(renderBlocks(ls.join('\n'), refs));
        }
        const body = it.join('\n');
        if (lb.loose) parts.push('<li>' + body.replace(/\n$/, '') + '\n</li>');
        else parts.push('<li>' + body.replace(/<p>([\s\S]*?)<\/p>\n?(?=<|$)/, '$1') + '</li>');
      }
      out.push('<' + tag + startAttr + '>\n' + parts.join('\n') + '\n</' + tag + '>');
      i = lb.next;
      continue;
    }
    if (/^ {0,3}>/.test(raw)) {
      const bq = blockquote(lines, i);
      out.push('<blockquote>\n' + renderBlocks(bq.inner, refs) + '</blockquote>');
      i = bq.next;
      continue;
    }
    const para = [raw];
    i++;
    let setext = 0;
    while (i < lines.length && !isBlank(lines[i])) {
      const nx = lines[i].replace(/^ {0,3}/, '');
      const lv = setextLevel(nx);
      if (lv) { setext = lv; i++; break; }
      if (isHr(nx)) break;
      if (/^(#{1,6})(?:[ \t]+|$)/.test(nx)) break;
      if (/^([-+*])(?:[ \t]+|$)/.test(nx) || /^(\d{1,9})[.)](?:[ \t]+|$)/.test(nx)) { const om=nx.match(/^(\d{1,9})[.)]/); if(!om||om[1]==='1') break; }
      if (/^ {0,3}>/.test(lines[i])) break;
      { let c = 0; for (const ch of nx) { if (ch === ' ') c++; else break; } if (c >= 4) break; }
      para.push(lines[i]); i++;
    }
    if (setext) out.push('<h' + setext + '>' + renderInline(para.join('\n'), refs) + '</h' + setext + '>');
    else out.push('<p>' + renderInline(para.join('\n'), refs) + '</p>');
  }
  return out.join('\n') + (out.length ? '\n' : '');
}

// A handful of leading constructs are real HTML blocks regardless of closing '>'.
function isBlockTagLine(raw) {
  const t = raw.replace(/^ {0,3}/, '');
  return /^(<!--|<\?|<!\[CDATA\[)/.test(t) || /^<(script|pre|style|textarea)(?=[\s>\/]|$)/i.test(t);
}

function taskPrefix(line) {
  return line.replace(/^\[([ xX])\][ \t]+/, (m, c) => '<input ' + (c === ' ' ? '' : 'checked="" ') + 'disabled="" type="checkbox"> ');
}
function addPrefix(lines, blank) {
  const o = lines.slice();
  for (let k = 0; k < o.length; k++) {
    if (!blank && k === 0) o[k] = taskPrefix(o[k]);
    if (o[k] !== '') o[k] = '> ' + o[k];
    else o[k] = '>';
  }
  return o;
}

