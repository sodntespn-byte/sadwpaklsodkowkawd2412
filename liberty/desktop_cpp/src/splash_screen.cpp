/*
 * splash_screen.cpp - Tela de carregamento inicial
 */

#include "splash_screen.h"
#include "styles.h"
#include <QPainter>
#include <QRadialGradient>
#include <QGraphicsDropShadowEffect>
#include <QPainterPath>

namespace Liberty {

SplashScreen::SplashScreen(QWidget* parent)
    : QWidget(parent)
{
    setWindowFlags(Qt::FramelessWindowHint);
    setAttribute(Qt::WA_TranslucentBackground);
    setFixedSize(500, 600);
    
    setupUI();
}

void SplashScreen::setupUI() {
    auto* mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    
    m_container = new QFrame();
    m_container->setObjectName("splash_container");
    
    auto* layout = new QVBoxLayout(m_container);
    layout->setSpacing(20);
    layout->setContentsMargins(40, 60, 40, 40);
    
    // Logo
    m_logoLabel = new QLabel();
    m_logoLabel->setPixmap(createLogo());
    m_logoLabel->setAlignment(Qt::AlignCenter);
    layout->addWidget(m_logoLabel);
    
    // Título
    m_titleLabel = new QLabel("LIBERTY");
    m_titleLabel->setObjectName("splash_title");
    m_titleLabel->setAlignment(Qt::AlignCenter);
    layout->addWidget(m_titleLabel);
    
    // Subtítulo
    m_subtitleLabel = new QLabel("Comunicação Segura & Privada");
    m_subtitleLabel->setObjectName("splash_subtitle");
    m_subtitleLabel->setAlignment(Qt::AlignCenter);
    layout->addWidget(m_subtitleLabel);
    
    // Barra de progresso
    m_progressFrame = new QFrame();
    m_progressFrame->setObjectName("progress_frame");
    m_progressFrame->setFixedHeight(8);
    
    auto* progressLayout = new QVBoxLayout(m_progressFrame);
    progressLayout->setContentsMargins(0, 2, 0, 2);
    
    m_progressBar = new QFrame();
    m_progressBar->setObjectName("progress_bar");
    m_progressBar->setFixedHeight(4);
    m_progressBar->setFixedWidth(0);
    progressLayout->addWidget(m_progressBar);
    
    layout->addWidget(m_progressFrame);
    
    // Status
    m_statusLabel = new QLabel("Carregando...");
    m_statusLabel->setObjectName("status_label");
    m_statusLabel->setAlignment(Qt::AlignCenter);
    layout->addWidget(m_statusLabel);
    
    layout->addStretch();
    
    mainLayout->addWidget(m_container);
    
    // Animação
    m_progressAnimation = new QPropertyAnimation(m_progressBar, "maximumWidth", this);
    m_progressAnimation->setDuration(2000);
    m_progressAnimation->setStartValue(0);
    m_progressAnimation->setEndValue(300);
}

QPixmap SplashScreen::createLogo() {
    QPixmap pixmap(120, 120);
    pixmap.fill(Qt::transparent);
    
    QPainter painter(&pixmap);
    painter.setRenderHint(QPainter::Antialiasing);
    
    // Círculo com gradiente
    QRadialGradient gradient(60, 60, 60);
    gradient.setColorAt(0, QColor(255, 255, 0));
    gradient.setColorAt(1, QColor(255, 215, 0));
    
    painter.setBrush(gradient);
    painter.setPen(Qt::NoPen);
    painter.drawEllipse(10, 10, 100, 100);
    
    // Letra L
    painter.setPen(QColor(0, 0, 0));
    QFont font("Inter", 48, QFont::Bold);
    painter.setFont(font);
    painter.drawText(QRect(0, 0, 120, 120), Qt::AlignCenter, "L");
    
    painter.end();
    return pixmap;
}

void SplashScreen::paintEvent(QPaintEvent* event) {
    Q_UNUSED(event);
    
    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);
    
    // Fundo com bordas arredondadas
    QPainterPath path;
    path.addRoundedRect(rect(), 20, 20);
    painter.fillPath(path, QColor(0, 0, 0));
}

void SplashScreen::startAnimation(std::function<void()> callback) {
    m_progressAnimation->start();
    
    QStringList messages = {
        "Inicializando...",
        "Carregando componentes...",
        "Preparando interface...",
        "Configurando segurança...",
        "Pronto!"
    };
    
    for (int i = 0; i < messages.size(); ++i) {
        QTimer::singleShot(i * 400, [this, msg = messages[i]]() {
            m_statusLabel->setText(msg);
        });
    }
    
    QTimer::singleShot(2200, callback);
}

} // namespace Liberty
