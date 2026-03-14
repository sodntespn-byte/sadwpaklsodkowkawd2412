@echo off
REM Coloca CMD em background (minimizado) - Loading Screen aparece no lugar
if "%1"=="" (start /min cmd /c "%~f0" _run & exit /b)
cd /d "%~dp0"

set PY=python
set PYLAUNCH=pythonw
where python >nul 2>&1
if %errorlevel% neq 0 (
    where py >nul 2>&1
    if %errorlevel% equ 0 (set PY=py -3) else (
        echo [ERRO] Python nao encontrado. Instale em python.org
        pause
        exit /b 1
    )
)

where pythonw >nul 2>&1
if %errorlevel% neq 0 (
    where pyw >nul 2>&1
    if %errorlevel% equ 0 (set PYLAUNCH=pyw -3) else (set PYLAUNCH=%PY%)
)

%PY% -c "import PyQt5.QtWebEngineWidgets" 2>nul
if %errorlevel% neq 0 (
    echo Instalando dependencias...
    %PY% -m pip install -r requirements.txt -q
)

REM pythonw inicia sem console - SplashScreen (Loading) aparece imediatamente
start "" /b %PYLAUNCH% main.py
