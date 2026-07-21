// Funcoes compartilhadas entre as paginas (home, dashboard, mapa).

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch { /* ignore */ }
    throw new Error(detail || `Erro ${res.status} em ${url}`);
  }
  return res.json();
}

function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Classifica um texto de status livre da planilha num dos 4 estados fixos
// (good/warning/serious/critical) + "info" (em andamento) e "neutral" (desconhecido).
function classifyStatus(statusRaw) {
  const s = normalizeText(statusRaw);
  if (!s) return { key: 'neutral', icon: '⚪', label: 'Sem status' };
  if (/entreg|concluid|finaliz|conclu/.test(s)) return { key: 'good', icon: '✅', label: statusRaw };
  if (/cancel|problema|ocorrenc|avaria|sinistro|bloquead/.test(s)) return { key: 'critical', icon: '⛔', label: statusRaw };
  if (/atras/.test(s)) return { key: 'serious', icon: '⚠️', label: statusRaw };
  if (/transit|andamento|viagem|rota|carregad|saiu|deslocamento/.test(s)) return { key: 'info', icon: '🚚', label: statusRaw };
  return { key: 'neutral', icon: '⚪', label: statusRaw };
}

function formatDateTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso) {
  if (!iso) return 'nunca';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  return `${h}h${min % 60}min atrás`;
}

function startClock(clockEl, dateEl) {
  function tick() {
    const now = new Date();
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  }
  tick();
  setInterval(tick, 15000);
}

// Le/escreve o termo de busca compartilhado entre paginas (via querystring "?q=").
function getSearchParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

function goToSearch(page, q) {
  const url = new URL(page, window.location.origin);
  if (q) url.searchParams.set('q', q);
  window.location.href = url.toString();
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
