import { parse } from './parse.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const inputDir = process.env.MAKEFUN_INPUT_DIR || '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8'));

const results = [];
for (const c of cases) {
  results.push(parse(c.markdown));
}

writeFileSync(join(outputDir, 'html.json'), JSON.stringify(results));
