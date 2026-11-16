const named=new Set(['nbsp','amp','copy','AElig','Dcaron','frac34','HilbertSpace','DifferentialD','ClockwiseContourIntegral','ngE','ouml','hi']);
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
    if(!named.has(body)) return null;
  }
  return {raw:m[0],len:m[0].length,value: to===null?('&'+body+';'):String.fromCodePoint(to)};
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
      if (d) { out += d.value; i += d.len; continue; }
      out += '&amp;'; i++; continue;
    }
    out += ch; i++;
  }
  return out;
}
export function renderInline(text, refs) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      out += '\\' + text[i + 1]; i += 2; continue;
    }
    if (ch === '`') {
      const n = runLen(text, i, '`');
      const close = findTick(text, i + n, n);
      if (close >= 0) { out += renderCode(text.slice(i + n, close)); i = close + n; continue; }
      out += escapeText(text.slice(i, i + n)); i += n; continue;
    }
    if (ch === '<') {
      const e = angleEnd(text, i);
      if (e > i) { out += text.slice(i, e); i = e; continue; }
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
