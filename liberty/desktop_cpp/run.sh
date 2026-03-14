#!/bin/bash
# LIBERTY Desktop App - Script de build e execução

set -e

echo "🚀 LIBERTY Desktop App"
echo ""

# Verificar dependências
check_deps() {
    echo "📦 Verificando dependências..."
    
    # Qt5
    if ! pkg-config --exists Qt5Widgets Qt5OpenGL Qt5Core Qt5Gui 2>/dev/null; then
        echo "❌ Qt5 não encontrado. Instale com:"
        echo "   sudo pacman -S qt5-base qt5-tools"
        echo "   ou"
        echo "   sudo apt install qt5-default qtbase5-dev libqt5opengl5-dev"
        exit 1
    fi
    
    # OpenGL
    if ! pkg-config --exists gl 2>/dev/null; then
        echo "❌ OpenGL não encontrado. Instale com:"
        echo "   sudo pacman -S mesa"
        echo "   ou"
        echo "   sudo apt install libgl1-mesa-dev"
        exit 1
    fi
    
    echo "✅ Dependências OK"
}

# Build com CMake
build_cmake() {
    echo ""
    echo "🔨 Build com CMake..."
    
    mkdir -p build
    cd build
    
    cmake ..
    make -j$(nproc)
    
    echo "✅ Build completo!"
}

# Executar
run() {
    echo ""
    echo "▶️  Iniciando LIBERTY..."
    ./build/liberty
}

# Main
cd "$(dirname "$0")"

check_deps
build_cmake
run
