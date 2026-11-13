// Зауваження з перевірки на телефоні/планшеті (30.10):
// частини мови, сітка відмінювання, шрифт, напрямок у «Виборі», повільне озвучення, кнопка «Далі».
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));

// ───────────── Відмінювання: розбір форми на займенник + дієслово ─────────────
test('Відмінювання: "he/she/it" не розривається, а "it" не стає "i" + "t"', async () => {
  const app = await loadApp();
  const split = app.fn('splitConjugatedForm');
  assert.deepEqual(plain(split('he/she/it goes')), { pronoun: 'he/she/it', verb: 'goes' });
  assert.deepEqual(plain(split('it rains')), { pronoun: 'it', verb: 'rains' });
  assert.deepEqual(plain(split('they have gone')), { pronoun: 'they', verb: 'have gone' });
});

test('Відмінювання: усі шість осіб розбираються правильно', async () => {
  const app = await loadApp();
  const split = app.fn('splitConjugatedForm');
  const cases = [
    ['I go', 'I', 'go'],
    ['you go', 'you', 'go'],
    ['he/she/it goes', 'he/she/it', 'goes'],
    ['we go', 'we', 'go'],
    ['you went', 'you', 'went'],
    ['they will go', 'they', 'will go'],
    ['I have gone', 'I', 'have gone']
  ];
  for (const [input, pronoun, verb] of cases) {
    assert.deepEqual(plain(split(input)), { pronoun, verb }, `зламалось на "${input}"`);
  }
});

test('Відмінювання: рядок без займенника не калічиться', async () => {
  const app = await loadApp();
  const split = app.fn('splitConjugatedForm');
  assert.deepEqual(plain(split('having gone')), { pronoun: '', verb: 'having gone' });
  assert.deepEqual(plain(split('italic')), { pronoun: '', verb: 'italic' }, 'слово на «i…» не вважається займенником');
});

test('Відмінювання: у HTML займенник і форма в окремих комірках', async () => {
  const app = await loadApp();
  const html = app.fn('formatConjugationRow')('they have worked');
  assert.match(html, /class="pronoun">they</);
  assert.match(html, /<b>have worked<\/b>/);
});

test('Відмінювання: сітка заповнюється по колонках (ліворуч однина, праворуч множина)', () => {
  const rule = HTML.match(/\.forms-grid \{[^}]*\}/);
  assert.ok(rule, 'правило .forms-grid зникло');
  assert.match(rule[0], /grid-auto-flow:\s*column/, 'без column-flow колонки знову підуть рядками');
  assert.match(rule[0], /grid-template-rows:\s*repeat\(3,/, 'потрібні рівно 3 рядки на колонку');
});

// ───────────── Шрифт: питання і варіанти однією гарнітурою ─────────────
test('Шрифт: слово-значення використовує ту саму гарнітуру, що й французькі варіанти', () => {
  const meaning = HTML.match(/\.study-meaning \{[^}]*\}/);
  const optFr = HTML.match(/\.option-btn \.opt-word \{[^}]*\}/);
  assert.ok(meaning && optFr);
  assert.match(meaning[0], /font-family:\s*var\(--font-word\)/, 'кирилиця знову випадає в інший шрифт');
  assert.match(optFr[0], /font-family:\s*var\(--font-word\)/);
});

// ───────────── Кнопка «Далі» не вилазить за картку ─────────────
test('Верстка: жодна кнопка «Далі» не висить на float', () => {
  assert.equal(/float:\s*right/.test(HTML), false, 'float виносить кнопку за межі картки');
  assert.ok(HTML.includes('class="next-row"'), 'обгортка .next-row зникла');
  // Кнопка тепер на всю ширину картки: у кут її більше не тиснуть
  const rule = HTML.match(/\.next-row \.btn \{[^}]*\}/);
  assert.ok(rule && /width:\s*100%/.test(rule[0]), '«Далі» має займати всю ширину');
});

// ───────────── Фільтр по частинах мови ─────────────
test('Частини мови: вільний текст pos зводиться до правильної групи', async () => {
  const app = await loadApp();
  const g = app.fn('posGroupId');
  assert.equal(g('noun'), 'noun');
  assert.equal(g('countable noun'), 'noun');
  assert.equal(g('verb'), 'verb');
  assert.equal(g('transitive verb'), 'verb');
  assert.equal(g('phrasal verb'), 'phrasal');
  assert.equal(g('adjective'), 'adjective');
  assert.equal(g('expression'), 'expression');
  assert.equal(g('idiom'), 'expression');
  assert.equal(g(''), 'autre');
  assert.equal(g(undefined), 'autre');
});

test('Частини мови: "adverb" не потрапляє в дієслова, "pronoun" не потрапляє в іменники', async () => {
  const app = await loadApp();
  const g = app.fn('posGroupId');
  assert.equal(g('adverb'), 'adverb');
  assert.equal(g('pronoun'), 'autre');
  assert.equal(g('preposition'), 'autre');
});

