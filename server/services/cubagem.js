// Empacotamento 3D (bin packing) pra calcular como caixas/paletes cabem
// dentro de um veiculo/conteiner. Usa uma heuristica de "pontos extremos"
// (extreme points): comeca com um ponto livre na quina do veiculo, tenta
// encaixar cada caixa (maior primeiro, testando as 6 rotacoes possiveis) no
// melhor ponto disponivel, e a cada caixa colocada gera novos pontos livres
// nas quinas dela. Nao e um otimo matematico (isso e NP-dificil), mas da uma
// arrumacao solida e rapida o suficiente pra rodar direto no request.

// as 6 permutacoes possiveis de comprimento/largura/altura (rotacionar a
// caixa deitada de todo jeito, sem rotacao "de banda" - soh eixos retos)
function rotacoes(caixa) {
  const { comprimento: c, largura: l, altura: a } = caixa;
  return [
    [c, l, a],
    [l, c, a],
    [c, a, l],
    [a, c, l],
    [l, a, c],
    [a, l, c],
  ];
}

function sobrepoe(a, b) {
  return a.x < b.x + b.comprimento && a.x + a.comprimento > b.x
    && a.y < b.y + b.largura && a.y + a.largura > b.y
    && a.z < b.z + b.altura && a.z + a.altura > b.z;
}

function cabeNoVeiculo(pos, dim, veiculo) {
  return pos.x + dim[0] <= veiculo.comprimento + 1e-9
    && pos.y + dim[1] <= veiculo.largura + 1e-9
    && pos.z + dim[2] <= veiculo.altura + 1e-9;
}

/**
 * Recebe o veiculo ({comprimento, largura, altura, capacidadeKg} em metros/kg)
 * e a lista de cargas ({nome, comprimento, largura, altura, peso, quantidade, cor}),
 * devolve as caixas colocadas com posicao (x,y,z) + dimensoes finais (depois
 * da rotacao escolhida), as que nao couberam, e os totais de ocupacao.
 */
function calcularCubagem(veiculo, cargas) {
  // expande "quantidade" em itens individuais e ordena do maior volume pro
  // menor - colocar os grandes primeiro deixa mais espaco livre pros pequenos
  // encaixarem depois (heuristica classica de bin packing: "first fit decreasing")
  const itens = [];
  cargas.forEach((c, cargaIdx) => {
    const qtd = Math.max(1, parseInt(c.quantidade, 10) || 1);
    for (let i = 0; i < qtd; i += 1) {
      itens.push({ ...c, cargaIdx, volume: c.comprimento * c.largura * c.altura });
    }
  });
  itens.sort((a, b) => b.volume - a.volume);

  let pontosLivres = [{ x: 0, y: 0, z: 0 }];
  const colocadas = [];
  const naoCoube = [];
  let volumeUsado = 0;
  let pesoUsado = 0;

  itens.forEach((item) => {
    let melhor = null; // { pontoIdx, pos, dim }

    for (let p = 0; p < pontosLivres.length; p += 1) {
      const pos = pontosLivres[p];
      for (const dim of rotacoes(item)) {
        if (!cabeNoVeiculo(pos, dim, veiculo)) continue;
        const caixaTeste = { x: pos.x, y: pos.y, z: pos.z, comprimento: dim[0], largura: dim[1], altura: dim[2] };
        const bate = colocadas.some((outra) => sobrepoe(caixaTeste, outra));
        if (bate) continue;

        // prioriza o ponto mais "no fundo" (menor z, depois menor y, depois
        // menor x) - empilha de baixo pra cima e do fundo pra frente, do
        // jeito que uma carga de verdade seria arrumada
        if (!melhor || pos.z < melhor.pos.z
          || (pos.z === melhor.pos.z && pos.y < melhor.pos.y)
          || (pos.z === melhor.pos.z && pos.y === melhor.pos.y && pos.x < melhor.pos.x)) {
          melhor = { pontoIdx: p, pos, dim };
        }
        break; // achou uma rotacao que serve nesse ponto, nao precisa testar as outras
      }
    }

    if (!melhor) {
      naoCoube.push(item);
      return;
    }

    const caixa = {
      nome: item.nome,
      cargaIdx: item.cargaIdx,
      cor: item.cor,
      peso: item.peso,
      x: melhor.pos.x,
      y: melhor.pos.y,
      z: melhor.pos.z,
      comprimento: melhor.dim[0],
      largura: melhor.dim[1],
      altura: melhor.dim[2],
    };
    colocadas.push(caixa);
    volumeUsado += caixa.comprimento * caixa.largura * caixa.altura;
    pesoUsado += item.peso || 0;

    // remove o ponto usado e acrescenta os 3 novos pontos extremos nas
    // quinas "de fora" da caixa que acabou de entrar
    pontosLivres.splice(melhor.pontoIdx, 1);
    pontosLivres.push(
      { x: caixa.x + caixa.comprimento, y: caixa.y, z: caixa.z },
      { x: caixa.x, y: caixa.y + caixa.largura, z: caixa.z },
      { x: caixa.x, y: caixa.y, z: caixa.z + caixa.altura },
    );
  });

  const volumeVeiculo = veiculo.comprimento * veiculo.largura * veiculo.altura;
  const capacidadeKg = veiculo.capacidadeKg || 0;

  return {
    caixasColocadas: colocadas,
    caixasNaoCabem: naoCoube.map((i) => ({ nome: i.nome, cargaIdx: i.cargaIdx })),
    ocupacaoVolume: volumeVeiculo > 0 ? Math.round((volumeUsado / volumeVeiculo) * 1000) / 10 : 0,
    ocupacaoPeso: capacidadeKg > 0 ? Math.round((pesoUsado / capacidadeKg) * 1000) / 10 : 0,
    volumeUsado: Math.round(volumeUsado * 100) / 100,
    volumeVeiculo: Math.round(volumeVeiculo * 100) / 100,
    pesoUsado: Math.round(pesoUsado * 100) / 100,
    capacidadeKg,
    excedeuPeso: capacidadeKg > 0 && pesoUsado > capacidadeKg,
    excedeuItens: naoCoube.length > 0,
  };
}

module.exports = { calcularCubagem };
