startClock(document.getElementById('clock'), document.getElementById('dateLabel'));

const AUTO_REFRESH_MS = 10 * 60 * 1000;
const BRAZIL_CENTER = [-14.235, -51.9253];

const searchInput = document.getElementById('searchInput');
const detailPanel = document.getElementById('detailPanel');
const totalPointsEl = document.getElementById('totalPoints');
const lastUpdateEl = document.getElementById('lastUpdate');

const STATUS_COLOR_VAR = {
  good: '--status-good',
  warning: '--status-warning',
  serious: '--status-serious',
  critical: '--status-critical',
  info: '--accent',
  neutral: '--muted',
};

const map = L.map('map', { zoomControl: true }).setView(BRAZIL_CENTER, 4);

// tiles escuros (CARTO Dark Matter) - gratuito, sem chave, combina com o tema
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

// fronteiras dos estados brasileiros - so linha bem fraca separando, sem
// preenchimento, e sem interceptar clique (fica "atras" dos marcadores)
fetch('data/br-states-topo.json')
  .then((res) => res.json())
  .then((topology) => {
    const geo = topojson.feature(topology, topology.objects.estados);
    L.geoJSON(geo, {
      interactive: false,
      style: { color: '#ffffff', weight: 1, opacity: 0.16, fillOpacity: 0 },
    }).addTo(map);
  })
  .catch((err) => console.error('Não foi possível carregar as fronteiras dos estados:', err));

const markersLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);

let currentPoints = [];
let highlightedProgramacao = null; // quando setado, so esse caminhao aparece no mapa

function markerIcon(cls, highlighted) {
  const colorVar = STATUS_COLOR_VAR[cls.key];
  if (highlighted) {
    return L.divIcon({
      className: '',
      html: `<div style="width:42px;height:42px;border-radius:50%;background:var(--surface-1);
        border:3px solid var(--brand-gold);display:flex;align-items:center;justify-content:center;
        font-size:20px;box-shadow:0 0 0 4px rgba(212,175,55,0.25), 0 4px 12px rgba(0,0,0,.6);">🚚</div>`,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });
  }
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;border-radius:50%;background:var(--surface-1);
      border:2px solid var(${colorVar});display:flex;align-items:center;justify-content:center;
      font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,.6);">🚚</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function pinIcon(emoji) {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:20px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.7));">${emoji}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 18],
  });
}

function popupHtml(p) {
  const cls = classifyStatus(p.status);
  return `
    <b>${p.programacao || 'Sem identificação'}</b><br>
    ${cls.icon} ${p.status || 'Sem status'}<br>
    ${p.placa ? `Cavalo: ${p.placa}<br>` : ''}
    ${p.carreta ? `Carreta: ${p.carreta}<br>` : ''}
    ${p.motorista ? `Motorista: ${p.motorista}<br>` : ''}
    ${p.origem || '?'} → ${p.destino || '?'}
  `;
}

// Renderiza os marcadores. Se "somente" (programacao) for passado, mostra so
// esse caminhao em destaque e esconde todos os outros - usado na busca por SPE.
function renderMarkers(points, somente) {
  markersLayer.clearLayers();
  const visiveis = somente ? points.filter((p) => p.programacao === somente) : points;

  visiveis.forEach((p) => {
    const cls = classifyStatus(p.status);
    const marker = L.marker([p.lat, p.lng], { icon: markerIcon(cls, Boolean(somente)) });
    marker.bindPopup(popupHtml(p));
    marker.on('click', () => selectPoint(p));
    markersLayer.addLayer(marker);
  });
}

