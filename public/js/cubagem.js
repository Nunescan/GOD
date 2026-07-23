import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

startClock(document.getElementById('clock'), document.getElementById('dateLabel'));

// medidas internas usuais (metros) e capacidade util aproximada (kg) - ajustaveis na tela.
// Os paletes usam a mesma logica dos veiculos (sao so um "recipiente" menor) -
// a altura e a altura MAXIMA UTIL de empilhamento (nao a altura do palete vazio,
// que e uns 14-15cm), e o peso e a capacidade de carga que ele aguenta.
const PRESETS = {
  conteiner20: { comprimento: 5.90, largura: 2.35, altura: 2.39, capacidadeKg: 28000 },
  conteiner40: { comprimento: 12.03, largura: 2.35, altura: 2.39, capacidadeKg: 26500 },
  carreta: { comprimento: 14.0, largura: 2.5, altura: 2.7, capacidadeKg: 27000 },
  truck: { comprimento: 7.0, largura: 2.4, altura: 2.5, capacidadeKg: 14000 },
  paletePbr: { comprimento: 1.20, largura: 1.00, altura: 1.80, capacidadeKg: 1500 },
  paleteEuro: { comprimento: 1.20, largura: 0.80, altura: 1.80, capacidadeKg: 1000 },
  paleteAmericano: { comprimento: 1.219, largura: 1.016, altura: 1.80, capacidadeKg: 1000 },
  manual: { comprimento: 5.90, largura: 2.35, altura: 2.39, capacidadeKg: 28000 },
};

const CORES = ['#3987e5', '#ec835a', '#0ca30c', '#fab219', '#d4af37', '#e66767', '#8a5fd6', '#3ecfc0'];

const veiculoPreset = document.getElementById('veiculoPreset');
const vComprimento = document.getElementById('vComprimento');
const vLargura = document.getElementById('vLargura');
const vAltura = document.getElementById('vAltura');
const vCapacidade = document.getElementById('vCapacidade');
const cargasBody = document.getElementById('cargasBody');
const addCargaBtn = document.getElementById('addCargaBtn');
const calcularBtn = document.getElementById('calcularBtn');
const calcularMsg = document.getElementById('calcularMsg');
const resultCard = document.getElementById('resultCard');
const alertaCard = document.getElementById('alertaCard');

function aplicarPreset(nome) {
  const p = PRESETS[nome];
  vComprimento.value = p.comprimento;
  vLargura.value = p.largura;
  vAltura.value = p.altura;
  vCapacidade.value = p.capacidadeKg;
}

veiculoPreset.addEventListener('change', () => aplicarPreset(veiculoPreset.value));
aplicarPreset('conteiner20');

let corIdx = 0;
function linhaCarga(valores = {}) {
  const tr = document.createElement('tr');
  const cor = valores.cor || CORES[corIdx % CORES.length];
  corIdx += 1;
  tr.innerHTML = `
    <td><input type="text" class="c-nome" value="${valores.nome || ''}" placeholder="Ex: Palete"></td>
    <td><input type="number" class="c-comprimento" step="0.01" min="0" value="${valores.comprimento || ''}"></td>
    <td><input type="number" class="c-largura" step="0.01" min="0" value="${valores.largura || ''}"></td>
    <td><input type="number" class="c-altura" step="0.01" min="0" value="${valores.altura || ''}"></td>
    <td><input type="number" class="c-peso" step="0.1" min="0" value="${valores.peso || ''}"></td>
    <td><input type="number" class="c-quantidade" step="1" min="1" value="${valores.quantidade || 1}" style="max-width:70px;"></td>
    <td><input type="color" class="c-cor" value="${cor}" style="width:40px; height:32px; padding:2px; cursor:pointer;"></td>
    <td><button type="button" class="icon-btn remover-carga" title="Remover">🗑️</button></td>
  `;
  tr.querySelector('.remover-carga').addEventListener('click', () => tr.remove());
  return tr;
}

addCargaBtn.addEventListener('click', () => cargasBody.appendChild(linhaCarga()));
cargasBody.appendChild(linhaCarga({ nome: 'Palete', comprimento: 1.2, largura: 1.0, altura: 1.5, peso: 400, quantidade: 6 }));

function lerCargas() {
  return [...cargasBody.querySelectorAll('tr')].map((tr) => ({
    nome: tr.querySelector('.c-nome').value.trim() || 'Carga',
    comprimento: parseFloat(tr.querySelector('.c-comprimento').value) || 0,
    largura: parseFloat(tr.querySelector('.c-largura').value) || 0,
    altura: parseFloat(tr.querySelector('.c-altura').value) || 0,
    peso: parseFloat(tr.querySelector('.c-peso').value) || 0,
    quantidade: parseInt(tr.querySelector('.c-quantidade').value, 10) || 1,
    cor: tr.querySelector('.c-cor').value,
  }));
}

// ---------- cena 3D ----------
let scene, camera, renderer, controls, grupoCaixas;

