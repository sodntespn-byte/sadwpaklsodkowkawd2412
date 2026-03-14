/*
 * styles.h - Estilos do aplicativo LIBERTY
 */

#ifndef STYLES_H
#define STYLES_H

#include <QString>

namespace Liberty {
namespace Styles {

// Cores principais
const char* const COLOR_BLACK = "#000000";
const char* const COLOR_BLACK_SOFT = "#0a0a0a";
const char* const COLOR_BLACK_LIGHT = "#111111";
const char* const COLOR_BLACK_LIGHTER = "#1a1a1a";
const char* const COLOR_YELLOW = "#FFFF00";
const char* const COLOR_YELLOW_DARK = "#FFD700";
const char* const COLOR_WHITE = "#FFFFFF";
const char* const COLOR_GRAY = "#888888";
const char* const COLOR_GRAY_DARK = "#666666";

// Estilos CSS
QString getMainStyle();
QString getSplashStyle();
QString getLoginStyle();
QString getMainWindowStyle();

} // namespace Styles
} // namespace Liberty

#endif // STYLES_H
