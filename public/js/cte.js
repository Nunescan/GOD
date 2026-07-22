startClock(document.getElementById('clock'), document.getElementById('dateLabel'));

const ARMADORES = ['alianca', 'mercosul', 'norcoast'];
const ARMADOR_LABEL = { alianca: 'Aliança', mercosul: 'Mercosul', norcoast: 'Norcoast' };

// ---------- abas ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => { p.style.display = 'none'; });
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).style.display = 'block';
  });
});

// ---------- status / log ----------
const notInstalledCard = document.getElementById('notInstalledCard');
const statusLabel = document.getElementById('statusLabel');
const commandLabel = document.getElementById('commandLabel');
const stopBtn = document.getElementById('stopBtn');
const logView = document.getElementById('logView');

function renderLog(log) {
  const wasAtBottom = logView.scrollTop + logView.clientHeight >= logView.scrollHeight - 20;
  logView.textContent = (log || []).map((l) => `[${formatDateTime(l.time)}] ${l.message}`).join('\n');
  if (wasAtBottom) logView.scrollTop = logView.scrollHeight;
}

async function refreshStatus() {
  try {
    const state = await fetchJSON('/api/cte/status');
    notInstalledCard.style.display = state.installed ? 'none' : 'block';
    statusLabel.textContent = state.running ? '🟢 Rodando' : (state.lastExitCode === 0 ? '✅ Concluído' : state.lastExitCode ? `🔴 Erro (${state.lastExitCode})` : '⚪ Parado');
    commandLabel.textContent = state.command || '--';
    stopBtn.style.display = state.running ? 'inline-block' : 'none';
    renderLog(state.log);
    return state;
  } catch (err) {
    statusLabel.textContent = `Erro: ${err.message}`;
  }
  return null;
}

stopBtn.addEventListener('click', async () => {
  await fetchJSON('/api/cte/stop', { method: 'POST' }).catch(() => {});
  refreshStatus();
});

// espera um comando em segundo plano terminar, chamando onDone com o estado final
async function waitForCompletion(onDone) {
  const poll = setInterval(async () => {
    const state = await refreshStatus();
    if (state && !state.running) {
      clearInterval(poll);
      onDone(state);
    }
  }, 1500);
}

setInterval(refreshStatus, 4000);
refreshStatus();

// ---------- helpers de picker nativo ----------
async function pickFolderInto(inputEl) {
  const result = await fetchJSON('/api/cte/pick-folder', { method: 'POST' }).catch((err) => {
    alert(`Erro: ${err.message}`);
    return null;
  });
  if (result && result.path) inputEl.value = result.path;
}

async function pickFileInto(inputEl) {
  const result = await fetchJSON('/api/cte/pick-file', { method: 'POST' }).catch((err) => {
    alert(`Erro: ${err.message}`);
    return null;
  });
  if (result && result.path) inputEl.value = result.path;
}

// ---------- dashboard ----------
const dashFilePath = document.getElementById('dashFilePath');
const dashMsg = document.getElementById('dashMsg');
const dashContent = document.getElementById('dashContent');
const dashKpis = document.getElementById('dashKpis');

document.getElementById('dashPickBtn').addEventListener('click', () => pickFileInto(dashFilePath));

function moneyBR(v) {
  if (v === null || v === undefined) return 'N/D';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderBarList(container, items, opts = {}) {
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state">Sem dados nessa coluna.</div>';
    return;
  }
  const max = Math.max(...items.map((i) => (opts.valueKey ? i[opts.valueKey] : i.count)));
  container.innerHTML = items.map((item) => {
    const value = opts.valueKey ? item[opts.valueKey] : item.count;
    const display = opts.money ? moneyBR(value) : value;
    return `
      <div class="bar-row">
        <div class="label">${item.label}</div>
        <div class="track"><div class="fill" style="width:${(value / max) * 100}%; background:var(--accent);"></div></div>
        <div class="count">${display}</div>
      </div>
    `;
  }).join('');
}

