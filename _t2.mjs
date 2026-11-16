import { tableBlock } from './lib/tables.js';
import { finishInline, renderInline } from './inline.js';
const BS = String.fromCharCode(92);
const Q = String.fromCharCode(96);
const lines = ['| f' + BS + '|oo  |', '| ------ |', '| b ' + Q + BS + '|' + Q + ' az |', '| b **' + BS + '|** im |'];
const tb = tableBlock(lines, 0, (t) => finishInline(renderInline(t)));
console.log(JSON.stringify(tb.html));
