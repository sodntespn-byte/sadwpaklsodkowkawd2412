#!/bin/bash
# LIBERTY Desktop App - Script de execução

cd "$(dirname "$0")"

echo "🚀 Iniciando LIBERTY..."
echo ""

# Verificar se as dependências estão instaladas
if ! python3 -c "import PyQt5" 2>/dev/null; then
    echo "📦 Instalando dependências..."
    pip3 install -r requirements.txt
fi

# Executar o app
python3 main.py
