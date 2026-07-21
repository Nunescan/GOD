const fs = require('fs');
const path = require('path');
const { normalizeRows } = require('./excelParser');
const { geocodeText } = require('./geocode');
const { readVeiculoCoords } = require('./veiculoParser');

const LATEST_XLSX = path.resolve(__dirname, '../../data/downloads/latest.xlsx');
const VEICULO_XLSX = path.resolve(__dirname, '../../data/downloads/veiculos-latest.xlsx');
const CACHE_JSON = path.resolve(__dirname, '../../data/cache/latest.json');
const COLUMN_MAP_FILE = path.resolve(__dirname, '../../config/columnMap.json');

// trava de seguranca: nunca deixa uma planilha com dado sujo (ou uma coluna
// mapeada errada) fazer o reprocessamento demorar horas em buscas de geocoding
const MAX_GEOCODE_LOOKUPS = 300;

function readColumnOverrides() {
  if (!fs.existsSync(COLUMN_MAP_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(COLUMN_MAP_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Le data/downloads/latest.xlsx, normaliza as linhas, cruza com as
 * coordenadas precisas do relatorio de veiculo (por SPE/Programacao de
 * Transporte) e geocodifica o que sobrar, salvando tudo em
 * data/cache/latest.json - que e o que as rotas da API leem, pra responder rapido.
 */
async function rebuildCache() {
  const overrides = readColumnOverrides();
  const { rows, columnMap, rawHeaders } = await normalizeRows(LATEST_XLSX, overrides);
  const coordsBySpe = await readVeiculoCoords(VEICULO_XLSX);

  const counts = new Map();
  rows.forEach((r) => {
    // so entra na fila de geocoding quem NAO tem coordenada precisa do
    // relatorio de veiculo pra essa SPE/Programacao de Transporte
    if (r.posicaoAtual && !coordsBySpe[r.programacao]) {
      counts.set(r.posicaoAtual, (counts.get(r.posicaoAtual) || 0) + 1);
    }
    [r.origem, r.destino].forEach((text) => {
      if (text) counts.set(text, (counts.get(text) || 0) + 1);
    });
  });

  // processa primeiro os textos mais frequentes (mais chance de serem locais
  // de verdade e nao ruido), e corta no limite de seguranca
  const uniqueTexts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([text]) => text);
  const toGeocode = uniqueTexts.slice(0, MAX_GEOCODE_LOOKUPS);
  const geocodeSkipped = uniqueTexts.length - toGeocode.length;

  const geo = {};
  for (const text of toGeocode) {
    geo[text] = await geocodeText(text);
  }

  let precisas = 0;
  rows.forEach((r) => {
    const precisa = coordsBySpe[r.programacao];
    if (precisa) {
      r.posicaoAtualGeo = precisa;
      precisas += 1;
    } else {
      r.posicaoAtualGeo = r.posicaoAtual ? geo[r.posicaoAtual] || null : null;
    }
    r.origemGeo = r.origem ? geo[r.origem] || null : null;
    r.destinoGeo = r.destino ? geo[r.destino] || null : null;
  });

  const result = {
    updatedAt: new Date().toISOString(),
    columnMap,
    rawHeaders,
    total: rows.length,
    geocodeSkipped,
    posicoesPrecisas: precisas,
    rows,
  };

  fs.mkdirSync(path.dirname(CACHE_JSON), { recursive: true });
  fs.writeFileSync(CACHE_JSON, JSON.stringify(result, null, 2));
  return result;
}

function readCache() {
  if (!fs.existsSync(CACHE_JSON)) return null;
  return JSON.parse(fs.readFileSync(CACHE_JSON, 'utf-8'));
}

module.exports = { readCache, rebuildCache, LATEST_XLSX, VEICULO_XLSX, CACHE_JSON };
