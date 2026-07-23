const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { getAisApiKey } = require('./settings');

// Rastreamento de navios via AIS (aisstream.io, gratuito). Assina uma
// bounding box cobrindo a costa do Brasil inteira e guarda em memoria TODO
// navio que aparecer (chave = MMSI, que e sempre unico e estavel - nome as
// vezes vem vazio ou muda). A lista que voce mantem (config/navios.json) so
// serve pra marcar quais desses navios sao "da sua lista" e qual a SPE de
// cada um - o filtro de exibir so esses ou todos fica por conta da tela.
const ENDPOINT = 'wss://stream.aisstream.io/v0/stream';
const BRAZIL_BBOX = [[[-34, -54], [6, -30]]];
const RECONNECT_MS = 8000;
const PRUNE_MS = 30 * 60 * 1000; // limpa navios sem sinal ha mais de 6h, a cada 30min
const MAX_IDLE_MS = 6 * 60 * 60 * 1000;

const NAVIOS_FILE = path.resolve(__dirname, '../../config/navios.json');

let ws = null;
let reconnectTimer = null;
let pruneTimer = null;
let watchlistByName = new Map(); // nome normalizado -> spe
const shipData = {}; // mmsi (string) -> { nome, mmsi, lat, lng, ... }

const status = {
  estado: 'desligado', // desligado | conectando | conectado | erro
  detalhe: null,
  mensagensRecebidas: 0,
  ultimaMensagemEm: null,
};

function normalizeName(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function refreshWatchlist() {
  if (!fs.existsSync(NAVIOS_FILE)) {
    watchlistByName = new Map();
    return;
  }
  try {
    const lista = JSON.parse(fs.readFileSync(NAVIOS_FILE, 'utf-8'));
    watchlistByName = new Map((lista || []).map((n) => [normalizeName(n.nome), n.spe || '']));
  } catch {
    watchlistByName = new Map();
  }
}

function formatEta(eta) {
  if (!eta || !eta.Month) return null; // Month 0 = nao informado pelo navio
  const now = new Date();
  const ano = now.getUTCFullYear();
  const dt = new Date(Date.UTC(ano, eta.Month - 1, eta.Day || 1, eta.Hour || 0, eta.Minute || 0));
  return dt.toISOString();
}

function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  status.mensagensRecebidas += 1;
  status.ultimaMensagemEm = new Date().toISOString();

  // erro reportado pelo proprio aisstream.io (ex: API key invalida) vem como
  // uma mensagem normal, nao como "close" - por isso pegamos aqui tambem
  if (msg.error) {
    status.estado = 'erro';
    status.detalhe = msg.error;
    console.error('[ais] erro reportado pelo aisstream.io:', msg.error);
    return;
  }

  if (msg.MessageType === 'PositionReport') {
    const mmsi = msg.MetaData && msg.MetaData.MMSI;
    if (!mmsi) return;
    const pos = msg.Message && msg.Message.PositionReport;
    if (!pos) return;

    const key = String(mmsi);
    shipData[key] = {
      ...shipData[key],
      nome: (msg.MetaData.ShipName || (shipData[key] && shipData[key].nome) || '').trim(),
      mmsi,
      lat: pos.Latitude,
      lng: pos.Longitude,
      velocidadeNos: pos.Sog,
      rumo: pos.Cog,
      atualizadoEm: new Date().toISOString(),
    };
    return;
  }

  if (msg.MessageType === 'ShipStaticData') {
    const data = msg.Message && msg.Message.ShipStaticData;
    if (!data || !data.UserID) return;

    const key = String(data.UserID);
    shipData[key] = {
      ...shipData[key],
      mmsi: data.UserID,
      nome: (data.Name || (shipData[key] && shipData[key].nome) || '').trim(),
      destino: data.Destination ? data.Destination.trim() : (shipData[key] && shipData[key].destino) || null,
      etaPrevisto: formatEta(data.Eta),
    };
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_MS);
}

function connect() {
  const apiKey = getAisApiKey();
  if (!apiKey) {
    status.estado = 'desligado';
    status.detalhe = 'sem API key configurada';
    console.log('[ais] sem API key configurada (Configurações > Navios) - rastreamento de navios desligado.');
    return;
  }

  status.estado = 'conectando';
  status.detalhe = null;

  try {
    ws = new WebSocket(ENDPOINT);
  } catch (err) {
    status.estado = 'erro';
    status.detalhe = err.message;
    console.error('[ais] erro ao abrir conexão:', err.message);
    scheduleReconnect();
    return;
  }

  ws.on('open', () => {
    status.estado = 'conectado';
    console.log('[ais] conectado ao aisstream.io, assinando costa do Brasil (todos os navios)...');
    ws.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: BRAZIL_BBOX,
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    }));
  });

  ws.on('message', (data) => handleMessage(data.toString()));

  ws.on('error', (err) => {
    status.estado = 'erro';
    status.detalhe = err.message;
    console.error('[ais] erro na conexão:', err.message);
  });

  ws.on('close', (code, reason) => {
    status.estado = 'desligado';
    status.detalhe = `conexão fechada (código ${code}${reason ? ': ' + reason.toString() : ''})`;
    console.log(`[ais] conexão fechada - código ${code}${reason ? ': ' + reason.toString() : ''}. Reconectando em ${RECONNECT_MS / 1000}s...`);
    ws = null;
    scheduleReconnect();
  });
}

function pruneStale() {
  const limite = Date.now() - MAX_IDLE_MS;
  Object.keys(shipData).forEach((key) => {
    const t = new Date(shipData[key].atualizadoEm || 0).getTime();
    if (t < limite) delete shipData[key];
  });
}

function stop() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }
  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }
}

function restart() {
  stop();
  refreshWatchlist();
  connect();
  pruneTimer = setInterval(pruneStale, PRUNE_MS);
}

function start() {
  refreshWatchlist();
  connect();
  pruneTimer = setInterval(pruneStale, PRUNE_MS);
}

// devolve TODOS os navios com posicao conhecida, marcando quais estao na
// sua lista (config/navios.json) e com qual SPE - a tela decide se filtra
function getAllShips() {
  return Object.values(shipData)
    .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
    .map((s) => {
      const spe = watchlistByName.get(normalizeName(s.nome));
      return { ...s, naLista: spe !== undefined, spe: spe || '' };
    });
}

// mesma lista que voce cadastrou, com a posicao mais recente conhecida
// mesclada quando existir - usado pra mostrar "aguardando sinal" nos que
// ainda nao apareceram
function getWatchlistWithPositions() {
  if (!fs.existsSync(NAVIOS_FILE)) return [];
  let lista = [];
  try {
    lista = JSON.parse(fs.readFileSync(NAVIOS_FILE, 'utf-8')) || [];
  } catch {
    return [];
  }
  const porNome = {};
  Object.values(shipData).forEach((s) => { porNome[normalizeName(s.nome)] = s; });
  return lista.map((item) => {
    const pos = porNome[normalizeName(item.nome)];
    return { ...item, ...pos, encontrado: Boolean(pos) };
  });
}

function getStatus() {
  return { ...status, naviosNaLista: watchlistByName.size, naviosConhecidos: Object.keys(shipData).length };
}

module.exports = {
  start,
  stop,
  restart,
  refreshWatchlist,
  getAllShips,
  getWatchlistWithPositions,
  getStatus,
  normalizeName,
};
