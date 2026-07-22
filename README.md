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
│   ├── routes/             # Rotas HTTP (auth, settings, launcher, cte, cabotagem)
│   ├── services/            # Regras de negócio (settings, excel, geocoding, rotas, picker,
│   │                          veiculoParser, auxReportParser, cteRunner, cteDashboard,
│   │                          activityLog, speLookup, cabotagemDaily, schedule)
│   └── index.js             # Ponto de entrada do servidor
├── public/               # Frontend (HTML/CSS/JS puro, sem build)
│   ├── login.html           # Tela de senha (primeiro acesso cria a senha)
│   ├── index.html            # Página inicial ("modo gamer")
│   ├── dashboard.html         # Monitoramento (KPIs, tabela)
│   ├── mapa.html               # Mapa em tempo real
│   ├── cte.html                 # Painel do CT-e: dashboard, coleta, processar, relatório, log
│   ├── cabotagem.html            # Atividades, busca de SPE, verificação diária, e-mails
│   ├── settings.html              # Credenciais, senha do painel e atalhos
│   └── data/br-states-topo.json    # Fronteiras dos estados (mapa) - dado estático
├── config/
│   ├── launcher.example.json  # Modelo de atalhos (vai pro git)
│   ├── launcher.json           # Seus atalhos de verdade (não vai pro git)
│   ├── columnMap.json           # Mapeamento manual de colunas (se você ajustou algum)
│   ├── cabotagemConfig.json      # Config da verificação diária (não vai pro git)
│   ├── schedule.json              # Horário de atualização automática (não vai pro git)
│   └── secrets.json                # Credenciais do Ravex + hash da senha do painel (não vai pro git)
├── data/
│   ├── downloads/         # Planilhas baixadas do Ravex (não vai pro git)
│   └── cache/               # Dados já processados/geocodificados (não vai pro git)
├── cte-czar/              # Programa de análise de CT-e - engines por armador +
│   ├── cli.py               # cli.py (um único ponto de entrada, chamado pelo painel)
│   ├── modules/               # Engines (Aliança/Mercosul/Norcoast/Login/Coleta) - o que já existia
│   └── config/vinculos.json    # Pasta do Outlook <-> armador (não vai pro git)
├── scripts/               # Scripts .bat de instalação e atalho
└── docs/
    └── comandos-instalacao.txt  # Lista dos comandos de instalação, pra referência manual