function initCena() {
  const container = document.getElementById('cena3d');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);

  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.05, 200);

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  grupoCaixas = new THREE.Group();
  scene.add(grupoCaixas);

  window.addEventListener('resize', () => {
    if (!container.clientWidth) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function limparCena() {
  while (grupoCaixas.children.length > 0) {
    const obj = grupoCaixas.children.pop();
    obj.geometry && obj.geometry.dispose();
    obj.material && obj.material.dispose();
    grupoCaixas.remove(obj);
  }
}

// desenha o veiculo (wireframe transparente) e cada caixa colocada, todas
// centralizadas na origem pra camera girar em torno do meio da carga
function renderizarCena(veiculo, caixas) {
  limparCena();

  const cx = veiculo.comprimento / 2;
  const cy = veiculo.altura / 2; // Y = altura na cena 3D (Z do calculo vira Y aqui)
  const cz = veiculo.largura / 2;

  const veiculoGeo = new THREE.BoxGeometry(veiculo.comprimento, veiculo.altura, veiculo.largura);
  const veiculoEdges = new THREE.EdgesGeometry(veiculoGeo);
  const veiculoWire = new THREE.LineSegments(veiculoEdges, new THREE.LineBasicMaterial({ color: 0x3987e5, opacity: 0.6, transparent: true }));
  veiculoWire.position.set(0, 0, 0);
  grupoCaixas.add(veiculoWire);

  caixas.forEach((c) => {
    const geo = new THREE.BoxGeometry(c.comprimento, c.altura, c.largura);
    const mat = new THREE.MeshLambertMaterial({ color: c.cor, transparent: true, opacity: 0.88 });
    const mesh = new THREE.Mesh(geo, mat);
    // x/y/z do calculo: x=comprimento, y=largura, z=altura (empilhamento) ->
    // na cena 3D usamos Y como "pra cima", entao z do calculo vira y aqui
    mesh.position.set(
      c.x + c.comprimento / 2 - cx,
      c.z + c.altura / 2 - cy,
      c.y + c.largura / 2 - cz,
    );
    grupoCaixas.add(mesh);

    const edges = new THREE.EdgesGeometry(geo);
    const linha = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.3, transparent: true }));
    linha.position.copy(mesh.position);
    grupoCaixas.add(linha);
  });

  const maiorLado = Math.max(veiculo.comprimento, veiculo.largura, veiculo.altura);
  camera.position.set(maiorLado * 0.9, maiorLado * 0.7, maiorLado * 1.1);
  controls.target.set(0, 0, 0);
  controls.update();

  // renderiza na hora, sem esperar o proximo requestAnimationFrame - numa
  // aba que acabou de ficar visivel (ou sem foco) o navegador pode atrasar
  // o primeiro rAF, e sem isso o quadro ficava preto ate algum evento
  // (resize, interacao) forcar um novo frame
  renderer.render(scene, camera);
}

function corPorPeso(pct) {
  if (pct > 100) return 'var(--status-critical)';
  if (pct > 90) return 'var(--status-warning)';
  return 'var(--accent)';
}

calcularBtn.addEventListener('click', async () => {
  const veiculo = {
    comprimento: parseFloat(vComprimento.value) || 0,
    largura: parseFloat(vLargura.value) || 0,
    altura: parseFloat(vAltura.value) || 0,
    capacidadeKg: parseFloat(vCapacidade.value) || 0,
  };
  const cargas = lerCargas().filter((c) => c.comprimento > 0 && c.largura > 0 && c.altura > 0);

  if (!veiculo.comprimento || !veiculo.largura || !veiculo.altura) {
    calcularMsg.textContent = 'Preencha as dimensões do veículo.';
    return;
  }
  if (cargas.length === 0) {
    calcularMsg.textContent = 'Adicione pelo menos uma carga com dimensões válidas.';
    return;
  }

  calcularBtn.disabled = true;
  calcularMsg.textContent = 'Calculando...';
  try {
    const data = await fetchJSON('/api/cubagem/calcular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ veiculo, cargas }),
    });

    resultCard.style.display = 'block';
    document.getElementById('ocupacaoVolumeValor').textContent = data.ocupacaoVolume + '%';
    document.getElementById('ocupacaoVolumeBar').style.width = Math.min(100, data.ocupacaoVolume) + '%';
    document.getElementById('ocupacaoVolumeBar').style.background = corPorPeso(data.ocupacaoVolume);

    document.getElementById('ocupacaoPesoValor').textContent = data.ocupacaoPeso + '%';
    document.getElementById('ocupacaoPesoBar').style.width = Math.min(100, data.ocupacaoPeso) + '%';
    document.getElementById('ocupacaoPesoBar').style.background = corPorPeso(data.ocupacaoPeso);

    if (data.excedeuPeso || data.excedeuItens) {
      const partes = [];
      if (data.excedeuPeso) partes.push(`peso passou da capacidade (${data.pesoUsado}kg de ${data.capacidadeKg}kg)`);
      if (data.excedeuItens) partes.push(`${data.caixasNaoCabem.length} item(ns) não couberam no espaço`);
      alertaCard.textContent = '⚠️ ' + partes.join(' · ');
      alertaCard.style.display = 'block';
    } else {
      alertaCard.style.display = 'none';
    }

    if (!scene) initCena();
    renderizarCena(veiculo, data.caixasColocadas);

    calcularMsg.textContent = `${data.caixasColocadas.length} caixa(s) posicionada(s).`;
  } catch (err) {
    calcularMsg.textContent = `Erro: ${err.message}`;
  } finally {
    calcularBtn.disabled = false;
  }
});
