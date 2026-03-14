@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado.
    pause
    exit /b 1
)

pip show pyinstaller >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando PyInstaller...
    pip install pyinstaller
)

pip install -r requirements.txt

echo Compilando...
pyinstaller --onefile --windowed --name Liberty --icon=assets/logo.png --add-data "assets/logo.png;assets" --add-data "..\web;web" --hidden-import=PyQt5.QtWebEngineWidgets --hidden-import=PyQt5.QtWebEngineCore --hidden-import=OpenGL --hidden-import=OpenGL.GL --hidden-import=OpenGL.GLU main.py

if %errorlevel% neq 0 (
    echo [ERRO] Falha na compilacao.
    pause
    exit /b 1
)

echo Concluido! Executavel em: dist\Liberty.exe
pause
