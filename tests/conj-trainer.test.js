// Тренажер відмінювання: у «Словах» → «Дієслова» → кнопка; бере дієслова з готовим відмінюванням.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const V = (term, uk, src, conj, pos = 'verb') => ({ id: term, term, uk, def: '', ex: '', syn: [], pos, src, r: 1, iv: 1, ef: 2.5, l: 0, due: 0, t: 1, conj });
const WALK = { tenses: {
  present: ['I walk', 'you walk', 'he/she/it walks', 'we walk', 'you walk', 'they walk'],
  present_perfect: ['I have walked', 'you have walked', 'he/she/it has walked', 'we have walked', 'you have walked', 'they have walked'],
  conditional: ['I would walk', 'you would walk', 'he/she/it would walk', 'we would walk', 'you would walk', 'they would walk']
} };
const GO = { tenses: {
  present: [{ p: 'I', v: 'go' }, { p: 'you', v: 'go' }, { p: 'he/she/it', v: 'goes' }, { p: 'we', v: 'go' }, { p: 'you', v: 'go' }, { p: 'they', v: 'go' }],
  past_simple: ['I went', 'you went', 'he/she/it went', 'we went', 'you went', 'they went'],
  future_simple: ['I will go', 'you will go', 'he/she/it will go', 'we will go', 'you will go', 'they will go']
} };
const WORDS = () => [
  V('walk', 'ходити', 'Музика', WALK),
  V('go', 'йти', 'Рух', GO),
  V('laugh', 'сміятися', 'Музика', null),                       // дієслово без відмінювання
  V('a song', 'пісня', 'Музика', WALK, 'noun')                  // не дієслово
];
const setup = async () => { const a = await loadApp(); a.api.state.words = WORDS(); return a; };

test('Форми беруться і з рядків, і з {p, v}; псевдоніми past / future працюють', async () => {
  const a = await setup(); const forms = a.fn('conjFormsOf'); const [walk, go] = a.api.state.words;
  assert.deepEqual(JSON.parse(JSON.stringify(forms(walk, 'present')[1])), { pronoun: 'you', verb: 'walk' });
  assert.deepEqual(JSON.parse(JSON.stringify(forms(walk, 'present')[2])), { pronoun: 'he/she/it', verb: 'walks' });
  assert.deepEqual(JSON.parse(JSON.stringify(forms(go, 'present')[0])), { pronoun: 'I', verb: 'go' });
  assert.equal(forms(go, 'past').length, 6, 'ключ past_simple');
  assert.equal(forms(go, 'future')[0].verb, 'will go');
  assert.equal(forms(walk, 'past').length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(a.fn('conjTensesOf')(walk))), ['present', 'present_perfect', 'conditional']);
});

test('Кандидати: лише дієслова з відмінюванням; тема звужує вибір', async () => {
  const a = await setup(); const cand = a.fn('conjTrainerCandidates');
  const all = cand({ status: 'all', pos: 'all', src: 'all', query: '' });
  assert.deepEqual(all.map(w => w.term).sort(), ['go', 'walk'], 'laugh без відмінювання, song не дієслово');
  const music = cand({ status: 'all', pos: 'all', src: 'Музика', query: '' });
  assert.deepEqual(music.map(w => w.term), ['walk']);
});

test('Перевірка відповіді: правильна, із займенником, регістр, альтернативи через /', async () => {
  const a = await setup(); const chk = a.fn('checkConjAnswer');
  const q = (pronoun, answer) => ({ pronoun, answer });
  assert.equal(chk('walk', q('you', 'walk')), 'ok');
  assert.equal(chk('  Walk ', q('you', 'walk')), 'ok', 'регістр і пробіли');
  assert.equal(chk('you walk', q('you', 'walk')), 'ok', 'учень написав і займенник');
  assert.equal(chk('he/she/it walks', q('he/she/it', 'walks')), 'ok');
  assert.equal(chk('have walked', q('I', 'have walked')), 'ok');
  assert.equal(chk('', q('you', 'walk')), 'err');
  assert.equal(chk('walks', q('you', 'walk')), 'err');
  assert.equal(chk('was', q('I', 'was / were')), 'ok', 'будь-яка частина запису «a / b»');
  assert.equal(chk('were', q('I', 'was / were')), 'ok');
});

test('Вправи: не більше за ліміт, лише обрані часи, без повторів', async () => {
  const a = await setup(); const build = a.fn('buildConjQuestions');
  const qs = build(a.fn('conjTrainerCandidates')({ status: 'all', pos: 'all', src: 'all', query: '' }), ['present'], 10);
  assert.equal(qs.length, 10);
  assert.ok(qs.every(q => q.tenseId === 'present'));
  assert.equal(new Set(qs.map(q => q.word.term + q.idx)).size, 10, 'комбінації різні');
  const few = build([a.api.state.words[0]], ['conditional'], 20);
  assert.equal(few.length, 6, 'форм менше, ніж ліміт — вправ стільки, скільки є');
});

