const express = require('express');
const { calcularCubagem } = require('../services/cubagem');

const router = express.Router();

function numero(v, def = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

router.post('/calcular', (req, res) => {
  const { veiculo, cargas } = req.body || {};

  if (!veiculo || !veiculo.comprimento || !veiculo.largura || !veiculo.altura) {
    return res.status(400).json({ ok: false, error: 'Informe as dimensões do veículo (comprimento, largura, altura)' });
  }
  if (!Array.isArray(cargas) || cargas.length === 0) {
    return res.status(400).json({ ok: false, error: 'Adicione pelo menos uma carga' });
  }

  const veiculoNormalizado = {
    comprimento: numero(veiculo.comprimento),
    largura: numero(veiculo.largura),
    altura: numero(veiculo.altura),
    capacidadeKg: numero(veiculo.capacidadeKg),
    margemTopo: numero(veiculo.margemTopo),
  };

  const cargasNormalizadas = cargas
    .map((c) => ({
      nome: String(c.nome || 'Carga').trim(),
      comprimento: numero(c.comprimento),
      largura: numero(c.largura),
      altura: numero(c.altura),
      peso: numero(c.peso),
      quantidade: Math.max(1, parseInt(c.quantidade, 10) || 1),
      cor: c.cor || '#3987e5',
    }))
    .filter((c) => c.comprimento > 0 && c.largura > 0 && c.altura > 0);

  if (cargasNormalizadas.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhuma carga com dimensões válidas' });
  }

  try {
    const resultado = calcularCubagem(veiculoNormalizado, cargasNormalizadas);
    res.json({ ok: true, ...resultado, veiculo: veiculoNormalizado });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
