@echo off
REM Uso diario: da 2 cliques (ou crie um atalho deste arquivo na Area de Trabalho).
REM Liga o servidor local se ainda nao estiver rodando e abre o painel numa
REM janela "de app" (sem barra de endereco), parecido com um programa proprio.
cd /d "%~dp0.."

set PORT=4173

netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo Servidor ja estava rodando.
) else (
  echo Iniciando servidor...
  start "Painel Ravex - servidor" /min cmd /c "npm start"
  timeout /t 3 /nobreak >nul
)

REM tenta abrir no Edge (vem com o Windows); se preferir Chrome, troque "msedge" por "chrome"
REM --start-fullscreen abre direto em tela cheia real (igual apertar F11), sem
REM precisar maximizar na mao
start msedge --app=http://localhost:%PORT%/index.html --start-fullscreen
