/*
 * chat_widget.h - Widget de chat
 */

#ifndef CHAT_WIDGET_H
#define CHAT_WIDGET_H

#include <QWidget>
#include <QFrame>
#include <QVBoxLayout>
#include <QScrollArea>
#include <QLineEdit>
#include <QPushButton>
#include <QLabel>
#include <QDateTime>

namespace Liberty {

struct Message {
    QString author;
    QString text;
    QString time;
    QString avatar;
};

class MessageWidget : public QFrame {
    Q_OBJECT

public:
    explicit MessageWidget(const Message& msg, QWidget* parent = nullptr);
};

class ChatWidget : public QWidget {
    Q_OBJECT

public:
    explicit ChatWidget(QWidget* parent = nullptr);

    void addMessage(const QString& author, const QString& text);
    void setChannelName(const QString& name);
    void clear();

signals:
    void messageSent(const QString& text);

private slots:
    void onSendClicked();

private:
    void setupUI();
    void addWelcomeMessage();

    QString m_channelName;
    
    QFrame* m_header;
    QLabel* m_channelLabel;
    
    QScrollArea* m_scrollArea;
    QWidget* m_messageContainer;
    QVBoxLayout* m_messageLayout;
    
    QFrame* m_inputFrame;
    QLineEdit* m_input;
    QPushButton* m_sendBtn;
};

} // namespace Liberty

#endif // CHAT_WIDGET_H
