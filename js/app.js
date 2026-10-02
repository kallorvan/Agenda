// Interface da agenda: telas, formulários, lembretes e atalhos.
(() => {
  'use strict';

  const HOUR_PX = 48;
  const PRIORITIES = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  const REMINDERS = [
    ['', 'Sem lembrete'], ['0', 'Na hora'], ['5', '5 minutos antes'], ['10', '10 minutos antes'],
    ['15', '15 minutos antes'], ['30', '30 minutos antes'], ['60', '1 hora antes'],
    ['120', '2 horas antes'], ['1440', '1 dia antes'],
  ];
  const WEEKDAYS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];
  const NOTIFIED_KEY = 'agenda.notified';
  const NOTIFY_DISMISSED_KEY = 'agenda.notifyDismissed';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = U.esc;
  const data = () => Store.data;
  const settings = () => Store.data.settings;

  const state = { view: 'day', date: U.todayKey(), taskTab: 'day', project: '', expanded: new Set() };
  let lastScrollKey = null;
  let lastMinute = U.nowTime();

  // ---------- Auxiliares ----------

  const projectOf = (id) => data().projects.find((p) => p.id === id);
  const projectColor = (id) => projectOf(id)?.color || 'var(--accent)';
  const matchesFilter = (item) => !state.project || item.projectId === state.project;
  const filteredEvents = () => data().events.filter(matchesFilter);
  const filteredTasks = () => data().tasks.filter(matchesFilter);

  function safeStorage(fn, fallback) {
    try { return fn(); } catch (_) { return fallback; }
  }

  function projectChip(id) {
    const p = projectOf(id);
    return p ? `<span class="chip" style="--c:${esc(p.color)}"><i></i>${esc(p.name)}</span>` : '';
  }

  function fillProjectSelect(select, value, emptyLabel) {
    select.innerHTML =
      `<option value="">${esc(emptyLabel)}</option>` +
      data().projects.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    select.value = value && projectOf(value) ? value : '';
  }

  function fillReminderSelect(select, value) {
    select.innerHTML = REMINDERS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    select.value = value === null || value === undefined ? '' : String(value);
  }

  const parseReminder = (v) => (v === '' ? null : Number(v));

  function taskDueLabel(task, now = new Date()) {
    if (!task.dueDate) return 'Sem prazo';
    const status = Schedule.taskStatus(task, now);
    const day = U.relativeDay(task.dueDate);
    const text = task.dueTime ? `${day} ${task.dueTime}` : day;
    return status === 'overdue' ? `Atrasada · ${text}` : text;
  }

  // ---------- Renderização ----------

  function render() {
    $$('.segmented [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
    $('#periodLabel').textContent = periodLabel();
    fillProjectSelect($('#projectFilter'), state.project, 'Todos os projetos');
    state.project = $('#projectFilter').value;

    const view = $('#view');
    view.className = `view-${state.view}`;
    if (state.view === 'day') view.innerHTML = renderDay();
    else if (state.view === 'week') view.innerHTML = renderWeek();
    else view.innerHTML = renderMonth();

    autoScroll();
    updateTitle();
  }

  function periodLabel() {
    if (state.view === 'day') {
      const label = U.longDate(state.date);
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    if (state.view === 'week') {
      const start = U.weekStart(state.date);
      const end = U.addDays(start, settings().showWeekend ? 6 : 4);
      return `${U.dayMonthShort(start)} – ${U.dayMonthShort(end)} de ${U.fromKey(end).getFullYear()}`;
    }
    const label = U.monthYear(state.date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function updateTitle() {
    const now = new Date();
    const overdue = data().tasks.filter((t) => Schedule.taskStatus(t, now) === 'overdue').length;
    document.title = overdue ? `(${overdue}) Agenda` : 'Agenda';
  }

  // Rola a linha do tempo até a hora atual ao abrir um dia ou semana.
  function autoScroll() {
    const key = `${state.view}|${state.date}`;
    if (key === lastScrollKey) return;
    lastScrollKey = key;
    const scroller = $('.timeline-scroll');
    if (!scroller) return;
    const nowMin = U.toMin(U.nowTime()) - settings().dayStart * 60;
    scroller.scrollTop = Math.max(0, ((nowMin - 60) / 60) * HOUR_PX);
  }

  function hourLabels() {
    const { dayStart, dayEnd } = settings();
    let html = '';
    for (let h = dayStart; h < dayEnd; h++) {
      html += `<div class="hour-label" style="top:${(h - dayStart) * HOUR_PX}px">${U.pad(h)}:00</div>`;
    }
    return `<div class="hours" style="height:${(dayEnd - dayStart) * HOUR_PX}px">${html}</div>`;
  }

  function isVisible(occ) {
    const { dayStart, dayEnd } = settings();
    return U.toMin(occ.end) > dayStart * 60 && U.toMin(occ.start) < dayEnd * 60;
  }

  function renderTrack(key, occs) {
    const { dayStart, dayEnd } = settings();
    const startMin = dayStart * 60;
    const endMin = dayEnd * 60;
    const now = new Date();
    const today = U.todayKey();
    const nowMin = U.toMin(U.nowTime(now));

    const blocks = Schedule.layout(occs.filter(isVisible)).map(({ occ, col, cols }) => {
      const ev = occ.event;
      const s = Math.max(U.toMin(occ.start), startMin);
      const e = Math.min(U.toMin(occ.end), endMin);
      const top = ((s - startMin) / 60) * HOUR_PX;
      const height = Math.max(((e - s) / 60) * HOUR_PX, 18);
      const past = occ.date < today || (occ.date === today && U.toMin(occ.end) <= nowMin);
      const size = height < 36 ? 'short' : height < 60 ? 'compact' : '';
      const classes = ['event-block', size, past ? 'past' : ''].join(' ');
      return `<button type="button" class="${classes}" data-action="open-event" data-id="${esc(ev.id)}" data-date="${occ.date}"
          style="top:${top}px;height:${height}px;left:calc(${(col / cols) * 100}% + 2px);width:calc(${100 / cols}% - 4px);--c:${esc(projectColor(ev.projectId))}"
          title="${esc(`${occ.start}–${occ.end} ${ev.title}`)}">
          <span class="ev-title">${esc(ev.title)}</span>
          <span class="ev-time">${occ.start}–${occ.end}${ev.repeat?.type && ev.repeat.type !== 'none' ? ' ↻' : ''}</span>
          ${ev.location ? `<span class="ev-loc">${esc(ev.location)}</span>` : ''}
        </button>`;
    });

    const nowLine =
      key === today && nowMin >= startMin && nowMin < endMin
        ? `<div class="now-line" style="top:${((nowMin - startMin) / 60) * HOUR_PX}px"></div>`
        : '';

    return `<div class="track ${key === today ? 'is-today' : ''}" data-date="${key}" style="height:${(dayEnd - dayStart) * HOUR_PX}px">${blocks.join('')}${nowLine}</div>`;
  }

  function outsideNote(occs) {
    const outside = occs.filter((o) => !isVisible(o));
    if (!outside.length) return '';
    return `<div class="outside-note">Fora do horário exibido:
      ${outside.map((o) => `<button type="button" class="link-btn" data-action="open-event" data-id="${esc(o.event.id)}" data-date="${o.date}">${state.view === 'week' ? U.weekdayShort(o.date) + ' ' : ''}${o.start} ${esc(o.event.title)}</button>`).join(' · ')}
    </div>`;
  }

  // ----- Dia -----

  function renderDay() {
    const key = state.date;
    const occs = Schedule.occurrencesBetween(filteredEvents(), key, key);
    return `<div class="day-layout">
      <section class="panel timeline-panel">
        <div class="panel-head">
          <h2>Compromissos <span class="count">${occs.length}</span></h2>
          <button type="button" class="btn small" data-action="new-event" data-date="${key}">+ Novo</button>
        </div>
        ${outsideNote(occs)}
        <div class="timeline-scroll">
          <div class="timeline" style="--n:1">${hourLabels()}${renderTrack(key, occs)}</div>
        </div>
      </section>
      ${renderTasksPanel(key)}
      ${renderSidePanel()}
    </div>`;
  }

  function renderTasksPanel(key) {
    const now = new Date();
    const today = U.todayKey();
    const all = filteredTasks();
    let pending = [];
    let done = [];
    let empty = '';

    if (state.taskTab === 'day') {
      if (key === today) {
        pending = all.filter((t) => !t.done && (!t.dueDate || t.dueDate <= today));
        done = all.filter((t) => t.done && t.doneAt && U.toKey(new Date(t.doneAt)) === today);
        empty = 'Nenhuma tarefa para hoje. Adicione abaixo ou aproveite o respiro.';
      } else {
        pending = all.filter((t) => !t.done && t.dueDate === key);
        done = all.filter((t) => t.done && t.dueDate === key);
        empty = 'Nenhuma tarefa com prazo neste dia.';
      }
    } else if (state.taskTab === 'all') {
      pending = all.filter((t) => !t.done);
      empty = 'Nenhuma tarefa pendente.';
    } else {
      done = all.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      empty = 'Nenhuma tarefa concluída ainda.';
    }

    const sorted = Schedule.sortTasks(pending, now);
    const items = [...sorted, ...done].map((t) => taskItem(t, now)).join('');
    const tab = (id, label) =>
      `<button type="button" class="${state.taskTab === id ? 'active' : ''}" data-action="task-tab" data-tab="${id}">${label}</button>`;

    const quickAdd = state.taskTab === 'done' ? '' : `
      <form class="quick-add" data-form="quick-task">
        <input name="title" maxlength="200" autocomplete="off" placeholder="${state.taskTab === 'day' ? `Nova tarefa para ${U.relativeDay(key).toLowerCase()}…` : 'Nova tarefa sem prazo…'}" aria-label="Nova tarefa">
        <select name="priority" aria-label="Prioridade">
          <option value="alta">Alta</option><option value="media" selected>Média</option><option value="baixa">Baixa</option>
        </select>
        <button type="submit" class="btn small">Adicionar</button>
      </form>`;

    return `<section class="panel tasks-panel">
      <div class="panel-head">
        <h2>Tarefas <span class="count">${sorted.length}</span></h2>
        <div class="segmented small">${tab('day', key === today ? 'Hoje' : 'Do dia')}${tab('all', 'Todas')}${tab('done', 'Concluídas')}</div>
      </div>
      ${quickAdd}
      ${items ? `<ul class="task-list">${items}</ul>` : `<p class="empty">${empty}</p>`}
    </section>`;
  }

  function progressBadge(t) {
    const { done, total } = Schedule.itemProgress(t);
    if (!total) return '';
    return `<span class="progress ${done === total ? 'complete' : ''}" title="${done} de ${total} itens marcados">
      <span class="bar"><i style="width:${Math.round((done / total) * 100)}%"></i></span>${done}/${total}</span>`;
  }

  function taskItem(t, now) {
    const status = Schedule.taskStatus(t, now);
    const canSnooze = status === 'overdue' || status === 'today';
    const items = Array.isArray(t.items) ? t.items : [];
    const open = items.length > 0 && state.expanded.has(t.id);
    const expand = items.length
      ? `<button type="button" class="icon-btn small expand ${open ? 'open' : ''}" data-action="expand-task" data-id="${esc(t.id)}" aria-expanded="${open}" aria-label="${open ? 'Recolher' : 'Mostrar'} itens de ${esc(t.title)}">›</button>`
      : '';
    const subitems = open
      ? `<ul class="subitems">${items.map((i) => `<li class="${i.done ? 'done' : ''}"><label>
          <input type="checkbox" data-action="toggle-item" data-id="${esc(t.id)}" data-item="${esc(i.id)}" ${i.done ? 'checked' : ''}>
          <span>${esc(i.text)}</span></label></li>`).join('')}</ul>`
      : '';
    return `<li class="task status-${status}">
      ${expand}
      <input type="checkbox" class="task-check" data-action="toggle-task" data-id="${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="Concluir ${esc(t.title)}">
      <button type="button" class="task-body" data-action="open-task" data-id="${esc(t.id)}">
        <span class="task-title">${esc(t.title)}</span>
        <span class="task-meta">
          <span class="prio prio-${esc(t.priority)}">${PRIORITIES[t.priority] || 'Média'}</span>
          <span class="due">${esc(taskDueLabel(t, now))}</span>
          ${progressBadge(t)}
          ${projectChip(t.projectId)}
        </span>
      </button>
      ${canSnooze ? `<button type="button" class="btn ghost small snooze" data-action="snooze-task" data-id="${esc(t.id)}" title="Mudar o prazo para ${esc(snoozeLabel())}">Adiar p/ ${esc(snoozeLabel())}</button>` : ''}
      ${subitems}
    </li>`;
  }

  function renderSidePanel() {
    const now = new Date();
    const today = U.todayKey();
    const nowHM = U.nowTime(now);
    const events = filteredEvents();

    const happening = Schedule.occurrencesBetween(events, today, today).filter((o) => o.start <= nowHM && o.end > nowHM);
    const upcoming = Schedule.occurrencesBetween(events, today, U.addDays(today, 14))
      .filter((o) => o.date > today || o.start > nowHM)
      .slice(0, 6);
    const overdue = Schedule.sortTasks(filteredTasks().filter((t) => Schedule.taskStatus(t, now) === 'overdue'), now);

    const occItem = (o, extra = '') => {
      const ev = o.event;
      const link = U.isUrl(ev.location) ? `<a class="join" href="${esc(ev.location.trim())}" target="_blank" rel="noopener noreferrer">Entrar ↗</a>` : '';
      return `<li class="side-item ${extra}" style="--c:${esc(projectColor(ev.projectId))}">
        <button type="button" class="side-body" data-action="open-event" data-id="${esc(ev.id)}" data-date="${o.date}">
          <span class="side-when">${U.relativeDay(o.date)} · ${o.start}–${o.end}</span>
          <span class="side-title">${esc(ev.title)}</span>
          ${ev.location && !link ? `<span class="side-loc">${esc(ev.location)}</span>` : ''}
        </button>${link}
      </li>`;
    };

    const lastBackup = settings().lastBackup;
    const hasData = data().events.length + data().tasks.length > 0;
    const backupDue = hasData && (!lastBackup || Date.now() - lastBackup > 7 * 86400000);

    return `<aside class="side-panel">
      ${happening.length ? `<section class="panel side-section now">
        <h2>Acontecendo agora</h2><ul class="side-list">${happening.map((o) => occItem(o, 'is-now')).join('')}</ul>
      </section>` : ''}

      <section class="panel side-section ${overdue.length ? 'has-overdue' : ''}">
        <h2>Atrasadas <span class="count ${overdue.length ? 'danger' : ''}">${overdue.length}</span></h2>
        ${overdue.length ? `<ul class="side-list">${overdue.map((t) => `<li class="side-item overdue">
            <button type="button" class="side-body" data-action="open-task" data-id="${esc(t.id)}">
              <span class="side-when">${esc(taskDueLabel(t, now))} · ${PRIORITIES[t.priority] || 'Média'}</span>
              <span class="side-title">${esc(t.title)}</span>
            </button>
            <button type="button" class="btn ghost small" data-action="snooze-task" data-id="${esc(t.id)}" title="Adiar para ${esc(snoozeLabel())}">${esc(snoozeLabel().replace(/^./, (c) => c.toUpperCase()))}</button>
          </li>`).join('')}</ul>` : '<p class="empty">Nada atrasado. Muito bem!</p>'}
      </section>

      <section class="panel side-section">
        <h2>Próximos compromissos</h2>
        ${upcoming.length ? `<ul class="side-list">${upcoming.map((o) => occItem(o)).join('')}</ul>` : '<p class="empty">Nenhum compromisso nos próximos 14 dias.</p>'}
      </section>

      ${backupDue ? `<section class="panel side-section backup-hint">
        <p>${lastBackup ? 'Seu último backup tem mais de 7 dias.' : 'Você ainda não fez nenhum backup.'} Os dados ficam só neste navegador.</p>
        <button type="button" class="btn small" data-action="export">Exportar backup agora</button>
      </section>` : ''}
    </aside>`;
  }

  // ----- Semana -----

  function renderWeek() {
    const start = U.weekStart(state.date);
    const n = settings().showWeekend ? 7 : 5;
    const days = Array.from({ length: n }, (_, i) => U.addDays(start, i));
    const today = U.todayKey();
    const now = new Date();
    const occs = Schedule.occurrencesBetween(filteredEvents(), days[0], days[n - 1]);
    const tasks = filteredTasks().filter((t) => t.dueDate && t.dueDate >= days[0] && t.dueDate <= days[n - 1]);

    const head = days.map((d) => `<button type="button" class="week-day-head ${d === today ? 'is-today' : ''}" data-action="goto-day" data-date="${d}">
        <span>${U.weekdayShort(d)}</span><strong>${U.fromKey(d).getDate()}</strong></button>`).join('');

    const allDay = days.map((d) => {
      const list = Schedule.sortTasks(tasks.filter((t) => t.dueDate === d && !t.done), now)
        .concat(tasks.filter((t) => t.dueDate === d && t.done));
      return `<div class="allday-cell">${list.map((t) => taskChip(t, now)).join('')}</div>`;
    }).join('');

    return `<section class="panel week-panel">
      ${outsideNote(occs)}
      <div class="timeline-scroll week-scroll">
        <div class="week-sticky" style="--n:${n}">
          <div class="week-head"><div></div>${head}</div>
          <div class="week-allday"><div class="allday-label">Tarefas</div>${allDay}</div>
        </div>
        <div class="timeline" style="--n:${n}">${hourLabels()}${days.map((d) => renderTrack(d, occs.filter((o) => o.date === d))).join('')}</div>
      </div>
    </section>`;
  }

  function taskChip(t, now) {
    const status = Schedule.taskStatus(t, now);
    return `<button type="button" class="task-chip status-${status} prio-${esc(t.priority)}" data-action="open-task" data-id="${esc(t.id)}" title="${esc(t.title)}">
      <span class="box">${t.done ? '✓' : ''}</span><span class="txt">${t.dueTime ? `${t.dueTime} ` : ''}${esc(t.title)}</span>${chipProgress(t)}</button>`;
  }

  function chipProgress(t) {
    const { done, total } = Schedule.itemProgress(t);
    return total ? `<span class="chip-progress">${done}/${total}</span>` : '';
  }

  // ----- Mês -----

  function renderMonth() {
    const first = U.addMonths(state.date, 0);
    const gridStart = U.weekStart(first);
    const firstDate = U.fromKey(first);
    const daysInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate();
    const offset = (firstDate.getDay() + 6) % 7;
    const weeks = Math.ceil((offset + daysInMonth) / 7);
    const last = U.addDays(gridStart, weeks * 7 - 1);
    const today = U.todayKey();
    const now = new Date();
    const occs = Schedule.occurrencesBetween(filteredEvents(), gridStart, last);
    const tasks = filteredTasks().filter((t) => t.dueDate && t.dueDate >= gridStart && t.dueDate <= last);
    const month = firstDate.getMonth();

    const headers = WEEKDAYS.map(([, l]) => `<div class="month-wd">${l}</div>`).join('');
    let cells = '';
    for (let i = 0; i < weeks * 7; i++) {
      const d = U.addDays(gridStart, i);
      const dayOccs = occs.filter((o) => o.date === d);
      const dayTasks = Schedule.sortTasks(tasks.filter((t) => t.dueDate === d && !t.done), now)
        .concat(tasks.filter((t) => t.dueDate === d && t.done));
      const items = [
        ...dayOccs.map((o) => `<button type="button" class="month-ev" style="--c:${esc(projectColor(o.event.projectId))}" data-action="open-event" data-id="${esc(o.event.id)}" data-date="${d}" title="${esc(`${o.start} ${o.event.title}`)}"><b>${o.start}</b> ${esc(o.event.title)}</button>`),
        ...dayTasks.map((t) => taskChip(t, now)),
      ];
      const max = 3;
      const shown = items.slice(0, max).join('');
      const more = items.length > max ? `<span class="more">+${items.length - max} mais</span>` : '';
      cells += `<div class="month-cell ${U.fromKey(d).getMonth() !== month ? 'other' : ''} ${d === today ? 'is-today' : ''}" data-action="goto-day" data-date="${d}">
        <span class="mc-num">${U.fromKey(d).getDate()}</span>${shown}${more}</div>`;
    }
    return `<section class="panel month-panel"><div class="month-grid">${headers}${cells}</div></section>`;
  }

  // ---------- Ações na tela ----------

  function goto(view, date) {
    state.view = view;
    if (date) state.date = date;
    render();
  }

  function navigate(dir) {
    if (state.view === 'day') state.date = U.addDays(state.date, dir);
    else if (state.view === 'week') state.date = U.addDays(state.date, dir * 7);
    else state.date = U.addMonths(state.date, dir);
    render();
  }

  function saveAndRender(collection, item) {
    Store.upsert(collection, item);
    render();
  }

  function toggleTask(id, done) {
    const task = data().tasks.find((t) => t.id === id);
    if (!task) return;
    const previous = { done: task.done, doneAt: task.doneAt };
    saveAndRender('tasks', { ...task, done, doneAt: done ? Date.now() : null });
    if (done) {
      toast(`Tarefa concluída: ${task.title}`, {
        action: 'Desfazer',
        onAction: () => saveAndRender('tasks', { ...data().tasks.find((t) => t.id === id), ...previous }),
      });
    }
  }

  // Marca um item da lista. Marcar o último conclui a tarefa; desmarcar reabre.
  function toggleItem(taskId, itemId, done) {
    const task = data().tasks.find((t) => t.id === taskId);
    if (!task || !Array.isArray(task.items)) return;
    const before = { done: task.done, doneAt: task.doneAt };
    const items = task.items.map((i) => (i.id === itemId ? { ...i, done } : i));
    const allDone = items.every((i) => i.done);
    const updated = { ...task, items };
    if (allDone && !task.done) Object.assign(updated, { done: true, doneAt: Date.now() });
    if (!done && task.done) Object.assign(updated, { done: false, doneAt: null });
    saveAndRender('tasks', updated);
    if (updated.done && !task.done) {
      toast(`Todos os itens marcados. Tarefa concluída: ${task.title}`, {
        action: 'Desfazer',
        onAction: () => {
          const current = data().tasks.find((t) => t.id === taskId);
          if (!current) return;
          saveAndRender('tasks', {
            ...current,
            ...before,
            items: current.items.map((i) => (i.id === itemId ? { ...i, done: false } : i)),
          });
        },
      });
    }
  }

  // Próximo dia de trabalho: pula o fim de semana quando ele não é exibido.
  function snoozeTarget() {
    let key = U.addDays(U.todayKey(), 1);
    if (!settings().showWeekend) {
      while ([0, 6].includes(U.fromKey(key).getDay())) key = U.addDays(key, 1);
    }
    return key;
  }

  function snoozeLabel() {
    const key = snoozeTarget();
    return key === U.addDays(U.todayKey(), 1) ? 'amanhã' : U.weekdayShort(key);
  }

  function snoozeTask(id) {
    const task = data().tasks.find((t) => t.id === id);
    if (!task) return;
    const label = snoozeLabel();
    saveAndRender('tasks', { ...task, dueDate: snoozeTarget() });
    toast(`Adiada para ${label}: ${task.title}`);
  }

  function onViewClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) {
      const track = e.target.closest('.track');
      if (track && e.target === track) newEventAt(track, e);
      return;
    }
    const { action, id, date } = el.dataset;
    switch (action) {
      case 'open-event': return openEventDialog(id, date);
      case 'open-task': return openTaskDialog(id);
      case 'new-event': return openEventDialog(null, date);
      case 'toggle-task': return toggleTask(id, el.checked);
      case 'toggle-item': return toggleItem(id, el.dataset.item, el.checked);
      case 'expand-task':
        if (state.expanded.has(id)) state.expanded.delete(id);
        else state.expanded.add(id);
        return render();
      case 'snooze-task': return snoozeTask(id);
      case 'goto-day': return goto('day', date);
      case 'task-tab': state.taskTab = el.dataset.tab; return render();
      case 'export': return exportBackup();
    }
  }

  // Clique em um horário vazio cria um compromisso naquele horário.
  function newEventAt(track, e) {
    const rect = track.getBoundingClientRect();
    const minutes = settings().dayStart * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60;
    const start = Math.min(Math.floor(minutes / 30) * 30, 23 * 60);
    openEventDialog(null, track.dataset.date, U.fromMin(start));
  }

  function onViewSubmit(e) {
    const form = e.target.closest('[data-form="quick-task"]');
    if (!form) return;
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) return form.title.focus();
    Store.upsert('tasks', {
      id: U.uid(),
      title,
      priority: form.priority.value,
      dueDate: state.taskTab === 'day' ? state.date : null,
      dueTime: null,
      projectId: state.project || null,
      notes: '',
      done: false,
      doneAt: null,
      createdAt: Date.now(),
    });
    render();
    $('.quick-add input[name="title"]')?.focus();
  }

  // ---------- Diálogos ----------

  function openModal(dialog) {
    dialog.showModal();
    const first = dialog.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea');
    if (first) first.focus();
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.hidden = !msg;
  }

  // ----- Compromisso -----

  let editingEvent = null;
  let editingOccurrence = null;

  function openEventDialog(id, date, start) {
    const dialog = $('#eventDialog');
    const form = $('#eventForm');
    const ev = id ? data().events.find((x) => x.id === id) : null;
    editingEvent = ev;
    editingOccurrence = date || null;

    const startTime = start || defaultStartTime(date);
    const values = ev || {
      title: '', date: date || state.date, start: startTime, end: U.fromMin(Math.min(U.toMin(startTime) + 60, 23 * 60 + 59)),
      location: '', projectId: state.project || null, reminder: settings().defaultReminder,
      repeat: { type: 'none', days: [], until: null }, notes: '',
    };

    $('#eventDialogTitle').textContent = ev ? 'Editar compromisso' : 'Novo compromisso';
    form.title.value = values.title;
    form.date.value = values.date;
    form.start.value = values.start;
    form.end.value = values.end;
    form.location.value = values.location || '';
    fillProjectSelect(form.projectId, values.projectId, 'Sem projeto');
    fillReminderSelect(form.reminder, values.reminder);
    form.repeat.value = values.repeat?.type || 'none';
    form.until.value = values.repeat?.until || '';
    form.notes.value = values.notes || '';

    const days = values.repeat?.days?.length ? values.repeat.days : [U.fromKey(values.date).getDay()];
    $('#weekdaysList').innerHTML = WEEKDAYS.map(([v, l]) =>
      `<label class="day-toggle"><input type="checkbox" name="days" value="${v}" ${days.includes(v) ? 'checked' : ''}><span>${l}</span></label>`).join('');

    $('#eventDeleteBtn').hidden = !ev;
    $('#seriesHint').hidden = !(ev && ev.repeat?.type !== 'none');
    updateEventFormState();
    showError($('#eventError'), '');
    openModal(dialog);
  }

  // Sugere o próximo horário cheio (ou meia hora) quando o dia é hoje.
  function defaultStartTime(date) {
    const key = date || state.date;
    if (key !== U.todayKey()) return U.fromMin(Math.max(settings().dayStart, 9) * 60);
    const min = Math.ceil((U.toMin(U.nowTime()) + 1) / 30) * 30;
    return U.fromMin(Math.min(min, 23 * 60));
  }

  function updateEventFormState() {
    const form = $('#eventForm');
    const repeat = form.repeat.value;
    $('#weekdaysField').hidden = repeat !== 'weekly';
    $('#untilField').classList.toggle('disabled', repeat === 'none');
    form.until.disabled = repeat === 'none';
    $('#eventDateLabel').textContent = repeat === 'none' ? 'Data' : 'Começa em';
    const link = $('#eventLink');
    const loc = form.location.value.trim();
    link.hidden = !U.isUrl(loc);
    if (U.isUrl(loc)) link.href = loc;
  }

  function submitEvent(e) {
    e.preventDefault();
    const form = $('#eventForm');
    const err = $('#eventError');
    const title = form.title.value.trim();
    const repeatType = form.repeat.value;
    const days = $$('input[name="days"]:checked', form).map((c) => Number(c.value));

    if (!title) return showError(err, 'Informe um título.');
    if (!form.date.value) return showError(err, 'Informe a data.');
    if (!form.start.value || !form.end.value) return showError(err, 'Informe o horário de início e de fim.');
    if (form.end.value <= form.start.value) return showError(err, 'O fim precisa ser depois do início.');
    if (repeatType === 'weekly' && !days.length) return showError(err, 'Escolha pelo menos um dia da semana.');
    if (repeatType !== 'none' && form.until.value && form.until.value < form.date.value) {
      return showError(err, 'A data final da repetição precisa ser depois do início.');
    }

    const ev = {
      ...(editingEvent || { id: U.uid(), exceptions: [], createdAt: Date.now() }),
      title,
      date: form.date.value,
      start: form.start.value,
      end: form.end.value,
      location: form.location.value.trim(),
      projectId: form.projectId.value || null,
      reminder: parseReminder(form.reminder.value),
      repeat: {
        type: repeatType,
        days: repeatType === 'weekly' ? days : [],
        until: repeatType !== 'none' && form.until.value ? form.until.value : null,
      },
      notes: form.notes.value.trim(),
    };
    // Lembretes já disparados não devem impedir o aviso de um novo horário.
    if (editingEvent && (editingEvent.start !== ev.start || editingEvent.reminder !== ev.reminder)) {
      forgetNotified(ev.id);
    }
    $('#eventDialog').close();
    saveAndRender('events', ev);
    toast(editingEvent ? 'Compromisso atualizado.' : 'Compromisso criado.');
  }

  async function deleteEvent() {
    const ev = editingEvent;
    if (!ev) return;
    const recurring = ev.repeat?.type && ev.repeat.type !== 'none';
    let choice;
    if (recurring && editingOccurrence) {
      choice = await askChoice('Excluir compromisso', `"${ev.title}" se repete. O que deseja excluir?`, [
        { label: 'Cancelar', value: '' },
        { label: `Só o de ${U.dayMonth(editingOccurrence)}`, value: 'one' },
        { label: 'Todas as repetições', value: 'all', kind: 'danger' },
      ]);
    } else {
      choice = await askChoice('Excluir compromisso', `Excluir "${ev.title}"?`, [
        { label: 'Cancelar', value: '' },
        { label: 'Excluir', value: 'all', kind: 'danger' },
      ]);
    }
    if (!choice) return;
    $('#eventDialog').close();
    if (choice === 'one') {
      saveAndRender('events', { ...ev, exceptions: [...(ev.exceptions || []), editingOccurrence] });
    } else {
      Store.remove('events', ev.id);
      render();
    }
    toast('Compromisso excluído.');
  }

  // ----- Tarefa -----

  let editingTask = null;
  let draftItems = [];

  function renderDraftItems() {
    const done = draftItems.filter((i) => i.done).length;
    $('#checklistEdit').innerHTML = draftItems.map((i) => `<li data-item="${esc(i.id)}" class="${i.done ? 'done' : ''}">
        <input type="checkbox" data-field="done" ${i.done ? 'checked' : ''} aria-label="Marcar item">
        <input data-field="text" value="${esc(i.text)}" maxlength="300" aria-label="Texto do item">
        <button type="button" class="icon-btn small" data-remove-item aria-label="Remover item">×</button>
      </li>`).join('');
    $('#itemsProgress').textContent = draftItems.length ? `${done}/${draftItems.length}` : '';
    $('#uncheckAllBtn').hidden = done === 0;
  }

  // Mantém "Concluída" coerente com os itens marcados.
  function syncDoneWithItems() {
    const form = $('#taskForm');
    if (!draftItems.length) return;
    form.done.checked = draftItems.every((i) => i.done);
  }

  function addDraftItems(texts) {
    for (const text of texts) draftItems.push({ id: U.uid(), text, done: false });
    if (texts.length) clearDoneCheckbox();
    renderDraftItems();
  }

  // Um item novo (não marcado) reabre a tarefa.
  function clearDoneCheckbox() {
    $('#taskForm').done.checked = false;
  }

  function onNewItemKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const input = e.target;
    addDraftItems(Schedule.parseItems(input.value));
    input.value = '';
  }

  function onNewItemPaste(e) {
    const text = e.clipboardData?.getData('text') || '';
    if (!/\r?\n/.test(text.trim())) return;
    e.preventDefault();
    const input = e.target;
    addDraftItems(Schedule.parseItems(input.value + text));
    input.value = '';
  }

  function onChecklistInput(e) {
    const li = e.target.closest('li[data-item]');
    const item = li && draftItems.find((i) => i.id === li.dataset.item);
    if (!item) return;
    if (e.target.dataset.field === 'text') item.text = e.target.value;
    if (e.target.dataset.field === 'done') {
      item.done = e.target.checked;
      li.classList.toggle('done', item.done);
      syncDoneWithItems();
      const done = draftItems.filter((i) => i.done).length;
      $('#itemsProgress').textContent = `${done}/${draftItems.length}`;
      $('#uncheckAllBtn').hidden = done === 0;
    }
  }

  function onChecklistClick(e) {
    const btn = e.target.closest('[data-remove-item]');
    if (!btn) return;
    const id = btn.closest('li').dataset.item;
    draftItems = draftItems.filter((i) => i.id !== id);
    renderDraftItems();
    $('#newItemInput').focus();
  }

  function uncheckAll() {
    draftItems.forEach((i) => (i.done = false));
    clearDoneCheckbox();
    renderDraftItems();
  }

  function openTaskDialog(id) {
    const form = $('#taskForm');
    const task = id ? data().tasks.find((t) => t.id === id) : null;
    editingTask = task;
    const values = task || {
      title: '', priority: 'media', dueDate: state.view === 'day' ? state.date : '', dueTime: '',
      projectId: state.project || null, notes: '', done: false,
    };
    $('#taskDialogTitle').textContent = task ? 'Editar tarefa' : 'Nova tarefa';
    form.title.value = values.title;
    form.priority.value = values.priority || 'media';
    form.dueDate.value = values.dueDate || '';
    form.dueTime.value = values.dueTime || '';
    fillProjectSelect(form.projectId, values.projectId, 'Sem projeto');
    form.notes.value = values.notes || '';
    form.done.checked = !!values.done;
    form.done.closest('label').hidden = !task;
    draftItems = (values.items || []).map((i) => ({ ...i }));
    $('#newItemInput').value = '';
    renderDraftItems();
    $('#taskDeleteBtn').hidden = !task;
    showError($('#taskError'), '');
    openModal($('#taskDialog'));
  }

  function submitTask(e) {
    e.preventDefault();
    const form = $('#taskForm');
    const err = $('#taskError');
    const title = form.title.value.trim();
    if (!title) return showError(err, 'Informe um título.');
    if (form.dueTime.value && !form.dueDate.value) return showError(err, 'Para definir a hora, informe também a data do prazo.');

    // Texto digitado e não confirmado com Enter também vira item.
    const pending = Schedule.parseItems($('#newItemInput').value);
    if (pending.length) addDraftItems(pending);
    const items = draftItems
      .map((i) => ({ id: i.id, text: i.text.trim(), done: !!i.done }))
      .filter((i) => i.text);

    const done = form.done.checked;
    const task = {
      ...(editingTask || { id: U.uid(), createdAt: Date.now() }),
      title,
      priority: form.priority.value || 'media',
      dueDate: form.dueDate.value || null,
      dueTime: form.dueTime.value || null,
      projectId: form.projectId.value || null,
      notes: form.notes.value.trim(),
      items,
      done,
      doneAt: done ? editingTask?.doneAt || Date.now() : null,
    };
    if (editingTask && (editingTask.dueDate !== task.dueDate || editingTask.dueTime !== task.dueTime)) {
      forgetNotified(task.id);
    }
    $('#taskDialog').close();
    saveAndRender('tasks', task);
    toast(editingTask ? 'Tarefa atualizada.' : 'Tarefa criada.');
  }

  async function deleteTask() {
    const task = editingTask;
    if (!task) return;
    const choice = await askChoice('Excluir tarefa', `Excluir "${task.title}"?`, [
      { label: 'Cancelar', value: '' },
      { label: 'Excluir', value: 'yes', kind: 'danger' },
    ]);
    if (!choice) return;
    $('#taskDialog').close();
    Store.remove('tasks', task.id);
    render();
    toast('Tarefa excluída.');
  }

  // ----- Escolha -----

  function askChoice(title, message, buttons) {
    const dialog = $('#choiceDialog');
    $('#choiceTitle').textContent = title;
    $('#choiceMessage').textContent = message;
    $('#choiceButtons').innerHTML = '<span class="spacer"></span>' + buttons
      .map((b) => `<button class="btn ${b.kind === 'danger' ? 'danger' : ''}" value="${esc(b.value)}">${esc(b.label)}</button>`)
      .join('');
    dialog.returnValue = '';
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
      dialog.showModal();
      dialog.querySelector('.btn.danger, .btn:last-child')?.focus();
    });
  }

  // ----- Configurações -----

  let draftProjects = [];

  function openSettings() {
    const form = $('#settingsForm');
    const s = settings();
    const hours = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .map((h) => `<option value="${h}">${U.pad(h)}:00</option>`).join('');
    form.dayStart.innerHTML = hours(0, 23);
    form.dayEnd.innerHTML = hours(1, 24);
    form.dayStart.value = s.dayStart;
    form.dayEnd.value = s.dayEnd;
    fillReminderSelect(form.defaultReminder, s.defaultReminder);
    form.showWeekend.checked = !!s.showWeekend;
    draftProjects = data().projects.map((p) => ({ ...p }));
    renderProjectList();
    updateNotifyUI();
    $('#lastBackupInfo').textContent = s.lastBackup
      ? `Último backup: ${new Date(s.lastBackup).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`
      : 'Nenhum backup feito ainda.';
    showError($('#settingsError'), '');
    openModal($('#settingsDialog'));
  }

  function renderProjectList() {
    $('#projectList').innerHTML = draftProjects.length
      ? draftProjects.map((p) => `<li data-id="${esc(p.id)}">
          <input type="color" value="${esc(p.color)}" data-field="color" aria-label="Cor de ${esc(p.name)}">
          <input value="${esc(p.name)}" data-field="name" maxlength="60" aria-label="Nome do projeto">
          <button type="button" class="btn ghost small danger-text" data-remove-project>Remover</button>
        </li>`).join('')
      : '<li class="empty">Nenhum projeto ainda. Projetos ajudam a separar clientes ou frentes de trabalho.</li>';
  }

  function onProjectListInput(e) {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const p = draftProjects.find((x) => x.id === li.dataset.id);
    if (p && e.target.dataset.field) p[e.target.dataset.field] = e.target.value;
  }

  function onProjectListClick(e) {
    if (!e.target.closest('[data-remove-project]')) return;
    const id = e.target.closest('li').dataset.id;
    draftProjects = draftProjects.filter((p) => p.id !== id);
    renderProjectList();
  }

  function addProject() {
    const name = $('#newProjectName').value.trim();
    if (!name) return $('#newProjectName').focus();
    draftProjects.push({ id: U.uid(), name, color: $('#newProjectColor').value });
    $('#newProjectName').value = '';
    // Sugere uma cor diferente para o próximo projeto.
    const palette = ['#2f6fed', '#0f9d76', '#d9480f', '#7c3aed', '#c2255c', '#0b7285', '#a16207', '#4b5563'];
    $('#newProjectColor').value = palette[draftProjects.length % palette.length];
    renderProjectList();
    $('#newProjectName').focus();
  }

  function submitSettings(e) {
    e.preventDefault();
    const form = $('#settingsForm');
    const dayStart = Number(form.dayStart.value);
    const dayEnd = Number(form.dayEnd.value);
    if (dayEnd <= dayStart) return showError($('#settingsError'), 'O fim do expediente precisa ser depois do início.');
    if (draftProjects.some((p) => !p.name.trim())) return showError($('#settingsError'), 'Todo projeto precisa de um nome.');

    const keep = new Set(draftProjects.map((p) => p.id));
    data().projects.filter((p) => !keep.has(p.id)).forEach((p) => Store.removeProject(p.id));
    data().projects = draftProjects.map((p) => ({ ...p, name: p.name.trim() }));
    Store.setSettings({
      dayStart,
      dayEnd,
      defaultReminder: parseReminder(form.defaultReminder.value),
      showWeekend: form.showWeekend.checked,
    });
    if (state.project && !keep.has(state.project)) state.project = '';
    $('#settingsDialog').close();
    lastScrollKey = null;
    render();
    toast('Configurações salvas.');
  }

  // ----- Backup -----

  function exportBackup() {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agenda-backup-${U.todayKey()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Store.setSettings({ lastBackup: Date.now() });
    if ($('#settingsDialog').open) $('#lastBackupInfo').textContent = 'Último backup: agora.';
    render();
    toast('Backup exportado. Guarde o arquivo em um lugar seguro.');
  }

  async function importBackup(file) {
    let text;
    try {
      text = await file.text();
      Store.normalize(JSON.parse(text));
    } catch (_) {
      toast('Não foi possível ler este arquivo. Verifique se é um backup da agenda.', { kind: 'error' });
      return;
    }
    const choice = await askChoice('Importar backup', 'Todos os dados atuais serão substituídos pelos do arquivo. Deseja continuar?', [
      { label: 'Cancelar', value: '' },
      { label: 'Substituir dados', value: 'yes', kind: 'danger' },
    ]);
    if (!choice) return;
    Store.importJSON(text);
    state.project = '';
    $('#settingsDialog').close();
    render();
    toast('Backup importado com sucesso.');
  }

  // ---------- Avisos ----------

  function toast(message, opts = {}) {
    const el = document.createElement('div');
    el.className = `toast ${opts.kind || ''}`;
    el.innerHTML = `<div class="toast-text">${opts.title ? `<strong>${esc(opts.title)}</strong>` : ''}<span>${esc(message)}</span></div>`;
    if (opts.action) {
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = opts.action;
      btn.onclick = () => { opts.onAction(); el.remove(); };
      el.append(btn);
    }
    const close = document.createElement('button');
    close.className = 'icon-btn small';
    close.setAttribute('aria-label', 'Fechar aviso');
    close.textContent = '×';
    close.onclick = () => el.remove();
    el.append(close);
    $('#toasts').append(el);
    if (!opts.sticky) setTimeout(() => el.remove(), opts.action ? 7000 : 4000);
  }

  // ----- Notificações e lembretes -----

  const notifySupported = () => 'Notification' in window;

  function updateNotifyUI() {
    const banner = $('#notifyBanner');
    const dismissed = safeStorage(() => localStorage.getItem(NOTIFY_DISMISSED_KEY), null);
    banner.hidden = !(notifySupported() && Notification.permission === 'default' && !dismissed);

    const status = $('#notifyStatus');
    const btn = $('#settingsNotifyBtn');
    if (!notifySupported()) {
      status.textContent = 'Este navegador não permite notificações aqui. Os lembretes aparecem como avisos dentro da agenda, desde que ela esteja aberta.';
      btn.hidden = true;
    } else if (Notification.permission === 'granted') {
      status.textContent = 'Notificações ativadas. Mantenha a agenda aberta em uma aba (pode ser em segundo plano) para receber os lembretes.';
      btn.hidden = true;
    } else if (Notification.permission === 'denied') {
      status.textContent = 'As notificações foram bloqueadas. Para liberar, clique no cadeado ao lado do endereço do site e permita notificações. Enquanto isso, os lembretes aparecem dentro da agenda.';
      btn.hidden = true;
    } else {
      status.textContent = 'As notificações ainda não foram ativadas.';
      btn.hidden = false;
    }
  }

  async function requestNotify() {
    if (!notifySupported()) return;
    try {
      await Notification.requestPermission();
    } catch (_) { /* navegador antigo ou bloqueio */ }
    updateNotifyUI();
    if (Notification.permission === 'granted') toast('Notificações ativadas.');
  }

  function loadNotified() {
    return new Set(safeStorage(() => JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]'), []));
  }

  function saveNotified(set) {
    // Mantém só os registros recentes.
    const minDate = U.addDays(U.todayKey(), -2);
    const recent = [...set].filter((k) => (k.split('|')[1] || '') >= minDate);
    safeStorage(() => localStorage.setItem(NOTIFIED_KEY, JSON.stringify(recent)));
  }

  function forgetNotified(id) {
    const set = loadNotified();
    [...set].filter((k) => k.startsWith(`${id}|`)).forEach((k) => set.delete(k));
    saveNotified(set);
  }

  function notify(key, title, body, onClick) {
    toast(body, { title, sticky: true, kind: 'reminder' });
    if (notifySupported() && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, { body, tag: key, requireInteraction: true });
        n.onclick = () => { window.focus(); onClick(); n.close(); };
      } catch (_) { /* alguns navegadores só notificam via service worker */ }
    }
  }

  function checkReminders() {
    const now = new Date();
    const today = U.todayKey();
    const notified = loadNotified();
    let changed = false;

    // Compromissos de hoje e amanhã (lembretes de até 1 dia antes).
    for (const o of Schedule.occurrencesBetween(data().events, today, U.addDays(today, 1))) {
      const reminder = o.event.reminder;
      if (reminder === null || reminder === undefined || notified.has(o.key)) continue;
      const start = U.dateTime(o.date, o.start);
      const fireAt = start.getTime() - reminder * 60000;
      if (now.getTime() >= fireAt && now.getTime() < start.getTime() + 60000) {
        const mins = Math.round((start - now) / 60000);
        const when = mins <= 0 ? 'Começando agora' : mins < 60 ? `Em ${mins} min` : `${U.relativeDay(o.date)} às ${o.start}`;
        const place = o.event.location ? ` · ${o.event.location}` : '';
        notify(o.key, o.event.title, `${when} (${o.start}–${o.end})${place}`, () => goto('day', o.date));
        notified.add(o.key);
        changed = true;
      }
    }

    // Tarefas com hora de prazo: aviso com a antecedência padrão.
    const lead = settings().defaultReminder ?? 15;
    for (const t of data().tasks) {
      if (t.done || !t.dueDate || !t.dueTime) continue;
      const key = `${t.id}|${t.dueDate}`;
      if (notified.has(key)) continue;
      const due = U.dateTime(t.dueDate, t.dueTime).getTime();
      if (now.getTime() >= due - lead * 60000 && now.getTime() < due + 60000) {
        notify(key, `Prazo: ${t.title}`, `Tarefa com prazo ${U.relativeDay(t.dueDate).toLowerCase()} às ${t.dueTime}`, () => goto('day', U.todayKey()));
        notified.add(key);
        changed = true;
      }
    }
    if (changed) saveNotified(notified);
  }

  // Atualiza a tela a cada minuto (linha do "agora", atrasos) sem atrapalhar a digitação.
  function tick() {
    checkReminders();
    const minute = U.nowTime();
    if (minute === lastMinute) return;
    lastMinute = minute;
    const typing = document.activeElement?.closest('#view input, #view select, #view textarea');
    if (!typing) render();
    else updateTitle();
  }

  // ---------- Atalhos de teclado ----------

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest('input, select, textarea, [contenteditable]')) return;
    const actions = {
      c: () => openEventDialog(null, state.date),
      n: () => openTaskDialog(null),
      t: () => goto(state.view, U.todayKey()),
      d: () => goto('day'),
      s: () => goto('week'),
      m: () => goto('month'),
      ArrowLeft: () => navigate(-1),
      ArrowRight: () => navigate(1),
    };
    const fn = actions[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (fn) { e.preventDefault(); fn(); }
  }

  // ---------- Inicialização ----------

  function init() {
    $$('.segmented [data-view]').forEach((b) => b.addEventListener('click', () => goto(b.dataset.view)));
    $('#prevBtn').addEventListener('click', () => navigate(-1));
    $('#nextBtn').addEventListener('click', () => navigate(1));
    $('#todayBtn').addEventListener('click', () => goto(state.view, U.todayKey()));
    $('#projectFilter').addEventListener('change', (e) => { state.project = e.target.value; render(); });
    $('#newEventBtn').addEventListener('click', () => openEventDialog(null, state.date));
    $('#newTaskBtn').addEventListener('click', () => openTaskDialog(null));
    $('#settingsBtn').addEventListener('click', openSettings);

    const view = $('#view');
    view.addEventListener('click', onViewClick);
    view.addEventListener('submit', onViewSubmit);

    // Fechar diálogos: botões "×"/Cancelar e clique fora da janela.
    $$('dialog.modal').forEach((dialog) => {
      dialog.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]') || e.target === dialog) dialog.close();
      });
    });

    const eventForm = $('#eventForm');
    eventForm.addEventListener('submit', submitEvent);
    eventForm.repeat.addEventListener('change', updateEventFormState);
    eventForm.location.addEventListener('input', updateEventFormState);
    eventForm.start.addEventListener('change', () => {
      // Mantém a duração ao mudar o início.
      const prevDur = eventForm.dataset.dur ? Number(eventForm.dataset.dur) : 60;
      if (eventForm.start.value) {
        eventForm.end.value = U.fromMin(Math.min(U.toMin(eventForm.start.value) + prevDur, 23 * 60 + 59));
      }
    });
    eventForm.start.addEventListener('focus', () => {
      if (eventForm.start.value && eventForm.end.value) {
        eventForm.dataset.dur = Math.max(U.toMin(eventForm.end.value) - U.toMin(eventForm.start.value), 15);
      }
    });
    $('#eventDeleteBtn').addEventListener('click', deleteEvent);

    $('#taskForm').addEventListener('submit', submitTask);
    $('#taskDeleteBtn').addEventListener('click', deleteTask);
    $('#newItemInput').addEventListener('keydown', onNewItemKey);
    $('#newItemInput').addEventListener('paste', onNewItemPaste);
    $('#checklistEdit').addEventListener('input', onChecklistInput);
    $('#checklistEdit').addEventListener('change', onChecklistInput);
    $('#checklistEdit').addEventListener('click', onChecklistClick);
    $('#checklistEdit').addEventListener('keydown', (e) => {
      // Enter num item existente não envia o formulário; vai para o campo de novo item.
      if (e.key === 'Enter' && e.target.dataset.field === 'text') { e.preventDefault(); $('#newItemInput').focus(); }
    });
    $('#uncheckAllBtn').addEventListener('click', uncheckAll);

    $('#settingsForm').addEventListener('submit', submitSettings);
    $('#projectList').addEventListener('input', onProjectListInput);
    $('#projectList').addEventListener('click', onProjectListClick);
    $('#addProjectBtn').addEventListener('click', addProject);
    $('#newProjectName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addProject(); } });
    $('#exportBtn').addEventListener('click', exportBackup);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) importBackup(file);
    });

    $('#enableNotifyBtn').addEventListener('click', requestNotify);
    $('#settingsNotifyBtn').addEventListener('click', requestNotify);
    $('#dismissNotifyBtn').addEventListener('click', () => {
      safeStorage(() => localStorage.setItem(NOTIFY_DISMISSED_KEY, '1'));
      updateNotifyUI();
    });
    $('#testNotifyBtn').addEventListener('click', () =>
      notify(`teste|${U.todayKey()}`, 'Teste de lembrete', 'É assim que os lembretes vão aparecer.', () => {}));

    Store.onSave((ok) => {
      if (!ok) toast('Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado.', { kind: 'error', sticky: true });
    });

    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

    render();
    updateNotifyUI();
    checkReminders();
    setInterval(tick, 20000);
  }

  init();
})();
