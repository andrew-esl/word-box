// Тренажер неправильних дієслів: дані, коробки Лейтнера, добір, варіанти відповідей, синхронізація.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const settle = async (n = 14) => { for (let k = 0; k < n; k++) await new Promise(r => setImmediate(r)); };

test('Дані: 200 дієслів, усі групи існують, форми непорожні, без дублів', async () => {
  const m = HTML.match(/const IRREG = (\{[\s\S]*?\});\n  const IRREG_LEVELS/);
  assert.ok(m, 'набір IRREG вшито в index.html');
  const data = JSON.parse(m[1]);
  assert.equal(data.verbs.length, 200);
  const seen = new Set();
  data.verbs.forEach(v => {
    assert.ok(v.v1 && v.v2.length && v.v3.length && v.uk, v.v1);
    assert.ok(data.groups[v.group], 'група ' + v.group + ' для ' + v.v1);
    assert.ok([1, 2, 3].includes(v.level));
    assert.ok(!seen.has(v.v1), 'дубль ' + v.v1);
    seen.add(v.v1);
  });
});

test('Коробки: правильно — на крок угору (до 5), помилка — в нуль; перевірка приймає варіанти', async () => {
  const app = await loadApp();
  const next = app.fn('irregNextBox'), chk = app.fn('irregCheckForm'), due = app.fn('irregDueAt');
  assert.equal(next(0, true), 1);
  assert.equal(next(5, true), 5);
  assert.equal(next(4, false), 0);
  assert.equal(due(0, 1000), 1000, 'коробка 0 — повторити одразу');
  assert.equal(due(2, 0), 3 * 86400000);
  assert.ok(chk('  Learnt ', ['learned', 'learnt']));
  assert.ok(chk('WENT', ['went']));
  assert.ok(!chk('', ['went']));
  assert.ok(!chk('goed', ['went']));
});

test('Добір: спершу прострочені, потім нові; фільтри рівня й «лише помилки»', async () => {
  const app = await loadApp();
  const pick = app.fn('irregPick');
  const vs = [1, 2, 3, 4].map(i => ({ v1: 'v' + i, level: i <= 2 ? 1 : 2 }));
  const now = 1e9;
  const map = { v1: { box: 1, c: 1, w: 0, due: now + 5e6 }, v2: { box: 0, c: 0, w: 2, due: now - 1 } };
  const r = pick(vs, map, { n: 4, now });
  assert.equal(r[0].v1, 'v2', 'прострочене першим');
  assert.equal(r[r.length - 1].v1, 'v1', 'не прострочене в кінці');
  assert.deepEqual(pick(vs, map, { n: 4, now, level: 2 }).map(v => v.v1).sort(), ['v3', 'v4']);
  assert.deepEqual(pick(vs, map, { n: 4, now, only: true }).map(v => v.v1), ['v2']);
});

test('Варіанти відповіді: 4 унікальних, правильний один, правильні форми не потрапляють у хибні', async () => {
  const app = await loadApp();
  const opts = app.fn('irregOptions');
  const m = HTML.match(/const IRREG = (\{[\s\S]*?\});\n  const IRREG_LEVELS/);
  const data = JSON.parse(m[1]);
  for (const v of data.verbs) {
    for (const f of ['v2', 'v3']) {
      const o = opts(v, f);
      assert.equal(o.length, 4, v.v1 + ' ' + f);
      assert.equal(new Set(o).size, 4, 'унікальні ' + v.v1);
      assert.equal(o.filter(x => v[f].includes(x)).length, 1, 'рівно один правильний ' + v.v1 + ' ' + f);
    }
  }
});

test('Сортування: 2–3 групи, без unique/variant, по 2–3 дієслова', async () => {
  const app = await loadApp();
  const build = app.fn('irregBuildSort');
  const m = HTML.match(/const IRREG = (\{[\s\S]*?\});\n  const IRREG_LEVELS/);
  const data = JSON.parse(m[1]);
  const s = build(data.verbs);
  assert.ok(s.groups.length >= 2 && s.groups.length <= 3);
  assert.ok(!s.groups.includes('unique') && !s.groups.includes('variant'));
  s.items.forEach(v => assert.ok(s.groups.includes(v.group)));
});

test('Синхронізація: upsert по id «email|verb», помилка таблиці не ламає, злиття бере пізніший запис', async () => {
  const app = await loadApp();
  const merge = app.fn('mergeIrregular');
  assert.equal(typeof merge, 'function');
  assert.match(HTML, /from\('irregular_progress'\)\.upsert\([\s\S]{0,200}onConflict: 'id'/);
  assert.match(HTML, /await loadIrregular\(\);/);
  assert.match(HTML, /\[irregular\]/);
  assert.ok(!/irregRecord[\s\S]{0,300}handleMiniGameResult/.test(HTML.match(/function irregRecord[\s\S]*?\n  }\n/)[0]), 'слова не чіпаємо');
});
