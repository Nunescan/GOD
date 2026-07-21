@echo off
REM Abre o servidor numa janela visivel, com os logs aparecendo -
REM util pra testar/depurar (ex: primeira vez rodando a automacao do Ravex).
cd /d "%~dp0.."
call npm start
pause
