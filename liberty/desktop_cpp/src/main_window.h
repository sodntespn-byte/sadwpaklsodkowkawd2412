/*
 * main_window.h - Janela principal do aplicativo
 */

#ifndef MAIN_WINDOW_H
#define MAIN_WINDOW_H

#include <QMainWindow>
#include <QFrame>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QPushButton>
#include <QLabel>
#include <QScrollArea>
#include <QVariantMap>

namespace Liberty {

class ChatWidget;

class MainWindow : public QMainWindow {
    Q_OBJECT

public:
    explicit MainWindow(const QVariantMap& userData, QWidget* parent = nullptr);
    ~MainWindow() override = default;

private slots:
    void onServerClicked(const QString& serverId);
    void onHomeClicked();
    void onAddServerClicked();
    void onMessageSent(const QString& text);

private:
    void setupUI();
    void setupServerSidebar();
    void setupChannelSidebar();
    void setupMainArea();
    void setupMemberSidebar();
    
    void addServer(const QString& name);
    void selectServer(int index);
    void addChannel(const QString& name, bool isVoice);
    void addMember(const QString& name, bool online);

    QVariantMap m_userData;
    QStringList m_servers;
    int m_currentServer;
    QString m_currentChannel;
    
    // Server Sidebar
    QFrame* m_serverSidebar;
    QVBoxLayout* m_serverListLayout;
    
    // Channel Sidebar
    QFrame* m_channelSidebar;
    QLabel* m_serverTitle;
    QWidget* m_channelList;
    QVBoxLayout* m_channelListLayout;
    QLabel* m_userAvatar;
    QLabel* m_userName;
    QLabel* m_userStatus;
    
    // Main Area
    ChatWidget* m_chatWidget;
    
    // Member Sidebar
    QFrame* m_memberSidebar;
    QWidget* m_memberList;
    QVBoxLayout* m_memberListLayout;
};

} // namespace Liberty

#endif // MAIN_WINDOW_H
