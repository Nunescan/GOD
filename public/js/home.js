startClock(document.getElementById('clock'), document.getElementById('dateLabel'));
startClock(document.getElementById('clockBig'), document.getElementById('dateBig'));

const runBtn = document.getElementById('runBtn');
const lastUpdateEl = document.getElementById('lastUpdate');
const logLineEl = document.getElementById('logLine');
const searchInput = document.getElementById('searchInput');
const launcherGrid = document.getElementById('launcherGrid');

let polling = null;

function renderStatus(state) {
  runBtn.disabled = state.running;
  runBtn.textContent = state.running ? '⏳ Atualizando...' : '🔄 Atualizar monitoramento';
  const lastLog = state.log[state.log.length - 1];
  logLineEl.textContent = lastLog ? lastLog.message : '';
  if (state.lastResult && state.lastResult.ok && state.lastResult.timestamp) {
    lastUpdateEl.textContent = `${formatDateTime(state.lastResult.timestamp)} (${timeAgo(state.lastResult.timestamp)})`;
  } else if (state.lastResult && !state.lastResult.ok) {
    lastUpdateEl.textContent = `falhou - ${state.lastResult.error}`;
  }
}

async function refreshStatus() {
  try {
    const state = await fetchJSON('/api/automation/status');
    renderStatus(state);
    if (state.running && !polling) {
      polling = setInterval(refreshStatus, 1500);
    } else if (!state.running && polling) {
      clearInterval(polling);
      polling = null;
    }
  } catch (err) {
    logLineEl.textContent = `Servidor indisponível: ${err.message}`;
  }
}

runBtn.addEventListener('click', async () => {
  try {
    await fetchJSON('/api/automation/run', { method: 'POST' });
    refreshStatus();
    if (!polling) polling = setInterval(refreshStatus, 1500);
  } catch (err) {
    logLineEl.textContent = `Erro ao iniciar: ${err.message}`;
  }
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && searchInput.value.trim()) {
    goToSearch('mapa.html', searchInput.value.trim());
  }
});

async function loadLauncher() {
  try {
    const apps = await fetchJSON('/api/launcher/apps');
    launcherGrid.innerHTML = apps.map((app) => `
      <div class="launcher-card" data-id="${app.id}">
        <div class="launcher-icon">${app.icon || '🔗'}</div>
        <div class="launcher-name">${app.name}</div>
      </div>
    `).join('');
    launcherGrid.querySelectorAll('.launcher-card').forEach((card) => {
      card.addEventListener('click', async () => {
        try {
          await fetchJSON('/api/launcher/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: card.dataset.id }),
          });
        } catch (err) {
          alert(`Não foi possível abrir: ${err.message}`);
        }
      });
    });
  } catch (err) {
    launcherGrid.innerHTML = `<div class="empty-state">Erro ao carregar atalhos: ${err.message}</div>`;
  }
}

loadLauncher();
refreshStatus();
