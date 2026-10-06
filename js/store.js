// Guarda os dados no navegador (localStorage) e cuida do backup.
const Store = (() => {
  const KEY = 'agenda.v1';

  const defaults = () => ({
    version: 1,
    settings: {
      dayStart: 7,
      dayEnd: 20,
      defaultReminder: 15,
      showWeekend: false,
      lastBackup: null,
    },
    projects: [],
    events: [],
    tasks: [],
    notes: [],
  });

  // Valida e completa dados vindos do armazenamento ou de um backup.
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('O arquivo não é um backup da agenda.');
    }
    const base = defaults();
    const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && x.id) : []);
    return {
      version: 1,
      settings: { ...base.settings, ...(raw.settings || {}) },
      projects: list(raw.projects),
      events: list(raw.events),
      tasks: list(raw.tasks),
      notes: list(raw.notes),
    };
  }

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : defaults();
    } catch (err) {
      console.error('Falha ao carregar a agenda', err);
      // Preserva o conteúdo ilegível para não sobrescrevê-lo.
      try {
        if (raw) localStorage.setItem(`${KEY}.corrompido.${Date.now()}`, raw);
      } catch (_) { /* sem espaço: nada a fazer */ }
      return defaults();
    }
  }

  let data = load();
  const listeners = new Set();

  function save() {
    let ok = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Falha ao salvar a agenda', err);
      ok = false;
    }
    listeners.forEach((fn) => fn(ok));
    return ok;
  }

  function upsert(collection, item) {
    const items = data[collection];
    const i = items.findIndex((x) => x.id === item.id);
    if (i === -1) items.push(item);
    else items[i] = item;
    return save();
  }

  function remove(collection, id) {
    data[collection] = data[collection].filter((x) => x.id !== id);
    return save();
  }

  function removeProject(id) {
    data.projects = data.projects.filter((p) => p.id !== id);
    for (const item of [...data.events, ...data.tasks, ...data.notes]) {
      if (item.projectId === id) item.projectId = null;
    }
    return save();
  }

  function setSettings(patch) {
    data.settings = { ...data.settings, ...patch };
    return save();
  }

  function exportJSON() {
    return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
  }

  function importJSON(text) {
    data = normalize(JSON.parse(text));
    return save();
  }

  return {
    get data() { return data; },
    upsert, remove, removeProject, setSettings, exportJSON, importJSON, normalize,
    onSave: (fn) => listeners.add(fn),
  };
})();
