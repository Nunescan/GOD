import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

startClock(document.getElementById('clock'), document.getElementById('dateLabel'));

// Medidas internas (metros) e capacidade util aproximada (kg). Fontes:
// - Hapag-Lloyd: ficha tecnica oficial (Container Specification PDF)
// - Mercosul Line: pagina oficial de conteineres (mercosul-line.com.br)
// - genericos/Reefer: referencia agregada (despex.com.br) + ISO 668
// - Alianca: nao consegui abrir a pagina oficial deles (timeout) - valor
//   aproximado de busca, confira antes de usar pra algo critico
// Os paletes e reefer usam a mesma logica dos veiculos (sao so um
// "recipiente" menor) - a altura e a altura interna, e a margemTopo (quando
// tem) e descontada dela pelo backend antes de calcular o quanto cabe.
const PRESETS = {
  conteiner20: { comprimento: 5.898, largura: 2.352, altura: 2.394, capacidadeKg: 21630, margemTopo: 0 },
  conteiner40: { comprimento: 12.031, largura: 2.352, altura: 2.394, capacidadeKg: 26480, margemTopo: 0 },
  conteiner40hc: { comprimento: 12.031, largura: 2.352, altura: 2.698, capacidadeKg: 26500, margemTopo: 0 },
  hapagLloyd40: { comprimento: 12.029, largura: 2.350, altura: 2.392, capacidadeKg: 26700, margemTopo: 0 },
  maersk40: { comprimento: 12.032, largura: 2.350, altura: 2.393, capacidadeKg: 28800, margemTopo: 0 },
  mercosul20: { comprimento: 5.900, largura: 2.352, altura: 2.393, capacidadeKg: 28250, margemTopo: 0 },
  mercosul40: { comprimento: 12.034, largura: 2.352, altura: 2.395, capacidadeKg: 23040, margemTopo: 0 },
  alianca40: { comprimento: 12.0, largura: 2.44, altura: 2.59, capacidadeKg: 26930, margemTopo: 0 },
  carreta: { comprimento: 14.0, largura: 2.5, altura: 2.7, capacidadeKg: 27000, margemTopo: 0 },
  truck: { comprimento: 7.0, largura: 2.4, altura: 2.5, capacidadeKg: 14000, margemTopo: 0 },
  // reefer: altura ja e a altura interna bruta - a margemTopo de 0.12m
  // representa a "linha vermelha" (10-12cm abaixo do teto) obrigatoria pra
  // nao bloquear a circulacao de ar frio
  reefer20: { comprimento: 5.449, largura: 2.290, altura: 2.244, capacidadeKg: 20950, margemTopo: 0.12 },
  reefer40hc: { comprimento: 11.6, largura: 2.29, altura: 2.54, capacidadeKg: 27000, margemTopo: 0.12 },
  // altura 2.10m e peso 1200kg sao os limites que a propria Seara usa no
  // projeto de reengenharia de caixas pra otimizar o caminhao (fonte:
  // projetodraft.com/seara-reengenharia-de-caixas) - as dimensoes exatas
  // das caixas nao sao publicas, digite as suas na tabela de cargas
  paleteSeara: { comprimento: 1.20, largura: 1.00, altura: 2.10, capacidadeKg: 1200, margemTopo: 0 },
  paletePbr: { comprimento: 1.20, largura: 1.00, altura: 1.80, capacidadeKg: 1500, margemTopo: 0 },
  paleteEuro: { comprimento: 1.20, largura: 0.80, altura: 1.80, capacidadeKg: 1000, margemTopo: 0 },
  paleteAmericano: { comprimento: 1.219, largura: 1.016, altura: 1.80, capacidadeKg: 1000, margemTopo: 0 },
  manual: { comprimento: 5.90, largura: 2.35, altura: 2.39, capacidadeKg: 28000, margemTopo: 0 },
};

const CORES = ['#3987e5', '#ec835a', '#0ca30c', '#fab219', '#d4af37', '#e66767', '#8a5fd6', '#3ecfc0'];

const veiculoPreset = document.getElementById('veiculoPreset');
const vComprimento = document.getElementById('vComprimento');
const vLargura = document.getElementById('vLargura');
const vAltura = document.getElementById('vAltura');
const vCapacidade = document.getElementById('vCapacidade');
const vMargemTopo = document.getElementById('vMargemTopo');
const cargasBody = document.getElementById('cargasBody');
const addCargaBtn = document.getElementById('addCargaBtn');
const calcularBtn = document.getElementById('calcularBtn');
const calcularMsg = document.getElementById('calcularMsg');
const resultCard = document.getElementById('resultCard');
const alertaCard = document.getElementById('alertaCard');
const avisoEstabilidade = document.getElementById('avisoEstabilidade');

