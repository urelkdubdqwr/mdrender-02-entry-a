export function isDelimRow(line) {
  const t = line.replace(/^ {0,3}/, '').replace(/[ \t]+$/, '');
  if (!t.includes('|')) return null;
  let s = t;
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = splitCells(s);
  if (!cells.length) return null;
  const aligns = [];
  for (const cell of cells) {
    const c = cell.replace(/[ \t]/g, '');
    if (!/^:?-+:?$/.test(c)) return null;
    aligns.push(c.startsWith(':') && c.endsWith(':') ? 'center' : c.startsWith(':') ? 'left' : c.endsWith(':') ? 'right' : null);
  }
  return aligns;
}

function splitCells(s) {
  const cells = [];
  let cur = '', esc = false;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (esc) { esc = false; cur += ch; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '|') { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

function rowCells(line) {
  let t = line.replace(/^ {0,3}/, '').replace(/[ \t]+$/, '');
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return splitCells(t).map((c) => c.replace(/^[ \t]+|[ \t]+$/g, ''));
}

export function tableBlock(lines, i, inline) {
  if (i + 1 >= lines.length) return null;
  if (isDelimRow(lines[i])) return null;
  const aligns = isDelimRow(lines[i + 1]);
  const header = rowCells(lines[i]);
  if (!aligns || !lines[i].includes('|')) return null;
  if (header.length !== aligns.length) return null;
  if (aligns.length < 2 && header.length > aligns.length) { header.pop(); aligns.pop(); }
  const body = [];
  let j = i + 2;
  for (; j < lines.length; j++) {
    const line = lines[j];
    if (/^ {0,3}([ \t]*)$/.test(line)) break;
    if (/^ {4,}/.test(line)) break;
    if (/^ {0,3}\d{1,9}[.)]([ \t]|$)/.test(line)) break;
    if (/^ {0,3}>/.test(line)) break;
    if (/^ {0,3}([-+*]|\d{1,9}[.)])([ \t]|$)/.test(line)) break;
    body.push(rowCells(line));
  }
  const cell = (t, al) => '<td' + (al ? ' align="' + al + '"' : '') + '>' + inline(t) + '</td>';
  let out = '<table>\n<thead>\n<tr>\n' + header.map((t, c) => '<th' + (aligns[c] ? ' align="' + aligns[c] + '"' : '') + '>' + inline(t) + '</th>').join('\n') + '\n</tr>\n</thead>\n';
  if (body.length) {
    out += '<tbody>' + body.map((r) => '<tr>\n' + aligns.map((al, c) => cell(r[c] === undefined ? '' : r[c], al)).join('\n') + '\n</tr>').join('\n') + '\n</tbody>';
  }
  out += '</table>';
  return { html: out, next: j };
}
