const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { getAisApiKey } = require('./settings');

// Rastreamento de navios via AIS (aisstream.io, gratuito). Assina uma
// bounding box cobrindo a costa do Brasil inteira e fica ouvindo as
// mensagens de todo mundo que estiver navegando ali - mas so guarda em
// memoria os navios cujo nome esteja na sua lista (config/navios.json),
// senao seria informacao de navio nenhum interessa pra voce.
const ENDPOINT = 'wss://stream.aisstream.io/v0/stream';
const BRAZIL_BBOX = [[[-34, -54], [6, -30]]];
const RECONNECT_MS = 8000;

const NAVIOS_FILE = path.resolve(__dirname, '../../config/navios.json');

let ws = null;
let reconnectTimer = null;
let watchlist = new Set(); // nomes normalizados
const shipData = {}; // nome normalizado -> { nome, mmsi, lat, lng, ... }

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
    watchlist = new Set();
    return;
  }
  try {
    const lista = JSON.parse(fs.readFileSync(NAVIOS_FILE, 'utf-8'));
    watchlist = new Set((lista || []).map((n) => normalizeName(n.nome)));
  } catch {
    watchlist = new Set();
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

  if (msg.MessageType === 'PositionReport') {
    const nome = msg.Metadata && msg.Metadata.ShipName;
    const norm = normalizeName(nome);
    if (!norm || !watchlist.has(norm)) return;

    const pos = msg.Message && msg.Message.PositionReport;
    if (!pos) return;

    shipData[norm] = {
      ...shipData[norm],
      nome: nome.trim(),
      mmsi: msg.Metadata.MMSI,
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
    if (!data) return;
    const norm = normalizeName(data.Name);
    if (!norm || !watchlist.has(norm)) return;

    shipData[norm] = {
      ...shipData[norm],
      nome: (data.Name || '').trim(),
      destino: data.Destination ? data.Destination.trim() : (shipData[norm] && shipData[norm].destino) || null,
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
    console.log('[ais] sem API key configurada (Configurações > Navios) - rastreamento de navios desligado.');
    return;
  }

  try {
    ws = new WebSocket(ENDPOINT);
  } catch (err) {
    console.error('[ais] erro ao abrir conexão:', err.message);
    scheduleReconnect();
    return;
  }

  ws.on('open', () => {
    console.log('[ais] conectado ao aisstream.io, assinando costa do Brasil...');
    ws.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: BRAZIL_BBOX,
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    }));
  });

  ws.on('message', (data) => handleMessage(data.toString()));

  ws.on('error', (err) => {
    console.error('[ais] erro na conexão:', err.message);
  });

  ws.on('close', () => {
    ws = null;
    scheduleReconnect();
  });
}

function stop() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
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
}

function start() {
  refreshWatchlist();
  connect();
}

// devolve a lista completa (config) com a posicao mais recente conhecida
// mesclada em cada item, quando existir
function getShipsWithPositions() {
  if (!fs.existsSync(NAVIOS_FILE)) return [];
  let lista = [];
  try {
    lista = JSON.parse(fs.readFileSync(NAVIOS_FILE, 'utf-8')) || [];
  } catch {
    return [];
  }
  return lista.map((item) => {
    const pos = shipData[normalizeName(item.nome)];
    return { ...item, ...pos, encontrado: Boolean(pos) };
  });
}

module.exports = { start, stop, restart, refreshWatchlist, getShipsWithPositions, normalizeName };
