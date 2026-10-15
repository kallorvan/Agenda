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
      case 'monthly': {
        const d = Utils.fromKey(key);
        const first = Utils.fromKey(ev.date);
        if (repeat.monthlyBy === 'weekday' || repeat.monthlyBy === 'lastWeekday') {
          if (d.getDay() !== first.getDay()) return false;
          const pos = weekdayPosition(key);
          return repeat.monthlyBy === 'lastWeekday' ? pos.isLast : pos.n === weekdayPosition(ev.date).n;
        }
        return d.getDate() === first.getDate();
      }
      default:
        return key === ev.date;
    }
  }

  // Posição do dia da semana no mês: 2/11/2026 é a 1ª segunda-feira (n = 1);
  // isLast indica que é a última daquele dia da semana no mês.
  function weekdayPosition(key) {
    const d = Utils.fromKey(key);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return { weekday: d.getDay(), n: Math.ceil(d.getDate() / 7), isLast: d.getDate() + 7 > daysInMonth };
  }

  // Todas as ocorrências entre duas datas (inclusive), em ordem de data e hora.
  function occurrencesBetween(events, fromKey, toKey) {
    const out = [];
    for (let key = fromKey; key <= toKey; key = Utils.addDays(key, 1)) {
      for (const ev of events) {
        if (occursOn(ev, key)) {
          out.push({
            event: ev, date: key, start: ev.start, end: ev.end, key: `${ev.id}|${key}`,
            done: (ev.completed || []).includes(key),
            dismissed: (ev.dismissed || []).includes(key),
          });
        }
      }
    }
    return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }

  // Compromisso que já terminou e não foi marcado como concluído nem ignorado.
  // Em compromissos que se repetem, as repetições de antes do cadastro não contam
  // (ex.: reunião diária cadastrada hoje com início no dia 1º).
  function isMissed(occ, now = new Date()) {
    if (occ.done || occ.dismissed) return false;
    const today = Utils.toKey(now);
    const ended = occ.date < today || (occ.date === today && occ.end <= Utils.nowTime(now));
    if (!ended) return false;
    const recurring = occ.event.repeat?.type && occ.event.repeat.type !== 'none';
    const created = occ.event.createdAt ? Utils.toKey(new Date(occ.event.createdAt)) : '';
    return !recurring || occ.date >= created;
  }

  // Não concluídos dos últimos `days` dias, do mais recente para o mais antigo.
  function missedOccurrences(events, now = new Date(), days = 7) {
    const today = Utils.toKey(now);
    return occurrencesBetween(events, Utils.addDays(today, -days), today)
      .filter((o) => isMissed(o, now))
      .reverse();
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

  // Progresso da lista de itens de uma tarefa: { done, total }.
  function itemProgress(task) {
    const items = Array.isArray(task.items) ? task.items : [];
    return { done: items.filter((i) => i.done).length, total: items.length };
  }

  // Divide um texto colado em itens: uma linha por item, sem marcadores de lista.
  function parseItems(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:[-*•–]|\[[ xX]?\]|\d+[.)](?=\s))\s*/, '').trim())
      .filter(Boolean);
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

  return { occursOn, weekdayPosition, occurrencesBetween, isMissed, missedOccurrences, taskStatus, sortTasks, itemProgress, parseItems, layout };
})();

if (typeof module !== 'undefined') module.exports = Schedule;
