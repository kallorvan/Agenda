// Regras do caderno de anotações: ordem, busca e limpeza do texto formatado.
const Notes = (() => {
  // Fixadas primeiro, depois as editadas mais recentemente.
  function sortNotes(notes) {
    return [...notes].sort(
      (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0)
    );
  }

  // Ignora maiúsculas e acentos: "reuniao" encontra "Reunião".
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function matches(note, query) {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const haystack = fold(`${note.title} ${note.text}`);
    return words.every((w) => haystack.includes(w));
  }

  // Tags e atributos que o editor produz; todo o resto é removido
  // (protege contra conteúdo estranho vindo de um backup importado).
  const ALLOWED = {
    P: [], DIV: [], BR: [], B: [], STRONG: [], I: [], EM: [], U: [],
    H2: [], H3: [], UL: ['class'], OL: [], LI: ['data-checked'], SPAN: [],
  };
  const DROP = ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'IMG', 'SVG', 'TEMPLATE', 'LINK', 'META', 'VIDEO', 'AUDIO'];

  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) continue;
        if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue; }
        const tag = child.tagName;
        if (DROP.includes(tag)) { child.remove(); continue; }
        walk(child);
        if (!ALLOWED[tag]) { child.replaceWith(...child.childNodes); continue; }
        for (const attr of [...child.attributes]) {
          if (!ALLOWED[tag].includes(attr.name)) child.removeAttribute(attr.name);
        }
        if (tag === 'UL' && child.getAttribute('class') !== 'checklist') child.removeAttribute('class');
        if (tag === 'LI' && child.hasAttribute('data-checked') && child.getAttribute('data-checked') !== 'true') {
          child.setAttribute('data-checked', 'false');
        }
      }
    };
    walk(root);
    return root.innerHTML;
  }

  // Texto puro, usado na busca e na prévia da lista.
  function toText(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    root.querySelectorAll('p, div, h2, h3, li, br').forEach((el) => el.append(' '));
    return root.textContent.replace(/\s+/g, ' ').trim();
  }

  return { sortNotes, matches, sanitizeHtml, toText, fold };
})();

if (typeof module !== 'undefined') module.exports = Notes;