function aplicarPreset(nome) {
  const p = PRESETS[nome];
  vComprimento.value = p.comprimento;
  vLargura.value = p.largura;
  vAltura.value = p.altura;
  vCapacidade.value = p.capacidadeKg;
  vMargemTopo.value = p.margemTopo || 0;
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

// estado do arrastar-com-mouse: guarda cada caixa em coordenadas "modelo"
// (x,y,z = comprimento/largura/altura, origem no canto, igual ao calculo)
// junto com seus objetos 3D (mesh + contorno), pra converter de volta pra
// cena e checar colisao/limites em tempo real
let veiculoAtual = null;
let caixasModelo = [];
let arrastando = null; // { item, offsetX, offsetZ }
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
const planoArrasto = new THREE.Plane();
const COR_COLISAO = 0xe66767;

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

  configurarArrasto(renderer.domElement);
  animate();
}

function pintarColisao(item, colidindo) {
  item.mesh.material.color.set(colidindo ? COR_COLISAO : item.corOriginal);
}

function configurarArrasto(domElement) {
  function mousePara(evento) {
    const rect = domElement.getBoundingClientRect();
    mouseNDC.x = ((evento.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((evento.clientY - rect.top) / rect.height) * 2 + 1;
  }

  domElement.addEventListener('pointerdown', (evento) => {
    if (evento.button !== 0) return; // so botao esquerdo - direito/meio ficam livres pra OrbitControls
    mousePara(evento);
    raycaster.setFromCamera(mouseNDC, camera);
    const alvos = caixasModelo.map((i) => i.mesh);
    const hits = raycaster.intersectObjects(alvos, false);
    if (hits.length === 0) return;

    const mesh = hits[0].object;
    const item = mesh.userData.item;
    const ponto = hits[0].point;

    planoArrasto.set(new THREE.Vector3(0, 1, 0), -mesh.position.y);
    arrastando = { item, offsetX: mesh.position.x - ponto.x, offsetZ: mesh.position.z - ponto.z };
    controls.enabled = false;
    domElement.style.cursor = 'grabbing';
  });

  domElement.addEventListener('pointermove', (evento) => {
    if (!arrastando) return;
    mousePara(evento);
    raycaster.setFromCamera(mouseNDC, camera);
    const ponto = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(planoArrasto, ponto)) return;

    const { item, offsetX, offsetZ } = arrastando;
    const novoX = ponto.x + offsetX;
    const novoZ = ponto.z + offsetZ;
    item.mesh.position.x = novoX;
    item.mesh.position.z = novoZ;
    item.linha.position.x = novoX;
    item.linha.position.z = novoZ;

    // converte de volta pra coordenadas modelo so pra checar colisao/limites
    // em tempo real (feedback visual) - a posicao "oficial" so e gravada no solta
    const cx = veiculoAtual.comprimento / 2;
    const cz = veiculoAtual.largura / 2;
    const testeItem = {
      ...item,
      x: novoX + cx - item.comprimento / 2,
      y: novoZ + cz - item.largura / 2,
    };
    pintarColisao(item, temColisao(testeItem, caixasModelo.map((i) => (i === item ? testeItem : i))));
  });

  function soltar() {
    if (!arrastando) return;
    const { item } = arrastando;
    const cx = veiculoAtual.comprimento / 2;
    const cz = veiculoAtual.largura / 2;
    item.x = item.mesh.position.x + cx - item.comprimento / 2;
    item.y = item.mesh.position.z + cz - item.largura / 2;
    pintarColisao(item, temColisao(item, caixasModelo));

    arrastando = null;
    controls.enabled = true;
    domElement.style.cursor = 'auto';
  }

  domElement.addEventListener('pointerup', soltar);
  domElement.addEventListener('pointerleave', soltar);
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

function modeloParaCena(item, veiculo) {
  const cx = veiculo.comprimento / 2;
  const cy = veiculo.altura / 2;
  const cz = veiculo.largura / 2;
  return {
    x: item.x + item.comprimento / 2 - cx,
    y: item.z + item.altura / 2 - cy,
    z: item.y + item.largura / 2 - cz,
  };
}

function sobrepoeModelo(a, b) {
  return a.x < b.x + b.comprimento && a.x + a.comprimento > b.x
    && a.y < b.y + b.largura && a.y + a.largura > b.y
    && a.z < b.z + b.altura && a.z + a.altura > b.z;
}

// confere se um item (em coordenadas modelo) cabe dentro do veiculo e nao
// bate em nenhuma outra caixa ja colocada - usado ao soltar o arrasto
function temColisao(item, todasAsCaixas) {
  const foraDoVeiculo = item.x < -1e-6 || item.y < -1e-6 || item.z < -1e-6
    || item.x + item.comprimento > veiculoAtual.comprimento + 1e-6
    || item.y + item.largura > veiculoAtual.largura + 1e-6
    || item.z + item.altura > veiculoAtual.altura + 1e-6;
  if (foraDoVeiculo) return true;
  return todasAsCaixas.some((outra) => outra !== item && sobrepoeModelo(item, outra));
}

// desenha o veiculo (wireframe transparente) e cada caixa colocada, todas
// centralizadas na origem pra camera girar em torno do meio da carga
function renderizarCena(veiculo, caixas, margemTopo) {
  limparCena();
  veiculoAtual = veiculo;
  caixasModelo = [];

  const cx = veiculo.comprimento / 2;
  const cy = veiculo.altura / 2; // Y = altura na cena 3D (Z do calculo vira Y aqui)
  const cz = veiculo.largura / 2;

  const veiculoGeo = new THREE.BoxGeometry(veiculo.comprimento, veiculo.altura, veiculo.largura);
  const veiculoEdges = new THREE.EdgesGeometry(veiculoGeo);
  const veiculoWire = new THREE.LineSegments(veiculoEdges, new THREE.LineBasicMaterial({ color: 0x3987e5, opacity: 0.6, transparent: true }));
  veiculoWire.position.set(0, 0, 0);
  grupoCaixas.add(veiculoWire);

  // "linha vermelha": plano semi-transparente marcando o limite util quando
  // tem margem de seguranca no topo (reefer) - carga nao pode passar disso
  if (margemTopo > 0) {
    const alturaUtil = veiculo.altura - margemTopo;
    const planoGeo = new THREE.PlaneGeometry(veiculo.comprimento, veiculo.largura);
    const planoMat = new THREE.MeshBasicMaterial({ color: 0xe66767, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const plano = new THREE.Mesh(planoGeo, planoMat);
    plano.rotation.x = Math.PI / 2;
    plano.position.set(0, alturaUtil - cy, 0);
    grupoCaixas.add(plano);

    const bordaGeo = new THREE.EdgesGeometry(planoGeo);
    const borda = new THREE.LineSegments(bordaGeo, new THREE.LineBasicMaterial({ color: 0xe66767 }));
    borda.rotation.x = Math.PI / 2;
    borda.position.set(0, alturaUtil - cy, 0);
    grupoCaixas.add(borda);
  }

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

    // guarda em coordenadas "modelo" (mesmo sistema do calculo) pra dar pra
    // arrastar depois e checar colisao/limites
    const item = {
      x: c.x, y: c.y, z: c.z,
      comprimento: c.comprimento, largura: c.largura, altura: c.altura,
      corOriginal: c.cor, mesh, linha,
    };
    mesh.userData.item = item;
    caixasModelo.push(item);
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

let ultimoVeiculo = null;
let ultimoResultado = null;

calcularBtn.addEventListener('click', async () => {
  const veiculo = {
    comprimento: parseFloat(vComprimento.value) || 0,
    largura: parseFloat(vLargura.value) || 0,
    altura: parseFloat(vAltura.value) || 0,
    capacidadeKg: parseFloat(vCapacidade.value) || 0,
    margemTopo: parseFloat(vMargemTopo.value) || 0,
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

    if (data.avisoEstabilidade) {
      avisoEstabilidade.textContent = `📐 Pilha chegando a ${data.alturaMaxUsada}m de altura - acima de 1,8m, considere filme stretch e cantoneiras de papelão pra carga não tombar em curva.`;
      avisoEstabilidade.style.display = 'block';
    } else {
      avisoEstabilidade.style.display = 'none';
    }

    if (!scene) initCena();
    renderizarCena(veiculo, data.caixasColocadas, data.margemTopo);

    ultimoVeiculo = veiculo;
    ultimoResultado = data;
    usarComoCargaMsg.textContent = '';

    calcularMsg.textContent = `${data.caixasColocadas.length} caixa(s) posicionada(s).`;
  } catch (err) {
    calcularMsg.textContent = `Erro: ${err.message}`;
  } finally {
    calcularBtn.disabled = false;
  }
});

// pega o resultado do calculo atual (ex: quantas caixas cabem num palete) e
// adiciona como uma UNICA carga (o "palete carregado") na propria tabela -
// assim da pra trocar o veiculo pra um conteiner/carreta e calcular de novo
// pra ver quantos desses paletes cabem, com o palete inteiro aparecendo
// como um bloco na cena 3D do conteiner
const usarComoCargaBtn = document.getElementById('usarComoCargaBtn');
const usarComoCargaMsg = document.getElementById('usarComoCargaMsg');

usarComoCargaBtn.addEventListener('click', () => {
  if (!ultimoVeiculo || !ultimoResultado || ultimoResultado.caixasColocadas.length === 0) {
    usarComoCargaMsg.textContent = 'Calcule primeiro pra ter o que usar como carga.';
    return;
  }

  const nomeVeiculoAtual = veiculoPreset.options[veiculoPreset.selectedIndex].text;
  cargasBody.appendChild(linhaCarga({
    nome: `Palete carregado (${nomeVeiculoAtual})`,
    comprimento: ultimoVeiculo.comprimento,
    largura: ultimoVeiculo.largura,
    altura: ultimoResultado.alturaMaxUsada || ultimoVeiculo.altura,
    peso: ultimoResultado.pesoUsado,
    quantidade: 1,
  }));

  usarComoCargaMsg.textContent = 'Adicionado na tabela de cargas! Troque o "Tipo" pro contêiner/carreta e calcule de novo.';
});
