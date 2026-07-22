const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { readCache } = require('./pipeline');

function cellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    return v.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return v.result;
    if (v.text !== undefined) return v.text;
  }
  return v;
}

async function readRows(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headers: [], rows: [] };

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

  return { headers: headers.filter(Boolean), rows };
}

/**
 * Le so o cabecalho + uma previa (5 linhas), pra tela deixar escolher qual
 * coluna tem a SPE antes de rodar a busca de verdade.
 */
async function previewSpreadsheet(filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, error: 'Arquivo não encontrado' };
  const { headers, rows } = await readRows(filePath);
  return { ok: true, headers, preview: rows.slice(0, 5), total: rows.length };
}

/**
 * Cruza os valores de uma coluna (SPE) de uma planilha qualquer com os dados
 * mais recentes do Ravex (data/cache/latest.json), devolvendo status atual,
 * origem/destino etc pra cada SPE encontrada.
 */
async function lookupSpes(filePath, speColumn, dateColumn, dateFilter) {
  if (!fs.existsSync(filePath)) return { ok: false, error: 'Arquivo não encontrado' };
  const { rows } = await readRows(filePath);

  let linhas = rows;
  if (dateColumn && dateFilter) {
    linhas = rows.filter((row) => {
      const raw = row[dateColumn];
      const date = raw instanceof Date ? raw : new Date(raw);
      if (Number.isNaN(date.getTime())) return false;
      return date.toISOString().slice(0, 10) === dateFilter;
    });
  }

  const cache = readCache();
  const bySpe = new Map();
  if (cache) {
    cache.rows.forEach((r) => {
      if (r.programacao) bySpe.set(r.programacao.trim().toLowerCase(), r);
    });
  }

  const resultados = linhas.map((row) => {
    const spe = String(row[speColumn] || '').trim();
    const match = spe ? bySpe.get(spe.toLowerCase()) : null;
    return {
      spe,
      encontrado: Boolean(match),
      status: match ? match.status : null,
      origem: match ? match.origem : null,
      destino: match ? match.destino : null,
      posicaoAtual: match ? match.posicaoAtual : null,
      placa: match ? match.placa : null,
      carreta: match ? match.carreta : null,
      motorista: match ? match.motorista : null,
      transportadora: match ? match.transportadora : null,
      linhaOriginal: row,
    };
  });

  return {
    ok: true,
    total: resultados.length,
    encontrados: resultados.filter((r) => r.encontrado).length,
    naoEncontrados: resultados.filter((r) => !r.encontrado).length,
    resultados,
  };
}

/**
 * Escreve o resultado do cruzamento (lookupSpes) numa planilha nova, pronta
 * pra enviar por e-mail.
 */
async function writeResultSpreadsheet(resultados, outputPath) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Verificação Cabotagem');

  sheet.addRow(['SPE', 'Alocado no Ravex?', 'Status', 'Origem', 'Destino', 'Posição Atual', 'Cavalo (Placa)', 'Carreta', 'Motorista', 'Transportadora']);
  sheet.getRow(1).font = { bold: true };

  resultados.forEach((r) => {
    sheet.addRow([
      r.spe,
      r.encontrado ? 'Sim' : 'Não',
      r.status || '',
      r.origem || '',
      r.destino || '',
      r.posicaoAtual || '',
      r.placa || '',
      r.carreta || '',
      r.motorista || '',
      r.transportadora || '',
    ]);
  });

  sheet.columns.forEach((col) => { col.width = 20; });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

module.exports = { previewSpreadsheet, lookupSpes, readRows, writeResultSpreadsheet };
