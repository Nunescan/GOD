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

const markersLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);

let currentPoints = [];

function markerIcon(cls) {
  const colorVar = STATUS_COLOR_VAR[cls.key];
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

function renderMarkers(points) {
  markersLayer.clearLayers();
  points.forEach((p) => {
    const cls = classifyStatus(p.status);
    const marker = L.marker([p.lat, p.lng], { icon: markerIcon(cls) });
    marker.bindPopup(`
      <b>${p.programacao || 'Sem identificação'}</b><br>
      ${cls.icon} ${p.status || 'Sem status'}<br>
      ${p.placa ? `Placa: ${p.placa}<br>` : ''}
      ${p.motorista ? `Motorista: ${p.motorista}<br>` : ''}
      ${p.origem || '?'} → ${p.destino || '?'}
    `);
    marker.on('click', () => selectPoint(p));
    markersLayer.addLayer(marker);
  });
}

async function selectPoint(p) {
  routeLayer.clearLayers();
  detailPanel.style.display = 'block';
  detailPanel.innerHTML = `
    <h3>${p.programacao || 'Sem identificação'}</h3>
    <div class="row"><span class="k">Status</span><span>${classifyStatus(p.status).icon} ${p.status || '-'}</span></div>
    <div class="row"><span class="k">Placa</span><span>${p.placa || '-'}</span></div>
    <div class="row"><span class="k">Motorista</span><span>${p.motorista || '-'}</span></div>
    <div class="row"><span class="k">Origem</span><span>${p.origem || '-'}</span></div>
    <div class="row"><span class="k">Destino</span><span>${p.destino || '-'}</span></div>
    <div class="row"><span class="k">Posição atual</span><span>${p.posicaoAtual || '-'}</span></div>
    <div class="row"><span class="k">Falta para chegar</span><span>calculando...</span></div>
  `;

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
      const remainingRow = rows[rows.length - 1];
      if (data.remaining) {
        remainingRow.querySelector('span:last-child').textContent =
          `${data.remaining.distanceKm} km · ~${data.remaining.etaMinutes} min (${data.remaining.source})`;
      } else {
        remainingRow.querySelector('span:last-child').textContent = 'não foi possível calcular';
      }
    } catch {
      const rows = detailPanel.querySelectorAll('.row');
      rows[rows.length - 1].querySelector('span:last-child').textContent = 'erro ao calcular';
    }
  }
}

function findByQuery(q) {
  const nq = normalizeText(q);
  return currentPoints.find((p) => normalizeText(p.programacao) === nq)
    || currentPoints.find((p) => normalizeText(p.programacao).includes(nq))
    || currentPoints.find((p) => [p.placa, p.motorista, p.destino, p.origem, p.posicaoAtual].some((f) => normalizeText(f).includes(nq)));
}

function runSearch(q) {
  if (!q) return;
  const found = findByQuery(q);
  if (found) {
    selectPoint(found);
  } else {
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
    renderMarkers(currentPoints);

    if (fitAll && currentPoints.length > 0) {
      const bounds = L.latLngBounds(currentPoints.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds.pad(0.2));
    }

    const initialQ = getSearchParam('q');
    if (initialQ) runSearch(initialQ);
  } catch (err) {
    totalPointsEl.textContent = '0';
    lastUpdateEl.textContent = `erro: ${err.message}`;
  }
}

loadMap(true);
setInterval(() => loadMap(false), AUTO_REFRESH_MS);