document.getElementById('dashLoadBtn').addEventListener('click', async () => {
  if (!dashFilePath.value) {
    dashMsg.textContent = 'Escolha um arquivo primeiro.';
    return;
  }
  dashMsg.textContent = 'Carregando...';
  try {
    const data = await fetchJSON('/api/cte/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dashFilePath.value }),
    });
    dashMsg.textContent = '';
    dashContent.style.display = 'block';

    dashKpis.innerHTML = `
      <div class="kpi-tile"><div class="value">${data.totalCtes}</div><div class="label">📦 Total de CTEs</div></div>
      <div class="kpi-tile"><div class="value">${data.valorTotal !== null ? moneyBR(data.valorTotal) : 'N/D'}</div><div class="label">💰 Valor Mercadoria</div></div>
      <div class="kpi-tile"><div class="value">${data.freteTotal !== null ? moneyBR(data.freteTotal) : 'N/D'}</div><div class="label">🚚 Frete</div></div>
      <div class="kpi-tile"><div class="value">${data.containersUnicos !== null ? data.containersUnicos : 'N/D'}</div><div class="label">📦 Containers únicos</div></div>
    `;

    renderBarList(document.getElementById('dashTopDestinos'), data.topDestinos);
    renderBarList(document.getElementById('dashTopContainers'), data.topContainers);
    renderBarList(document.getElementById('dashTopValores'), data.topValores, { valueKey: 'value', money: true });
    renderBarList(document.getElementById('dashPorData'), data.ctesPorData.map((d) => ({ label: d.date, count: d.count })));
  } catch (err) {
    dashMsg.textContent = `Erro: ${err.message}`;
    dashContent.style.display = 'none';
  }
});

// ---------- coleta ----------
const vinculosForm = document.getElementById('vinculosForm');
const scanMsg = document.getElementById('scanMsg');
const vinculosMsg = document.getElementById('vinculosMsg');
let pastasDisponiveis = [];
let vinculosAtuais = {};

function renderVinculosForm() {
  vinculosForm.innerHTML = ARMADORES.map((a) => {
    const atual = vinculosAtuais[a] || '';
    const options = ['<option value="">(nenhuma)</option>']
      .concat(pastasDisponiveis.map((p) => `<option value="${p}" ${p === atual ? 'selected' : ''}>${p}</option>`));
    return `
      <div class="field" style="margin-bottom:10px;">
        <label>${ARMADOR_LABEL[a]}</label>
        <select data-armador="${a}">${options.join('')}</select>
      </div>
    `;
  }).join('');
}

async function loadVinculos() {
  vinculosAtuais = await fetchJSON('/api/cte/vinculos').catch(() => ({}));
  renderVinculosForm();
}

document.getElementById('scanOutlookBtn').addEventListener('click', async () => {
  scanMsg.textContent = 'Escaneando (isso pode levar alguns segundos)...';
  try {
    await fetchJSON('/api/cte/pastas-outlook', { method: 'POST' });
    waitForCompletion((state) => {
      if (state.lastResult && state.lastResult.pastas) {
        pastasDisponiveis = state.lastResult.pastas;
        scanMsg.textContent = `${pastasDisponiveis.length} pasta(s) encontrada(s).`;
        renderVinculosForm();
      } else {
        scanMsg.textContent = 'Não foi possível escanear (veja o log).';
      }
    });
  } catch (err) {
    scanMsg.textContent = `Erro: ${err.message}`;
  }
});

document.getElementById('saveVinculosBtn').addEventListener('click', async () => {
  const vinculos = {};
  vinculosForm.querySelectorAll('select[data-armador]').forEach((sel) => {
    if (sel.value) vinculos[sel.dataset.armador] = sel.value;
  });
  try {
    await fetchJSON('/api/cte/vinculos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vinculos),
    });
    vinculosAtuais = vinculos;
    vinculosMsg.textContent = 'Salvo!';
  } catch (err) {
    vinculosMsg.textContent = `Erro: ${err.message}`;
  }
});

document.getElementById('coletarBtn').addEventListener('click', async () => {
  const dias = parseInt(document.getElementById('diasInput').value, 10) || 9999;
  try {
    await fetchJSON('/api/cte/coletar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dias }),
    });
    document.querySelector('[data-tab="tab-log"]').click();
  } catch (err) {
    alert(`Erro: ${err.message}`);
  }
});

// ---------- processar ----------
document.getElementById('procOrigemBtn').addEventListener('click', () => pickFolderInto(document.getElementById('procOrigem')));
document.getElementById('procDestinoBtn').addEventListener('click', () => pickFolderInto(document.getElementById('procDestino')));

document.getElementById('processarBtn').addEventListener('click', async () => {
  const armador = document.getElementById('procArmador').value;
  const origem = document.getElementById('procOrigem').value;
  const destino = document.getElementById('procDestino').value;
  if (!origem) {
    alert('Escolha a pasta de origem.');
    return;
  }
  try {
    await fetchJSON('/api/cte/processar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ armador, origem, destino: destino || undefined }),
    });
    document.querySelector('[data-tab="tab-log"]').click();
  } catch (err) {
    alert(`Erro: ${err.message}`);
  }
});

// ---------- relatorio ----------
document.getElementById('relPastaBtn').addEventListener('click', () => pickFolderInto(document.getElementById('relPasta')));

