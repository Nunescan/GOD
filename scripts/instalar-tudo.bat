@echo off
REM ============================================================
REM  INSTALADOR UNICO - Painel Cesar Augusto
REM  De 2 cliques neste arquivo UMA VEZ, na primeira vez que for
REM  usar o projeto nesta maquina. Ele baixa/instala tudo:
REM    - dependencias do servidor (Node.js)
REM    - navegador usado pra automatizar o login no Ravex (Playwright)
REM    - arquivo de configuracao (.env)
REM    - ambiente Python isolado do CT-e (CZAR)
REM ============================================================
cd /d "%~dp0.."

echo ============================================
echo   INSTALANDO O PAINEL CESAR AUGUSTO
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado nesta maquina.
  echo Instale em https://nodejs.org e rode este arquivo de novo.
  pause
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Python nao encontrado nesta maquina.
  echo Instale em https://python.org e rode este arquivo de novo.
  pause
  exit /b 1
)

echo [1/5] Instalando dependencias do servidor (npm install)...
call npm install
if errorlevel 1 goto erro

echo.
echo [2/5] Baixando navegador do Playwright (~300MB, so na primeira vez)...
call npx playwright install chromium
if errorlevel 1 goto erro

echo.
echo [3/5] Preparando arquivo de configuracao (.env)...
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Criado .env - as credenciais do Ravex podem ser preenchidas depois,
  echo direto pela tela de Configuracoes do painel.
) else (
  echo .env ja existe, mantendo como esta.
)

echo.
echo [4/5] Criando ambiente Python isolado do CT-e (cte-czar\venv)...
cd cte-czar
python -m venv venv
if errorlevel 1 goto erro_cte

echo.
echo [5/5] Instalando dependencias do CT-e...
call venv\Scripts\python.exe -m pip install --upgrade pip -q
call venv\Scripts\python.exe -m pip install -r requirements.txt -q
if errorlevel 1 goto erro_cte
cd ..

echo.
echo ============================================
echo   INSTALACAO CONCLUIDA!
echo ============================================
echo.
echo Proximos passos:
echo   1. De 2 cliques em scripts\abrir-painel.bat pra abrir o painel
echo   2. Na primeira vez, crie sua senha de acesso ao painel
echo   3. Va em Configuracoes e preencha suas credenciais do Ravex
echo.
echo (Opcional) Pra usar a leitura de CT-e por imagem (OCR) dentro do CT-e,
echo instale o Tesseract-OCR: https://github.com/UB-Mannheim/tesseract/wiki
echo.
pause
exit /b 0

:erro_cte
cd ..

:erro
echo.
echo ============================================
echo   ALGO DEU ERRADO NA INSTALACAO
echo ============================================
echo Veja a mensagem de erro acima.
pause
exit /b 1
