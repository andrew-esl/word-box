// Зауваження з телефона (30.10, друга партія):
// 1) латиниця й кирилиця мали різний шрифт, розмір і колір в одній і тій самій ролі;
// 2) фільтр частин мови рахував увесь словник, ігноруючи обрану тему.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Словник: 2 теми. «Одяг» — 2 іменники + 1 дієслово, «Робота» — 1 дієслово.
const W = [
  { id: 'a', term: 'le béret', uk: 'берет', pos: 'noun', src: 'Одяг' },
  { id: 'b', term: "l'écharpe", uk: 'шарф', pos: 'noun', src: 'Одяг' },
  { id: 'c', term: 'porter', uk: 'носити', pos: 'verb', src: 'Одяг' },
  { id: 'd', term: 'embaucher', uk: 'наймати', pos: 'verb', src: 'Робота' }
];
const base = { iv: 0, ef: 2.5, r: 0, l: 0, due: 0, t: 0 };
async function appWith(words = W) {
  const app = await loadApp();
  app.api.state.words = words.map(w => ({ ...base, ...w }));
  return app;
}
// Витягнути пари «підпис → число» з розмітки випадайка
function options(html, selectId) {
  const i = html.indexOf(`id="${selectId}"`);
  assert.notEqual(i, -1, `немає випадайка ${selectId}`);
  const chunk = html.slice(i, html.indexOf('</select>', i));
  return [...chunk.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(m => m[1].trim());
}

// ───────────── Предикат фільтрів (спільний для списку і лічильників) ─────────────
test('Фільтри: тема звужує вибірку', async () => {
  const app = await appWith();
  const pass = app.fn('wordPassesFilters');
  const f = { status: 'all', pos: 'all', src: 'Одяг', query: '' };
  assert.equal(app.api.state.words.filter(w => pass(w, f)).length, 3);
});

test('Фільтри: частина мови й тема діють разом', async () => {
  const app = await appWith();
  const pass = app.fn('wordPassesFilters');
  const f = { status: 'all', pos: 'verb', src: 'Одяг', query: '' };
  const got = app.api.state.words.filter(w => pass(w, f)).map(w => w.term);
  assert.deepEqual(JSON.parse(JSON.stringify(got)), ['porter']);
});

test('Фільтри: except дозволяє порахувати варіанти самого фільтра', async () => {
  const app = await appWith();
  const tally = app.fn('tallyWords');
  const posGroupId = app.fn('posGroupId');
  // Обрано «Іменники» в темі «Одяг»: скільки було б дієслів у цій же темі?
  const f = { status: 'all', pos: 'noun', src: 'Одяг', query: '' };
  const m = tally(app.api.state.words, f, 'pos', w => posGroupId(w.pos));
  assert.equal(m.get('noun'), 2);
  assert.equal(m.get('verb'), 1, 'без except лічильник показав би 0');
});

test('Фільтри: пошук шукає і у французькому, і в українському, і у визначенні', async () => {
  const app = await appWith();
  const pass = app.fn('wordPassesFilters');
  const f = s => ({ status: 'all', pos: 'all', src: 'all', query: s });
  const find = s => app.api.state.words.filter(w => pass(w, f(s))).map(w => w.term);
  assert.deepEqual(JSON.parse(JSON.stringify(find('шарф'))), ["l'écharpe"]);
  assert.deepEqual(JSON.parse(JSON.stringify(find('béret'))), ['le béret']);
  assert.equal(find('zzz').length, 0);
});

// ───────────── Лічильники у випадайках ─────────────
test('Частини мови: лічильники рахують лише обрану тему (баг зі скриншота)', async () => {
  const app = await appWith();
  app.api.wordFilterSrc = 'Одяг';
  const el = app.el('x');
  app.fn('renderWordsTab')(el);
  const opts = options(el.innerHTML, 'selFilterPos');
  assert.ok(opts.some(o => /Дієслова \(1\)/.test(o)), `дієслів у темі «Одяг» рівно 1, а показано: ${opts.join(' | ')}`);
  assert.ok(opts.some(o => /Іменники \(2\)/.test(o)), opts.join(' | '));
  assert.ok(!opts.some(o => /Дієслова \(2\)/.test(o)), 'лічильник знову рахує весь словник');
});

test('Частини мови: без обраної теми рахується весь словник', async () => {
  const app = await appWith();
  app.api.wordFilterSrc = 'all';
  const el = app.el('x');
  app.fn('renderWordsTab')(el);
  const opts = options(el.innerHTML, 'selFilterPos');
  assert.ok(opts.some(o => /Дієслова \(2\)/.test(o)), opts.join(' | '));
});

test('Статуси: лічильники теж рахують лише поточну вибірку', async () => {
  const app = await appWith();
  app.api.wordFilterSrc = 'Робота';
  const el = app.el('x');
  app.fn('renderWordsTab')(el);
  const opts = options(el.innerHTML, 'selFilterStatus');
  assert.ok(opts.some(o => /Усі статуси \(1\)/.test(o)), `у темі «Робота» одне слово, а показано: ${opts.join(' | ')}`);
});

test('Частини мови: обраний фільтр не зникає при зміні теми, показує «(0)»', async () => {
  const app = await appWith();
  app.api.wordFilterPos = 'noun';
  app.api.wordFilterSrc = 'Робота';           // іменників тут немає
  const el = app.el('x');
  app.fn('renderWordsTab')(el);
  assert.equal(app.api.wordFilterPos, 'noun', 'вибір скинувся з-під пальця');
  const opts = options(el.innerHTML, 'selFilterPos');
  assert.ok(opts.some(o => /Іменники \(0\)/.test(o)), opts.join(' | '));
});

test('Частини мови: вибір скидається, лише якщо таких слів не лишилось у словнику взагалі', async () => {
  const app = await appWith(W.filter(w => w.pos === 'verb'));   // самі дієслова
  app.api.wordFilterPos = 'noun';
  app.fn('renderWordsTab')(app.el('x'));
  assert.equal(app.api.wordFilterPos, 'all');
});

test('Список і лічильники не можуть розійтися: обидва через wordPassesFilters', () => {
  const body = HTML.slice(HTML.indexOf('function renderWordsTab'), HTML.indexOf('function openModal'));
  assert.ok(/const filtered = state\.words\.filter\(w => wordPassesFilters\(w, f\)\)/.test(body),
    'список фільтрується власною копією умов');
  assert.ok(/tallyWords\(state\.words, f, 'pos'/.test(body), 'лічильник частин мови не враховує решту фільтрів');
  assert.ok(/tallyWords\(state\.words, f, 'status'/.test(body), 'лічильник статусів не враховує решту фільтрів');
  assert.equal(/Усі статуси \(\$\{state\.words\.length\}\)/.test(HTML), false,
    'повернувся лічильник статусів по всьому словнику');
});

// ───────────── Типографіка: мова не змінює оформлення ─────────────
test('Типографіка: варіант відповіді має один клас незалежно від мови', () => {
  assert.equal(/areOptionsFrench \? 'opt-term' : 'opt-uk'/.test(HTML), false,
    'клас варіанта знову залежить від мови');
  assert.equal(/\.opt-uk\b/.test(HTML), false, 'лишився окремий стиль для кирилиці');
  assert.match(HTML, /\.option-btn \.opt-word \{[^}]*font-family: var\(--font-word\)/);
});

test('Типографіка: питання у «Виборі» має один клас незалежно від напрямку', () => {
  assert.equal(/isPromptFrench \? 'study-word-title' : 'study-meaning'/.test(HTML), false,
    'питання знову змінює розмір і колір залежно від напрямку');
  assert.match(HTML, /class="study-prompt"/);
  const rule = HTML.match(/\.study-prompt \{[^}]*\}/);
  assert.ok(rule, 'немає стилю .study-prompt');
  assert.match(rule[0], /font-family: var\(--font-word\)/);
  assert.match(rule[0], /color: var\(--text-main\)/);
});

test('Типографіка: у контенті не лишилось інтерфейсного шрифту', () => {
  assert.equal(/font-family:var\(--font-ui\)/.test(HTML), false,
    'кирилиця в контенті знову набирається інтерфейсним шрифтом');
});

test('Типографіка: значення у списку слів тієї ж гарнітури, що й саме слово', () => {
  const term = HTML.match(/\.word-term \{[^}]*\}/)[0];
  const uk = HTML.match(/\.word-meaning \{[^}]*\}/)[0];
  assert.match(term, /font-family: var\(--font-word\)/);
  assert.match(uk, /font-family: var\(--font-word\)/);
});