document.getElementById('relatorioBtn').addEventListener('click', async () => {
  const armador = document.getElementById('relArmador').value;
  const pasta = document.getElementById('relPasta').value;
  const relResultMsg = document.getElementById('relResultMsg');
  if (!pasta) {
    alert('Escolha a pasta processada.');
    return;
  }
  relResultMsg.textContent = '';
  try {
    await fetchJSON('/api/cte/relatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ armador, pasta }),
    });
    document.querySelector('[data-tab="tab-log"]').click();
    waitForCompletion((state) => {
      if (state.lastResult && state.lastResult.excel_path) {
        relResultMsg.textContent = `Relatório gerado: ${state.lastResult.total_ctes} CTEs em ${state.lastResult.total_containers} containers - ${state.lastResult.excel_path}`;
      }
    });
  } catch (err) {
    alert(`Erro: ${err.message}`);
  }
});

loadVinculos();

// ---------- pagamentos ----------
const pagFilePath = document.getElementById('pagFilePath');
const pagMsg = document.getElementById('pagMsg');
const pagContent = document.getElementById('pagContent');
let ultimoAnexoPagamentos = '';

document.getElementById('pagPickBtn').addEventListener('click', async () => {
  const result = await fetchJSON('/api/cte/pagamentos/pick-file', { method: 'POST' }).catch((err) => {
    alert(`Erro: ${err.message}`);
    return null;
  });
  if (result && result.path) pagFilePath.value = result.path;
});

document.getElementById('pagLoadBtn').addEventListener('click', async () => {
  if (!pagFilePath.value) {
    pagMsg.textContent = 'Escolha a planilha primeiro.';
    return;
  }
  pagMsg.textContent = 'Carregando...';
  try {
    const data = await fetchJSON('/api/cte/pagamentos/carregar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pagFilePath.value }),
    });
    pagMsg.textContent = '';
    pagContent.style.display = 'block';
    ultimoAnexoPagamentos = pagFilePath.value;

    const moeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('pagKpis').innerHTML = `
      <div class="kpi-tile"><div class="value">${data.totalCtes}</div><div class="label">📦 Total de CT-e</div></div>
      <div class="kpi-tile"><div class="value">${moeda(data.valorFreteTotal)}</div><div class="label">🚚 Valor Frete</div></div>
      <div class="kpi-tile"><div class="value">${moeda(data.valorMercadoriaTotal)}</div><div class="label">💰 Valor Mercadoria</div></div>
      <div class="kpi-tile"><div class="value">${moeda(data.adValoremTotal)}</div><div class="label">🛡️ Ad-Valorem</div></div>
      <div class="kpi-tile"><div class="value">${moeda(data.bafTotal)}</div><div class="label">⛽ BAF</div></div>
      <div class="kpi-tile ${data.totalComDiferenca > 0 ? 'critical' : 'good'}"><div class="value">${data.totalComDiferenca}</div><div class="label">⚠️ Com diferença</div></div>
    `;

    renderBarList(document.getElementById('pagPorArmador'), data.porArmador);
    renderBarList(document.getElementById('pagPorFilial'), data.porFilial);

    const diferencaBody = document.getElementById('pagDiferencaBody');
    const diferencaVazio = document.getElementById('pagDiferencaVazio');
    diferencaVazio.style.display = data.comDiferenca.length === 0 ? 'block' : 'none';
    diferencaBody.innerHTML = data.comDiferenca.map((r) => `
      <tr>
        <td>${r.cte || '-'}</td>
        <td>${r.armador || '-'}</td>
        <td>${r.tomador || '-'}</td>
        <td>${moeda(r.diferenca)}</td>
      </tr>
    `).join('');
  } catch (err) {
    pagMsg.textContent = `Erro: ${err.message}`;
    pagContent.style.display = 'none';
  }
});

document.getElementById('pagEmailBtn').addEventListener('click', async () => {
  const pagEmailMsg = document.getElementById('pagEmailMsg');
  if (!ultimoAnexoPagamentos) {
    pagEmailMsg.textContent = 'Carregue uma planilha primeiro.';
    return;
  }
  const para = document.getElementById('pagEmailPara').value;
  const assunto = document.getElementById('pagEmailAssunto').value;
  pagEmailMsg.textContent = 'Abrindo o Outlook...';
  try {
    await fetchJSON('/api/cte/pagamentos/enviar-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ para, assunto, corpo: 'Segue em anexo a planilha de pagamentos de CT-e.', anexo: ultimoAnexoPagamentos }),
    });
    pagEmailMsg.textContent = 'Rascunho aberto no Outlook - revise e envie por lá.';
  } catch (err) {
    pagEmailMsg.textContent = `Erro: ${err.message}`;
  }
});
