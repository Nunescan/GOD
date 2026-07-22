startClock(document.getElementById('clock'), document.getElementById('dateLabel'));

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => { p.style.display = 'none'; });
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).style.display = 'block';
  });
});

// ---------- notas ----------
const listaNotas = document.getElementById('listaNotas');
const notaTitulo = document.getElementById('notaTitulo');
const notaConteudo = document.getElementById('notaConteudo');
const notaMsg = document.getElementById('notaMsg');
const excluirNotaBtn = document.getElementById('excluirNotaBtn');

let notaAtualId = null;
let notasCache = [];

function limparEditor() {
  notaAtualId = null;
  notaTitulo.value = '';
  notaConteudo.value = '';
  notaMsg.textContent = '';
  excluirNotaBtn.style.display = 'none';
  document.querySelectorAll('.nota-item').forEach((el) => el.classList.remove('active'));
}

function abrirNota(nota) {
  notaAtualId = nota.id;
  notaTitulo.value = nota.titulo;
  notaConteudo.value = nota.conteudo;
  notaMsg.textContent = '';
  excluirNotaBtn.style.display = 'inline-block';
  document.querySelectorAll('.nota-item').forEach((el) => el.classList.toggle('active', el.dataset.id === nota.id));
}

async function carregarNotas() {
  notasCache = await fetchJSON('/api/notas').catch(() => []);
  listaNotas.innerHTML = notasCache.map((n) => `
    <div class="nota-item ${n.id === notaAtualId ? 'active' : ''}" data-id="${n.id}">
      <div class="titulo">${n.titulo || 'Sem título'}</div>
      <div class="preview">${(n.conteudo || '').slice(0, 60) || 'Vazia'}</div>
      <div class="quando">${timeAgo(n.atualizadoEm)}</div>
    </div>
  `).join('') || '<div class="empty-state">Nenhuma nota ainda.</div>';

  listaNotas.querySelectorAll('.nota-item').forEach((el) => {
    el.addEventListener('click', () => {
      const nota = notasCache.find((n) => n.id === el.dataset.id);
      if (nota) abrirNota(nota);
    });
  });
}

document.getElementById('novaNotaBtn').addEventListener('click', () => {
  limparEditor();
  notaTitulo.focus();
});

document.getElementById('salvarNotaBtn').addEventListener('click', async () => {
  if (!notaTitulo.value.trim() && !notaConteudo.value.trim()) {
    notaMsg.textContent = 'Escreva alguma coisa primeiro.';
    return;
  }
  try {
    const data = await fetchJSON('/api/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: notaAtualId, titulo: notaTitulo.value, conteudo: notaConteudo.value }),
    });
    notaAtualId = data.nota.id;
    notaMsg.textContent = 'Salvo!';
    excluirNotaBtn.style.display = 'inline-block';
    await carregarNotas();
  } catch (err) {
    notaMsg.textContent = `Erro: ${err.message}`;
  }
});

excluirNotaBtn.addEventListener('click', async () => {
  if (!notaAtualId || !confirm('Excluir esta nota?')) return;
  await fetchJSON(`/api/notas/${notaAtualId}`, { method: 'DELETE' });
  limparEditor();
  await carregarNotas();
});

// ---------- agenda ----------
const listaAgenda = document.getElementById('listaAgenda');
const agendaVazia = document.getElementById('agendaVazia');

async function carregarAgenda() {
  const itens = await fetchJSON('/api/notas/agenda').catch(() => []);
  agendaVazia.style.display = itens.length === 0 ? 'block' : 'none';
  listaAgenda.innerHTML = itens.map((i) => `
    <div class="agenda-item ${i.feito ? 'feito' : ''}" data-id="${i.id}">
      <input type="checkbox" ${i.feito ? 'checked' : ''}>
      <div class="texto">${i.texto}</div>
      ${i.data ? `<div class="data-badge">${new Date(i.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div>` : ''}
      <button type="button" class="icon-btn danger" title="Remover">🗑️</button>
    </div>
  `).join('');

  listaAgenda.querySelectorAll('.agenda-item').forEach((el) => {
    const id = el.dataset.id;
    el.querySelector('input[type="checkbox"]').addEventListener('change', async () => {
      await fetchJSON(`/api/notas/agenda/${id}/alternar`, { method: 'POST' });
      carregarAgenda();
    });
    el.querySelector('.icon-btn').addEventListener('click', async () => {
      await fetchJSON(`/api/notas/agenda/${id}`, { method: 'DELETE' });
      carregarAgenda();
    });
  });
}

document.getElementById('addAgendaBtn').addEventListener('click', async () => {
  const texto = document.getElementById('agendaTexto').value.trim();
  const data = document.getElementById('agendaData').value;
  if (!texto) return;
  await fetchJSON('/api/notas/agenda', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, data }),
  });
  document.getElementById('agendaTexto').value = '';
  document.getElementById('agendaData').value = '';
  carregarAgenda();
});

carregarNotas();
carregarAgenda();
