startClock(document.getElementById('clock'), document.getElementById('dateLabel'));

const statusLabel = document.getElementById('statusLabel');
const startedAtEl = document.getElementById('startedAt');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const openBtn = document.getElementById('openBtn');
const notInstalledCard = document.getElementById('notInstalledCard');
const logView = document.getElementById('logView');

let port = 8501;
let poll = null;

function renderLog(log) {
  const wasAtBottom = logView.scrollTop + logView.clientHeight >= logView.scrollHeight - 20;
  logView.textContent = log.map((l) => `[${formatDateTime(l.time)}] ${l.message}`).join('\n');
  if (wasAtBottom) logView.scrollTop = logView.scrollHeight;
}

function render(state) {
  port = state.port || port;
  notInstalledCard.style.display = state.installed ? 'none' : 'block';

  if (state.running) {
    statusLabel.textContent = '🟢 Rodando';
    startedAtEl.textContent = formatDateTime(state.startedAt);
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    openBtn.style.display = 'inline-block';
  } else {
    statusLabel.textContent = state.lastExitCode !== null && state.lastExitCode !== undefined
      ? `🔴 Parado (código ${state.lastExitCode})`
      : '⚪ Parado';
    startedAtEl.textContent = state.startedAt ? formatDateTime(state.startedAt) : '--';
    startBtn.style.display = 'inline-block';
    startBtn.disabled = !state.installed;
    stopBtn.style.display = 'none';
    openBtn.style.display = 'none';
  }

  renderLog(state.log || []);
}

async function refresh() {
  try {
    const state = await fetchJSON('/api/cte/status');
    render(state);
  } catch (err) {
    statusLabel.textContent = `Erro: ${err.message}`;
  }
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  try {
    await fetchJSON('/api/cte/start', { method: 'POST' });
    refresh();
  } catch (err) {
    alert(`Não foi possível iniciar: ${err.message}`);
    startBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', async () => {
  stopBtn.disabled = true;
  try {
    await fetchJSON('/api/cte/stop', { method: 'POST' });
  } catch (err) {
    alert(`Erro ao parar: ${err.message}`);
  } finally {
    stopBtn.disabled = false;
    refresh();
  }
});

openBtn.addEventListener('click', () => {
  window.open(`http://localhost:${port}`, '_blank');
});

refresh();
poll = setInterval(refresh, 2000);
