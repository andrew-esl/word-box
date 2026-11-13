// «Золоті тести»: кожен баг, який уже виправляли, тепер захищений тестом.
// Якщо хтось (людина чи ШІ) знову його зламає, тест одразу це покаже.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');

// ───────────── Баг 1: дублювання англійських голосів ─────────────
test('Баг 1: голоси озвучення не дублюються при оновленні списку', async () => {
  const voices = [
    { name: 'Samantha', lang: 'en-US', voiceURI: 'samantha-1' },
    { name: 'Samantha', lang: 'en-US', voiceURI: 'samantha-2' }, // дубль
    { name: 'Karen', lang: 'en-GB', voiceURI: 'karen' },
    { name: 'Thomas', lang: 'fr-FR', voiceURI: 'thomas' }      // не англійська
  ];
  const app = await loadApp({ voices });
  const refresh = app.fn('refreshVoices');
  refresh(); refresh(); refresh(); // «оновлення» кілька разів
  assert.equal(app.api.voices.length, 2);
  assert.ok(app.api.voices.every(v => /^en/i.test(v.lang)));
});

// ───────────── Баг 2: автоозвучення при виборі відповіді ─────────────
test('Баг 2: вибір відповіді не запускає озвучення автоматично', async () => {
  const app = await loadApp();
  const between = (src, from, to) => {
    const a = src.indexOf(from), b = src.indexOf(to, a);
    assert.ok(a !== -1 && b !== -1, `не знайдено ділянку ${from}…${to}`);
    return src.slice(a, b);
  };
  const choice = between(app.fn('runChoiceMode').toString(), 'function choose', 'function next');
  const context = between(app.fn('runContextMode').toString(), 'function choose', 'function next');
  const pairs = app.fn('runPairsMode').toString();
  assert.ok(!choice.includes('speakWord('), 'Вибір: choose() озвучує');
  assert.ok(!context.includes('speakWord('), 'У контексті: choose() озвучує');
  assert.ok(!pairs.includes('speakWord('), 'Пари: озвучення при кліку');
});

// ───────────── Баг 3: Enter у текстових тренажерах ─────────────
test('Баг 3: Enter обробляється в Напиши, Диктанті та Анаграмі', async () => {
  const app = await loadApp();
  for (const name of ['runWriteMode', 'runDictationMode', 'runAnagramMode']) {
    const src = app.fn(name).toString();
    assert.match(src, /key\s*===\s*'Enter'/, `${name}: немає обробки Enter`);
  }
  // у Напиши/Диктанті Enter у полі вводу перевіряє відповідь, а не «пролітає» далі
  for (const name of ['runWriteMode', 'runDictationMode']) {
    assert.match(app.fn(name).toString(), /stopPropagation\(\)/, `${name}: Enter у полі не зупиняється`);
  }
});

// ───────────── Баг 4: технічний опис «SM-2» на головному екрані ─────────────
test('Баг 4: в описах режимів немає технічного «SM-2»', async () => {
  const app = await loadApp();
  for (const m of app.api.MODES_META) assert.ok(!/SM-?2/i.test(m.desc), `${m.name}: «${m.desc}»`);
  // Описи стали однорядковими (дизайн), тож «інтервальне повторення» в них уже не згадується —
  // важливо лише, щоб жоден опис не показував учневі технічну назву алгоритму.
  const cards = app.api.MODES_META.find(m => m.id === 'cards');
  assert.ok(cards && cards.desc.length > 0, 'у режиму «Картки» має бути опис');
});

// ───────────── Баг 6: втрата прогресу при згортанні ─────────────
test('Баг 6: при згортанні вкладки прогрес раунду зберігається', async () => {
  const app = await loadApp();
  app.api.currentTab = 'study';
  app.api.activeRoundState = { mode: 'choice', wordIds: ['a', 'b'], idx: 1, results: [] };
  app.doc.visibilityState = 'hidden';
  for (const fn of app.listeners['doc:visibilitychange'] || []) fn();
  const raw = app.sessionStorage.getItem(app.api.SESSION_PROGRESS_KEY);
  assert.ok(raw, 'прогрес не збережено у sessionStorage');
  assert.equal(JSON.parse(raw).idx, 1);
});

