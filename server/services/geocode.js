const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.resolve(__dirname, '../../data/cache/geocode-cache.json');
const COORD_REGEX = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;

let cache = {};
try {
  if (fs.existsSync(CACHE_FILE)) cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
} catch {
  cache = {};
}

function saveCache() {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Nominatim (OpenStreetMap) pede no maximo ~1 requisicao por segundo.
let lastRequestAt = 0;
async function throttle() {
  const wait = 1100 - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/**
 * Converte um texto (ex: "Posicao atual" ou "Destino") em { lat, lng }.
 * Se o texto ja for coordenadas "lat,lng" usa direto; senao geocodifica via
 * Nominatim (gratuito, sem chave) com cache em disco pra nao repetir buscas.
 */
async function geocodeText(text) {
  if (!text) return null;

  const coordMatch = text.match(COORD_REGEX);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]), source: 'coord' };
  }

  const key = text.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];

  await throttle();
  try {
    const query = encodeURIComponent(/brasil|brazil/i.test(text) ? text : `${text}, Brasil`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`, {
      headers: { 'User-Agent': 'ravex-dashboard-local/1.0 (uso interno pessoal)' },
    });
    const data = await res.json();
    const result = data && data.length > 0
      ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), source: 'nominatim' }
      : null;
    cache[key] = result;
    saveCache();
    return result;
  } catch (err) {
    console.error('[geocode] erro ao buscar "%s": %s', text, err.message);
    return null;
  }
}

module.exports = { geocodeText };
