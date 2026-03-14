cmake_minimum_required(VERSION 3.16)
project(LIBERTY VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# Qt
find_package(Qt5 REQUIRED COMPONENTS Core Gui Widgets OpenGL)

# OpenGL
find_package(OpenGL REQUIRED)

# Sources
set(SOURCES
    src/main.cpp
    src/globe_gl.c
    src/splash_screen.cpp
    src/login_window.cpp
    src/main_window.cpp
    src/chat_widget.cpp
    src/styles.cpp
)

set(HEADERS
    src/globe_gl.h
    src/splash_screen.h
    src/login_window.h
    src/main_window.h
    src/chat_widget.h
    src/styles.h
)

# Executable
add_executable(liberty ${SOURCES} ${HEADERS})

target_include_directories(liberty PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${OPENGL_INCLUDE_DIRS}
)

target_link_libraries(liberty PRIVATE
    Qt5::Core
    Qt5::Gui
    Qt5::Widgets
    Qt5::OpenGL
    ${OPENGL_LIBRARIES}
)

# Install
install(TARGETS liberty DESTINATION bin)
