// Рішення викладача (30.10): помилка в написанні, зокрема пропущена діакритика, — орфографічна помилка.
// Зараховується лише точне написання; вердикт при цьому розрізняє причину помилки.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./harness');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ───────────── Оцінка ─────────────
test('Акцент: точне написання — єдине, що зараховується', async () => {
  const app = await loadApp();
  const ev = app.fn('evaluateWrittenAnswer');
  const isOk = app.fn('isWrittenAnswerCorrect');
  assert.equal(ev('café', 'café'), 'ok');
  assert.equal(ev('résumé', 'résumé'), 'ok');
  assert.equal(isOk('ok'), true);
});

test('Акцент: пропущений акцент — помилка, а не «майже»', async () => {
  const app = await loadApp();
  const ev = app.fn('evaluateWrittenAnswer');
  const isOk = app.fn('isWrittenAnswerCorrect');
  for (const [inp, tgt] of [['cafe', 'café'], ['naive', 'naïve'], ['resume', 'résumé'], ['fiancee', 'fiancée'], ['facade', 'façade']]) {
    assert.equal(ev(inp, tgt), 'accent', `"${inp}" проти "${tgt}"`);
    assert.equal(isOk(ev(inp, tgt)), false, `"${inp}" не має зараховуватись`);
  }
});

test('Акцент: неправильний акцент теж помилка (è замість é)', async () => {
  const app = await loadApp();
  const ev = app.fn('evaluateWrittenAnswer');
  assert.equal(ev('cafè', 'café'), 'accent');
  assert.equal(ev('résumè', 'résumé'), 'accent');
  assert.equal(app.fn('isWrittenAnswerCorrect')(ev('cafè', 'café')), false);
});

test('Одруківка на одну літеру — помилка, але з іншим вердиктом', async () => {
  const app = await loadApp();
  const ev = app.fn('evaluateWrittenAnswer');
  assert.equal(ev('walkd', 'walked'), 'typo');
  assert.equal(app.fn('isWrittenAnswerCorrect')('typo'), false);
});

test('Зовсім інше слово — err', async () => {
  const app = await loadApp();
  const ev = app.fn('evaluateWrittenAnswer');
  assert.equal(ev('coat', 'café'), 'err');
  assert.equal(ev('', 'café'), 'err');
});

test('Регістр лишається пробачним: телефон сам ставить велику літеру', async () => {
  const app = await loadApp();
  const ev = app.fn('evaluateWrittenAnswer');
  assert.equal(ev('Café', 'café'), 'ok');
  assert.equal(ev('CAFÉ', 'café'), 'ok');
});

test('Кручений апостроф не вважається помилкою', async () => {
  const app = await loadApp();
  const ev = app.fn('evaluateWrittenAnswer');
  assert.equal(ev('don’t', "don't"), 'ok');
});

test('Службові позначки не треба писати: sth відрізається (стара поведінка)', async () => {
  const app = await loadApp();
  const ev = app.fn('evaluateWrittenAnswer');
  assert.equal(ev('put off', 'put off (put sth off)'), 'ok');
  assert.equal(ev('put off', 'put off sth'), 'ok');
});

// ───────────── Зворотний зв'язок ─────────────
test('Вердикт: помилка в акценті показується як помилка, а не як жовте «майже»', async () => {
  const app = await loadApp();
  const meta = app.fn('writtenVerdictMeta');
  assert.equal(meta('ok').cls, 'ok');
  assert.equal(meta('accent').cls, 'err', 'акцент більше не може бути жовтим «майже»');
  assert.equal(meta('typo').cls, 'err');
  assert.equal(meta('err').cls, 'err');
  assert.match(meta('accent').title, /діакритик|акцент|орфограф/i, 'учень має прочитати, що саме не так');
  assert.notEqual(meta('accent').title, meta('err').title, 'причина помилки має відрізнятись');
});

test('Підсвічування: видно саме ту літеру, де загубився акцент', async () => {
  const app = await loadApp();
  const mark = app.fn('markAccentDiff');
  const html = mark('beret', 'béret');
  assert.ok(html.includes('<mark class="accent-miss">é</mark>'), html);
  assert.ok(!html.includes('<mark class="accent-miss">b</mark>'), 'правильні літери не підсвічуються');
});

test('Підсвічування: кілька акцентів позначаються всі', async () => {
  const app = await loadApp();
  const html = app.fn('markAccentDiff')('eleve', 'élève');
  assert.equal((html.match(/<mark class="accent-miss">/g) || []).length, 2);
});

test('Підсвічування: при іншій довжині слова просто показуємо відповідь без розмітки', async () => {
  const app = await loadApp();
  const mark = app.fn('markAccentDiff');
  assert.equal(mark('manteau', 'béret'), 'béret');
  assert.equal(mark('', 'béret'), 'béret');
});

test('Підсвічування: HTML у слові екранується', async () => {
  const app = await loadApp();
  const out = app.fn('markAccentDiff')('x', '<b>');
  assert.ok(!out.includes('<b>'), out);
});

// ───────────── Режими справді використовують нову оцінку ─────────────
test('«Напиши» і «Диктант» зараховують відповідь через isWrittenAnswerCorrect', () => {
  assert.equal(/chk === 'ok' \|\| chk === 'almost'/.test(HTML), false, 'повернулось зарахування «майже» як правильного');
  assert.equal((HTML.match(/const ok = isWrittenAnswerCorrect\(chk\);/g) || []).length, 2, 'мають бути обидва режими');
});

test('Стилю «майже» більше немає: він підказував, що відповідь напівзарахована', () => {
  assert.equal(/feedback-box\.almost/.test(HTML), false);
  assert.ok(/\.accent-miss \{/.test(HTML), 'немає стилю підсвічування акценту');
});
