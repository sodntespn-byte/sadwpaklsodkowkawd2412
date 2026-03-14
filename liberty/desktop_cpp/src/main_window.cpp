/*
 * main_window.cpp - Janela principal do aplicativo
 */

#include "main_window.h"
#include "chat_widget.h"
#include "styles.h"
#include <QMessageBox>
#include <QInputDialog>

namespace Liberty {

MainWindow::MainWindow(const QVariantMap& userData, QWidget* parent)
    : QMainWindow(parent)
    , m_userData(userData)
    , m_currentServer(-1)
{
    setWindowTitle("LIBERTY");
    resize(1200, 800);
    
    setupUI();
    
    // Adicionar servidor inicial
    addServer("Meu Servidor");
}

void MainWindow::setupUI() {
    auto* central = new QWidget();
    setCentralWidget(central);
    
    auto* mainLayout = new QHBoxLayout(central);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(0);
    
    setupServerSidebar();
    mainLayout->addWidget(m_serverSidebar);
    
    setupChannelSidebar();
    mainLayout->addWidget(m_channelSidebar);
    
    setupMainArea();
    mainLayout->addWidget(m_chatWidget, 1);
    
    setupMemberSidebar();
    mainLayout->addWidget(m_memberSidebar);
}

void MainWindow::setupServerSidebar() {
    m_serverSidebar = new QFrame();
    m_serverSidebar->setObjectName("server_sidebar");
    m_serverSidebar->setFixedWidth(72);
    
    auto* layout = new QVBoxLayout(m_serverSidebar);
    layout->setContentsMargins(12, 12, 12, 12);
    layout->setSpacing(8);
    
    // Botão home
    auto* homeBtn = new QPushButton();
    homeBtn->setObjectName("server_btn_home");
    homeBtn->setFixedSize(48, 48);
    homeBtn->setCursor(Qt::PointingHandCursor);
    homeBtn->setToolTip("Mensagens Diretas");
    connect(homeBtn, &QPushButton::clicked, this, &MainWindow::onHomeClicked);
    layout->addWidget(homeBtn);
    
    // Divisor
    auto* divider = new QFrame();
    divider->setObjectName("divider");
    divider->setFixedHeight(2);
    layout->addWidget(divider);
    
    // Lista de servidores
    m_serverListLayout = new QVBoxLayout();
    m_serverListLayout->setSpacing(8);
    layout->addLayout(m_serverListLayout);
    
    // Botão adicionar
    auto* addBtn = new QPushButton("+");
    addBtn->setObjectName("server_btn_add");
    addBtn->setFixedSize(48, 48);
    addBtn->setCursor(Qt::PointingHandCursor);
    addBtn->setToolTip("Adicionar Servidor");
    connect(addBtn, &QPushButton::clicked, this, &MainWindow::onAddServerClicked);
    layout->addWidget(addBtn);
    
    layout->addStretch();
}

void MainWindow::setupChannelSidebar() {
    m_channelSidebar = new QFrame();
    m_channelSidebar->setObjectName("channel_sidebar");
    m_channelSidebar->setFixedWidth(240);
    
    auto* layout = new QVBoxLayout(m_channelSidebar);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(0);
    
    // Header
    auto* header = new QFrame();
    header->setObjectName("channel_header");
    header->setFixedHeight(48);
    
    auto* headerLayout = new QHBoxLayout(header);
    headerLayout->setContentsMargins(16, 0, 16, 0);
    
    m_serverTitle = new QLabel("Mensagens Diretas");
    m_serverTitle->setObjectName("server_title");
    headerLayout->addWidget(m_serverTitle);
    
    auto* settingsBtn = new QPushButton("⚙");
    settingsBtn->setObjectName("icon_btn");
    settingsBtn->setFixedSize(32, 32);
    headerLayout->addWidget(settingsBtn);
    
    layout->addWidget(header);
    
    // Busca
    auto* searchFrame = new QFrame();
    searchFrame->setObjectName("search_frame");
    searchFrame->setFixedHeight(40);
    
    auto* searchLayout = new QHBoxLayout(searchFrame);
    searchLayout->setContentsMargins(12, 8, 12, 8);
    
    auto* searchIcon = new QLabel("🔍");
    searchLayout->addWidget(searchIcon);
    
    auto* searchInput = new QLineEdit();
    searchInput->setPlaceholderText("Buscar");
    searchInput->setObjectName("search_input");
    searchLayout->addWidget(searchInput);
    
    layout->addWidget(searchFrame);
    
    // Lista de canais
    m_channelList = new QWidget();
    m_channelListLayout = new QVBoxLayout(m_channelList);
    m_channelListLayout->setContentsMargins(8, 8, 8, 8);
    m_channelListLayout->setSpacing(4);
    
    auto* scroll = new QScrollArea();
    scroll->setWidget(m_channelList);
    scroll->setWidgetResizable(true);
    scroll->setObjectName("channel_scroll");
    layout->addWidget(scroll);
    
    // Painel do usuário
    auto* userPanel = new QFrame();
    userPanel->setObjectName("user_panel");
    userPanel->setFixedHeight(60);
    
    auto* userLayout = new QHBoxLayout(userPanel);
    userLayout->setContentsMargins(8, 8, 8, 8);
    
    m_userAvatar = new QLabel();
    m_userAvatar->setObjectName("user_avatar");
    m_userAvatar->setFixedSize(32, 32);
    m_userAvatar->setAlignment(Qt::AlignCenter);
    QString username = m_userData.value("username", "U").toString();
    m_userAvatar->setText(username.isEmpty() ? "U" : QString(username[0].toUpper()));
    userLayout->addWidget(m_userAvatar);
    
    auto* infoLayout = new QVBoxLayout();
    infoLayout->setSpacing(2);
    
    m_userName = new QLabel(username);
    m_userName->setObjectName("user_name");
    infoLayout->addWidget(m_userName);
    
    m_userStatus = new QLabel("Online");
    m_userStatus->setObjectName("user_status");
    infoLayout->addWidget(m_userStatus);
    
    userLayout->addLayout(infoLayout);
    userLayout->addStretch();
    
    // Controles
    auto* controls = new QHBoxLayout();
    controls->setSpacing(4);
    
    auto* micBtn = new QPushButton("🎤");
    micBtn->setObjectName("control_btn");
    micBtn->setFixedSize(32, 32);
    controls->addWidget(micBtn);
    
    auto* headphoneBtn = new QPushButton("🎧");
    headphoneBtn->setObjectName("control_btn");
    headphoneBtn->setFixedSize(32, 32);
    controls->addWidget(headphoneBtn);
    
    userLayout->addLayout(controls);
    
    layout->addWidget(userPanel);
}

void MainWindow::setupMainArea() {
    m_chatWidget = new ChatWidget();
    connect(m_chatWidget, &ChatWidget::messageSent, this, &MainWindow::onMessageSent);
}

void MainWindow::setupMemberSidebar() {
    m_memberSidebar = new QFrame();
    m_memberSidebar->setObjectName("member_sidebar");
    m_memberSidebar->setFixedWidth(240);
    
    auto* layout = new QVBoxLayout(m_memberSidebar);
    layout->setContentsMargins(0, 0, 0, 0);
    
    // Header
    auto* header = new QLabel("Membros");
    header->setObjectName("member_header");
    header->setFixedHeight(48);
    header->setAlignment(Qt::AlignCenter);
    layout->addWidget(header);
    
    // Lista de membros
    m_memberList = new QWidget();
    m_memberListLayout = new QVBoxLayout(m_memberList);
    m_memberListLayout->setContentsMargins(8, 8, 8, 8);
    m_memberListLayout->setSpacing(4);
    
    auto* scroll = new QScrollArea();
    scroll->setWidget(m_memberList);
    scroll->setWidgetResizable(true);
    layout->addWidget(scroll);
    
    // Adicionar usuário atual como membro
    addMember(m_userData.value("username", "Você").toString(), true);
}

void MainWindow::addServer(const QString& name) {
    m_servers.append(name);
    
    auto* btn = new QPushButton();
    btn->setObjectName("server_btn");
    btn->setFixedSize(48, 48);
    btn->setCursor(Qt::PointingHandCursor);
    btn->setToolTip(name);
    btn->setText(name.isEmpty() ? "?" : QString(name[0].toUpper()));
    
    int index = m_servers.size() - 1;
    connect(btn, &QPushButton::clicked, [this, index]() {
        selectServer(index);
    });
    
    m_serverListLayout->addWidget(btn);
    
    // Selecionar automaticamente se for o primeiro
    if (m_servers.size() == 1) {
        selectServer(0);
    }
}

void MainWindow::selectServer(int index) {
    if (index < 0 || index >= m_servers.size()) return;
    
    m_currentServer = index;
    m_serverTitle->setText(m_servers[index]);
    
    // Limpar canais e adicionar padrão
    while (m_channelListLayout->count() > 0) {
        auto* item = m_channelListLayout->takeAt(0);
        if (item->widget()) delete item->widget();
        delete item;
    }
    
    addChannel("geral", false);
    addChannel("voz", true);
}

void MainWindow::addChannel(const QString& name, bool isVoice) {
    auto* btn = new QPushButton();
    btn->setObjectName("channel_item");
    btn->setFixedHeight(36);
    btn->setCursor(Qt::PointingHandCursor);
    btn->setText(QString(isVoice ? "🔊 " : "# ") + name);
    
    connect(btn, &QPushButton::clicked, [this, name]() {
        m_chatWidget->setChannelName(name);
        m_currentChannel = name;
    });
    
    m_channelListLayout->addWidget(btn);
}

void MainWindow::addMember(const QString& name, bool online) {
    auto* memberFrame = new QFrame();
    memberFrame->setObjectName("member_item");
    
    auto* layout = new QHBoxLayout(memberFrame);
    layout->setContentsMargins(8, 8, 8, 8);
    layout->setSpacing(8);
    
    auto* avatar = new QLabel();
    avatar->setObjectName("user_avatar");
    avatar->setFixedSize(32, 32);
    avatar->setAlignment(Qt::AlignCenter);
    avatar->setText(name.isEmpty() ? "?" : QString(name[0].toUpper()));
    
    if (online) {
        avatar->setStyleSheet("background: #FFFF00; border-radius: 16px; color: #000000; font-weight: bold;");
    }
    
    layout->addWidget(avatar);
    
    auto* nameLabel = new QLabel(name);
    if (online) {
        nameLabel->setStyleSheet("color: #FFFFFF;");
    } else {
        nameLabel->setStyleSheet("color: #888888;");
    }
    layout->addWidget(nameLabel);
    
    m_memberListLayout->addWidget(memberFrame);
}

void MainWindow::onServerClicked(const QString& serverId) {
    Q_UNUSED(serverId);
}

void MainWindow::onHomeClicked() {
    m_currentServer = -1;
    m_serverTitle->setText("Mensagens Diretas");
    m_chatWidget->setChannelName("Amigos");
}

void MainWindow::onAddServerClicked() {
    bool ok;
    QString name = QInputDialog::getText(this, "Criar Servidor",
        "Nome do servidor:", QLineEdit::Normal, "", &ok);
    
    if (ok && !name.isEmpty()) {
        addServer(name);
    }
}

void MainWindow::onMessageSent(const QString& text) {
    QString username = m_userData.value("username", "Você").toString();
    m_chatWidget->addMessage(username, text);
}

} // namespace Liberty
