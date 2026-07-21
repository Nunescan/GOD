// Estima distancia/tempo restante entre a posicao atual e o destino.
// Tenta uma rota real de estrada via OSRM (servidor publico de demonstracao,
// sem chave); se falhar ou nao responder, cai numa estimativa em linha reta.

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function estimateRemaining(fromGeo, toGeo) {
  if (!fromGeo || !toGeo) return null;

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromGeo.lng},${fromGeo.lat};${toGeo.lng},${toGeo.lat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data && data.code === 'Ok' && data.routes && data.routes[0]) {
      const r = data.routes[0];
      return {
        distanceKm: Math.round(r.distance / 1000),
        etaMinutes: Math.round(r.duration / 60),
        source: 'rota (OSRM)',
      };
    }
  } catch {
    // segue pro fallback abaixo
  }

  const distanceKm = Math.round(haversineKm(fromGeo, toGeo));
  const AVG_SPEED_KMH = 60; // estimativa media pra estrada, usada so no fallback
  return {
    distanceKm,
    etaMinutes: Math.round((distanceKm / AVG_SPEED_KMH) * 60),
    source: 'estimativa em linha reta',
  };
}

module.exports = { estimateRemaining, haversineKm };
