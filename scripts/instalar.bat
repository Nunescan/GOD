@echo off
REM Rode este arquivo UMA VEZ, na primeira vez que for usar o projeto neste PC.
cd /d "%~dp0.."

echo === Instalando dependencias (npm install)... ===
call npm install
if errorlevel 1 goto erro

echo.
echo === Baixando navegador do Playwright (~300MB, so na primeira vez)... ===
call npx playwright install chromium
if errorlevel 1 goto erro

if not exist ".env" (
  echo.
  echo === Criando arquivo .env a partir do .env.example ===
  copy ".env.example" ".env" >nul
  echo IMPORTANTE: abra o arquivo .env e preencha seu usuario e senha do Ravex.
)

echo.
echo Tudo pronto! Use "scripts\abrir-painel.bat" para abrir o painel no dia a dia.
pause
exit /b 0

:erro
echo.
echo Algo deu errado na instalacao. Veja a mensagem de erro acima.
pause
exit /b 1