// ───────────── Порядок фільтрів: тема задає область, решта звужує всередині ─────────────
test('Фільтри: порядок — пошук, тема, частина мови, статус', async () => {
  const app = await appWith();
  const el = app.el('x');
  app.fn('renderWordsTab')(el);
  const bar = el.innerHTML.slice(el.innerHTML.indexOf('class="filters-bar"'));
  const order = [...bar.matchAll(/id="(inpWordSearch|selFilterSrc|selFilterPos|selFilterStatus)"/g)].map(m => m[1]);
  assert.deepEqual(order.slice(0, 4), ['inpWordSearch', 'selFilterSrc', 'selFilterPos', 'selFilterStatus']);
});

test('Теми: випадайок рахує слова, а не кількість тем', async () => {
  const app = await appWith();
  const el = app.el('x');
  app.fn('renderWordsTab')(el);
  const opts = options(el.innerHTML, 'selFilterSrc');
  assert.ok(opts.some(o => /Усі теми \(4\)/.test(o)), `4 слова всього, а показано: ${opts.join(' | ')}`);
  assert.ok(opts.some(o => /Одяг \(3\)/.test(o)), opts.join(' | '));
  assert.ok(opts.some(o => /Робота \(1\)/.test(o)), opts.join(' | '));
});

test('Теми: лічильники враховують обрану частину мови', async () => {
  const app = await appWith();
  app.api.wordFilterPos = 'verb';
  const el = app.el('x');
  app.fn('renderWordsTab')(el);
  const opts = options(el.innerHTML, 'selFilterSrc');
  assert.ok(opts.some(o => /Одяг \(1\)/.test(o)), `дієслово в темі «Одяг» одне, показано: ${opts.join(' | ')}`);
  assert.ok(opts.some(o => /Робота \(1\)/.test(o)), opts.join(' | '));
});

