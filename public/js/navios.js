startClock(document.getElementById('clock'), document.getElementById('dateLabel'));

const AUTO_REFRESH_MS = 2 * 60 * 1000; // navios atualizam com bem menos frequencia que caminhoes
const BRAZIL_CENTER = [-14.235, -39.9253];

const searchInput = document.getElementById('searchInput');
const detailPanel = document.getElementById('detailPanel');
const listaPanel = document.getElementById('listaPanel');
const totalNaviosEl = document.getElementById('totalNavios');
const listaResumoEl = document.getElementById('listaResumo');
const semChaveBanner = document.getElementById('semChaveBanner');
const somenteListaToggle = document.getElementById('somenteListaToggle');

const map = L.map('map', { zoomControl: true }).setView(BRAZIL_CENTER, 4);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

let currentShips = []; // todos os navios com posicao (naLista/spe vem marcado em cada um)
let currentLista = []; // sua lista cadastrada, com posicao quando encontrada

function shipIcon(naLista) {
  const cor = naLista ? 'var(--brand-gold)' : 'var(--accent)';
  return L.divIcon({
    className: '',
    html: `<div style="width:${naLista ? 36 : 28}px;height:${naLista ? 36 : 28}px;border-radius:50%;background:var(--surface-1);
      border:2px solid ${cor};display:flex;align-items:center;justify-content:center;
      font-size:${naLista ? 17 : 13}px;box-shadow:0 2px 6px rgba(0,0,0,.6);">🚢</div>`,
    iconSize: [naLista ? 36 : 28, naLista ? 36 : 28],
    iconAnchor: [naLista ? 18 : 14, naLista ? 18 : 14],
  });
}

function formatVelocidade(nos) {
  if (nos === undefined || nos === null) return '-';
  return `${nos} nós`;
}

function detailHtml(n) {
  const temPosicao = typeof n.lat === 'number';
  return `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3 style="margin:0;">${n.nome || 'Sem nome'}</h3>
      <button class="icon-btn" id="clearSelectionBtn" title="Fechar">✕</button>
    </div>
    ${n.spe ? `<div class="row"><span class="k">SPE</span><span>${n.spe}</span></div>` : ''}
    ${n.naLista ? `<div class="row"><span class="k">Na sua lista?</span><span>✅ Sim</span></div>` : ''}
    ${temPosicao ? `
      <div class="row"><span class="k">Posição</span><span>${n.lat.toFixed(4)}, ${n.lng.toFixed(4)}</span></div>
      <div class="row"><span class="k">Velocidade</span><span>${formatVelocidade(n.velocidadeNos)}</span></div>
      <div class="row"><span class="k">Rumo</span><span>${n.rumo !== undefined && n.rumo !== null ? n.rumo + '°' : '-'}</span></div>
      <div class="row"><span class="k">Destino</span><span>${n.destino || '-'}</span></div>
      <div class="row"><span class="k">ETA prevista</span><span>${n.etaPrevisto ? formatDateTime(n.etaPrevisto) : '-'}</span></div>
      <div class="row"><span class="k">MMSI</span><span>${n.mmsi || '-'}</span></div>
      <div class="row"><span class="k">Última atualização</span><span>${timeAgo(n.atualizadoEm)}</span></div>
    ` : `<div class="empty-state">Ainda não recebemos posição desse navio pelo AIS (pode levar alguns minutos após ligar, ou o navio pode estar fora da costa do Brasil agora).</div>`}
  `;
}

function selectShip(n) {
  detailPanel.style.display = 'block';
  detailPanel.innerHTML = detailHtml(n);
  document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);
  if (typeof n.lat === 'number') map.flyTo([n.lat, n.lng], 7);
}

function clearSelection() {
  detailPanel.style.display = 'none';
}

function shipsVisiveis() {
  return somenteListaToggle.checked ? currentShips.filter((n) => n.naLista) : currentShips;
}

function renderMarkers() {
  markersLayer.clearLayers();
  shipsVisiveis().forEach((n) => {
    const marker = L.marker([n.lat, n.lng], { icon: shipIcon(n.naLista) });
    marker.bindPopup(`<b>${n.nome || 'Sem nome'}</b><br>${n.spe ? 'SPE: ' + n.spe + '<br>' : ''}${formatVelocidade(n.velocidadeNos)}`);
    marker.on('click', () => selectShip(n));
    markersLayer.addLayer(marker);
  });
}

function renderLista() {
  const visiveis = shipsVisiveis();
  totalNaviosEl.textContent = visiveis.length;
  const encontrados = currentLista.filter((n) => n.encontrado).length;
  listaResumoEl.innerHTML = `
    <div class="row"><span class="k">Navios na sua lista</span><span>${currentLista.length}</span></div>
    <div class="row"><span class="k">Da lista com posição agora</span><span>${encontrados}</span></div>
    <div class="row"><span class="k">Total avistados na costa</span><span>${currentShips.length}</span></div>
  `;
}

function findByQuery(q) {
  const nq = normalizeText(q);
  return currentShips.find((n) => n.spe && normalizeText(n.spe) === nq)
    || currentShips.find((n) => normalizeText(n.nome).includes(nq))
    || currentShips.find((n) => n.spe && normalizeText(n.spe).includes(nq));
}

