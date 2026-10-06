// Testes do caderno: ordem e busca. Rode com: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Notes = require('../js/notes.js');

test('fixadas primeiro, depois as editadas mais recentemente', () => {
  const notes = [
    { id: 'velha', updatedAt: 1 },
    { id: 'fixada-velha', updatedAt: 0, pinned: true },
    { id: 'nova', updatedAt: 5 },
  ];
  assert.deepEqual(Notes.sortNotes(notes).map((n) => n.id), ['fixada-velha', 'nova', 'velha']);
});

test('busca ignora acentos e maiúsculas e exige todas as palavras', () => {
  const note = { title: 'Reunião com cliente Alfa', text: 'Prazo de entrega em março' };
  assert.ok(Notes.matches(note, 'reuniao'));
  assert.ok(Notes.matches(note, 'ALFA marco'));
  assert.ok(Notes.matches(note, ''));
  assert.ok(!Notes.matches(note, 'alfa beta'));
});
