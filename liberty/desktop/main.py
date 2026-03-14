#!/usr/bin/env python3
"""
LIBERTY - Aplicativo Desktop
Design aconchegante com globo 3D
"""

import sys
import json
import os
import subprocess
import platform
from datetime import datetime
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QTextEdit, QScrollArea,
    QFrame, QStackedWidget, QSizePolicy, QMessageBox, QFileDialog,
    QComboBox, QSlider, QCheckBox, QGridLayout, QSpacerItem,
    QGraphicsDropShadowEffect, QSplitter
)
from PyQt5.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve, QSize, QRect, QPoint
from PyQt5.QtGui import (
    QColor, QFont, QPalette, QPixmap, QPainter, QBrush,
    QLinearGradient, QRadialGradient, QPainterPath, QFontDatabase, QIcon
)

# Importar o widget do globo (opcional - fallback se OpenGL não instalado)
try:
    from globe_widget import GlobeWidget
except ImportError:
    GlobeWidget = None

# Caminho da logo e pasta web (PyInstaller: sys._MEIPASS quando compilado)
_BASE = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(_BASE, "assets", "logo.png")
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web") if not getattr(sys, "frozen", False) else os.path.join(_BASE, "web")
INDEX_PATH = os.path.join(WEB_DIR, "index.html")

# Config e persistência de usuário
def _config_dir():
    if platform.system() == "Windows":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
    else:
        base = os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config"))
    return os.path.join(base, "Liberty")

def _config_path():
    return os.path.join(_config_dir(), "config.json")

def get_hardware_uuid():
    """Retorna UUID único do hardware (Windows/Linux/Mac)"""
    try:
        if platform.system() == "Windows":
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if platform.system() == "Windows" else 0
            r = subprocess.run(
                ["powershell", "-Command", "(Get-WmiObject Win32_ComputerSystemProduct).UUID"],
                capture_output=True, text=True, timeout=5, creationflags=flags
            )
            if r.returncode == 0 and r.stdout:
                return r.stdout.strip().split()[-1] if r.stdout.strip() else ""
        elif platform.system() == "Linux":
            p = "/sys/class/dmi/id/product_uuid"
            if os.path.exists(p):
                with open(p) as f:
                    return f.read().strip()
        elif platform.system() == "Darwin":
            r = subprocess.run(["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"], capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                for line in r.stdout.splitlines():
                    if "IOPlatformUUID" in line:
                        return line.split('"')[-2]
    except Exception:
        pass
    return str(os.getpid()) + platform.node()

def load_config():
    p = _config_path()
    if os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"quick_login_enabled": True, "users_by_uuid": {}, "last_user": None}

