const win={0xFFFD:0xFFFD};
function decodeEntity(src){
  const m=/^&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/.exec(src);
  if(!m) return null;
  const body=m[1]; let cp=null,to=null;
  if(body[0]==='#'){
    if(body[1]==='x'||body[1]==='X') cp=parseInt(body.slice(2),16);
    else { if(body.length<2) return null; cp=parseInt(body.slice(1),10); }
    to = (cp===0||cp>0x10FFFF||(cp>=0xD800&&cp<=0xDFFF))?0xFFFD:cp;
  } else {
    return {raw:m[0],len:m[0].length,value:m[0]};
  }
  return {raw:m[0],len:m[0].length,value:String.fromCodePoint(to)};
}
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
      const d = decodeEntity(text.slice(i));
      if (d) {
        const v = d.value;
        if (v === d.raw) { out += v; }
        else { for (const c of v) out += ESC[c] || c; }
        i += d.len; continue;
      }
      out += '&amp;'; i++; continue;
    }
    if (ch === '<') { out += '&lt;'; i++; continue; }
    if (ch === '>') { out += '&gt;'; i++; continue; }
    if (ch === '"') { out += '&quot;'; i++; continue; }
    if (ch === "'") { out += '&#39;'; i++; continue; }
    out += ch; i++;
  }
  return out;
}

const PUNCTS = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'.split(''));
function isWs(c){ return c===undefined || c===' ' || c==='\t' || c==='\n'; }
function isPunct(c){ return c!==undefined && PUNCTS.has(c); }
function flank(text, runStart, runEnd, ch){
  const before = runStart>0 ? text[runStart-1] : ' ';
  const after = runEnd<text.length ? text[runEnd] : ' ';
  const wsB=isWs(before), wsA=isWs(after), pB=isPunct(before), pA=isPunct(after);
  const left = !wsA && (!pA || wsB || pB);
  const right = !wsB && (!pB || wsA || pA);
  if(ch==='*') return {open:left, close:right};
  return {open:left && (!right || pB), close:right && (!left || pA)};
}
function runAt(text, i, ch){ let n=0; while(text[i+n]===ch) n++; return n; }

function skipBracket(text, j){
  let d=0,k=j+1;
  while(k<text.length){ if(text[k]==='\\'){k+=2;continue;} if(text[k]==='[')d++; else if(text[k]===']'){ if(d===0) return {end:k+1}; d--; } k++; }
  return null;
}

function skipInline(text, i){
  const ch=text[i];
  if(ch==='\\' && i+1<text.length) return i+2;
  if(ch==='`'){ const n=runLen(text,i,'`'); const cl=findTick(text,i+n,n); return cl>=0? cl+n : i+n; }
  if(ch==='[' || ch==='!'){ const st=skipBracket(text, ch==='!'?i+1:i); if(st) return st.end; }
  if(ch==='<'){ const a=autoLink(text,i); if(a) return a.end; const e=angleEnd(text,i); if(e>i) return e; }
  return i+1;
}
export function tryEmphasis(text, i, refs){
  const ch=text[i];
  const run=runAt(text,i,ch);
  let use=0;
  if(run>=3 && text.slice(i,i+3)===ch+ch+ch) use=3;
  else if(run>=2) use=2;
  else use=1;
  const f=flank(text,i,i+run,ch);
  if(!f.open) return null;
  const body=[]; const stack=[];
  let j=i+run;
  while(j<text.length){
    const c=text[j];
    if(c==='\\'||c==='`'||c==='['||c==='!'||c==='<'){ const nj=skipInline(text,j); if(nj!==j+1){ body.push(text.slice(j,nj)); j=nj; continue; } }
    if(c===ch){
      const cr=runAt(text,j,ch);
      const cf=flank(text,j,j+cr,ch);
      if(cf.close && cr>=use){ break; }
      body.push(text.slice(j,j+cr)); j+=cr; continue;
    }
    body.push(c); j++;
  }
  if(j>=text.length) return null;
  const cr=runAt(text,j,ch);
  const inner=text.slice(i+run, j);
  return { html: wrap(ch, use, renderInline(inner, refs)), end: j+use };
}
function wrap(ch, use, html){
  if(use>=3) return '<em><strong>'+html+'</strong></em>';
  if(use===2) return '<strong>'+html+'</strong>';
  return '<em>'+html+'</em>';
}

