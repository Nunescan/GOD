# Painel Ravex

Painel local para abrir todo dia no trabalho: faz login sozinho no [Ravex](https://longopercurso.sistema.ravex.com.br/login),
entra em Monitoramento, exporta a planilha, e mostra tudo num dashboard com mapa em
tempo real das cargas/caminhões. Também serve como launcher rápido (Outlook, planilhas
fixas, etc).

Roda **inteiramente no seu PC** (não é um site na internet) - os dados da empresa e sua
senha nunca saem da sua máquina, exceto para o próprio Ravex.

## Estrutura do projeto

```
GOD/
├── automation/        # Playwright: login + exportação da planilha do Ravex
├── server/             # Servidor Express (API local)
│   ├── routes/          # Rotas HTTP (launcher, etc)
│   ├── services/         # Regras de negócio (parser de excel, geocoding, rotas)
│   └── index.js          # Ponto de entrada do servidor
├── public/             # Frontend (HTML/CSS/JS puro, sem build)
│   ├── index.html        # Página inicial ("modo gamer")
│   ├── dashboard.html     # Monitoramento (KPIs, tabela)
│   └── mapa.html          # Mapa em tempo real
├── config/
│   └── launcher.json     # Atalhos da tela inicial (edite os caminhos aqui)
├── data/
│   ├── downloads/        # Planilhas baixadas do Ravex (não vai pro git)
│   └── cache/             # Dados já processados/geocodificados (não vai pro git)
├── scripts/             # Scripts .bat de instalação e atalho
└── docs/
```

## Primeira vez usando (nesse PC)

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou mais nova) se ainda não tiver.
2. Dê 2 cliques em `scripts\instalar.bat` - ele instala tudo (dependências + navegador
   do Playwright) e cria o arquivo `.env` a partir do `.env.example`.
3. Abra o arquivo `.env` (na raiz do projeto) e confira/preencha:
   ```
   RAVEX_USERNAME=seu.email@seara.com.br
   RAVEX_PASSWORD=sua_senha
   ```
   Esse arquivo **nunca** vai pro GitHub (está no `.gitignore`).
4. Edite `config/launcher.json` com os caminhos reais dos seus programas/planilhas
   (Outlook, a planilha de Programação de Transporte, etc).

## Uso do dia a dia

Dê 2 cliques em `scripts\abrir-painel.bat` (ou crie um atalho dele na Área de
Trabalho - clique direito → Enviar para → Área de trabalho). Ele:

1. Liga o servidor local (se ainda não estiver ligado);
2. Abre o painel numa janela "de app" (sem barra de endereço), estilo Steam Big Picture.

Na tela inicial, clique em **"Atualizar monitoramento"** para o robô logar no Ravex,
abrir Monitoramento e baixar a planilha automaticamente. Isso também roda sozinho a
cada 10 minutos (ajustável em `AUTO_REFRESH_MINUTES` no `.env`) enquanto o servidor
estiver ligado.

- **Dashboard**: KPIs (total, em trânsito, entregues, atrasados) + tabela completa,
  com busca.
- **Mapa**: posição atual de cada carga, atualizando junto com os dados. Buscar por
  uma Programação de Transporte (na home ou no mapa) centraliza nela, traça a rota
  até o destino e mostra a distância/tempo restante.

## Como a automação funciona

`automation/ravexClient.js` usa o [Playwright](https://playwright.dev) pra controlar um
navegador de verdade: login → busca "monitoramento" no menu → aplica zoom 80% → clica em
"Exportar todos os dados" → salva o arquivo em `data/downloads/`.

Se o login/exportação falhar (ex: o Ravex mudou algum botão de lugar), rode
`scripts\iniciar-servidor.bat` (mostra os logs) e/ou mude `RAVEX_HEADLESS=false` no
`.env` pra ver o navegador abrindo e identificar onde travou.

## Se as colunas da planilha tiverem nomes diferentes

O sistema tenta reconhecer as colunas automaticamente (`server/services/excelParser.js`,
constante `FIELD_KEYWORDS`) por palavras-chave, então pequenas variações no nome do
cabeçalho (ex: "Posição Atual" vs "Posição atual do veículo") já são cobertas. Se uma
coluna não for reconhecida, adicione a palavra-chave correspondente nessa constante.

## Segurança

- `.env` (com sua senha) fica só no seu PC - **nunca** é commitado.
- `.env.example` (o que vai pro GitHub) só tem valores de exemplo.
- O servidor só escuta em `127.0.0.1` (localhost) - ninguém na rede consegue acessar.
- O botão de abrir programas (`config/launcher.json`) só executa caminhos que **você**
  cadastrou localmente, nunca um caminho vindo de fora.
- Geocodificação usa o [Nominatim](https://nominatim.org) (OpenStreetMap) e o cálculo
  de rota usa o servidor de demonstração do [OSRM](https://project-osrm.org) - ambos
  gratuitos e sem chave, com uso respeitando o limite de ~1 req/seg deles. Resultados
  ficam em cache em `data/cache/` pra não repetir buscas.
- `npm audit` mostra uma vulnerabilidade moderada indireta (via `uuid`, dependência do
  `exceljs`) sem correção estável disponível ainda; risco baixo pro uso deste projeto
  (não expõe rede, uso pessoal).

## Publicando no GitHub

O projeto já está com `git init` feito e um commit inicial. Pra subir:

```
git remote add origin <url-do-seu-repositorio>
git push -u origin main
```

Confira antes com `git status` que `.env` não aparece na lista (ele deve estar
ignorado). Nunca force a inclusão dele.
