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
    TABLE: [], THEAD: [], TBODY: [], TR: [], TH: [], TD: [],
    MARK: [], IMG: ['data-img'],
  };
  const DROP = ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'TEMPLATE', 'LINK', 'META', 'VIDEO', 'AUDIO'];

  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) continue;
        if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue; }
        const tag = child.tagName;
        if (DROP.includes(tag)) { child.remove(); continue; }
        // Imagem só vale se apontar para um print guardado pela agenda.
        if (tag === 'IMG' && !/^[a-z0-9]+$/.test(child.getAttribute('data-img') || '')) { child.remove(); continue; }
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
    root.querySelectorAll('p, div, h2, h3, ul, ol, li, br, table, td, th').forEach((el) => {
      el.before(' ');
      el.append(' ');
    });
    return root.textContent.replace(/\s+/g, ' ').trim();
  }

  // ----- Exportação em Markdown -----

  // Escapa caracteres que o Markdown interpretaria como formatação.
  const escapeMd = (text) => text.replace(/([\\`*_[\]])/g, '\\$1');

  // Coloca os marcadores colados ao texto: " **x** " e não "** x **".
  function wrap(text, marker) {
    const [, lead, body, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return body ? `${lead}${marker}${body}${marker}${trail}` : text;
  }

  // Imagens disponíveis na conversão atual ({ id: dataURL }).
  let mdImages = {};

  function inlineMd(node) {
    return [...node.childNodes].map((n) => {
      if (n.nodeType === Node.TEXT_NODE) return escapeMd(n.textContent.replace(/\s+/g, ' '));
      if (n.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = n.tagName;
      if (tag === 'BR') return '  \n';
      if (tag === 'IMG') {
        const src = mdImages[n.getAttribute('data-img')];
        return src ? `![print](${src})` : '';
      }
      if (tag === 'UL' || tag === 'OL') return '';
      const inner = inlineMd(n);
      if (tag === 'B' || tag === 'STRONG') return wrap(inner, '**');
      if (tag === 'I' || tag === 'EM') return wrap(inner, '*');
      if (tag === 'MARK') return inner.trim() ? `<mark>${inner}</mark>` : inner;
      return inner;
    }).join('');
  }

  function listMd(list, depth) {
    const lines = [];
    const ordered = list.tagName === 'OL';
    const checklist = list.classList.contains('checklist');
    let n = 1;
    for (const li of list.children) {
      // O navegador às vezes coloca a sublista direto dentro da lista.
      if (li.tagName === 'UL' || li.tagName === 'OL') { lines.push(...listMd(li, depth + 1)); continue; }
      if (li.tagName !== 'LI') continue;
      const marker = ordered ? `${n++}.` : checklist ? `- [${li.dataset.checked === 'true' ? 'x' : ' '}]` : '-';
      lines.push(`${'   '.repeat(depth)}${marker} ${inlineMd(li).trim()}`);
      for (const sub of li.children) {
        if (sub.tagName === 'UL' || sub.tagName === 'OL') lines.push(...listMd(sub, depth + 1));
      }
    }
    return lines;
  }

  // Texto de uma célula numa linha só, com "|" escapado.
  function cellMd(cell) {
    const text = [...cell.childNodes]
      .map((n) => (n.nodeType === Node.ELEMENT_NODE && ['P', 'DIV'].includes(n.tagName) ? `${inlineMd(n)} ` : inlineMd({ childNodes: [n] })))
      .join('');
    return text.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
  }

  // Tabela no formato do GitHub: a primeira linha vira o cabeçalho.
  function tableMd(table) {
    const rows = [...table.querySelectorAll('tr')].map((tr) => [...tr.children].map(cellMd));
    if (!rows.length) return '';
    const cols = Math.max(...rows.map((r) => r.length));
    const line = (cells) => `| ${Array.from({ length: cols }, (_, i) => cells[i] || ' ').join(' | ')} |`;
    return [line(rows[0]), `| ${Array(cols).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n');
  }

  function htmlToMarkdown(html, images) {
    if (images) mdImages = images;
    const doc = new DOMParser().parseFromString(`<div>${sanitizeHtml(html)}</div>`, 'text/html');
    const blocks = [];
    let loose = '';
    const flush = () => {
      if (loose.trim()) blocks.push(loose.trim());
      loose = '';
    };
    for (const node of doc.body.firstElementChild.childNodes) {
      const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName : '';
      if (tag === 'H2' || tag === 'H3') {
        flush();
        const text = inlineMd(node).trim();
        if (text) blocks.push(`${tag === 'H2' ? '##' : '###'} ${text}`);
      } else if (tag === 'UL' || tag === 'OL') {
        flush();
        blocks.push(listMd(node, 0).join('\n'));
      } else if (tag === 'TABLE') {
        flush();
        blocks.push(tableMd(node));
      } else if (tag === 'P' || tag === 'DIV') {
        flush();
        const sub = [...node.children].some((c) => ['UL', 'OL', 'H2', 'H3', 'P', 'DIV', 'TABLE'].includes(c.tagName));
        if (sub) blocks.push(htmlToMarkdown(node.innerHTML));
        else if (inlineMd(node).trim()) blocks.push(inlineMd(node).trim());
      } else {
        loose += node.nodeType === Node.ELEMENT_NODE ? inlineMd({ childNodes: [node] }) : escapeMd(node.textContent.replace(/\s+/g, ' '));
      }
    }
    flush();
    return blocks.filter(Boolean).join('\n\n');
  }

  // Arquivo completo: título, dados da anotação e o texto.
  function noteToMarkdown(note, { project, event, images = {} } = {}) {
    const meta = [];
    if (project) meta.push(`Projeto: ${project}`);
    if (event) meta.push(`Reunião: ${event}`);
    const parts = [`# ${escapeMd(note.title || 'Sem título')}`];
    if (meta.length) parts.push(`> ${escapeMd(meta.join(' · '))}`);
    const body = htmlToMarkdown(note.html, images);
    mdImages = {};
    if (body) parts.push(body);
    return `${parts.join('\n\n')}\n`;
  }

  // Nome de arquivo válido no Windows, Mac e Linux.
  function fileName(title) {
    const base = String(title || '')
      .replace(/[\\/]/g, '-') // datas como 06/10/2026 viram 06-10-2026
      .replace(/[:*?"<>|\u0000-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return `${base || 'anotacao'}.md`;
  }

  return { sortNotes, matches, sanitizeHtml, toText, fold, htmlToMarkdown, noteToMarkdown, fileName };
})();

if (typeof module !== 'undefined') module.exports = Notes;
