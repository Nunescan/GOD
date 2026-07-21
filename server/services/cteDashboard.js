const ExcelJS = require('exceljs');
const fs = require('fs');

// Le o relatorio Excel gerado pelo CZAR (cli.py relatorio) e monta as mesmas
// metricas que o antigo dashboard em Streamlit (main.py) mostrava: totais,
// top 10 destinos, top 10 valores, containers e CTEs por data.

function cellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return v.result;
    if (v.text !== undefined) return v.text;
  }
  return v;
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value ?? '').replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

async function readRows(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = [];
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = String(cellValue(cell) || '').trim();
      });
      return;
    }
    const obj = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (key) obj[key] = cellValue(cell);
    });
    rows.push(obj);
  });
  return rows;
}

function findColumn(headers, candidates) {
  return candidates.find((c) => headers.includes(c)) || null;
}

/**
 * Monta o resumo do relatorio de CT-e (KPIs + rankings) a partir de um
 * arquivo Excel gerado pelo CZAR. Nao assume nomes fixos de coluna alem dos
 * ja usados pelo relatorio original (Container, CTE, Origem, Destino,
 * Valor Mercadoria (Total), Frete Líquido (Total), Data Emissão).
 */
async function buildCteDashboard(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'Arquivo não encontrado' };
  }

  const rows = await readRows(filePath);
  if (rows.length === 0) {
    return { ok: false, error: 'Planilha vazia ou sem dados' };
  }

  const headers = Object.keys(rows[0]);
  const colCte = findColumn(headers, ['CTE', 'Numero CTE', 'Número CTE']);
  const colContainer = findColumn(headers, ['Container']);
  const colOrigem = findColumn(headers, ['Origem']);
  const colDestino = findColumn(headers, ['Destino']);
  const colValor = findColumn(headers, ['Valor Mercadoria (Total)', 'Valor Mercadoria']);
  const colFrete = findColumn(headers, ['Frete Líquido (Total)', 'Frete Líquido', 'Frete']);
  const colData = findColumn(headers, ['Data Emissão', 'Data Emissao', 'Data']);

  const totalCtes = rows.length;
  const valorTotal = colValor ? rows.reduce((sum, r) => sum + toNumber(r[colValor]), 0) : null;
  const freteTotal = colFrete ? rows.reduce((sum, r) => sum + toNumber(r[colFrete]), 0) : null;
  const containersUnicos = colContainer
    ? new Set(rows.map((r) => String(r[colContainer] || '').trim()).filter(Boolean)).size
    : null;

  const contarPor = (col) => {
    const counts = new Map();
    rows.forEach((r) => {
      const v = String(r[col] || '').trim();
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  };

  const topDestinos = colDestino ? contarPor(colDestino).slice(0, 10).map(([label, count]) => ({ label, count })) : [];
  const topContainers = colContainer ? contarPor(colContainer).slice(0, 10).map(([label, count]) => ({ label, count })) : [];

  const topValores = colValor
    ? [...rows]
      .sort((a, b) => toNumber(b[colValor]) - toNumber(a[colValor]))
      .slice(0, 10)
      .map((r) => ({ label: colCte ? String(r[colCte] || '-') : '-', value: toNumber(r[colValor]) }))
    : [];

  let ctesPorData = [];
  if (colData) {
    const counts = new Map();
    rows.forEach((r) => {
      const raw = r[colData];
      const date = raw instanceof Date ? raw : new Date(raw);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    ctesPorData = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }

  return {
    ok: true,
    totalCtes,
    valorTotal,
    freteTotal,
    containersUnicos,
    topDestinos,
    topContainers,
    topValores,
    ctesPorData,
    colunas: { colCte, colContainer, colOrigem, colDestino, colValor, colFrete, colData },
    rows: rows.slice(0, 100),
  };
}

module.exports = { buildCteDashboard };