```

## Primeira vez usando (nesse PC)

1. Instale o [Node.js](https://nodejs.org) e o [Python](https://python.org) (versões
   recentes) se ainda não tiver.
2. Dê 2 cliques em **`scripts\instalar-tudo.bat`** - o instalador único: baixa as
   dependências do servidor, o navegador do Playwright, e prepara o ambiente Python
   do CT-e, tudo numa vez só. (Os comandos que ele roda por baixo estão listados em
   `docs/comandos-instalacao.txt`, caso queira rodar algum na mão ou entender o que
   acontece.)
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

- **Dashboard**: KPIs (total, em trânsito, entregues, atrasados) + tabela completa
  (cavalo, carreta, motorista, transportadora, datas...), com busca. Clique numa
  linha pra expandir e ver **todas** as colunas originais da planilha, incluindo o
  que vier vinculado da Situação Cadastral e da Alocação.
- **Mapa**: posição atual de cada carga, atualizando junto com os dados. Buscar por
  uma Programação de Transporte (na home ou no mapa) destaca esse caminhão (anel
  dourado) e esconde os demais, traça a rota até o destino, mostra a distância/tempo
  restante e abre um painel do lado com **todas** as informações da carga (cavalo,
  carreta, motorista, transportadora, mais tudo que vier dos outros relatórios).
- **Configurações**: credenciais do Ravex, senha do painel, mapeamento de colunas e
  o gerenciador de atalhos (nome, ícone e caminho - com botões "Procurar
  arquivo"/"Procurar pasta" que abrem o seletor nativo do Windows, então você nunca
  precisa digitar o caminho na mão).
- **CT-e**: dashboard nativo + coleta/processamento/relatório do CZAR direto no
  painel, com log ao vivo. Veja a seção própria abaixo.
- **Cabotagem**: histórico de tudo que o painel já fez, configuração do horário de
  atualização, busca de SPE por planilha, verificação diária automática e busca de
  e-mails. Veja a seção própria abaixo.

Pra sair (ex: antes de sair da mesa), clique no ⏻ no canto superior direito.

> **Sobre o mapa:** o relatório de Monitoramento não traz mais coordenadas precisas,
> mas o relatório **Informações do Veículo** traz - o painel cruza os dois pela
> SPE/Programação de Transporte e usa a coordenada exata sempre que disponível (veja
> "Duas planilhas" abaixo). Quando a posição é exata, aparece um selo **📍 precisa**
> no mapa. As fronteiras dos estados aparecem como uma linha bem fraca, só pra dar
> referência visual.

## Como a automação funciona

`automation/ravexClient.js` usa o [Playwright](https://playwright.dev) pra controlar um
navegador de verdade, numa única sessão logada: login → busca "monitoramento" no menu
→ exporta → depois abre, direto pela URL, mais três relatórios e exporta cada um -
**Informações do Veículo**, **Situação Cadastral** e **Alocação/Programação de
Transporte**. Cada exportação extra é isolada: se uma falhar, as outras (e o
Monitoramento) continuam normalmente. Os arquivos vão pra `data/downloads/`
(`latest.xlsx`, `veiculos-latest.xlsx`, `situacao-latest.xlsx`, `alocacao-latest.xlsx`).

### Quatro planilhas, uma junção

- **Monitoramento** (`latest.xlsx`): origem, destino, status, posição atual, cavalo
  (placa), carreta - a base de tudo.
- **Informações do Veículo** (`veiculos-latest.xlsx`): SPE/Programação de Transporte
  na coluna **G** e coordenadas geográficas na coluna **I** (formato
  `-25.09380 , -50.20050`) - colunas F/G/H vêm mescladas no cabeçalho do Ravex, então
  a leitura é por posição de coluna, não por nome (`server/services/veiculoParser.js`).
- **Situação Cadastral** (`situacao-latest.xlsx`) e **Alocação**
  (`alocacao-latest.xlsx`): estrutura de colunas ainda não mapeada manualmente, então
  são lidas de forma genérica - o painel detecta sozinho qual coluna é a Placa (pra
  Situação Cadastral) ou a SPE (pra Alocação) e vincula automaticamente com o resto
  dos dados, mantendo todas as colunas originais (`server/services/auxReportParser.js`).
  Esses campos aparecem prefixados (ex: `[Alocação] Data Alocação`) na seção "mais
  informações" do mapa e na linha expandida do dashboard.

No reprocessamento (`server/services/pipeline.js`), pra cada linha o painel primeiro
tenta achar a coordenada exata pela SPE no relatório de veículo; só cai pra
geocodificação por texto (Nominatim) se não achar.

Se falhar, use o botão **"👁️ Ver funcionando (modo visível)"** em Configurações - ele
roda a automação de novo, mas com o navegador aparecendo na tela, pra você acompanhar
exatamente onde trava. Se ainda assim não der pra entender, um print automático da
tela no momento da falha fica salvo em `data/downloads/debug/`.

## CT-e (CZAR)

`cte-czar/` é o programa de análise de CT-e que você já tinha feito, por armador
(Aliança, Mercosul, Norcoast) - **não roda mais como um app Streamlit separado, numa
aba/porta própria**. A essência de cada página virou um único CLI Python
(`cte-czar/cli.py`, comandos `processar` / `relatorio` / `coletar` / `pastas-outlook`),
chamado pelo painel sob demanda. Tudo aparece dentro da aba **CT-e** do painel, em
6 sub-abas:

- **Dashboard**: escolha um relatório Excel já gerado (botão "Procurar arquivo", sem
  precisar arrastar nada) e veja os KPIs e gráficos (total de CTEs, valor de
  mercadoria, frete, containers, top 10 destinos/valores, CTEs por data) - a mesma
  análise que o antigo `main.py` mostrava, recalculada nativamente pelo painel
  (`server/services/cteDashboard.js`), sem depender de Python pra essa parte.
- **Coleta**: escaneia as pastas do Outlook, deixa vincular cada uma a um armador
  (salvo em `cte-czar/config/vinculos.json`) e baixa os anexos (PDF/XML/ZIP/EML) com
  um botão.
- **Processar**: escolhe a pasta com os PDFs/XMLs baixados (seletor nativo do
  Windows) e organiza/renomeia tudo por CTE/container.
- **Relatório**: gera o Excel consolidado a partir de uma pasta já processada.
- **Pagamentos**: veja a seção própria abaixo.
- **Log**: mostra ao vivo tudo que o comando em execução está fazendo (e o resultado,
  quando termina) - sem precisar abrir terminal nenhum.

**Primeira vez:** dê 2 cliques em `scripts\instalar-cte.bat` (cria o ambiente Python
isolado em `cte-czar/venv` e instala as dependências - pandas, openpyxl, opencv,
pywin32, etc).

Bugs corrigidos ao organizar isso:
- `modules/login_engine/login_engine.py` tinha os caminhos do Tesseract-OCR e do
  Poppler fixos pro perfil `caanunes` de outro PC - agora usam variável de ambiente
  com fallback pro PATH do sistema.
- `modules/download_anexos.py`: o filtro de "período (dias)" na Coleta nunca era
  aplicado de verdade, e havia um limite escondido de 999 itens por pasta que
  descartava o resto silenciosamente. Corrigido - agora ordena por data, respeita o
  período pedido de verdade e processa a pasta inteira dentro do período.
- Todo `print()` com emoji quebrava quando o Python era chamado como processo filho
  no Windows (codificação padrão não aceita emoji fora de um console de verdade) -
  `cli.py` força UTF-8 na saída.

> A leitura automática de número de CT-e por OCR (usada dentro do processamento de
> alguns armadores) precisa do Tesseract-OCR instalado no Windows - **ainda não está
> instalado nesta máquina**. Instruções aparecem no final do `instalar-cte.bat`.
> A página de Configuração do CZAR (modelo de template pra OCR) ainda não foi portada
> pro painel nesta rodada.

### Pagamentos

Você tinha 4 planilhas separadas de "Controle de Pagamento" (uma por armador -
Aliança, Login, Mercosul, Norcoast), cada uma com ~30 colunas parecidas mas não
idênticas. A sub-aba **Pagamentos** sintetiza isso numa **planilha-modelo única**
(`server/services/pagamentos.js`, 28 colunas: CTE, NF, Tomador, Origem/Destino,
Filial, Valor Frete, Valor Mercadoria, Ad-Valorem, ICMS, BAF, Taxa Seca, Diferença de
validação, etc, com cabeçalho estilizado e filtro automático):

1. **Baixar modelo** - baixa a planilha vazia, pronta pra preencher com os CT-e do
   período (um campo "Armador" identifica de qual armador é cada linha).
2. Preenche com os dados (pode juntar os 4 armadores na mesma planilha).
3. **Carregar planilha preenchida** - escolhe o arquivo (seletor nativo) e o painel
   monta um dashboard: total de CT-e, valor de frete/mercadoria/ad-valorem/BAF,
   quebra por armador e por filial, e uma lista de **CT-e com diferença de validação**
   (pra conferir antes de pagar).
4. **Enviar por e-mail** - abre um rascunho no Outlook com a planilha já anexada,
   assunto preenchido, pronto pra você revisar o destinatário/texto e clicar em
   Enviar. **De propósito, não envia sozinho** - enviar e-mail é uma ação que só você
   deve confirmar.

> Como o modelo é escrito por nós, a leitura casa por nome exato de coluna (sem
> precisar adivinhar por palavra-chave, diferente do Monitoramento do Ravex). Se
> precisar de mais colunas, é só editar `TEMPLATE_HEADERS` em
> `server/services/pagamentos.js`.

## Cabotagem

Aba nova, com 4 sub-abas:

- **Atividades**: histórico de tudo que o painel já fez (atualizações do Ravex,
  comandos do CT-e, verificações de cabotagem - com data/hora e se deu certo ou não),
  salvo em `data/cache/activity-log.json` (sobrevive a reinícios do servidor). Também
  é onde fica o campo pra configurar de quantos em quantos minutos o Ravex atualiza
  sozinho (`config/schedule.json` - vale a partir da próxima vez que o painel abrir).
- **Buscar SPEs**: escolha qualquer planilha (ex: a programação de cabotagem que você
  recebe por e-mail), aponte com um clique qual coluna tem a SPE (e, se quiser, uma
  coluna de data pra filtrar), e o painel cruza cada SPE com os dados mais recentes do
  Ravex - mostra se está alocada, status, origem/destino, cavalo/carreta etc. Dá pra
  exportar o resultado numa planilha nova.
- **Verificação diária**: configura uma vez (pasta do Outlook + filtro de assunto
  opcional + qual coluna é a SPE/qual é a data) e, a partir daí, toda vez que o painel
  abrir, ele confere sozinho se já rodou hoje - se não, busca o e-mail mais recente
  dessa pasta com uma planilha em anexo, filtra pela data de hoje, cruza as SPEs com o
  Ravex (mesma lógica da busca acima) e deixa uma planilha pronta em
  `data/downloads/cabotagem-resultado_<data>.xlsx`, pra você conferir e enviar por
  e-mail. Também dá pra clicar em "Rodar agora" a qualquer momento.
- **E-mails**: busca e-mails numa pasta do Outlook por palavra-chave (assunto ou
  corpo) - por exemplo "programação, cabotagem" - e lista assunto/remetente/data/se
  tem anexo.

> Isso usa a mesma automação local do Outlook que a Coleta do CT-e já usava
> (`cte-czar/cli.py`, comandos `buscar-anexo` e `buscar-emails`) - ou seja, é o
> **Outlook instalado no Windows**, não o Outlook Web. Uma integração com o Outlook
> Web/Microsoft Graph exigiria cadastrar um aplicativo no Azure AD da empresa e pedir
> permissão de acesso ao e-mail - bem mais complexo, e provavelmente precisaria da
> aprovação do TI. Se um dia isso for necessário, dá pra revisitar.

## Se as colunas da planilha tiverem nomes diferentes

O sistema tenta reconhecer as colunas automaticamente (`server/services/excelParser.js`,
constante `FIELD_KEYWORDS`) por palavras-chave, então pequenas variações no nome do
cabeçalho (ex: "Posição Atual" vs "Posição atual do veículo") já são cobertas. Se uma
coluna não for reconhecida - ou for reconhecida errada -, ajuste em **Configurações →
Mapeamento de colunas** (sem precisar mexer em código), ou adicione a palavra-chave
certa em `FIELD_KEYWORDS`.

> Cuidado ao adicionar palavra-chave nova: prefira termos completos a abreviações
> curtas. Uma keyword como `"eta"` parece segura, mas bate por substring dentro de
> "carr**eta**" e rouba a coluna errada - foi exatamente esse bug que corrigimos aqui.
> Cada campo agora tem uma lista `exclude` opcional pra resolver colisões assim (ex:
> `placa` exclui cabeçalhos que contenham "carreta"/"reboque").

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
- As fronteiras dos estados no mapa vêm de um TopoJSON simplificado de domínio público
  ([gist de ppKrauss](https://gist.github.com/ppKrauss/0c33364240e841fa23e78b21005f792c)),
  já salvo localmente em `public/data/br-states-topo.json` (8KB) - servido pelo próprio
  painel, sem depender do gist em tempo de execução (só a biblioteca `topojson-client`,
  que converte o arquivo, vem de CDN - igual ao Leaflet).
- `npm audit` mostra uma vulnerabilidade moderada indireta (via `uuid`, dependência do
  `exceljs`) sem correção estável disponível ainda; risco baixo pro uso deste projeto
  (não expõe rede, uso pessoal).

## Publicando no GitHub

O projeto tem `git init` feito e commits locais nesta máquina - isso é tudo que dá
pra fazer sem você. Faltam duas coisas que só você pode fazer, porque exigem sua
conta do GitHub:

1. **Criar o repositório vazio** em github.com (Novo repositório → não marque
   "adicionar README" pra não conflitar com o que já existe aqui) e me passar a URL
   (ex: `https://github.com/seu-usuario/painel-cesar-augusto.git`).
2. **Autenticar uma vez**: quando o `git push` rodar, o Git Credential Manager (já
   instalado nesta máquina) vai abrir uma janela do navegador pedindo pra você
   logar no GitHub. Só acontece na primeira vez - depois fica salvo.

Com a URL em mãos, rode (ou peça pra eu rodar):

```
git remote add origin <url-do-seu-repositorio>
git push -u origin main
```

Confira antes com `git status` que `.env`, `config/secrets.json`,
`config/launcher.json` e `cte-czar/venv/` não aparecem na lista (devem estar
ignorados). Nunca force a inclusão deles.
