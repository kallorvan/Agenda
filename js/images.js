// Imagens das anotações (prints colados). Ficam no IndexedDB do navegador, que comporta
// bem mais que o localStorage; a anotação guarda só a referência <img data-img="id">.
const ImageStore = (() => {
  const DB_NAME = 'agenda-imagens';
  const STORE = 'imagens';
  const MAX_SIDE = 1920; // prints maiores são reduzidos para economizar espaço
  const urls = new Map(); // id -> URL temporária para exibir

  let dbPromise = null;
  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  // Executa uma operação e devolve o resultado quando a transação termina.
  async function run(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function put(id, blob) {
    await run('readwrite', (st) => st.put(blob, id));
    urls.set(id, URL.createObjectURL(blob));
    return urls.get(id);
  }

  const get = (id) => run('readonly', (st) => st.get(id));

  async function url(id) {
    if (urls.has(id)) return urls.get(id);
    const blob = await get(id);
    if (!blob) return null;
    urls.set(id, URL.createObjectURL(blob));
    return urls.get(id);
  }

  async function remove(id) {
    await run('readwrite', (st) => st.delete(id));
    if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
    urls.delete(id);
  }

  // Apaga imagens que nenhuma anotação usa mais.
  async function cleanup(keepIds) {
    const keep = new Set(keepIds);
    const all = await run('readonly', (st) => st.getAllKeys());
    for (const id of all) if (!keep.has(id)) await remove(id);
  }

  const toDataURL = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  // { id: "data:image/...;base64,..." } para backup e arquivo .md.
  async function exportAll(ids) {
    const out = {};
    for (const id of ids) {
      const blob = await get(id);
      if (blob) out[id] = await toDataURL(blob);
    }
    return out;
  }

  async function importAll(map) {
    for (const [id, dataUrl] of Object.entries(map || {})) {
      if (!/^[a-z0-9]+$/.test(id) || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(String(dataUrl))) continue;
      const blob = await (await fetch(dataUrl)).blob();
      await put(id, blob);
    }
  }

  // Reduz e comprime o print (WebP; se o navegador não suportar, PNG).
  async function compress(file) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
      return blob && blob.size < file.size ? blob : file;
    } catch (_) {
      return file;
    }
  }

  // Ids citados num HTML de anotação.
  const idsIn = (html) => [...String(html || '').matchAll(/data-img="([a-z0-9]+)"/g)].map((m) => m[1]);

  return { put, url, remove, cleanup, exportAll, importAll, compress, idsIn };
})();
