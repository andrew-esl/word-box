// Ліцензії сторонніх іконок (Lucide, Feather) збережені в коді.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('Повний текст ліцензій Lucide (ISC) і Feather (MIT) збережений у коді', () => {
  const block = HTML.slice(HTML.indexOf('Іконки Lucide'), HTML.indexOf('const ICONS'));
  assert.match(block, /ISC License/);
  assert.match(block, /Copyright \(c\) \d{4} Lucide Icons and Contributors/);
  assert.match(block, /provided that the above\s+copyright notice and this permission notice appear in all copies/);
  assert.match(block, /The MIT License/);
  assert.match(block, /Copyright \(c\) 2013-present Cole Bemis/);
});
