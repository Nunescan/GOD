@echo off
REM Rode este arquivo UMA VEZ pra preparar o ambiente Python do CT-e (CZAR).
cd /d "%~dp0..\cte-czar"

echo === Criando ambiente virtual Python (venv)... ===
python -m venv venv
if errorlevel 1 goto erro

echo.
echo === Instalando dependencias... ===
call venv\Scripts\python.exe -m pip install --upgrade pip -q
call venv\Scripts\python.exe -m pip install -r requirements.txt -q
if errorlevel 1 goto erro

echo.
echo Pronto! Agora use o botao "Rodar CZAR" na aba CT-e do painel.
echo.
echo IMPORTANTE: a leitura automatica de numero de CT-e por OCR (aba Login)
echo precisa do Tesseract-OCR instalado nesta maquina. Se ainda nao tiver,
echo baixe em: https://github.com/UB-Mannheim/tesseract/wiki
echo O instalador normalmente oferece "adicionar ao PATH" - marque essa opcao
echo e vai funcionar sozinho. Se marcar caminho customizado, defina a variavel
echo de ambiente do Windows TESSERACT_CMD apontando pro tesseract.exe.
pause
exit /b 0

:erro
echo.
echo Algo deu errado na instalacao. Veja a mensagem de erro acima.
pause
exit /b 1