def save_config(cfg):
    d = _config_dir()
    os.makedirs(d, exist_ok=True)
    with open(_config_path(), "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

try:
    from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineProfile, QWebEnginePage
    from PyQt5.QtWebEngineCore import QWebEngineSettings
    from PyQt5.QtCore import QUrl
    HAS_WEBENGINE = True
except ImportError:
    HAS_WEBENGINE = False


class AnimatedWidget(QWidget):
    """Widget com animações suaves"""
    def fade_in(self, duration=300):
        self.effect = QGraphicsDropShadowEffect()
        self.effect.setBlurRadius(0)
        self.effect.setColor(QColor(255, 255, 0, 0))
        self.setGraphicsEffect(self.effect)

        self.anim = QPropertyAnimation(self.effect, b"blurRadius")
        self.anim.setDuration(duration)
        self.anim.setStartValue(0)
        self.anim.setEndValue(20)
        self.anim.setEasingCurve(QEasingCurve.OutCubic)
        self.anim.start()


class FocusMixin:
    """Ao clicar no app, traz para frente e foca"""
    def focusInEvent(self, event):
        super().focusInEvent(event)
        self.raise_()
        self.activateWindow()


class SplashScreen(FocusMixin, QWidget):
    """Tela de carregamento - aparece antes do app (substitui CMD)"""
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setStyleSheet("background: #000;")
        self.setMinimumSize(400, 500)
        self.resize(500, 600)

        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        container = QFrame()
        container.setObjectName("splash_container")
        container_layout = QVBoxLayout(container)
        container_layout.setSpacing(20)
        container_layout.setContentsMargins(40, 60, 40, 40)

        logo_label = QLabel()
        logo_pixmap = self.create_logo()
        logo_label.setPixmap(logo_pixmap)
        logo_label.setAlignment(Qt.AlignCenter)
        container_layout.addWidget(logo_label)

        title = QLabel("LIBERTY")
        title.setObjectName("splash_title")
        title.setAlignment(Qt.AlignCenter)
        container_layout.addWidget(title)

        subtitle = QLabel("Comunicação Segura & Privada")
        subtitle.setObjectName("splash_subtitle")
        subtitle.setAlignment(Qt.AlignCenter)
        container_layout.addWidget(subtitle)

        self.progress_frame = QFrame()
        self.progress_frame.setObjectName("progress_frame")
        progress_layout = QVBoxLayout(self.progress_frame)
        self.progress_bar = QFrame()
        self.progress_bar.setObjectName("progress_bar")
        self.progress_bar.setFixedHeight(4)
        self.progress_bar.setFixedWidth(0)
        progress_layout.addWidget(self.progress_bar)
        container_layout.addWidget(self.progress_frame)

        self.status_label = QLabel("Carregando...")
        self.status_label.setObjectName("status_label")
        self.status_label.setAlignment(Qt.AlignCenter)
        container_layout.addWidget(self.status_label)
        container_layout.addStretch()
        layout.addWidget(container)

        self.progress_anim = QPropertyAnimation(self.progress_bar, b"maximumWidth")
        self.progress_anim.setDuration(2000)
        self.progress_anim.setStartValue(0)
        self.progress_anim.setEndValue(300)

    def create_logo(self):
        if os.path.exists(LOGO_PATH):
            pixmap = QPixmap(LOGO_PATH)
            return pixmap.scaled(120, 120, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        return QPixmap(120, 120)

    def start_animation(self, callback):
        self.progress_anim.start()
        messages = ["Inicializando...", "Carregando componentes...", "Preparando interface...", "Configurando segurança...", "Pronto!"]
        for i, msg in enumerate(messages):
            QTimer.singleShot(i * 400, lambda m=msg: self.status_label.setText(m))
        QTimer.singleShot(2200, callback)


class LoginWindow(FocusMixin, QWidget):
    """Tela de login com globo 3D - responsiva"""
    def __init__(self):
        super().__init__()
        self.setObjectName("login_window")
        self.setMinimumSize(500, 400)
        self.init_ui()

    def init_ui(self):
        self.main_layout = QHBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self.main_layout.setSpacing(0)

        self.left_panel = QFrame()
        self.left_panel.setObjectName("globe_panel")
        self.left_panel.setMinimumWidth(200)
        self.left_panel.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        left_layout = QVBoxLayout(self.left_panel)
        left_layout.setContentsMargins(40, 40, 40, 40)

        globe_title = QLabel("Conecte-se ao Mundo")
        globe_title.setObjectName("globe_title")
        globe_title.setAlignment(Qt.AlignCenter)
        left_layout.addWidget(globe_title)
        globe_subtitle = QLabel("Comunicação global, segura e privada")
        globe_subtitle.setObjectName("globe_subtitle")
        globe_subtitle.setAlignment(Qt.AlignCenter)
        left_layout.addWidget(globe_subtitle)
        left_layout.addSpacing(20)

        if GlobeWidget:
            self.globe = GlobeWidget()
        else:
            self.globe = self._create_globe_placeholder()
        self.globe.setMinimumSize(200, 200)
        self.globe.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        left_layout.addWidget(self.globe, 1)
        left_layout.addStretch()

        security_info = QLabel("🔒 Criptografia ponta-a-ponta")
        security_info.setObjectName("security_info")
        security_info.setAlignment(Qt.AlignCenter)
        left_layout.addWidget(security_info)
        self.main_layout.addWidget(self.left_panel, 1)

        right_panel = QFrame()
        right_panel.setObjectName("login_form_panel")
        right_panel.setMinimumWidth(280)
        right_panel.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(60, 80, 60, 60)
        right_layout.setSpacing(20)
        right_layout.addStretch()

        logo_label = QLabel()
        logo_label.setPixmap(self.create_small_logo())
        logo_label.setAlignment(Qt.AlignCenter)
        right_layout.addWidget(logo_label)
        title = QLabel("Bem-vindo")
        title.setObjectName("login_title")
        title.setAlignment(Qt.AlignCenter)
        right_layout.addWidget(title)
        subtitle = QLabel("Entre com sua conta para continuar")
        subtitle.setObjectName("login_subtitle")
        subtitle.setAlignment(Qt.AlignCenter)
        right_layout.addWidget(subtitle)
        right_layout.addSpacing(30)

        self.login_form = QFrame()
        login_layout = QVBoxLayout(self.login_form)
        login_layout.setSpacing(16)
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("Nome")
        self.name_input.setObjectName("login_input")
        self.name_input.setFixedHeight(48)
        login_layout.addWidget(self.name_input)
        self.login_btn = QPushButton("Entrar")
        self.login_btn.setObjectName("login_btn")
        self.login_btn.setFixedHeight(48)
        self.login_btn.setCursor(Qt.PointingHandCursor)
        login_layout.addWidget(self.login_btn)
        right_layout.addWidget(self.login_form)

        divider_layout = QHBoxLayout()
        line1 = QFrame()
        line1.setFrameShape(QFrame.HLine)
        line1.setObjectName("divider_line")
        or_label = QLabel("ou")
        or_label.setObjectName("or_label")
        or_label.setAlignment(Qt.AlignCenter)
        line2 = QFrame()
        line2.setFrameShape(QFrame.HLine)
        line2.setObjectName("divider_line")
        divider_layout.addWidget(line1)
        divider_layout.addWidget(or_label)
        divider_layout.addWidget(line2)
        right_layout.addLayout(divider_layout)

        self.register_btn = QPushButton("Criar nova conta")
        self.register_btn.setObjectName("register_btn")
        self.register_btn.setFixedHeight(48)
        self.register_btn.setCursor(Qt.PointingHandCursor)
        right_layout.addWidget(self.register_btn)
        right_layout.addStretch()

        self.config_btn = QPushButton("Configurações")
        self.config_btn.setObjectName("link_btn")
        self.config_btn.setCursor(Qt.PointingHandCursor)
        self.config_btn.setFixedHeight(36)
        right_layout.addWidget(self.config_btn)

        version = QLabel("LIBERTY v1.0.0")
        version.setObjectName("version_label")
        version.setAlignment(Qt.AlignCenter)
        right_layout.addWidget(version)
        self.main_layout.addWidget(right_panel, 1)

    def create_small_logo(self):
        if os.path.exists(LOGO_PATH):
            pixmap = QPixmap(LOGO_PATH)
            return pixmap.scaled(80, 80, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        return QPixmap(80, 80)

    def _create_globe_placeholder(self):
        placeholder = QFrame()
        placeholder.setObjectName("globe_placeholder")
        layout = QVBoxLayout(placeholder)
        layout.setAlignment(Qt.AlignCenter)
        if os.path.exists(LOGO_PATH):
            logo = QLabel()
            logo.setPixmap(QPixmap(LOGO_PATH).scaled(200, 200, Qt.KeepAspectRatio, Qt.SmoothTransformation))
            logo.setAlignment(Qt.AlignCenter)
            layout.addWidget(logo)
        hint = QLabel("Instale PyOpenGL para o globo 3D")
        hint.setAlignment(Qt.AlignCenter)
        hint.setStyleSheet("font-size: 12px; color: #666;")
        layout.addWidget(hint)
        return placeholder


class QuickLoginWarningWindow(FocusMixin, QWidget):
    """Aviso ao entrar via Quick Login (UUID) - estilo Identity Verified"""
    def __init__(self, user_data, on_continue, on_go_login):
        super().__init__()
        self.user_data = user_data
        self.on_continue = on_continue
        self.on_go_login = on_go_login
        self.setObjectName("quick_login_warning")
        self.setStyleSheet("#quick_login_warning { background: #000; }")
        self.setMinimumSize(520, 520)
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(60, 50, 60, 50)
        layout.setSpacing(16)

        # Logo
        if os.path.exists(LOGO_PATH):
            logo_label = QLabel()
            logo_label.setPixmap(QPixmap(LOGO_PATH).scaled(80, 80, Qt.KeepAspectRatio, Qt.SmoothTransformation))
            logo_label.setAlignment(Qt.AlignCenter)
            layout.addWidget(logo_label)

        # App title
        app_title = QLabel("LIBERTY")
        app_title.setAlignment(Qt.AlignCenter)
        app_title.setStyleSheet("font-size: 16px; font-weight: bold; color: #FFC107;")
        layout.addWidget(app_title)

        # Divider
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setStyleSheet("background: #FFC107; max-height: 1px;")
        layout.addWidget(line)

        # Main heading
        heading = QLabel("Identidade Verificada")
        heading.setAlignment(Qt.AlignCenter)
        heading.setStyleSheet("font-size: 28px; font-weight: bold; color: #FFC107;")
        layout.addWidget(heading)

        # Welcome + user
        username = self.user_data.get("username", "Usuário")
        welcome = QLabel(f"Bem-vindo de volta, {username}")
        welcome.setAlignment(Qt.AlignCenter)
        welcome.setStyleSheet("font-size: 14px; color: #B8860B;")
        layout.addWidget(welcome)

        # Short divider
        line2 = QFrame()
        line2.setFrameShape(QFrame.HLine)
        line2.setFixedHeight(1)
        line2.setMaximumWidth(200)
        line2.setStyleSheet("background: #FFC107;")
        line2_layout = QHBoxLayout()
        line2_layout.addStretch()
        line2_layout.addWidget(line2)
        line2_layout.addStretch()
        layout.addLayout(line2_layout)

        # Warning box
        warning_frame = QFrame()
        warning_frame.setStyleSheet(
            "QFrame { background: #2a2200; border: 2px solid #A07D0B; border-radius: 8px; padding: 16px; }"
        )
        warning_layout = QVBoxLayout(warning_frame)
        warning_layout.setContentsMargins(20, 16, 20, 16)
        warning_msg = QLabel(
            "Esta sessão foi autenticada via Hardware UUID.\n\n"
            "Não prossiga se você não for o dono desta conta."
        )
        warning_msg.setAlignment(Qt.AlignCenter)
        warning_msg.setWordWrap(True)
        warning_msg.setStyleSheet("color: #B8860B; font-size: 13px; line-height: 1.5;")
        warning_layout.addWidget(warning_msg)
        layout.addWidget(warning_frame)

        layout.addSpacing(24)

        # Buttons row
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(16)

        continue_btn = QPushButton("Continuar")
        continue_btn.setStyleSheet(
            "QPushButton { background: #FFC107; color: #000; border: none; border-radius: 8px; "
            "font-size: 14px; font-weight: bold; padding: 12px 32px; }"
            "QPushButton:hover { background: #FFD54F; }"
        )
        continue_btn.setFixedHeight(48)
        continue_btn.setCursor(Qt.PointingHandCursor)
        continue_btn.clicked.connect(self._do_continue)
        btn_layout.addWidget(continue_btn)

        login_btn = QPushButton("Usar Login")
        login_btn.setStyleSheet(
            "QPushButton { background: #1a1a1a; color: #FFC107; border: 2px solid #A07D0B; border-radius: 8px; "
            "font-size: 14px; font-weight: bold; padding: 12px 32px; }"
            "QPushButton:hover { background: #252525; }"
        )
        login_btn.setFixedHeight(48)
        login_btn.setCursor(Qt.PointingHandCursor)
        login_btn.clicked.connect(self._do_go_login)
        btn_layout.addWidget(login_btn)

        layout.addLayout(btn_layout)

    def _do_continue(self):
        self.close()
        self.on_continue(self.user_data)

    def _do_go_login(self):
        self.close()
        self.on_go_login()


class ConfigWindow(FocusMixin, QWidget):
    """Configurações - Quick login por Hardware UUID"""
    def __init__(self, parent_app):
        super().__init__()
        self.parent_app = parent_app
        self.setObjectName("register_window")
        self.setMinimumSize(380, 280)
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 30, 40, 30)
        layout.setSpacing(20)
        title = QLabel("Configurações")
        title.setObjectName("auth_title")
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)

        self.quick_login_cb = QCheckBox("Quick login (entrar com Hardware UUID)")
        self.quick_login_cb.setObjectName("auth_input")
        self.quick_login_cb.setStyleSheet("color: #fff;")
        self.quick_login_cb.setChecked(load_config().get("quick_login_enabled", True))
        layout.addWidget(self.quick_login_cb)

        hint = QLabel("Quando ativado, ao fazer login sua conta fica vinculada a este computador. Na próxima vez, entrará automaticamente sem senha.")
        hint.setWordWrap(True)
        hint.setStyleSheet("font-size: 11px; color: #888;")
        layout.addWidget(hint)

        uuid_label = QLabel(f"UUID deste dispositivo: {get_hardware_uuid()[:20]}...")
        uuid_label.setStyleSheet("font-size: 10px; color: #666;")
        layout.addWidget(uuid_label)

        layout.addStretch()
        self.back_btn = QPushButton("Voltar")
        self.back_btn.setObjectName("link_btn")
        self.back_btn.setCursor(Qt.PointingHandCursor)
        self.back_btn.clicked.connect(self.save_and_close)
        layout.addWidget(self.back_btn)

    def save_and_close(self):
        cfg = load_config()
        enabled = self.quick_login_cb.isChecked()
        cfg["quick_login_enabled"] = enabled
        if not enabled:
            hw_uuid = get_hardware_uuid()
            if hw_uuid and hw_uuid in cfg.get("users_by_uuid", {}):
                del cfg["users_by_uuid"][hw_uuid]
        save_config(cfg)
        self.close()


class RegisterWindow(FocusMixin, QWidget):
    """Tela de registro - responsiva"""
    def __init__(self):
        super().__init__()
        self.setObjectName("register_window")
        self.setMinimumSize(320, 450)
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 30, 40, 30)
        layout.setSpacing(20)
        title = QLabel("Criar Conta")
        title.setObjectName("auth_title")
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)
        hint = QLabel("Email, senha e HWID podem ser adicionados depois em Configurações > MultiFactor Authentication.")
        hint.setWordWrap(True)
        hint.setStyleSheet("font-size: 11px; color: #888;")
        layout.addWidget(hint)
        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Nome")
        self.username_input.setObjectName("auth_input")
        self.username_input.setFixedHeight(48)
        layout.addWidget(self.username_input)
        self.create_btn = QPushButton("Criar Conta")
        self.create_btn.setObjectName("primary_btn")
        self.create_btn.setFixedHeight(48)
        self.create_btn.setCursor(Qt.PointingHandCursor)
        layout.addWidget(self.create_btn)
        self.back_btn = QPushButton("Voltar ao login")
        self.back_btn.setObjectName("link_btn")
        self.back_btn.setCursor(Qt.PointingHandCursor)
        layout.addWidget(self.back_btn)
        layout.addStretch()


