// Testes da lógica da agenda. Rode com: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../js/utils.js');
const S = require('../js/schedule.js');

const ev = (o) => ({ id: 'e', title: 'x', date: '2026-10-01', start: '09:00', end: '10:00', repeat: { type: 'none' }, ...o });

test('compromisso único acontece só na data', () => {
  assert.equal(S.occursOn(ev(), '2026-10-01'), true);
  assert.equal(S.occursOn(ev(), '2026-10-02'), false);
});

test('repetição diária respeita início, fim e exceções', () => {
  const e = ev({ repeat: { type: 'daily', until: '2026-10-05' }, exceptions: ['2026-10-03'] });
  assert.equal(S.occursOn(e, '2026-09-30'), false);
  assert.equal(S.occursOn(e, '2026-10-02'), true);
  assert.equal(S.occursOn(e, '2026-10-03'), false);
  assert.equal(S.occursOn(e, '2026-10-05'), true);
  assert.equal(S.occursOn(e, '2026-10-06'), false);
});

test('repetição semanal nos dias escolhidos', () => {
  // 2026-10-01 é quinta-feira; repete seg (1) e qua (3)
  const e = ev({ repeat: { type: 'weekly', days: [1, 3] } });
  const dates = S.occurrencesBetween([e], '2026-10-01', '2026-10-14').map((o) => o.date);
  assert.deepEqual(dates, ['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14']);
});

test('repetição mensal pula meses sem o dia', () => {
  const e = ev({ date: '2026-01-31', repeat: { type: 'monthly' } });
  const dates = S.occurrencesBetween([e], '2026-01-01', '2026-05-31').map((o) => o.date);
  assert.deepEqual(dates, ['2026-01-31', '2026-03-31', '2026-05-31']);
});

test('situação das tarefas', () => {
  const now = new Date(2026, 9, 2, 14, 30);
  assert.equal(S.taskStatus({ done: true }, now), 'done');
  assert.equal(S.taskStatus({}, now), 'nodate');
  assert.equal(S.taskStatus({ dueDate: '2026-10-01' }, now), 'overdue');
  assert.equal(S.taskStatus({ dueDate: '2026-10-02' }, now), 'today');
  assert.equal(S.taskStatus({ dueDate: '2026-10-02', dueTime: '14:00' }, now), 'overdue');
  assert.equal(S.taskStatus({ dueDate: '2026-10-02', dueTime: '15:00' }, now), 'today');
  assert.equal(S.taskStatus({ dueDate: '2026-10-03' }, now), 'future');
});

test('ordem: atrasadas, prioridade, prazo', () => {
  const now = new Date(2026, 9, 2, 12, 0);
  const tasks = [
    { id: 'baixa-hoje', priority: 'baixa', dueDate: '2026-10-02' },
    { id: 'alta-sem', priority: 'alta' },
    { id: 'media-atrasada', priority: 'media', dueDate: '2026-09-30' },
    { id: 'alta-hoje', priority: 'alta', dueDate: '2026-10-02' },
  ];
  assert.deepEqual(S.sortTasks(tasks, now).map((t) => t.id), ['media-atrasada', 'alta-hoje', 'alta-sem', 'baixa-hoje']);
});

test('compromissos sobrepostos ficam lado a lado', () => {
  const occ = (start, end) => ({ start, end, event: {} });
  const out = S.layout([occ('09:00', '10:00'), occ('09:30', '10:30'), occ('11:00', '12:00')]);
  assert.deepEqual(out.map((o) => [o.col, o.cols]), [[0, 2], [1, 2], [0, 1]]);
});

test('semana começa na segunda', () => {
  assert.equal(U.weekStart('2026-10-04'), '2026-09-28'); // domingo
  assert.equal(U.weekStart('2026-10-05'), '2026-10-05'); // segunda
});
