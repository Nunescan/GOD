# Cesar Augusto — Painel de Monitoramento

Painel local para abrir todo dia no trabalho: faz login sozinho no [Ravex](https://longopercurso.sistema.ravex.com.br/login),
entra em Monitoramento, exporta a planilha, e mostra tudo num dashboard com mapa em
tempo real das cargas/caminhões. Também serve como launcher rápido (Outlook, planilhas
fixas, pastas, etc), com uma tela de senha antes de entrar.

Roda **inteiramente no seu PC** (não é um site na internet) - os dados da empresa e suas
senhas nunca saem da sua máquina, exceto para o próprio Ravex.

## Estrutura do projeto

```
GOD/
├── automation/          # Playwright: login + exportação da planilha do Ravex
├── server/
│   ├── middleware/        # Autenticação (sessão/cookie do painel)
│   ├── routes/             # Rotas HTTP (auth, settings, launcher)
│   ├── services/            # Regras de negócio (settings, excel, geocoding, rotas, picker)
│   └── index.js             # Ponto de entrada do servidor
├── public/               # Frontend (HTML/CSS/JS puro, sem build)
│   ├── login.html           # Tela de senha (primeiro acesso cria a senha)
│   ├── index.html            # Página inicial ("modo gamer")
│   ├── dashboard.html         # Monitoramento (KPIs, tabela)
│   ├── mapa.html               # Mapa em tempo real
│   └── settings.html            # Credenciais, senha do painel e atalhos
├── config/
│   ├── launcher.example.json  # Modelo de atalhos (vai pro git)
│   ├── launcher.json           # Seus atalhos de verdade (não vai pro git)
│   └── secrets.json             # Credenciais do Ravex + hash da senha do painel (não vai pro git)
├── data/
│   ├── downloads/         # Planilhas baixadas do Ravex (não vai pro git)
│   └── cache/               # Dados já processados/geocodificados (não vai pro git)
├── scripts/               # Scripts .bat de instalação e atalho
└── docs/
```

## Primeira vez usando (nesse PC)

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou mais nova) se ainda não tiver.
2. Dê 2 cliques em `scripts\instalar.bat` - ele instala tudo (dependências + navegador
   do Playwright).
3. Dê 2 cliques em `scripts\abrir-painel.bat`. Na primeira vez, a tela de login vai
   pedir pra você **criar uma senha de acesso ao painel** (isso protege o painel de
   quem passar na sua mesa - sem essa senha, nada abre).
4. Vá em **Configurações** (⚙️ no menu) e preencha o e-mail/senha do Ravex, e
   cadastre seus atalhos (Outlook, planilhas, pastas). Isso também dá pra editar
   depois, a qualquer momento, sem mexer em arquivo nenhum.

> Se preferir editar arquivo em vez da tela: `config/secrets.json` guarda as
> credenciais do Ravex (crie a partir de `.env.example` → `.env` como alternativa
> - veja abaixo) e `config/launcher.json` guarda os atalhos.

## Uso do dia a dia

Dê 2 cliques em `scripts\abrir-painel.bat` (ou crie um atalho dele na Área de
Trabalho - clique direito → Enviar para → Área de trabalho). Ele:

1. Liga o servidor local (se ainda não estiver ligado);
2. Abre o painel numa janela "de app" (sem barra de endereço), estilo Steam Big Picture;
3. Pede sua senha do painel antes de mostrar qualquer coisa.

Na tela inicial, clique em **"Atualizar monitoramento"** para o robô logar no Ravex,
abrir Monitoramento e baixar a planilha automaticamente. Isso também roda sozinho a
cada 10 minutos (ajustável em `AUTO_REFRESH_MINUTES` no `.env`) enquanto o servidor
estiver ligado.

- **Dashboard**: KPIs (total, em trânsito, entregues, atrasados) + tabela completa,
  com busca.
- **Mapa**: posição atual de cada carga, atualizando junto com os dados. Buscar por
  uma Programação de Transporte (na home ou no mapa) centraliza nela, traça a rota
  até o destino e mostra a distância/tempo restante.
- **Configurações**: credenciais do Ravex, senha do painel, e o gerenciador de
  atalhos (nome, ícone e caminho - com botões "Procurar arquivo"/"Procurar pasta"
  que abrem o seletor nativo do Windows, então você nunca precisa digitar o caminho
  na mão).

Pra sair (ex: antes de sair da mesa), clique no ⏻ no canto superior direito.

## Como a automação funciona

`automation/ravexClient.js` usa o [Playwright](https://playwright.dev) pra controlar um
navegador de verdade: login → busca "monitoramento" no menu → clica em "Exportar todos
os dados" → salva o arquivo em `data/downloads/`.

Se falhar, use o botão **"👁️ Ver funcionando (modo visível)"** em Configurações - ele
roda a automação de novo, mas com o navegador aparecendo na tela, pra você acompanhar
exatamente onde trava. Se ainda assim não der pra entender, um print automático da
tela no momento da falha fica salvo em `data/downloads/debug/`.

## Se as colunas da planilha tiverem nomes diferentes

O sistema tenta reconhecer as colunas automaticamente (`server/services/excelParser.js`,
constante `FIELD_KEYWORDS`) por palavras-chave, então pequenas variações no nome do
cabeçalho (ex: "Posição Atual" vs "Posição atual do veículo") já são cobertas. Se uma
coluna não for reconhecida, adicione a palavra-chave correspondente nessa constante.

## Segurança

- A tela de login exige uma senha (hash com salt via `scrypt`, nunca guardada em
  texto puro) antes de mostrar qualquer coisa do painel. A sessão é derrubada toda
  vez que o servidor reinicia - ou seja, abrir o painel de manhã sempre pede senha.
- `config/secrets.json` (credenciais do Ravex + hash da senha do painel) e
  `config/launcher.json` (seus atalhos, com caminhos locais) **nunca** vão pro
  GitHub - estão no `.gitignore`. Só os arquivos `.example`/template são versionados.
- `.env` continua funcionando como alternativa/fallback pras credenciais do Ravex,
  mas também nunca é commitado.
- O servidor só escuta em `127.0.0.1` (localhost) - ninguém na rede consegue acessar.
- O seletor de arquivo/pasta (Configurações → atalhos) abre uma caixa de diálogo
  nativa do Windows via PowerShell - só mostra a janela, quem escolhe o caminho é
  você, na hora.
- O botão de abrir programas só executa caminhos que **você** cadastrou localmente
  em `config/launcher.json`, nunca um caminho vindo de fora.
- Geocodificação usa o [Nominatim](https://nominatim.org) (OpenStreetMap) e o cálculo
  de rota usa o servidor de demonstração do [OSRM](https://project-osrm.org) - ambos
  gratuitos e sem chave, com uso respeitando o limite de ~1 req/seg deles. Resultados
  ficam em cache em `data/cache/` pra não repetir buscas.
- `npm audit` mostra uma vulnerabilidade moderada indireta (via `uuid`, dependência do
  `exceljs`) sem correção estável disponível ainda; risco baixo pro uso deste projeto
  (não expõe rede, uso pessoal).

## Publicando no GitHub

O projeto já está com `git init` feito e commits locais. Pra subir:

```
git remote add origin <url-do-seu-repositorio>
git push -u origin main
```

Confira antes com `git status` que `.env`, `config/secrets.json` e
`config/launcher.json` não aparecem na lista (devem estar ignorados). Nunca force a
inclusão deles.
