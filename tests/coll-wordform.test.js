// Колокації (coll) і словотвір (wf): дані лежать у conj, старі картки не страждають,
// збагачення нічого не стирає, режими беруть лише картки з цими полями.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const settle = async (n = 14) => { for (let k = 0; k < n; k++) await new Promise(r => setImmediate(r)); };
const card = (o) => Object.assign({ def: 'd', ex: '', pos: 'noun', src: 'Work', r: 0, iv: 0, ef: 2.5, l: 0, due: 0, t: 0, added: '2026-11-01' }, o);

test('Нормалізація: coll і wf читаються з conj та з верхнього рівня, сміття відсіюється', async () => {
  const app = await loadApp();
  const norm = app.fn('normalizeWordRow');
  const a = norm(card({ id: '1', term: 'decision', uk: 'рішення', conj: { coll: ['make a [decision]', 'reach a [decision]', 'decision', '[decision]', 'make a [decision]'] } }));
  assert.deepEqual(a.coll, ['make a [decision]', 'reach a [decision]'], 'без дужок, без партнера й дублі відкидаються');
  const b = norm(card({ id: '2', term: 'dissatisfied', uk: 'незадоволений', wf: { base: 'satisfy', ex: 'Customers were [dissatisfied] with it.', pos: 'adjective', family: ['satisfy', 'satisfaction'] } }));
  assert.equal(b.wf.base, 'satisfy');
  assert.deepEqual(app.fn('wfAnswers')(b.wf), ['dissatisfied']);
  const old = norm(card({ id: '3', term: 'old', uk: 'старий' }));
  assert.deepEqual(old.coll, []);
  assert.equal(old.wf, null, 'стара картка без нових полів працює як раніше');
  assert.equal(norm(card({ id: '4', term: 'x', uk: 'x', wf: { base: 'a', ex: 'no brackets' } })).wf, null);
});

test('Збагачення додає coll і wf, не стираючи відмінювання, context_quiz і прогрес', async () => {
  const app = await loadApp();
  const norm = app.fn('normalizeWordRow');
  const existing = norm(card({ id: '1', term: 'run', uk: 'бігти', r: 4, iv: 9,
    conj: { tenses: { present_simple: ['I run'] }, context_quiz: { correct: 'run', distractors: ['ran'] } } }));
  const patch = app.fn('enrichPatch')(existing, { term: 'run', coll: ['[run] a business'], wf: { base: 'run', ex: 'He is a [runner].', alt: ['runner'] } });
  assert.ok(patch.conj.tenses, 'відмінювання збереглось');
  assert.ok(patch.conj.context_quiz, 'context_quiz збережено');
  assert.deepEqual(patch.conj.coll, ['[run] a business']);
  assert.equal(patch.conj.wf.base, 'run');
  assert.equal(patch.r, undefined, 'прогрес повторень патч не чіпає');

  // Повторний імпорт без цих полів не стирає раніше додані
  const withData = norm(Object.assign({}, card({ id: '2', term: 'decision', uk: 'рішення' }), { conj: { coll: ['make a [decision]'] } }));
  const patch2 = app.fn('enrichPatch')(withData, { term: 'decision', uk: 'рішення' });
  assert.deepEqual(patch2.conj.coll, ['make a [decision]']);
  const back = norm(Object.assign({}, withData, patch2));
  assert.deepEqual(back.coll, ['make a [decision]']);
});

test('Імпорт нового слова кладе coll і wf у conj', async () => {
  const app = await loadApp({ supabase: { session: { user: { id: 't', email: 'andreyantonov2@gmail.com' } }, rows: [] } });
  await settle();
  await app.fn('insertWordsBatchForEmail')('olena@x.com', [{ term: 'decision', uk: 'рішення', def: 'a choice', coll: ['make a [decision]'], wf: { base: 'decide', ex: 'It was a hard [decision].' } }]);
  const row = app.db.rows.find(r => r.term === 'decision');
  assert.deepEqual(row.conj.coll, ['make a [decision]']);
  assert.equal(row.conj.wf.base, 'decide');
});

test('Колокації: раунд з 5 слів, фраза не підходить іншому слову раунду', async () => {
  const app = await loadApp();
  const norm = app.fn('normalizeWordRow');
  const mk = (t, coll) => norm(card({ id: t, term: t, uk: t, conj: { coll } }));
  const words = [
    mk('decision', ['make a [decision]', 'reach a [decision]']),
    mk('mistake', ['make a [mistake]', 'avoid a [mistake]']),   // «make a ___» збігається з decision
    mk('risk', ['take a [risk]']),
    mk('effort', ['make an [effort]']),
    mk('progress', ['make [progress]']),
    mk('chance', ['miss a [chance]']),
    mk('deadline', ['meet a [deadline]'])
  ];
  const rounds = app.fn('buildCollRounds')(words, 2);
  assert.equal(rounds.length, 1, 'сім слів дають один повний раунд');
  const round = rounds[0];
  assert.equal(round.length, 5);
  const key = app.fn('collBlankKey');
  round.forEach(it => round.forEach(o => {
    if (o !== it) assert.ok(!o.word.coll.map(key).includes(key(it.phrase)), `«${it.phrase}» підходить і слову «${o.word.term}»`);
  }));
  assert.equal(app.fn('buildCollRounds')(words.slice(0, 4), 1).length, 0, 'менше 5 слів: раунду немає');
});

test('Режими не беруть картки без coll / wf', () => {
  assert.match(HTML, /pickStudyWords\(roundSize\(\) \* 3, w => w\.coll && w\.coll\.length > 0\)/);
  assert.match(HTML, /pickStudyWords\(roundSize\(\), w => Boolean\(w\.wf\)\)/);
  assert.match(HTML, /id: 'collocations'/);
  assert.match(HTML, /id: 'wordform'/);
});

test('Словотвір: відповідь оцінюється через isWrittenAnswerCorrect, є додаткові допустимі форми', async () => {
  const app = await loadApp();
  const wf = app.fn('cleanWf')({ base: 'satisfy', ex: 'They were [dissatisfied].', alt: ['unsatisfied'] });
  assert.deepEqual(app.fn('wfAnswers')(wf), ['dissatisfied', 'unsatisfied']);
  const ev = app.fn('evaluateWrittenAnswer');
  assert.equal(ev('Dissatisfied', 'dissatisfied'), 'ok', 'регістр пробачний');
  assert.notEqual(ev('dissatified', 'dissatisfied'), 'ok', 'одруківка — помилка');
});