class MainWindow(FocusMixin, QMainWindow):
    """Janela principal - carrega UI do web (chat, canais, mensagens)"""
    def __init__(self, user_data, app=None):
        super().__init__()
        self.user = user_data
        self.app = app
        self.setObjectName("main_window")
        if HAS_WEBENGINE and os.path.exists(INDEX_PATH):
            self._init_web_view()
        else:
            self._init_fallback()

    def _init_web_view(self):
        """Carrega a UI do web (área de mensagens, canais, etc.)"""
        storage_dir = os.path.join(_config_dir(), "webstorage")
        os.makedirs(storage_dir, exist_ok=True)
        profile = QWebEngineProfile("Liberty", None)
        profile.setPersistentStoragePath(storage_dir)
        profile.setCachePath(os.path.join(storage_dir, "cache"))
        page = QWebEnginePage(profile, None)
        self.view = QWebEngineView()
        self.view.setPage(page)
        settings = self.view.settings()
        settings.setAttribute(QWebEngineSettings.LocalStorageEnabled, True)
        settings.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        self.view.loadFinished.connect(self._on_load_finished)
        url = QUrl.fromLocalFile(os.path.abspath(INDEX_PATH))
        self.view.load(url)
        self.setCentralWidget(self.view)

    def _build_web_user(self):
        """Monta objeto user completo para o app web (igual ao web login/register)"""
        username = self.user.get("username", "Usuário")
        tag = self.user.get("tag") or "#" + str(abs(hash(username + (self.user.get("email") or "")) % 10000)).zfill(4)
        return {
            "id": self.user.get("id") or "desktop-" + username[:8] + "-" + str(abs(hash(self.user.get("email", ""))) % 10000),
            "username": username,
            "tag": tag,
            "email": self.user.get("email", ""),
            "avatar": self.user.get("avatar"),
            "banner": self.user.get("banner"),
            "bio": self.user.get("bio", ""),
            "profileColor": self.user.get("profileColor", "#FFFF00"),
            "status": "online"
        }

    def _on_load_finished(self, ok):
        """Injeta usuário e mostra app (área de chat igual à versão web)"""
        if not ok:
            return
        user = self._build_web_user()
        user_json = json.dumps(user)
        js = f"""
        (function() {{
            var user = {user_json};
            localStorage.setItem('liberty_user', JSON.stringify(user));
            function show() {{
                if (window.app) {{
                    window.app.currentUser = user;
                    window.app.showApp();
                    window.app.updateUI();
                    return true;
                }}
                return false;
            }}
            if (!show()) setTimeout(function() {{ show(); }}, 100);
        }})();
        """
        self.view.page().runJavaScript(js)

    def _init_fallback(self):
        """Fallback se PyQtWebEngine não disponível - instalar ou voltar ao login"""
        central = QWidget()
        central.setStyleSheet("background: #000;")
        layout = QVBoxLayout(central)
        layout.setSpacing(24)
        layout.setContentsMargins(50, 50, 50, 50)

        msg = QLabel("PyQtWebEngine não encontrado.\nA interface completa requer este pacote.")
        msg.setAlignment(Qt.AlignCenter)
        msg.setStyleSheet("color: #fff; font-size: 14px;")
        layout.addWidget(msg)

        hint = QLabel("pip install PyQtWebEngine")
        hint.setAlignment(Qt.AlignCenter)
        hint.setStyleSheet("color: #888; font-size: 12px;")
        layout.addWidget(hint)

        install_btn = QPushButton("Instalar agora")
        install_btn.setStyleSheet(
            "QPushButton { background: #FFC107; color: #000; border: none; border-radius: 8px; "
            "font-weight: bold; padding: 12px; } QPushButton:hover { background: #FFD54F; }"
        )
        install_btn.setFixedHeight(48)
        install_btn.setCursor(Qt.PointingHandCursor)
        install_btn.clicked.connect(self._install_webengine)
        layout.addWidget(install_btn)

        if self.app:
            back_btn = QPushButton("Voltar ao login")
            back_btn.setStyleSheet(
                "QPushButton { background: transparent; color: #FFC107; border: 2px solid #A07D0B; "
                "border-radius: 8px; font-weight: bold; padding: 12px; } QPushButton:hover { background: #1a1a1a; }"
            )
            back_btn.setFixedHeight(48)
            back_btn.setCursor(Qt.PointingHandCursor)
            back_btn.clicked.connect(self._go_back_to_login)
            layout.addWidget(back_btn)

        layout.addStretch()
        self.setCentralWidget(central)

    def _install_webengine(self):
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "PyQtWebEngine"], check=True, capture_output=True)
            QMessageBox.information(self, "Sucesso", "PyQtWebEngine instalado.\nFeche e abra o app novamente.")
        except Exception:
            QMessageBox.warning(self, "Erro", "Falha na instalação.\nExecute no terminal:\npip install PyQtWebEngine")

    def _go_back_to_login(self):
        if self.app:
            self.close()
            self.app._show_login_window()