function outrasInfosHtml(raw) {
  if (!raw) return '';
  const entradas = Object.entries(raw).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (entradas.length === 0) return '';
  return `
    <div class="section-title" style="margin-top:14px;font-size:12px;">Mais informações (planilha completa)</div>
    <div style="max-height:220px; overflow-y:auto;">
      ${entradas.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span>${v}</span></div>`).join('')}
    </div>
  `;
}

async function selectPoint(p) {
  highlightedProgramacao = p.programacao || null;
  renderMarkers(currentPoints, highlightedProgramacao);
  routeLayer.clearLayers();

  detailPanel.style.display = 'block';
  detailPanel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3 style="margin:0;">${p.programacao || 'Sem identificação'}</h3>
      <button class="icon-btn" id="clearSelectionBtn" title="Mostrar todos de novo">✕</button>
    </div>
    <div class="row"><span class="k">Status</span><span>${classifyStatus(p.status).icon} ${p.status || '-'}</span></div>
    <div class="row"><span class="k">Cavalo (placa)</span><span>${p.placa || '-'}</span></div>
    <div class="row"><span class="k">Carreta</span><span>${p.carreta || '-'}</span></div>
    <div class="row"><span class="k">Motorista</span><span>${p.motorista || '-'}</span></div>
    <div class="row"><span class="k">Transportadora</span><span>${p.transportadora || '-'}</span></div>
    <div class="row"><span class="k">Origem</span><span>${p.origem || '-'}</span></div>
    <div class="row"><span class="k">Destino</span><span>${p.destino || '-'}</span></div>
    <div class="row"><span class="k">Posição atual</span><span>${p.posicaoAtual || '-'} ${p.posicaoPrecisa ? '<span class="badge good" title="Coordenada exata do relatório de veículo">📍 precisa</span>' : ''}</span></div>
    <div class="row"><span class="k">Data de saída</span><span>${p.dataSaida || '-'}</span></div>
    <div class="row"><span class="k">Previsão de chegada</span><span>${p.previsaoChegada || '-'}</span></div>
    <div class="row"><span class="k">Falta para chegar</span><span>calculando...</span></div>
    ${outrasInfosHtml(p.raw)}
  `;

  document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);

  map.flyTo([p.lat, p.lng], 8);

  if (p.origemGeo) L.marker([p.origemGeo.lat, p.origemGeo.lng], { icon: pinIcon('🟢') }).addTo(routeLayer).bindTooltip('Origem: ' + (p.origem || ''));
  if (p.destinoGeo) L.marker([p.destinoGeo.lat, p.destinoGeo.lng], { icon: pinIcon('🏁') }).addTo(routeLayer).bindTooltip('Destino: ' + (p.destino || ''));
  if (p.destinoGeo) {
    L.polyline([[p.lat, p.lng], [p.destinoGeo.lat, p.destinoGeo.lng]], {
      color: '#3987e5', dashArray: '6,8', weight: 2, opacity: 0.8,
    }).addTo(routeLayer);
  }

  if (p.programacao) {
    try {
      const data = await fetchJSON(`/api/route?q=${encodeURIComponent(p.programacao)}`);
      const rows = detailPanel.querySelectorAll('.row');
      const remainingRow = [...rows].find((r) => r.querySelector('.k').textContent === 'Falta para chegar');
      if (data.remaining) {
        remainingRow.querySelector('span:last-child').textContent =
          `${data.remaining.distanceKm} km · ~${data.remaining.etaMinutes} min (${data.remaining.source})`;
      } else {
        remainingRow.querySelector('span:last-child').textContent = 'não foi possível calcular';
      }
    } catch {
      const rows = detailPanel.querySelectorAll('.row');
      const remainingRow = [...rows].find((r) => r.querySelector('.k').textContent === 'Falta para chegar');
      if (remainingRow) remainingRow.querySelector('span:last-child').textContent = 'erro ao calcular';
    }
  }
}

function clearSelection() {
  highlightedProgramacao = null;
  routeLayer.clearLayers();
  detailPanel.style.display = 'none';
  renderMarkers(currentPoints, null);
  if (currentPoints.length > 0) {
    const bounds = L.latLngBounds(currentPoints.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.2));
  }
}

function findByQuery(q) {
  const nq = normalizeText(q);
  return currentPoints.find((p) => normalizeText(p.programacao) === nq)
    || currentPoints.find((p) => normalizeText(p.programacao).includes(nq))
    || currentPoints.find((p) => [p.placa, p.carreta, p.motorista, p.destino, p.origem, p.posicaoAtual].some((f) => normalizeText(f).includes(nq)));
}

function runSearch(q) {
  if (!q) return;
  const found = findByQuery(q);
  if (found) {
    selectPoint(found);
  } else {
    highlightedProgramacao = null;
    renderMarkers(currentPoints, null);
    detailPanel.style.display = 'block';
    detailPanel.innerHTML = `<div class="empty-state">Nenhum resultado para "${q}"</div>`;
  }
}

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch(searchInput.value.trim());
});

async function loadMap(fitAll) {
  try {
    const data = await fetchJSON('/api/map');
    currentPoints = data.points || [];
    totalPointsEl.textContent = currentPoints.length;
    lastUpdateEl.textContent = data.updatedAt ? `${formatDateTime(data.updatedAt)} (${timeAgo(data.updatedAt)})` : 'ainda não';
    renderMarkers(currentPoints, highlightedProgramacao);

    if (fitAll && !highlightedProgramacao && currentPoints.length > 0) {
      const bounds = L.latLngBounds(currentPoints.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds.pad(0.2));
    }

    const initialQ = getSearchParam('q');
    if (initialQ && !highlightedProgramacao) runSearch(initialQ);
  } catch (err) {
    totalPointsEl.textContent = '0';
    lastUpdateEl.textContent = `erro: ${err.message}`;
  }
}

loadMap(true);
setInterval(() => loadMap(false), AUTO_REFRESH_MS);
