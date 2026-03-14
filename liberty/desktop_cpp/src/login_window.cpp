/*
 * login_window.cpp - Tela de login com globo 3D
 */

#include "login_window.h"
#include "globe_gl.h"
#include "styles.h"
#include <QPainter>
#include <QRadialGradient>
#include <QMouseEvent>

namespace Liberty {

// GlobeGLWidget Implementation
GlobeGLWidget::GlobeGLWidget(QWidget* parent)
    : QOpenGLWidget(parent)
{
    m_globe = globe_create();
    m_timer = new QTimer(this);
    connect(m_timer, &QTimer::timeout, this, [this]() {
        globe_update((GlobeData*)m_globe);
        update();
    });
    m_timer->start(16); // ~60 FPS
    setMinimumSize(400, 400);
}

GlobeGLWidget::~GlobeGLWidget() {
    globe_destroy((GlobeData*)m_globe);
}

void GlobeGLWidget::initializeGL() {
    globe_init_gl();
}

void GlobeGLWidget::resizeGL(int w, int h) {
    globe_resize((GlobeData*)m_globe, w, h);
}

void GlobeGLWidget::paintGL() {
    globe_render((GlobeData*)m_globe);
}

void GlobeGLWidget::mousePressEvent(QMouseEvent* event) {
    globe_set_auto_rotate((GlobeData*)m_globe, 0);
    m_lastPos = event->pos();
}

void GlobeGLWidget::mouseMoveEvent(QMouseEvent* event) {
    if (event->buttons() & Qt::LeftButton) {
        float dx = event->x() - m_lastPos.x();
        float dy = event->y() - m_lastPos.y();
        globe_rotate((GlobeData*)m_globe, dx, dy);
        m_lastPos = event->pos();
        update();
    }
}

void GlobeGLWidget::mouseReleaseEvent(QMouseEvent* event) {
    Q_UNUSED(event);
    globe_set_auto_rotate((GlobeData*)m_globe, 1);
}

// LoginWindow Implementation
LoginWindow::LoginWindow(QWidget* parent)
    : QWidget(parent)
{
    setupUI();
}

void LoginWindow::setupUI() {
    auto* layout = new QHBoxLayout(this);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(0);
    
    // Painel esquerdo - Globo
    auto* leftPanel = new QFrame();
    leftPanel->setObjectName("globe_panel");
    
    auto* leftLayout = new QVBoxLayout(leftPanel);
    leftLayout->setContentsMargins(40, 40, 40, 40);
    leftLayout->setSpacing(10);
    
    auto* globeTitle = new QLabel("Conecte-se ao Mundo");
    globeTitle->setObjectName("globe_title");
    globeTitle->setAlignment(Qt::AlignCenter);
    leftLayout->addWidget(globeTitle);
    
    auto* globeSubtitle = new QLabel("Comunicação global, segura e privada");
    globeSubtitle->setObjectName("globe_subtitle");
    globeSubtitle->setAlignment(Qt::AlignCenter);
    leftLayout->addWidget(globeSubtitle);
    
    leftLayout->addSpacing(20);
    
    m_globeWidget = new GlobeGLWidget();
    leftLayout->addWidget(m_globeWidget, 1);
    
    leftLayout->addStretch();
    
    auto* securityInfo = new QLabel("🔒 Criptografia ponta-a-ponta");
    securityInfo->setObjectName("security_info");
    securityInfo->setAlignment(Qt::AlignCenter);
    leftLayout->addWidget(securityInfo);
    
    layout->addWidget(leftPanel, 1);
    
    // Painel direito - Formulário
    auto* rightPanel = new QFrame();
    rightPanel->setObjectName("login_form_panel");
    
    auto* rightLayout = new QVBoxLayout(rightPanel);
    rightLayout->setContentsMargins(60, 80, 60, 60);
    rightLayout->setSpacing(20);
    
    rightLayout->addStretch();
    
    // Logo pequeno
    auto* logoLabel = new QLabel();
    logoLabel->setPixmap(createSmallLogo());
    logoLabel->setAlignment(Qt::AlignCenter);
    rightLayout->addWidget(logoLabel);
    
    // Título
    auto* title = new QLabel("Bem-vindo");
    title->setObjectName("login_title");
    title->setAlignment(Qt::AlignCenter);
    rightLayout->addWidget(title);
    
    auto* subtitle = new QLabel("Entre com sua conta para continuar");
    subtitle->setObjectName("login_subtitle");
    subtitle->setAlignment(Qt::AlignCenter);
    rightLayout->addWidget(subtitle);
    
    rightLayout->addSpacing(30);
    
    // Formulário
    auto* formLayout = new QVBoxLayout();
    formLayout->setSpacing(16);
    
    m_emailInput = new QLineEdit();
    m_emailInput->setPlaceholderText("Email");
    m_emailInput->setFixedHeight(48);
    formLayout->addWidget(m_emailInput);
    
    m_passwordInput = new QLineEdit();
    m_passwordInput->setPlaceholderText("Senha");
    m_passwordInput->setEchoMode(QLineEdit::Password);
    m_passwordInput->setFixedHeight(48);
    formLayout->addWidget(m_passwordInput);
    
    m_loginBtn = new QPushButton("Entrar");
    m_loginBtn->setObjectName("login_btn");
    m_loginBtn->setFixedHeight(48);
    m_loginBtn->setCursor(Qt::PointingHandCursor);
    connect(m_loginBtn, &QPushButton::clicked, this, &LoginWindow::onLoginClicked);
    formLayout->addWidget(m_loginBtn);
    
    rightLayout->addLayout(formLayout);
    
    // Divisor
    auto* dividerLayout = new QHBoxLayout();
    auto* line1 = new QFrame();
    line1->setObjectName("divider_line");
    line1->setFrameShape(QFrame::HLine);
    line1->setFixedHeight(1);
    
    auto* orLabel = new QLabel("ou");
    orLabel->setObjectName("or_label");
    orLabel->setAlignment(Qt::AlignCenter);
    
    auto* line2 = new QFrame();
    line2->setObjectName("divider_line");
    line2->setFrameShape(QFrame::HLine);
    line2->setFixedHeight(1);
    
    dividerLayout->addWidget(line1);
    dividerLayout->addWidget(orLabel);
    dividerLayout->addWidget(line2);
    rightLayout->addLayout(dividerLayout);
    
    // Botão registrar
    m_registerBtn = new QPushButton("Criar nova conta");
    m_registerBtn->setObjectName("register_btn");
    m_registerBtn->setFixedHeight(48);
    m_registerBtn->setCursor(Qt::PointingHandCursor);
    connect(m_registerBtn, &QPushButton::clicked, this, &LoginWindow::onRegisterClicked);
    rightLayout->addWidget(m_registerBtn);
    
    rightLayout->addStretch();
    
    // Versão
    auto* version = new QLabel("LIBERTY v1.0.0");
    version->setObjectName("version_label");
    version->setAlignment(Qt::AlignCenter);
    rightLayout->addWidget(version);
    
    layout->addWidget(rightPanel, 1);
}

QPixmap LoginWindow::createSmallLogo() {
    QPixmap pixmap(80, 80);
    pixmap.fill(Qt::transparent);
    
    QPainter painter(&pixmap);
    painter.setRenderHint(QPainter::Antialiasing);
    
    QRadialGradient gradient(40, 40, 40);
    gradient.setColorAt(0, QColor(255, 255, 0));
    gradient.setColorAt(1, QColor(255, 215, 0));
    
    painter.setBrush(gradient);
    painter.setPen(Qt::NoPen);
    painter.drawEllipse(5, 5, 70, 70);
    
    painter.setPen(QColor(0, 0, 0));
    QFont font("Inter", 32, QFont::Bold);
    painter.setFont(font);
    painter.drawText(QRect(0, 0, 80, 80), Qt::AlignCenter, "L");
    
    painter.end();
    return pixmap;
}

void LoginWindow::onLoginClicked() {
    QString email = m_emailInput->text().trimmed();
    QString password = m_passwordInput->text();
    
    if (email.isEmpty() || password.isEmpty()) {
        // Mostrar erro
        return;
    }
    
    QString username = email.split('@').first();
    emit loginSuccess(username, email);
}

void LoginWindow::onRegisterClicked() {
    emit registerRequested();
}

} // namespace Liberty