class LibertyApp(QApplication):
    """Aplicação principal"""
    def __init__(self, argv):
        super().__init__(argv)
        self.setStyle("Fusion")
        self.apply_theme()
        if os.path.exists(LOGO_PATH):
            self.setWindowIcon(QIcon(LOGO_PATH))
        self.splash = SplashScreen()
        if os.path.exists(LOGO_PATH):
            self.splash.setWindowIcon(QIcon(LOGO_PATH))
        self.splash.showMaximized()
        self.splash.start_animation(self.show_login)

    def apply_theme(self):
        palette = QPalette()
        black = QColor(0, 0, 0)
        black_light = QColor(17, 17, 17)
        black_lighter = QColor(26, 26, 26)
        white = QColor(255, 255, 255)
        yellow = QColor(255, 255, 0)
        palette.setColor(QPalette.Window, black)
        palette.setColor(QPalette.WindowText, white)
        palette.setColor(QPalette.Base, black_light)
        palette.setColor(QPalette.Text, white)
        palette.setColor(QPalette.Button, black_lighter)
        palette.setColor(QPalette.ButtonText, white)
        palette.setColor(QPalette.Highlight, yellow)
        palette.setColor(QPalette.HighlightedText, black)
        self.setPalette(palette)
        self.setStyleSheet("""
            #splash_container, #login_window, #register_window { background: #000; }
            #splash_container { border-radius: 20px; }
            #splash_title { font-size: 42px; font-weight: bold; color: #FFFF00; }
            #login_input, #auth_input { background: #111; border: 2px solid #1a1a1a; border-radius: 8px; color: #fff; }
            #login_btn, #primary_btn { background: #FFFF00; border: none; border-radius: 8px; color: #000; font-weight: bold; }
            #register_btn, #link_btn { background: transparent; border: 2px solid #FFFF00; color: #FFFF00; }
            #server_sidebar { background: #0a0a0a; }
            #channel_sidebar { background: #111; }
            #main_area { background: #000; }
            #message_input { background: #111; border: none; border-radius: 12px; color: #fff; }
            #send_btn { background: #FFFF00; border: none; border-radius: 20px; color: #000; }
            #message_frame { background: transparent; }
            #message_avatar { background: #FFFF00; border-radius: 20px; color: #000; }
            #message_text { color: #fff; }
            #welcome_message { font-size: 18px; color: #FFFF00; }
            QSplitter::handle { background: #1a1a1a; width: 2px; }
            QSplitter::handle:hover { background: #FFFF00; }
        """)

    def show_login(self):
        self.splash.hide()
        self.splash.close()
        cfg = load_config()
        hw_uuid = get_hardware_uuid()
        # Quick login: se habilitado e temos usuário vinculado, mostra aviso antes de entrar
        if cfg.get("quick_login_enabled", True) and hw_uuid and cfg.get("users_by_uuid", {}).get(hw_uuid):
            user = cfg["users_by_uuid"][hw_uuid]
            self._show_quick_login_warning(user)
            return
        self._show_login_window(cfg)

    def _show_quick_login_warning(self, user):
        """Mostra aviso de Quick Login com opção de ir para login normal"""
        def on_continue(u):
            self._show_main_direct(u)

        def on_go_login():
            self._show_login_window()

        self.quick_login_warning = QuickLoginWarningWindow(user, on_continue, on_go_login)
        if os.path.exists(LOGO_PATH):
            self.quick_login_warning.setWindowIcon(QIcon(LOGO_PATH))
        self.quick_login_warning.setWindowTitle("LIBERTY - Quick Login")
        self.quick_login_warning.showMaximized()
        self.quick_login_warning.raise_()
        self.quick_login_warning.activateWindow()

    def _show_login_window(self, cfg=None):
        if cfg is None:
            cfg = load_config()
        self.login_window = LoginWindow()
        if os.path.exists(LOGO_PATH):
            self.login_window.setWindowIcon(QIcon(LOGO_PATH))
        self.login_window.setWindowTitle("LIBERTY - Login")
        self.login_window.setMinimumSize(600, 450)
        if cfg.get("last_user"):
            self.login_window.name_input.setText(cfg["last_user"].get("username", ""))
        self.login_window.login_btn.clicked.connect(self.do_login)
        self.login_window.register_btn.clicked.connect(self.show_register)
        self.login_window.config_btn.clicked.connect(self.show_config)
        self.login_window.showMaximized()
        self.login_window.raise_()
        self.login_window.activateWindow()

    def _show_main_direct(self, user_data):
        """Mostra janela principal sem passar pelo login (quick login)"""
        self.main_window = MainWindow(user_data, self)
        if os.path.exists(LOGO_PATH):
            self.main_window.setWindowIcon(QIcon(LOGO_PATH))
        self.main_window.setWindowTitle("LIBERTY")
        self.main_window.setMinimumSize(800, 500)
        self.main_window.showMaximized()

    def show_config(self):
        self.config_window = ConfigWindow(self)
        if os.path.exists(LOGO_PATH):
            self.config_window.setWindowIcon(QIcon(LOGO_PATH))
        self.config_window.setWindowTitle("LIBERTY - Configurações")
        self.config_window.show()

    def show_register(self):
        self.register_window = RegisterWindow()
        if os.path.exists(LOGO_PATH):
            self.register_window.setWindowIcon(QIcon(LOGO_PATH))
        self.register_window.setWindowTitle("LIBERTY - Criar Conta")
        self.register_window.create_btn.clicked.connect(self.do_register)
        self.register_window.back_btn.clicked.connect(lambda: (self.register_window.close(), self.login_window.showMaximized()))
        self.login_window.hide()
        self.register_window.showMaximized()

    def _persist_user(self, user):
        """Salva usuário no config para persistência e quick login"""
        cfg = load_config()
        cfg["last_user"] = user
        if cfg.get("quick_login_enabled", True):
            hw_uuid = get_hardware_uuid()
            if hw_uuid:
                if "users_by_uuid" not in cfg:
                    cfg["users_by_uuid"] = {}
                cfg["users_by_uuid"][hw_uuid] = user
        save_config(cfg)

    def do_login(self):
        name = self.login_window.name_input.text().strip()
        if not name:
            QMessageBox.warning(self.login_window, "Erro", "Digite seu nome")
            return
        user = {'username': name, 'email': ''}
        self._persist_user(user)
        self.show_main(user)

    def do_register(self):
        username = self.register_window.username_input.text().strip()
        if not username:
            QMessageBox.warning(self.register_window, "Erro", "Digite seu nome")
            return
        user = {'username': username, 'email': ''}
        self._persist_user(user)
        self.register_window.close()
        self.show_main(user)

    def show_main(self, user_data):
        self.login_window.hide()
        self.main_window = MainWindow(user_data, self)
        if os.path.exists(LOGO_PATH):
            self.main_window.setWindowIcon(QIcon(LOGO_PATH))
        self.main_window.setWindowTitle("LIBERTY")
        self.main_window.setMinimumSize(800, 500)
        self.main_window.showMaximized()


def main():
    app = LibertyApp(sys.argv)
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