test('Кнопка тренажера: завжди є, з лічильником дієслів', async () => {
  const a = await setup();
  const html = () => { const el = a.el('x'); a.fn('renderWordsTab')(el); return el.innerHTML; };
  a.api.fn("(wordFilterPos = 'all')");
  assert.match(html(), /id="btnConjTrainer"[^>]*>Тренажер відмінювання · 2</, 'кнопка є одразу, без фільтра «Дієслова»');
  a.api.fn("(wordFilterPos = 'verb')");
  assert.match(html(), /id="btnConjTrainer"[^>]*>Тренажер відмінювання · 2</);
  a.api.fn("(wordFilterSrc = 'Рух')");
  assert.match(html(), /Тренажер відмінювання · 1</, 'тема Рух → одне дієслово');
  a.api.fn("(wordFilterSrc = 'Музика')");
  a.api.state.words[0].conj = null;
  assert.match(html(), /id="btnConjTrainer" disabled[^>]*>Тренажер відмінювання · 0</, 'немає відмінювання → кнопка неактивна');
});

function open(a, words) {
  const handlers = {};
  const container = {
    innerHTML: '',
    querySelector(sel) { return { value: '', disabled: false, focus() {}, addEventListener(ev, fn) { handlers[sel + ':' + ev] = fn; } }; },
    querySelectorAll(sel) { return (sel === '[data-tense]' ? (container.innerHTML.match(/data-tense="[a-z_]+"/g) || []) : []).map(m => ({ dataset: { tense: m.split('"')[1] }, addEventListener(ev, fn) { handlers['tense:' + m.split('"')[1] + ':' + ev] = fn; } })); }
  };
  a.fn('runConjTrainer')(container, words, 'усі теми');
  return { container, handlers };
}

test('Екран налаштування: усі наявні часи обрано, ліміт із «Слів у раунді»', async () => {
  const a = await setup(); a.api.state.settings.roundSize = 15;
  const { container } = open(a, a.api.state.words.slice(0, 1));
  assert.match(container.innerHTML, /1 дієслово/);
  for (const t of ['Present Simple', 'Present Perfect', 'Conditional']) assert.match(container.innerHTML, new RegExp(t));
  assert.equal(container.innerHTML.includes('>Past Simple<'), false, 'часу без даних немає в списку');
  assert.match(container.innerHTML, /Вправ у раунді: 15/);
  assert.match(container.innerHTML, /id="cjStart" disabled/, 'нічого не обрано → «Почати» неактивна');
});

test('Раунд: помилка показує правильну форму й таблицю часу; підсумок рахує; SRS не чіпається', async () => {
  const a = await setup(); const w = a.api.state.words[0];
  const before = JSON.stringify([w.r, w.iv, w.due, w.ef]);
  const daysBefore = JSON.stringify(a.api.state.stats.days || {});
  a.api.state.settings.roundSize = 10;
  const { container, handlers } = open(a, [w]);
  handlers['#cjAll:click']();
  handlers['#cjStart:click']();
  assert.match(container.innerHTML, /Відмінювання · 1 \/ 10/);
  handlers['#cjSkip:click']();                       // «Не знаю»
  assert.match(container.innerHTML, /Правильна форма/);
  assert.match(container.innerHTML, /forms-grid/, 'таблиця часу після помилки');
  for (let i = 0; i < 9; i++) { handlers['#cjNext:click'](); handlers['#cjSkip:click'](); }
  handlers['#cjNext:click']();
  assert.match(container.innerHTML, /0<\/b> із 10 правильно/);
  assert.match(container.innerHTML, /Над чим попрацювати/);
  assert.equal(JSON.stringify([w.r, w.iv, w.due, w.ef]), before, 'розклад слова не змінився');
  assert.equal(JSON.stringify(a.api.state.stats.days || {}), daysBefore, 'журнал активності не змінився');
});

test('Подвійне «Перевірити» не дублює відповідь', async () => {
  const a = await setup();
  const { container, handlers } = open(a, [a.api.state.words[0]]);
  handlers['#cjAll:click']();
  handlers['#cjStart:click']();
  handlers['#cjSkip:click'](); handlers['#cjSkip:click']();
  handlers['#cjNext:click']();
  assert.match(container.innerHTML, /2 \/ 10|2 \/ 1[0-9]?/);
});

test('Обрано лише Present Simple → усі вправи тільки в Present Simple, і так до кінця раунду', async () => {
  const a = await setup(); a.api.state.settings.roundSize = 10;
  const { container, handlers } = open(a, a.api.state.words.slice(0, 2));
  handlers['tense:present:click']();                 // обрати лише present
  handlers['#cjStart:click']();
  for (let i = 0; i < 10; i++) {
    assert.match(container.innerHTML, /<span class="badge">Present Simple<\/span>/, 'вправа ' + (i + 1));
    handlers['#cjSkip:click'](); if (i < 9) handlers['#cjNext:click']();
  }
});

test('«Усі часи» обирає всі, повторне торкання знімає', async () => {
  const a = await setup();
  const { container, handlers } = open(a, a.api.state.words.slice(0, 1));
  handlers['#cjAll:click']();
  assert.equal(container.innerHTML.includes('id="cjStart" disabled'), false);
  assert.equal((container.innerHTML.match(/aria-pressed="true"/g) || []).length, 4, 'Усі + 3 часи');
  handlers['#cjAll:click']();
  assert.match(container.innerHTML, /id="cjStart" disabled/);
});
