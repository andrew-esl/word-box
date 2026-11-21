// Російський інтерфейс: переклад тексту, безпека для слів учня, повнота словників.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const UK_ONLY = /[іїєґІЇЄҐ]/;
const parse = (name) => {
  const m = HTML.match(new RegExp('const ' + name + ' = (\\{[\\s\\S]*?\\});\\n  const'));
  return JSON.parse(m[1]);
};

test('ruTr: точний збіг, числа, множина, довгі фрагменти всередині рядка', async () => {
  const app = await loadApp();
  const tr = app.fn('ruTr');
  assert.equal(tr('Прогрес'), 'Прогресс');
  assert.equal(tr('  Далі '), '  Далее ');
  assert.equal(tr('Через 5 год'), 'Через 5 ч');
  assert.equal(tr('Через 12 дн'), 'Через 12 дн.');
  assert.equal(tr('5 слів'), '5 слов');
  assert.equal(tr('3 дні'), '3 дня');
  assert.equal(tr('Вивчено 12 слів'), 'Выучено 12 слов');
  assert.equal(tr('Почати повторення (12)'), 'Начать повторение (12)');
});

test('ruTr не чіпає російський текст і короткі слова всередині речень', async () => {
  const app = await loadApp();
  const tr = app.fn('ruTr');
  assert.equal(tr('год'), 'год', 'слово «год» (рік) у перекладі слова не стає «ч»');
  assert.equal(tr('Он ушёл в прошлом году'), 'Он ушёл в прошлом году');
  assert.equal(tr('день'), 'день');
  assert.equal(tr('Hello, world'), 'Hello, world');
  assert.equal(tr(''), '');
  assert.equal(tr(null), '');
});

test('Словник: у російських значеннях немає українських літер, ключі — українські', async () => {
  const ui = parse('RU_UI');
  const bad = Object.entries(ui).filter(([, v]) => UK_ONLY.test(v));
  assert.deepEqual(bad, [], 'українські літери в перекладі: ' + JSON.stringify(bad.slice(0, 3)));
  assert.ok(Object.keys(ui).length > 300);
});

test('Неправильні дієслова: кожен український переклад, нотатка й група мають російську пару', async () => {
  const m = HTML.match(/const IRREG = (\{[\s\S]*?\});\n  const IRREG_LEVELS/);
  const data = JSON.parse(m[1]);
  const ru = parse('RU_IRREG');
  const need = new Set([...data.verbs.map(v => v.uk), ...data.verbs.map(v => v.note), ...Object.values(data.groups)].filter(s => /[А-Яа-я]/.test(s)));
  const missing = [...need].filter(k => !ru[k]);
  assert.deepEqual(missing, []);
  Object.values(ru).forEach(v => assert.ok(!UK_ONLY.test(v), v));
});

test('irregL: для російської підставляє переклад, для української віддає як є', async () => {
  const ru = await loadApp();
  ru.api.state.settings.lang = 'ru';
  assert.equal(ru.fn('irregL')('бути'), 'быть');
  ru.api.state.settings.lang = 'uk';
  assert.equal(ru.fn('irregL')('бути'), 'бути');
});