test('Теми: тема лишається у списку, навіть якщо в ній нічого не підходить', async () => {
  const app = await appWith();
  app.api.wordFilterPos = 'noun';
  const el = app.el('x');
  app.fn('renderWordsTab')(el);
  const opts = options(el.innerHTML, 'selFilterSrc');
  assert.ok(opts.some(o => /Робота \(0\)/.test(o)), `тема має лишатись видимою з нулем: ${opts.join(' | ')}`);
});

// ───────────── Прогноз на 7 днів ─────────────
test('Прогноз: сьогодні має справжній день тижня, а не скорочення «Сьог»', () => {
  assert.equal(/'Сьог'/.test(HTML), false, 'обрізане «Сьог» повернулось замість дня тижня');
  assert.match(HTML, /dayNames\[new Date\(start\)\.getDay\(\)\], count: cnt, isToday: d === 0/);
});

test('Прогноз: сьогодні позначається кольором, а не текстом', () => {
  const rule = HTML.match(/\.forecast-col\.is-today \.forecast-day \{[^}]*\}/);
  assert.ok(rule, 'немає стилю для позначки «сьогодні»');
  assert.match(rule[0], /background: var\(--accent\)/);
  assert.match(rule[0], /color: var\(--accent-contrast\)/, 'текст на кольоровій плашці має бути контрастним');
});

test('Прогноз: у дні без повторень смужка не малюється взагалі', () => {
  const tpl = HTML.slice(HTML.indexOf('class="forecast-chart"'), HTML.indexOf('class="forecast-chart"') + 900);
  assert.match(tpl, /f\.count > 0 \? `<div class="forecast-bar"/, 'нуль має давати порожній стовпчик');
  assert.equal(/height:\$\{f\.count>0\?Math\.max\(8/.test(tpl), false,
    'повернувся варіант, де нуль малює смужку в 3px через min-height');
});
