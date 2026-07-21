startClock(document.getElementById('clock'), document.getElementById('dateLabel'));

const AUTO_REFRESH_MS = 10 * 60 * 1000;

const lastUpdateEl = document.getElementById('lastUpdate');
const kpiGrid = document.getElementById('kpiGrid');
const statusBars = document.getElementById('statusBars');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const runBtn = document.getElementById('runBtn');
const reprocessBtn = document.getElementById('reprocessBtn');

let allRows = [];

const STATUS_COLOR_VAR = {
  good: '--status-good',
  warning: '--status-warning',
  serious: '--status-serious',
  critical: '--status-critical',
  info: '--accent',
  neutral: '--muted',
};

function renderKPIs(rows) {
  const counts = { good: 0, warning: 0, serious: 0, critical: 0, info: 0, neutral: 0 };
  rows.forEach((r) => { counts[classifyStatus(r.status).key]++; });

  const tiles = [
    { key: '', label: 'Total de cargas', icon: '📦', value: rows.length },
    { key: 'info', label: 'Em trânsito', icon: '🚚', value: counts.info },
    { key: 'good', label: 'Entregues', icon: '✅', value: counts.good },
    { key: 'serious', label: 'Atrasados', icon: '⚠️', value: counts.serious },
    { key: 'critical', label: 'Problemas', icon: '⛔', value: counts.critical },
  ];

  kpiGrid.innerHTML = tiles.map((t) => `
    <div class="kpi-tile ${t.key}">
      <div class="value">${t.value}</div>
      <div class="label">${t.icon} ${t.label}</div>
    </div>
  `).join('');
}

function renderStatusBreakdown(rows) {
  const counts = new Map();
  rows.forEach((r) => {
    const label = r.status || 'Sem status';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const breakdown = [...counts.entries()]
    .map(([label, count]) => ({ label, count, cls: classifyStatus(label) }))
    .sort((a, b) => b.count - a.count);

  if (breakdown.length === 0) {
    statusBars.innerHTML = '<div class="empty-state">Sem dados ainda.</div>';
    return;
  }

  const max = Math.max(...breakdown.map((b) => b.count));
  statusBars.innerHTML = breakdown.map((b) => `
    <div class="bar-row">
      <div class="label"><span class="dot ${b.cls.key}"></span>${b.cls.icon} ${b.label}</div>
      <div class="track"><div class="fill" style="width:${(b.count / max) * 100}%; background:var(${STATUS_COLOR_VAR[b.cls.key]});"></div></div>
      <div class="count">${b.count}</div>
    </div>
  `).join('');
}

function renderTable(rows) {
  emptyState.style.display = rows.length === 0 ? 'block' : 'none';
  tableBody.innerHTML = rows.map((r) => {
    const cls = classifyStatus(r.status);
    return `
      <tr>
        <td>${r.programacao || '-'}</td>
        <td><span class="badge ${cls.key}">${cls.icon} ${r.status || 'Sem status'}</span></td>
        <td>${r.placa || '-'}</td>
        <td>${r.motorista || '-'}</td>
        <td>${r.transportadora || '-'}</td>
        <td>${r.origem || '-'}</td>
        <td>${r.destino || '-'}</td>
        <td>${r.posicaoAtual || '-'}</td>
        <td>${r.previsaoChegada || '-'}</td>
      </tr>
    `;
  }).join('');
}

function applyFilter() {
  const q = normalizeText(searchInput.value);
  const filtered = !q ? allRows : allRows.filter((r) =>
    [r.programacao, r.origem, r.destino, r.posicaoAtual, r.placa, r.motorista, r.status]
      .some((field) => normalizeText(field).includes(q))
  );
  renderTable(filtered);
}

async function loadData() {
  try {
    const data = await fetchJSON('/api/data');
    allRows = data.rows || [];
    lastUpdateEl.textContent = data.updatedAt ? `${formatDateTime(data.updatedAt)} (${timeAgo(data.updatedAt)})` : 'ainda não';
    renderKPIs(allRows);
    renderStatusBreakdown(allRows);
    applyFilter();
  } catch (err) {
    emptyState.style.display = 'block';
    emptyState.textContent = `Erro ao carregar dados: ${err.message}`;
  }
}

searchInput.addEventListener('input', debounce(applyFilter, 150));

const initialQ = getSearchParam('q');
if (initialQ) searchInput.value = initialQ;

runBtn.addEventListener('click', async () => {
  runBtn.disabled = true;
  runBtn.textContent = '⏳ Atualizando...';
  try {
    await fetchJSON('/api/automation/run', { method: 'POST' });
    const poll = setInterval(async () => {
      const state = await fetchJSON('/api/automation/status');
      if (!state.running) {
        clearInterval(poll);
        runBtn.disabled = false;
        runBtn.textContent = '🔄 Atualizar monitoramento';
        loadData();
      }
    }, 2000);
  } catch (err) {
    alert(`Erro: ${err.message}`);
    runBtn.disabled = false;
    runBtn.textContent = '🔄 Atualizar monitoramento';
  }
});

reprocessBtn.addEventListener('click', async () => {
  reprocessBtn.disabled = true;
  try {
    await fetchJSON('/api/data/reprocess', { method: 'POST' });
    await loadData();
  } catch (err) {
    alert(`Erro ao reprocessar: ${err.message}`);
  } finally {
    reprocessBtn.disabled = false;
  }
});

loadData();
setInterval(loadData, AUTO_REFRESH_MS);