function runSearch(q) {
  if (!q) return;
  const found = findByQuery(q);
  if (found) {
    selectShip(found);
  } else {
    detailPanel.style.display = 'block';
    detailPanel.innerHTML = `<div class="empty-state">Nenhum navio avistado bate com "${q}"</div>`;
  }
}

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch(searchInput.value.trim());
});

function renderStatusBanner(status) {
  if (!status) { semChaveBanner.style.display = 'none'; return; }

  if (status.estado === 'desligado' && status.detalhe === 'sem API key configurada') {
    semChaveBanner.innerHTML = `⚠️ Nenhuma API key do AIS configurada ainda. Vá em <a href="settings.html">Configurações</a> e cole sua chave gratuita do
      <a href="https://aisstream.io" target="_blank" rel="noopener">aisstream.io</a> pra ativar o rastreamento.`;
    semChaveBanner.style.display = 'block';
  } else if (status.estado === 'erro' || (status.estado === 'desligado' && status.detalhe)) {
    semChaveBanner.innerHTML = `⚠️ Problema na conexão com o AIS: ${status.detalhe || 'erro desconhecido'}. Tentando de novo sozinho...`;
    semChaveBanner.style.display = 'block';
  } else if (status.estado === 'conectando') {
    semChaveBanner.innerHTML = `⏳ Conectando ao rastreamento de navios...`;
    semChaveBanner.style.display = 'block';
  } else {
    semChaveBanner.style.display = 'none';
  }
}

let primeiroCarregamento = true;

async function loadShips() {
  try {
    const data = await fetchJSON('/api/navios');
    currentShips = data.navios || [];
    currentLista = data.lista || [];
    renderMarkers();
    renderLista();
    renderStatusBanner(data.status);

    const visiveis = shipsVisiveis();
    if (primeiroCarregamento && visiveis.length > 0) {
      const bounds = L.latLngBounds(visiveis.map((n) => [n.lat, n.lng]));
      map.fitBounds(bounds.pad(0.3));
      primeiroCarregamento = false;
    }
  } catch (err) {
    listaResumoEl.innerHTML = `<div class="empty-state">Erro ao carregar: ${err.message}</div>`;
  }
}

somenteListaToggle.addEventListener('change', () => {
  renderMarkers();
  renderLista();
});

// --- modal de gerenciamento da lista ---
const gerenciarModal = document.getElementById('gerenciarModal');
const listaEditavel = document.getElementById('listaEditavel');
const gerenciarBtn = document.getElementById('gerenciarBtn');
const addNavioBtn = document.getElementById('addNavioBtn');
const salvarListaBtn = document.getElementById('salvarListaBtn');
const fecharModalBtn = document.getElementById('fecharModalBtn');
const listaMsg = document.getElementById('listaMsg');

function linhaEditavel(nome = '', spe = '') {
  const div = document.createElement('div');
  div.className = 'field-row';
  div.style.marginBottom = '8px';
  div.innerHTML = `
    <div class="field"><input type="text" class="navio-nome" placeholder="Nome do navio, ex: MSC AMBITION (não é IMO nem MMSI)" value="${nome}"></div>
    <div class="field" style="max-width:140px;"><input type="text" class="navio-spe" placeholder="SPE (opcional)" value="${spe}"></div>
    <button type="button" class="icon-btn remover-navio" title="Remover">🗑️</button>
  `;
  div.querySelector('.remover-navio').addEventListener('click', () => div.remove());
  return div;
}

function abrirModal() {
  listaEditavel.innerHTML = '';
  const lista = currentLista.length > 0 ? currentLista : [{ nome: '', spe: '' }];
  lista.forEach((n) => listaEditavel.appendChild(linhaEditavel(n.nome, n.spe)));
  gerenciarModal.style.display = 'flex';
}

gerenciarBtn.addEventListener('click', abrirModal);
fecharModalBtn.addEventListener('click', () => { gerenciarModal.style.display = 'none'; });
addNavioBtn.addEventListener('click', () => listaEditavel.appendChild(linhaEditavel()));

salvarListaBtn.addEventListener('click', async () => {
  const navios = [...listaEditavel.querySelectorAll('.field-row')].map((row) => ({
    nome: row.querySelector('.navio-nome').value.trim(),
    spe: row.querySelector('.navio-spe').value.trim(),
  })).filter((n) => n.nome);

  const pareceCodigo = navios.find((n) => /^\d+$/.test(n.nome));
  if (pareceCodigo) {
    const seguir = confirm(
      `"${pareceCodigo.nome}" parece um número IMO ou MMSI, não um nome de navio. ` +
      `O rastreamento busca pelo NOME que o navio transmite no AIS - com só o número não vai encontrar. ` +
      `Quer salvar assim mesmo?`
    );
    if (!seguir) return;
  }

  salvarListaBtn.disabled = true;
  try {
    await fetchJSON('/api/navios/lista', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ navios }),
    });
    listaMsg.textContent = 'Salvo!';
    await loadShips();
    setTimeout(() => { gerenciarModal.style.display = 'none'; listaMsg.textContent = ''; }, 800);
  } catch (err) {
    listaMsg.textContent = `Erro: ${err.message}`;
  } finally {
    salvarListaBtn.disabled = false;
  }
});

loadShips();
setInterval(loadShips, AUTO_REFRESH_MS);
