// Confere que a versão em index.html bate com version.json, para o aviso de atualização funcionar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('versão de index.html, arquivos e version.json são iguais', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  const meta = html.match(/<meta name="app-version" content="([^"]+)">/)[1];
  assert.equal(meta, String(version));

  const assets = [...html.matchAll(/(?:src|href)="((?:js\/[\w-]+\.js|styles\.css)[^"]*)"/g)].map((m) => m[1]);
  assert.ok(assets.length >= 5);
  for (const url of assets) assert.equal(url.split('?v=')[1], String(version), `${url} sem a versão atual`);
});
