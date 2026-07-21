const fs = require('fs');
const path = require('path');
const { normalizeRows } = require('./excelParser');
const { geocodeText } = require('./geocode');

const LATEST_XLSX = path.resolve(__dirname, '../../data/downloads/latest.xlsx');
const CACHE_JSON = path.resolve(__dirname, '../../data/cache/latest.json');

/**
 * Le data/downloads/latest.xlsx, normaliza as linhas e geocodifica cada
 * localizacao unica (posicao atual / origem / destino), salvando tudo em
 * data/cache/latest.json - que e o que as rotas da API leem, pra responder rapido.
 */
async function rebuildCache() {
  const { rows, columnMap, rawHeaders } = await normalizeRows(LATEST_XLSX);

  const uniqueTexts = new Set();
  rows.forEach((r) => {
    if (r.posicaoAtual) uniqueTexts.add(r.posicaoAtual);
    if (r.origem) uniqueTexts.add(r.origem);
    if (r.destino) uniqueTexts.add(r.destino);
  });

  const geo = {};
  for (const text of uniqueTexts) {
    geo[text] = await geocodeText(text);
  }

  rows.forEach((r) => {
    r.posicaoAtualGeo = r.posicaoAtual ? geo[r.posicaoAtual] || null : null;
    r.origemGeo = r.origem ? geo[r.origem] || null : null;
    r.destinoGeo = r.destino ? geo[r.destino] || null : null;
  });

  const result = {
    updatedAt: new Date().toISOString(),
    columnMap,
    rawHeaders,
    total: rows.length,
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

module.exports = { readCache, rebuildCache, LATEST_XLSX, CACHE_JSON };
