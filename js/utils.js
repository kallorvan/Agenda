// Funções utilitárias de data, hora e texto.
// Datas são sempre tratadas como texto 'AAAA-MM-DD' no fuso local, e horas como 'HH:MM'.
const U = (() => {
  const pad = (n) => String(n).padStart(2, '0');

  const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const fromKey = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const todayKey = () => toKey(new Date());

  const addDays = (key, n) => {
    const d = fromKey(key);
    d.setDate(d.getDate() + n);
    return toKey(d);
  };

  // Primeiro dia do mês deslocado em n meses.
  const addMonths = (key, n) => {
    const d = fromKey(key);
    return toKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
  };

  // Segunda-feira da semana que contém a data.
  const weekStart = (key) => {
    const d = fromKey(key);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return toKey(d);
  };

  const toMin = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const fromMin = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

  const nowTime = (now = new Date()) => `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const dateTime = (key, time) => {
    const d = fromKey(key);
    if (time) {
      const [h, m] = time.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    }
    return d;
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s || '').trim());

  const fmt = (opts) => new Intl.DateTimeFormat('pt-BR', opts);
  const fmtLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
  const fmtShortDay = fmt({ weekday: 'short', day: '2-digit', month: '2-digit' });
  const fmtDayMonth = fmt({ day: '2-digit', month: '2-digit' });
  const fmtMonthYear = fmt({ month: 'long', year: 'numeric' });
  const fmtWeekday = fmt({ weekday: 'short' });
  const fmtDayMonthShort = fmt({ day: 'numeric', month: 'short' });

  const clean = (s) => s.replace(/\./g, '');

  // "Hoje", "Amanhã", "Ontem" ou "sex, 10/10".
  const relativeDay = (key, today = todayKey()) => {
    if (key === today) return 'Hoje';
    if (key === addDays(today, 1)) return 'Amanhã';
    if (key === addDays(today, -1)) return 'Ontem';
    return clean(fmtShortDay.format(fromKey(key)));
  };

  return {
    pad, toKey, fromKey, todayKey, addDays, addMonths, weekStart, toMin, fromMin, nowTime,
    dateTime, uid, esc, isUrl, relativeDay,
    longDate: (key) => fmtLong.format(fromKey(key)),
    dayMonth: (key) => fmtDayMonth.format(fromKey(key)),
    monthYear: (key) => fmtMonthYear.format(fromKey(key)),
    weekdayShort: (key) => clean(fmtWeekday.format(fromKey(key))),
    dayMonthShort: (key) => clean(fmtDayMonthShort.format(fromKey(key))),
  };
})();

if (typeof module !== 'undefined') module.exports = U;