// ───────────── Баг 7: context_quiz ─────────────
test('Баг 7: context_quiz читається і з верхнього рівня, і з conj', async () => {
  const app = await loadApp();
  const norm = app.fn('normalizeWordRow');
  const quiz = { correct: 'des cabines', distractors: ['la cabine', 'cabiner'] };
  assert.deepEqual(norm({ term: 'une cabine', uk: 'кабіна', context_quiz: quiz }).context_quiz, quiz);
  assert.deepEqual(norm({ term: 'une cabine', uk: 'кабіна', conj: { tenses: {}, context_quiz: quiz } }).context_quiz, quiz);
});

// ───────────── Баг 8: відмінювання (різні часи, об'єкти й рядки) ─────────────
test('Баг 8: відмінювання — pronoun/форма для рядків і об’єктів', async () => {
  const app = await loadApp();
  const row = app.fn('formatConjugationRow');
  const a = row('I live');
  assert.match(a, /pronoun">I</); assert.match(a, /<b>live<\/b>/);
  const b = row('he/she/it lives');
  assert.match(b, /pronoun">he\/she\/it</); assert.match(b, /<b>lives<\/b>/);
  const c = row({ p: 'we', v: 'live' });
  assert.match(c, /pronoun">we</); assert.match(c, /<b>live<\/b>/);
});

test('Баг 8: switchTense показує окремі форми для кожного часу', async () => {
  const app = await loadApp();
  app.api.currentVerbData = { tenses: {
    future_simple: ['I will live'], conditional: ['I would live'], past_simple: ['I lived']
  } };
  const sw = app.fn('switchTense');
  const box = app.el('tense-content');
  sw('future', null); assert.match(box.innerHTML, /will live/);
  sw('conditional', null); assert.match(box.innerHTML, /would live/); assert.doesNotMatch(box.innerHTML, /will live/);
  sw('past', null); assert.match(box.innerHTML, /lived/);
});

// ───────────── Баг 9: службові позначки sb / sth ─────────────
test('Баг 9: getTestableTerm прибирає sb/sth та службові дужки, лишає прийменник', async () => {
  const app = await loadApp();
  const t = app.fn('getTestableTerm');
  assert.equal(t('look after sb'), 'look after');
  assert.equal(t('be afraid of sth'), 'be afraid of');
  assert.equal(t('get by (get by on sth)'), 'get by');
  assert.equal(t('give up smth'), 'give up');
  assert.equal(t('hello'), 'hello');
});

test('Баг 9: evaluateWrittenAnswer — точно / без діакритики / помилка', async () => {
  const app = await loadApp();
  const ev = app.fn('evaluateWrittenAnswer');
  assert.equal(ev('look after', 'look after sb'), 'ok');
  assert.equal(ev('Look After', 'look after sb'), 'ok', 'регістр пробачаємо');
  assert.equal(ev('look aftr', 'look after sb'), 'typo');
  assert.equal(app.fn('isWrittenAnswerCorrect')('typo'), false);
  assert.equal(ev('', 'look after sb'), 'err');
  assert.equal(ev('eat', 'look after sb'), 'err');
  assert.equal(ev('café', 'café'), 'ok');
  assert.equal(ev('cafe', 'café'), 'accent', 'запозичене слово: діакритика теж орфографія');
});

// ───────────── Баг 10: кросворд — без апострофів і дефісів ─────────────
test('Баг 10: у кросворді немає апострофів, дефісів і службових слів', async () => {
  const app = await loadApp();
  const ext = app.fn('extractCrosswordEntry');
  for (const term of ["don't", 'mother-in-law', 'a piece of cake', 'look after sb', 'to give up']) {
    const e = ext({ term });
    if (!e) continue;
    assert.match(e.clean, /^[a-z]+$/, `«${term}» → «${e.clean}»`);
  }
  assert.equal(ext({ term: "don't" }).clean, 'dont');
  assert.equal(ext({ term: 'mother-in-law' }).clean, 'motherinlaw');
  assert.equal(ext({ term: 'to give up' }).clean, 'giveup');
});

// ───────────── Допоміжне: JSON від викладача ─────────────
test('parseTolerantWordsJson: приймає масив, один об’єкт і «розумні» лапки', async () => {
  const app = await loadApp();
  const p = app.fn('parseTolerantWordsJson');
  assert.equal(p('[{"term":"a","uk":"б"}]').length, 1);
  assert.equal(p('Ось слова:\n[{"term":"a","uk":"б"},]\nГотово').length, 1);
  assert.throws(() => p(''), /порожнє/);
  assert.throws(() => p('нічого'), /JSON/);
});
