const express = require('express');
const notas = require('../services/notas');

const router = express.Router();

// ---------- notas ----------
router.get('/', (req, res) => {
  res.json(notas.listNotas());
});

router.post('/', (req, res) => {
  const { id, titulo, conteudo } = req.body || {};
  const nota = notas.salvarNota({ id, titulo, conteudo });
  res.json({ ok: true, nota });
});

router.delete('/:id', (req, res) => {
  notas.excluirNota(req.params.id);
  res.json({ ok: true });
});

// ---------- agenda ----------
router.get('/agenda', (req, res) => {
  res.json(notas.listAgenda());
});

router.post('/agenda', (req, res) => {
  const { texto, data } = req.body || {};
  if (!texto) return res.status(400).json({ ok: false, error: 'Digite alguma coisa' });
  const item = notas.salvarItemAgenda({ texto, data });
  res.json({ ok: true, item });
});

router.post('/agenda/:id/alternar', (req, res) => {
  const item = notas.alternarItemAgenda(req.params.id);
  res.json({ ok: true, item });
});

router.delete('/agenda/:id', (req, res) => {
  notas.excluirItemAgenda(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