export function renderInline(text, refs) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      const n = text[i + 1];
      if ('\\`*{}[]()#+-.!_>~|"$%&\'/:;<=?@^'.includes(n)) { out += escapeText(n); i += 2; continue; }
      out += '\\'; i += 1; continue;
    }
    if (ch === '`') {
      const n = runLen(text, i, '`');
      const close = findTick(text, i + n, n);
      if (close >= 0) { out += renderCode(text.slice(i + n, close)); i = close + n; continue; }
      out += escapeText(text.slice(i, i + n)); i += n; continue;
    }
    if (ch === '~') {
      const n = runLen(text, i, '~');
      if (n === 1 || n === 2) {
        const close = findTilde(text, i + n, n);
        if (close >= 0) { out += '<del>' + renderInline(text.slice(i + n, close), refs) + '</del>'; i = close + n; continue; }
      }
      out += escapeText(text.slice(i, i + n)); i += n; continue;
    }
const PUNCT = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
function charRef(t) {
  const d = decodeEntity(t);
  if (d) return { s: d.value, end: d.len };
  let cp = null;
  const m1 = /^&#[xX]([0-9a-fA-F]{1,6})/.exec(t);
  if (m1) cp = parseInt(m1[1], 16);
  else { const m2 = /^&#(\d{1,7})/.exec(t); if (m2) cp = parseInt(m2[1], 10); }
  if (cp === null) return null;
  const bad = cp === 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF);
  return { s: bad ? '\uFFFD' : String.fromCodePoint(cp), end: (m1 || m2)[0].length };
}
function escChar(t) { return t.length > 1 && t[0] === '\\' && PUNCT.includes(t[1]) ? { s: t[1], end: 2 } : null; }
function encodeURI2(s) {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === 0x5c) { out += '%5C'; continue; }
    if (cp > 0x20 && cp < 0x7f) { out += ch; continue; }
    const c = encodeURIComponent(ch);
    if (c.length > 1) { out += c; continue; }
    if (cp > 0x7f || cp < 0x20 || cp === 0x7f) { out += '%' + cp.toString(16).toUpperCase().padStart(2, '0'); continue; }
    out += ch;
  }
  return out;
}
function parseInlineDest(text, i) {
  let out = '';
  if (text[i] === '<') {
    let j = i + 1;
    while (j < text.length && text[j] !== '>') { const c = charRef(text.slice(j)) || escChar(text.slice(j)); if (c) { out += c.s; j += c.end; continue; } if (text[j] === '<' || text[j] === '\n') return null; out += text[j]; j++; }
    if (text[j] !== '>') return null;
    return { href: encodeURI2(out), end: j + 1 };
  }
  let depth = 0, j = i;
  while (j < text.length) {
    const c = charRef(text.slice(j)) || escChar(text.slice(j));
    if (c) { out += c.s; j += c.end; continue; }
    const ch = text[j];
    if (ch === '(' && depth < 32) { depth++; out += ch; j++; continue; }
    if (ch === ')') { if (depth === 0) break; depth--; out += ch; j++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\n') break;
    out += ch; j++;
  }
  if (out === '') return null;
  return { href: encodeURI2(out), end: j };
}
function parseTitle(text, i) {
  const q = text[i];
  const end = q === '(' ? ')' : q;
  if (q !== '"' && q !== "'" && q !== '(') return null;
  let v = '', j = i + 1;
  while (j < text.length) {
    const c = charRef(text.slice(j)) || escChar(text.slice(j));
    if (c) { v += c.s; j += c.end; continue; }
    if (text[j] === end) return { title: v, end: j + 1 };
    v += text[j]; j++;
  }
  return null;
}
function refNorm(label) {
  let s = label.replace(/\s+/g, ' ').replace(/^ | $/g, '');
  let out = '';
  for (let j = 0; j < s.length; j++) {
    if (s[j] === '\\' && j + 1 < s.length && PUNCT.includes(s[j + 1])) { out += s[j + 1]; j++; continue; }
    const c = text2(s.slice(j)); out += c ? c.s : s[j]; if (c) j += c.end - 1;
  }
  return out.toLowerCase();
}
function text2(t) {
  const m = /^&([a-zA-Z][a-zA-Z0-9]{1,31}|#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6});?/.exec(t);
  if (m) { const v = decodeEntity(m[0].endsWith(';') ? m[0] : m[0] + ';'); if (v) return { s: v.value, end: m[0].length }; }
  const c = charRef(t); return c;
}
function parseLink(text, i, refs, isImg) {
  let start = i;
  if (text[i] === '!') { isImg = true; i++; }
  if (text[i] !== '[') return null;
  let label = '', j = i + 1, depth = 0, ok = false;
  const bstack = [];
  while (j < text.length) {
    const ch = text[j];
    if (ch === '\\') { label += text.slice(j, j + 2); j += 2; continue; }
    if (ch === '`') { const n = runLen(text, j, '`'); const cl = findTick(text, j + n, n); if (cl >= 0) { label += text.slice(j, cl + n); j = cl + n; continue; } label += text.slice(j, j + n); j += n; continue; }
    if (ch === '[') { depth++; label += ch; j++; continue; }
    if (ch === ']') {
      if (depth === 0) { ok = true; break; }
      depth--; label += ch; j++; continue;
    }
    if (ch === '!' ) { const inner = parseLinkStart(text, j); label += inner ? text.slice(j, inner.end) : ch; j = inner ? inner.end : j + 1; continue; }
    label += ch; j++;
  }
  if (!ok) return null;
  const labelEnd = j;
  let dest = null, title = null, k = labelEnd + 1;
  if (text[k] === '(') {
    let p = k + 1;
    while (p < text.length && (text[p] === ' ' || text[p] === '\t' || text[p] === '\n')) p++;
    if (text[p] === ')') { dest = { href: '', end: p }; p = p; }
    else {
      const d = parseInlineDest(text, p);
      if (!d) return null;
      dest = d; p = d.end;
    }
    let q = p;
    while (q < text.length && (text[q] === ' ' || text[q] === '\t' || text[q] === '\n')) q++;
    if (text[q] === ')') { q++; }
    else {
      const tm = parseTitle(text, q);
      if (!tm) return null;
      title = tm.title; q = tm.end;
      while (q < text.length && (text[q] === ' ' || text[q] === '\t' || text[q] === '\n')) q++;
      if (text[q] !== ')') return null;
      q++;
    }
    k = q;
    const h = dest.href;
    const inner = renderInline(label, refs);
    const t = title !== null ? ' title="' + escapeText(title) + '"' : '';
    if (isImg) return { html: '<img src="' + h + '" alt="' + altText(label) + '"' + t + '>', end: k };
    return { html: '<a href="' + h + '"' + t + '>' + inner + '</a>', end: k };
  }
  let rl = null;
  if (text[k] === '[') {
    let r = k + 1, raw = '';
    while (r < text.length && text[r] !== ']') { if (text[r] === '\\') { raw += text.slice(r, r + 2); r += 2; continue; } if (text[r] === '[') return null; raw += text[r]; r++; }
    if (r >= text.length) return null;
    rl = raw; k = r + 1;
  }
  const key = refNorm(rl !== null && rl !== '' ? rl : label);
  const d2 = refs && refs.get ? refs.get(key) : (refs && refs[key]);
  if (!d2) return null;
  const h = encodeURI2(d2.href);
  const t = d2.title != null ? ' title="' + escapeText(d2.title) + '"' : '';
  if (isImg) return { html: '<img src="' + h + '" alt="' + altText(label) + '"' + t + '>', end: k };
  return { html: '<a href="' + h + '"' + t + '>' + renderInline(label, refs) + '</a>', end: k };
}
function parseLinkStart(text, j) {
  let d = 0, k = j + 1;
  while (k < text.length) { if (text[k] === '\\') { k += 2; continue; } if (text[k] === '[') d++; else if (text[k] === ']') { if (d === 0) return { end: k + 1 }; d--; } k++; }
  return null;
}
function altText(label) {
  let out = '';
  let i = 0;
  while (i < label.length) {
    if (label[i] === '\\') { out += label[i + 1] ?? ''; i += 2; continue; }
    if (label[i] === '`') { const n = runLen(label, i, '`'); const cl = findTick(label, i + n, n); if (cl >= 0) { out += renderCode(label.slice(i + n, cl)); i = cl + n; continue; } }
    if (label[i] === '!' && label[i + 1] === '[') { const im = parseLink(label, i + 1, refs, true); if (im) { i = im.end; continue; } }
    const c = charRef(label.slice(i)); if (c) { out += c.s; i += c.end; continue; }
    if (label[i] === '<') { const a = autoLink(label, i); if (a) { out += a.text || ''; i = a.end; continue; } }
    out += label[i] === '&' ? '&amp;' : (label[i] === '<' ? '&lt;' : (label[i] === '>' ? '&gt;' : (label[i] === '"' ? '&quot;' : label[i])));
    i++;
  }
  return out.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

    if (ch === '*' || ch === '_') {
      const em = tryEmphasis(text, i, refs);
      if (em) { out += em.html; i = em.end; continue; }
      const n = runLen(text, i, ch);
      out += escapeText(text.slice(i, i + n)); i += n; continue;
    }
    if (ch === '&') { const d = decodeEntity(text.slice(i)); const n = d ? d.len : 1; out += escapeText(text.slice(i, i + n)); i += n; continue; }
    if (ch === '[') { const li = parseLink(text, i, refs); if (li) { out += li.html; i = li.end; continue; } }
    if (ch === '!') { const im = parseLink(text, i + 1, refs, true); if (im) { out += im.html; i = im.end; continue; } }
    if (ch === '<') {
      const a = autoLink(text, i);
      if (a) { out += a.html; i = a.end; continue; }
      const e = angleEnd(text, i);
      if (e > i) { out += text.slice(i, e); i = e; continue; }
    }
    if (ch === 'w' || ch === 'h' || ch === '@') {
      const g = gfmAutoLink(text, i);
      if (g) { out += g.html; i = g.end; continue; }
    }
    if (text[i] === '<') { /* noop */ }
    if (ch === '\n') {
      let j = i - 1, sp = 0;
      while (j >= 0 && text[j] === ' ') { sp++; j--; }
      if (j >= 0 && text[j] === '\\') { out = out.replace(/\\$/, '') + '<br>'; i++; continue; }
      if (sp >= 1) { out = out.slice(0, out.length - sp) + '<br>'; i++; continue; }
      out += '\n'; i++; continue;
    }
    out += escapeText(ch); i++;
  }
  return out;
}
export function finishInline(text, refs) {
  return text.replace(/\\([\\`*{}\[\]()#+\-.!_>~|"$%&'/:;<=?@^])/g, '$1');
}
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

function findTilde(text, from, n) {
  for (let j = from; j < text.length; j++) {
    if (text[j] === '~') { const k = runLen(text, j, '~'); if (k === n) return j; j += k - 1; }
  }
  return -1;
}
function renderCode(c) {
  let t = c.replace(/\n/g, ' ');
  if (t.length > 2 && t[0] === ' ' && t[t.length - 1] === ' ' && /[^ ]/.test(t)) t = t.slice(1, -1);
  return '<code>' + escapeText(t) + '</code>';
}
function angleEnd(text, i) {
  const re = /^<(\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?|![A-Za-z][^<>]*|!--[\s\S]*?--|\?[\s\S]*?\?)>/;
  const m = re.exec(text.slice(i));
  return m ? i + m[0].length : -1;
}

function gfmAutoLink(text, i) {
  if (text[i] !== 'w' && text[i] !== 'h') {
    const e = /^([\w.!#$%&'*+/=?^`{|}~\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?)+)/.exec(text.slice(i));
    if (e && (i === 0 || !/[A-Za-z0-9_\-.]/.test(text[i - 1]))) {
      const a = e[1]; return { html: '<a href="mailto:' + a + '">' + a + '</a>', end: i + a.length };
    }
    return null;
  }
  let m = null;
  if (text.startsWith('www.', i)) {
    m = /^www\.[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+/.exec(text.slice(i));
  } else if (text.startsWith('http://', i) || text.startsWith('https://', i)) {
    const pfx = text.startsWith('https://', i) ? 8 : 7;
    if (!/[A-Za-z0-9_\-]/.test(text[i - 1] || '')) {
      m = new RegExp('^' + text.slice(i, i + pfx) + '[A-Za-z0-9\\-]+(?:\\.[A-Za-z0-9\\-]+)+').exec(text.slice(i));
    }
  }
  if (!m) return null;
  let u = m[0], end = i + u.length;
  while (end < text.length && !' \t\n<'.includes(text[end])) {
    if ('?!.,:*_~'.includes(text[end]) && (end + 1 >= text.length || ' \t\n<'.includes(text[end + 1]))) break;
    end++; u = m[0] + text.slice(i + m[0].length, end);
  }
  while (u.endsWith(')') && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) { u = u.slice(0, -1); end--; }
  const disp = u, href = disp.startsWith('www.') ? 'http://' + disp : disp;
  return { html: '<a href="' + escapeText(href) + '">' + escapeText(disp) + '</a>', end };
}
function autoLink(text, i) {
  const m = /^<([A-Za-z][A-Za-z0-9+.\-]{1,31}:[^<>\x00-\x20]*)>/.exec(text.slice(i));
  if (m) { const u = escapeText(m[1]); return { html: '<a href="' + u + '">' + u + '</a>', end: i + m[0].length }; }
  const e = /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?)*)>/.exec(text.slice(i));
  if (e) { const a = escapeText(e[1]); return { html: '<a href="mailto:' + a + '">' + a + '</a>', end: i + e[0].length }; }
  return null;
}
