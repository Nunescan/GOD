const express = require('express');
const cteRunner = require('../services/cteRunner');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json(cteRunner.getStatus());
});

router.post('/start', (req, res) => {
  const result = cteRunner.start();
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

router.post('/stop', (req, res) => {
  const result = cteRunner.stop();
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

module.exports = router;
