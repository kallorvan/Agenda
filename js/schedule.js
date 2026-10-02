// Regras da agenda: repetição de compromissos, situação e ordem das tarefas,
// e posicionamento de compromissos sobrepostos na linha do tempo.
const Schedule = (() => {
  const Utils = typeof U !== 'undefined' ? U : require('./utils.js');

  const PRIORITY_RANK = { alta: 0, media: 1, baixa: 2 };

  // O compromisso acontece nesta data?
  function occursOn(ev, key) {
    if (key < ev.date) return false;
    const repeat = ev.repeat || { type: 'none' };
    if (repeat.type !== 'none' && repeat.until && key > repeat.until) return false;
    if ((ev.exceptions || []).includes(key)) return false;

    switch (repeat.type) {
      case 'daily':
        return true;
      case 'weekly': {
        const days = repeat.days && repeat.days.length ? repeat.days : [Utils.fromKey(ev.date).getDay()];
        return days.includes(Utils.fromKey(key).getDay());
      }
      case 'monthly':
        return Utils.fromKey(key).getDate() === Utils.fromKey(ev.date).getDate();
      default:
        return key === ev.date;
    }
  }

  // Todas as ocorrências entre duas datas (inclusive), em ordem de data e hora.
  function occurrencesBetween(events, fromKey, toKey) {
    const out = [];
    for (let key = fromKey; key <= toKey; key = Utils.addDays(key, 1)) {
      for (const ev of events) {
        if (occursOn(ev, key)) {
          out.push({ event: ev, date: key, start: ev.start, end: ev.end, key: `${ev.id}|${key}` });
        }
      }
    }
    return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }

  // 'done' | 'overdue' | 'today' | 'future' | 'nodate'
  function taskStatus(task, now = new Date()) {
    if (task.done) return 'done';
    if (!task.dueDate) return 'nodate';
    const today = Utils.toKey(now);
    if (task.dueDate < today) return 'overdue';
    if (task.dueDate === today) {
      return task.dueTime && task.dueTime < Utils.nowTime(now) ? 'overdue' : 'today';
    }
    return 'future';
  }

  // Atrasadas primeiro, depois prioridade, depois prazo mais próximo.
  function sortTasks(tasks, now = new Date()) {
    const dueOf = (t) => (t.dueDate ? t.dueDate + (t.dueTime || '99:99') : '9999');
    return [...tasks].sort((a, b) => {
      const oa = taskStatus(a, now) === 'overdue' ? 0 : 1;
      const ob = taskStatus(b, now) === 'overdue' ? 0 : 1;
      return (
        oa - ob ||
        (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) ||
        dueOf(a).localeCompare(dueOf(b)) ||
        (a.createdAt || 0) - (b.createdAt || 0)
      );
    });
  }

  // Distribui compromissos sobrepostos em colunas lado a lado.
  // Retorna [{ occ, col, cols }].
  function layout(occs, minDuration = 20) {
    const items = occs
      .map((occ) => {
        const s = Utils.toMin(occ.start);
        return { occ, s, e: Math.max(Utils.toMin(occ.end), s + minDuration) };
      })
      .sort((a, b) => a.s - b.s || b.e - a.e);

    const out = [];
    let cluster = [];
    let colEnds = [];
    let clusterEnd = -1;
    const flush = () => {
      cluster.forEach((it) => (it.cols = colEnds.length));
      out.push(...cluster);
      cluster = [];
      colEnds = [];
      clusterEnd = -1;
    };

    for (const it of items) {
      if (cluster.length && it.s >= clusterEnd) flush();
      let col = colEnds.findIndex((end) => end <= it.s);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(it.e);
      } else {
        colEnds[col] = it.e;
      }
      it.col = col;
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.e);
    }
    flush();
    return out.map(({ occ, col, cols }) => ({ occ, col, cols }));
  }

  return { occursOn, occurrencesBetween, taskStatus, sortTasks, layout };
})();

if (typeof module !== 'undefined') module.exports = Schedule;
