// Викладач вчить слова сам: власні картки не змішуються з учнями, вибір слів для себе, копіювання з чистим прогресом.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./harness');

const ME = 'andreyantonov2@gmail.com';
const N = Date.now();
const card = (o) => Object.assign({ id: o.user_email + o.term, def: 'd', ex: '', pos: '', src: 'Теми', r: 0, iv: 0, ef: 2.5, l: 0, due: 0, t: 0, added: '2026-10-20' }, o);
const ROWS = [
  card({ user_email: 'olena@x.com', term: 'settle in', uk: 'освоїтися', src: 'Eleven Weeks', r: 5, iv: 9, l: 3, due: N, t: N }),
  card({ user_email: 'olena@x.com', term: 'fit in', uk: 'вписатися', src: 'Eleven Weeks' }),
  card({ user_email: 'taras@x.com', term: 'Settle in', uk: 'освоїтися', src: 'Eleven Weeks' }),
  card({ user_email: 'taras@x.com', term: 'bill', uk: 'рахунок', src: 'Cafe' }),
  card({ user_email: ME, term: 'fit in', uk: 'вписатися', src: 'Eleven Weeks' })
];
const mk = () => loadApp({ supabase: { session: { user: { id: 't', email: ME } }, rows: ROWS } });
const settle = async (n = 14) => { for (let k = 0; k < n; k++) await new Promise(r => setImmediate(r)); };

test('Власні картки викладача не з’являються в списку учнів', async () => {
  const app = await mk(); await settle();
  assert.deepEqual(app.fn('teacherStudents')().map(s => s.email).sort(), ['olena@x.com', 'taras@x.com']);
});

test('Кандидати: без слів, які вже є у викладача, без дублів між учнями, з групуванням за темою', async () => {
  const app = await mk(); await settle();
  const t = app.fn('teacherMineCandidates')();
  const eleven = t.find(x => x.name === 'Eleven Weeks');
  assert.deepEqual(eleven.words.map(w => w.term), ['settle in'], 'fit in вже є, Settle in від Тараса — дубль');
  assert.equal(t.find(x => x.name === 'Cafe').words.length, 1);
});

test('Копіювання: чистий прогрес, власник — викладач, картки учнів не змінюються', async () => {
  const app = await mk(); await settle();
  const topic = app.fn('teacherMineCandidates')().find(x => x.name === 'Eleven Weeks');
  app.api.teacher.minePicked = new Set(topic.words.map(w => w.id));
  await app.fn('teacherTakeWords')(topic);
  const mine = app.db.rows.filter(r => r.user_email === ME && r.term === 'settle in');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].r, 0); assert.equal(mine[0].l, 0); assert.equal(mine[0].due, 0);
  const olena = app.db.rows.find(r => r.user_email === 'olena@x.com' && r.term === 'settle in');
  assert.equal(olena.r, 5, 'прогрес учня не торкнуто');
  assert.equal(app.fn('teacherMineCandidates')().find(x => x.name === 'Eleven Weeks').words.length, 0, 'слово більше не пропонується');
});
