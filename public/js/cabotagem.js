startClock(document.getElementById('clock'), document.getElementById('dateLabel'));

// ---------- abas ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => { p.style.display = 'none'; });
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).style.display = 'block';
  });
});

const TIPO_ICON = {
  ravex: '🌐',
  cte: '🧾',
  cabotagem: '🚢',
  'spe-lookup': '🔎',
};

// ---------- atividades ----------
async function loadAtividades() {
  const body = document.getElementById('atividadesBody');
  const vazio = document.getElementById('atividadesVazio');
  try {
    const atividades = await fetchJSON('/api/cabotagem/atividades');
    vazio.style.display = atividades.length === 0 ? 'block' : 'none';
    body.innerHTML = atividades.map((a) => `
      <tr>
        <td>${formatDateTime(a.time)}</td>
        <td>${TIPO_ICON[a.tipo] || '•'} ${a.tipo}</td>
        <td><span class="badge ${a.ok ? 'good' : 'critical'}">${a.ok ? '✅' : '⛔'} ${a.titulo}</span></td>
        <td>${a.detalhe || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    vazio.style.display = 'block';
    vazio.textContent = `Erro ao carregar: ${err.message}`;
  }
}

async function loadSchedule() {
  const data = await fetchJSON('/api/cabotagem/schedule').catch(() => ({ autoRefreshMinutes: 10 }));
  document.getElementById('autoRefreshInput').value = data.autoRefreshMinutes || 10;
}

document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
  const scheduleMsg = document.getElementById('scheduleMsg');
  const autoRefreshMinutes = parseInt(document.getElementById('autoRefreshInput').value, 10);
  try {
    await fetchJSON('/api/cabotagem/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoRefreshMinutes }),
    });
    scheduleMsg.textContent = 'Salvo! Vale a partir da próxima vez que o painel abrir.';
  } catch (err) {
    scheduleMsg.textContent = `Erro: ${err.message}`;
  }
});

// ---------- buscar SPEs ----------
const buscarFilePath = document.getElementById('buscarFilePath');
const buscarColunas = document.getElementById('buscarColunas');
const buscarSpeColumn = document.getElementById('buscarSpeColumn');
const buscarDateColumn = document.getElementById('buscarDateColumn');
const buscarMsg = document.getElementById('buscarMsg');

document.getElementById('buscarPickBtn').addEventListener('click', async () => {
  const result = await fetchJSON('/api/cabotagem/spe/pick-file', { method: 'POST' }).catch((err) => {
    alert(`Erro: ${err.message}`);
    return null;
  });
  if (result && result.path) buscarFilePath.value = result.path;
});

document.getElementById('buscarPreviewBtn').addEventListener('click', async () => {
  if (!buscarFilePath.value) {
    buscarMsg.textContent = 'Escolha um arquivo primeiro.';
    return;
  }
  try {
    const data = await fetchJSON('/api/cabotagem/spe/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: buscarFilePath.value }),
    });
    buscarColunas.style.display = 'block';
    buscarSpeColumn.innerHTML = data.headers.map((h) => `<option value="${h}">${h}</option>`).join('');
    buscarDateColumn.innerHTML = '<option value="">(não filtrar por data)</option>' + data.headers.map((h) => `<option value="${h}">${h}</option>`).join('');
    buscarMsg.textContent = `${data.total} linha(s) na planilha.`;
  } catch (err) {
    buscarMsg.textContent = `Erro: ${err.message}`;
  }
});

function renderResultRows(bodyId, resultados) {
  document.getElementById(bodyId).innerHTML = resultados.map((r) => `
    <tr>
      <td>${r.spe}</td>
      <td><span class="badge ${r.encontrado ? 'good' : 'critical'}">${r.encontrado ? '✅ Sim' : '⛔ Não'}</span></td>
      <td>${r.status || '-'}</td>
      <td>${r.origem || '-'}</td>
      <td>${r.destino || '-'}</td>
      <td>${r.posicaoAtual || '-'}</td>
      <td>${r.placa || '-'}</td>
      <td>${r.carreta || '-'}</td>
    </tr>
  `).join('');
}

let ultimoResultadoBusca = [];

document.getElementById('buscarRunBtn').addEventListener('click', async () => {
  const dateColumn = buscarDateColumn.value;
  const dateFilter = document.getElementById('buscarDateFilter').value;
  buscarMsg.textContent = 'Buscando...';
  try {
    const data = await fetchJSON('/api/cabotagem/spe/buscar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: buscarFilePath.value, speColumn: buscarSpeColumn.value, dateColumn: dateColumn || undefined, dateFilter: dateFilter || undefined }),
    });
    buscarMsg.textContent = '';
    ultimoResultadoBusca = data.resultados;

    document.getElementById('buscarResultCard').style.display = 'block';
    document.getElementById('buscarKpis').innerHTML = `
      <div class="kpi-tile"><div class="value">${data.total}</div><div class="label">📋 Total de SPEs</div></div>
      <div class="kpi-tile good"><div class="value">${data.encontrados}</div><div class="label">✅ Alocadas no Ravex</div></div>
      <div class="kpi-tile critical"><div class="value">${data.naoEncontrados}</div><div class="label">⛔ Não encontradas</div></div>
    `;
    renderResultRows('buscarResultBody', data.resultados);
  } catch (err) {
    buscarMsg.textContent = `Erro: ${err.message}`;
  }
});

document.getElementById('buscarExportBtn').addEventListener('click', async () => {
  const exportMsg = document.getElementById('buscarExportMsg');
  if (ultimoResultadoBusca.length === 0) {
    exportMsg.textContent = 'Nada pra exportar ainda.';
    return;
  }
  try {
    const data = await fetchJSON('/api/cabotagem/spe/exportar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resultados: ultimoResultadoBusca }),
    });
    exportMsg.textContent = `Salvo em: ${data.path}`;
  } catch (err) {
    exportMsg.textContent = `Erro: ${err.message}`;
  }
});

// ---------- verificacao diaria ----------
const diariaPasta = document.getElementById('diariaPasta');
const diariaAssunto = document.getElementById('diariaAssunto');
const diariaColunas = document.getElementById('diariaColunas');
const diariaSpeColumn = document.getElementById('diariaSpeColumn');
const diariaDateColumn = document.getElementById('diariaDateColumn');

async function loadDiariaConfig() {
  const cfg = await fetchJSON('/api/cabotagem/diaria/config').catch(() => ({}));
  if (cfg.pasta) diariaPasta.value = cfg.pasta;
  if (cfg.assunto) diariaAssunto.value = cfg.assunto;
}

document.getElementById('diariaTestarBtn').addEventListener('click', async () => {
  const msg = document.getElementById('diariaTestarMsg');
  if (!diariaPasta.value) {
    msg.textContent = 'Digite o nome da pasta do Outlook.';
    return;
  }
  msg.textContent = 'Buscando o e-mail mais recente...';
  try {
    await fetchJSON('/api/cabotagem/diaria/testar-busca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pasta: diariaPasta.value, assunto: diariaAssunto.value }),
    });
    const poll = setInterval(async () => {
      const status = await fetchJSON('/api/cte/status');
      if (!status.running) {
        clearInterval(poll);
        if (status.lastExitCode !== 0) {
          msg.textContent = `Não encontrou (veja a aba CT-e > Log pra detalhes).`;
          return;
        }
        const preview = await fetchJSON('/api/cabotagem/diaria/preview-teste', { method: 'POST' }).catch((err) => {
          msg.textContent = `Erro ao ler planilha: ${err.message}`;
          return null;
        });
        if (!preview) return;
        diariaColunas.style.display = 'block';
        diariaSpeColumn.innerHTML = preview.headers.map((h) => `<option value="${h}">${h}</option>`).join('');
        diariaDateColumn.innerHTML = '<option value="">(não filtrar por data)</option>' + preview.headers.map((h) => `<option value="${h}">${h}</option>`).join('');
        msg.textContent = `Encontrado! ${preview.total} linha(s). Escolha as colunas abaixo.`;
      }
    }, 1500);
  } catch (err) {
    msg.textContent = `Erro: ${err.message}`;
  }
});

document.getElementById('diariaSalvarBtn').addEventListener('click', async () => {
  const msg = document.getElementById('diariaSalvarMsg');
  try {
    await fetchJSON('/api/cabotagem/diaria/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pasta: diariaPasta.value,
        assunto: diariaAssunto.value,
        speColumn: diariaSpeColumn.value,
        dateColumn: diariaDateColumn.value,
      }),
    });
    msg.textContent = 'Configuração salva!';
  } catch (err) {
    msg.textContent = `Erro: ${err.message}`;
  }
});

async function refreshDiariaStatus() {
  const status = await fetchJSON('/api/cabotagem/diaria/status').catch(() => null);
  if (!status) return;
  document.getElementById('diariaStatusLabel').textContent = status.running ? `🟢 ${status.step || 'Rodando...'}` : (status.lastResult ? (status.lastResult.ok ? '✅ Concluído' : '⛔ Falhou') : '⚪ Nunca rodou');
  document.getElementById('diariaLog').textContent = (status.log || []).map((l) => `[${formatDateTime(l.time)}] ${l.message}`).join('\n');

  const resultMsg = document.getElementById('diariaResultMsg');
  if (status.lastResult && status.lastResult.ok) {
    resultMsg.textContent = `E-mail: "${status.lastResult.emailAssunto}" (${status.lastResult.emailRecebidoEm}) - ${status.lastResult.total} SPE(s), ${status.lastResult.encontrados} alocada(s). Planilha: ${status.lastResult.outputPath}`;
  } else if (status.lastResult && !status.lastResult.ok) {
    resultMsg.textContent = `Falhou: ${status.lastResult.error}`;
  }
}

document.getElementById('diariaRodarBtn').addEventListener('click', async () => {
  try {
    await fetchJSON('/api/cabotagem/diaria/rodar', { method: 'POST' });
  } catch (err) {
    alert(`Erro: ${err.message}`);
  }
});

setInterval(refreshDiariaStatus, 2500);

// ---------- emails ----------
document.getElementById('emailsBuscarBtn').addEventListener('click', async () => {
  const pasta = document.getElementById('emailsPasta').value;
  const palavras = document.getElementById('emailsPalavras').value;
  const msg = document.getElementById('emailsMsg');
  if (!pasta) {
    msg.textContent = 'Digite o nome da pasta do Outlook.';
    return;
  }
  msg.textContent = 'Buscando...';
  try {
    await fetchJSON('/api/cabotagem/emails/buscar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pasta, palavras }),
    });
    const poll = setInterval(async () => {
      const status = await fetchJSON('/api/cte/status');
      if (!status.running) {
        clearInterval(poll);
        if (status.lastResult && status.lastResult.emails) {
          msg.textContent = '';
          document.getElementById('emailsResultCard').style.display = 'block';
          document.getElementById('emailsResultBody').innerHTML = status.lastResult.emails.map((e) => `
            <tr>
              <td>${e.assunto}</td>
              <td>${e.remetente}</td>
              <td>${e.recebidoEm}</td>
              <td>${e.temAnexo ? '📎' : '-'}</td>
            </tr>
          `).join('') || '<tr><td colspan="4" class="empty-state">Nenhum e-mail encontrado.</td></tr>';
        } else {
          msg.textContent = 'Nenhum resultado (veja a aba CT-e > Log).';
        }
      }
    }, 1500);
  } catch (err) {
    msg.textContent = `Erro: ${err.message}`;
  }
});

loadAtividades();
loadSchedule();
loadDiariaConfig();
refreshDiariaStatus();
setInterval(loadAtividades, 15000);
