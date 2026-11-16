export function parseRefDefs(lines) {
  const dst = {};
  const pass = new Set();
  let i = 0;
  while (i < lines.length) {
    if (/^ {0,3}\[/.test(lines[i])) {
      const def = parseRefDef(lines, i);
      if (def) { for (let k = i; k < def.next; k++) pass.add(k); if (!(def.norm in dst)) dst[def.norm] = { href: def.href, title: def.title }; i = def.next; continue; }
    }
    i++;
  }
  return { map: dst, pass };
}

function skipWs(s, p) { while (p < s.length && (s[p] === ' ' || s[p] === '\t')) p++; return p; }
function decodeEnt(t) {
  return t.replace(/&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (m, e) => {
    if (e[0] === '#') { const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(cp); } catch { return '\ufffd'; } }
    return DECODE[e] ?? '\ufffd';
  });
}
function norm(s) { return decodeEnt(s.toLowerCase().replace(/[ \t]+/g, ' ').replace(/^ | $/g, '')); }
function matchTitle(s, p) {
  const q = s[p], end = q === '(' ? ')' : q;
  if (q !== '"' && q !== "'" && q !== '(') return null;
  let v = '', k = p + 1;
  while (k < s.length) {
    if (s[k] === '\\' && k + 1 < s.length && /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(s[k + 1])) { v += s[k + 1]; k += 2; continue; }
    if (s[k] === end) return { title: v, end: k + 1 };
    v += s[k]; k++;
  }
  return null;
}
export function parseRefDef(lines, i) {
  let s = lines[i].replace(/^ {0,3}/, '');
  let p = 0, k = i;
  while (k < lines.length) {
    if (!/^ *\[/.test(s)) return null;
    p = skipWs(s, 0); p++;
    let label = '', closed = -1;
    while (k < lines.length) {
      let q = p;
      while (q < s.length) {
        if (s[q] === '\\') { label += s[q + 1] ?? ''; q += 2; continue; }
        if (s[q] === ']') { closed = q; break; }
        if (s[q] === '[') return null;
        label += s[q]; q++;
      }
      if (closed >= 0) break;
      k++; if (k >= lines.length) return null; s = lines[k].replace(/^ {0,3}/, ''); label += '\n'; p = 0;
    }
    if (label.replace(/[\s\n]/g, '') === '' || label.length > 999) return null;
    p = skipWs(s, closed + 1); if (s[p] !== ':') return null;
    p = skipWs(s, p + 1);
    if (p >= s.length) { k++; if (k >= lines.length) return null; s = lines[k].replace(/^ {0,3}/, ''); p = skipWs(s, 0); }
    let dest;
    if (s[p] === '<') {
      let v = '', q = p + 1, ok = false;
      while (q < s.length) { if (s[q] === '>') { ok = true; break; } if (s[q] === '<' || s[q] === '\n') return null; v += s[q]; q++; }
      if (!ok) return null; dest = v; p = q + 1;
    } else {
      let v = '', q = p, depth = 0;
      while (q < s.length) {
        const c = s[q];
        if (c === '\\' && q + 1 < s.length && !/[ \t\n]/.test(s[q + 1])) { v += s[q + 1]; q += 2; continue; }
        if (c === '(') depth++;
        else if (c === ')') { if (depth === 0) break; depth--; }
        else if ((c === ' ' || c === '\t') && depth === 0) break;
        v += c; q++;
      }
      if (v === '') return null; dest = v; p = q;
    }
    p = skipWs(s, p);
    let title = null;
    if (p < s.length && (s[p] === '"' || s[p] === "'" || s[p] === '(')) {
      const tm = matchTitle(s, p);
      if (tm) { title = tm.title.replace(/\n/g, '\n'); p = skipWs(s, tm.end); }
    }
    if (p < s.length) return null;
    return { label, norm: norm(label), href: dest, title, next: k + 1 };
  }
  return null;
}
