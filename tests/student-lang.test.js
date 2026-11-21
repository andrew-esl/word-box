// Мова учня: за замовчуванням українська, вмикається викладачем, помилка бази не ламає сайт.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness');

const ME = 'andreyantonov2@gmail.com';
const settle = async (n = 14) => { for (let k = 0; k < n; k++) await new Promise(r => setImmediate(r)); };
const card = { id: 'c1', user_email: 'olena@x.com', term: 'fit in', uk: 'вписатися', def: 'd', ex: '', pos: '', src: 'T', r: 0, iv: 0, ef: 2.5, l: 0, due: 0, t: 0, added: '2026-11-01' };

test('Учень без запису в student_settings — українська', async () => {
  const app = await loadApp({ supabase: { session: { user: { id: 's', email: 'olena@x.com' } }, rows: [card] } });
  await settle();
  assert.equal(app.api.state.settings.lang, 'uk');
});

test('Учень із lang=ru отримує російську; помилка таблиці лишає українську', async () => {
  const ru = await loadApp({ supabase: { session: { user: { id: 's', email: 'olena@x.com' } }, rows: [card], tables: { student_settings: [{ user_email: 'olena@x.com', lang: 'ru' }] } } });
  await settle();
  assert.equal(ru.api.state.settings.lang, 'ru');
  const broken = await loadApp({ supabase: { session: { user: { id: 's', email: 'olena@x.com' } }, rows: [card], tableError: { student_settings: { code: '42P01', message: 'relation does not exist' } } } });
  await settle();
  assert.equal(broken.api.state.settings.lang, 'uk');
});

test('Викладач вмикає мову: зберігається в student_settings, повторне натискання не дублює', async () => {
  const app = await loadApp({ supabase: { session: { user: { id: 't', email: ME } }, rows: [card] } });
  await settle();
  const res = await app.fn('saveStudentLang')('olena@x.com', 'ru');
  assert.ok(res.ok);
  await app.fn('saveStudentLang')('olena@x.com', 'ru');
  const rows = app.db.tables.student_settings.filter(r => r.user_email === 'olena@x.com');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].lang, 'ru');
  assert.equal(app.fn('teacherLangOf')('olena@x.com'), 'ru');
  assert.equal(app.fn('teacherLangOf')('nobody@x.com'), 'uk');
  assert.equal(app.fn('normLang')('de'), 'uk');
});

test('Без таблиці викладач отримує зрозуміле повідомлення про SQL 006', async () => {
  const app = await loadApp({ supabase: { session: { user: { id: 't', email: ME } }, rows: [card], tableError: { student_settings: { code: '42P01', message: 'relation does not exist' } } } });
  await settle();
  const res = await app.fn('saveStudentLang')('olena@x.com', 'ru');
  assert.equal(res.ok, false);
  assert.match(res.message, /006_student_settings\.sql/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'supabase', '006_student_settings.sql')));
});