test('Частини мови: підписи груп українською', async () => {
  const app = await loadApp();
  const label = app.fn('posGroupLabel');
  assert.equal(label('noun'), 'Іменники');
  assert.equal(label('verb'), 'Дієслова');
  assert.equal(label('phrasal'), 'Фразові дієслова');
  assert.equal(label('autre'), 'Інше');
});

// ───────────── Режим «Вибір»: напрямок ─────────────
test('Вибір: налаштування напрямку існує і за замовчуванням «мікс»', async () => {
  const app = await loadApp();
  assert.equal(app.fn('defaultState')().settings.choiceDir, 'random');
});

test('Вибір: напрямок переживає перезавантаження разом з іншими налаштуваннями', async () => {
  const app = await loadApp();
  app.api.currentUser = { id: 'u1', email: 'alina@gmail.com' };
  app.api.state.settings.choiceDir = 'en_uk';
  app.fn('saveLocalStats')();
  app.api.state.settings.choiceDir = 'random';
  app.fn('loadLocalStats')();
  assert.equal(app.api.state.settings.choiceDir, 'en_uk');
});

test('Вибір: у коді режиму напрямок береться з налаштувань, а не з парності питання', () => {
  const body = HTML.slice(HTML.indexOf('function runChoiceMode'), HTML.indexOf('3. РЕЖИМ НАПИШИ'));
  assert.equal(/const rev = \(idx % 2 === 1\)/.test(body), false, 'повернулось жорстке чергування напрямків');
  assert.ok(body.includes('directionForIndex'), 'немає вибору напрямку');
  assert.ok(/choiceDir/.test(body));
  assert.ok(/'uk_en'/.test(body) && /'en_uk'/.test(body) && /'random'/.test(body), 'мають бути всі три напрямки');
  assert.ok(/revs/.test(body) && /revs:\s*revs\.slice\(\)/.test(body), 'напрямки не зберігаються в сесії');
});

// ───────────── Диктант: «Повільно» справді повільніше ─────────────
const VOICES = [
  { name: 'Samantha', lang: 'en-US', voiceURI: 'uri-samantha' },
  { name: 'Daniel (Enhanced)', lang: 'en-US', voiceURI: 'uri-daniel-enh' },
  { name: 'Siri Voice 4', lang: 'en-US', voiceURI: 'uri-siri' }
];
function captureSpeech(app) {
  const said = [];
  app.speech.speak = u => said.push(u);
  return {
    said,
    run() { app.timers.splice(0).forEach(t => { if (typeof t.fn === 'function') t.fn(); }); }
  };
}

test('Диктант: повільний темп помітно нижчий за звичайний', async () => {
  const app = await loadApp({ voices: VOICES });
  const cap = captureSpeech(app);
  const speak = app.fn('speakWord');
  speak('porter');
  cap.run();
  speak('porter', app.sandbox.__api.fn('SLOW_RATE'));
  cap.run();
  assert.equal(cap.said.length, 2);
  assert.equal(cap.said[0].rate, 1);
  assert.ok(cap.said[1].rate <= 0.5, `повільний темп ${cap.said[1].rate} майже не відрізняється від звичайного`);
});

test('Диктант: на повільному темпі не беремо Siri/enhanced голос (iOS ігнорує на ньому швидкість)', async () => {
  const app = await loadApp({ voices: VOICES });
  const cap = captureSpeech(app);
  app.fn('speakWord')('porter', 0.45);
  cap.run();
  assert.equal(cap.said[0].voice.voiceURI, 'uri-samantha');
});

test('Диктант: явно обраний учнем голос поважається навіть на повільному темпі', async () => {
  const app = await loadApp({ voices: VOICES });
  app.api.state.settings.voiceURI = 'uri-siri';
  const cap = captureSpeech(app);
  app.fn('speakWord')('porter', 0.45);
  cap.run();
  assert.equal(cap.said[0].voice.voiceURI, 'uri-siri');
});

test('Диктант: на повільному темпі між словами виразу з\'являються паузи', async () => {
  const app = await loadApp({ voices: VOICES });
  const prep = app.fn('prepareSpeechText');
  assert.equal(prep('take care', 1), 'take care');
  assert.equal(prep('take care', 0.45), 'take, care');
  assert.equal(prep('porter', 0.45), 'porter', 'одне слово не має отримувати кому');
});

test('Озвучення: дужки і sb/sth і далі розгортаються (стара поведінка не загублена)', async () => {
  const app = await loadApp({ voices: VOICES });
  const prep = app.fn('prepareSpeechText');
  assert.equal(prep('put off (put sth off)', 1), 'put off');
  assert.equal(prep('[porter]', 1), 'porter');
  assert.equal(prep('talk to sb', 1), 'talk to somebody');
  assert.equal(prep('give up sth', 1), 'give up something');
});

test('Озвучення: некоректна швидкість не ламає відтворення', async () => {
  const app = await loadApp({ voices: VOICES });
  const cap = captureSpeech(app);
  const speak = app.fn('speakWord');
  speak('porter', 0);
  speak('porter', NaN);
  speak('porter', 99);
  cap.run();
  assert.equal(cap.said.length, 3);
  cap.said.forEach(u => assert.ok(u.rate >= 0.1 && u.rate <= 2, `швидкість поза межами: ${u.rate}`));
});
