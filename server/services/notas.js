const fs = require('fs');
const path = require('path');

// Notas livres (tipo Notion) + agenda simples. Guardado num arquivo proprio
// (nao em data/cache, que e coisa regeneravel) - isso aqui e conteudo seu de
// verdade, entao nunca vai pro Git (ver .gitignore).
const FILE = path.resolve(__dirname, '../../data/notas.json');

function readAll() {
  if (!fs.existsSync(FILE)) return { notas: [], agenda: [] };
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    return { notas: data.notas || [], agenda: data.agenda || [] };
  } catch {
    return { notas: [], agenda: [] };
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function novoId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- notas ----------
function listNotas() {
  return readAll().notas.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

function salvarNota({ id, titulo, conteudo }) {
  const data = readAll();
  const agora = new Date().toISOString();

  if (id) {
    const nota = data.notas.find((n) => n.id === id);
    if (nota) {
      nota.titulo = titulo || 'Sem título';
      nota.conteudo = conteudo || '';
      nota.atualizadoEm = agora;
      writeAll(data);
      return nota;
    }
  }

  const nova = { id: novoId(), titulo: titulo || 'Sem título', conteudo: conteudo || '', criadoEm: agora, atualizadoEm: agora };
  data.notas.push(nova);
  writeAll(data);
  return nova;
}

function excluirNota(id) {
  const data = readAll();
  data.notas = data.notas.filter((n) => n.id !== id);
  writeAll(data);
}

// ---------- agenda ----------
function listAgenda() {
  return readAll().agenda.sort((a, b) => {
    if (a.feito !== b.feito) return a.feito ? 1 : -1;
    return (a.data || '9999-99-99').localeCompare(b.data || '9999-99-99');
  });
}

function salvarItemAgenda({ texto, data: dataItem }) {
  const all = readAll();
  const item = { id: novoId(), texto: texto || '', data: dataItem || '', feito: false, criadoEm: new Date().toISOString() };
  all.agenda.push(item);
  writeAll(all);
  return item;
}

function alternarItemAgenda(id) {
  const all = readAll();
  const item = all.agenda.find((i) => i.id === id);
  if (item) {
    item.feito = !item.feito;
    writeAll(all);
  }
  return item;
}

function excluirItemAgenda(id) {
  const all = readAll();
  all.agenda = all.agenda.filter((i) => i.id !== id);
  writeAll(all);
}

module.exports = {
  listNotas, salvarNota, excluirNota,
  listAgenda, salvarItemAgenda, alternarItemAgenda, excluirItemAgenda,
};
