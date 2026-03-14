/*
 * splash_screen.h - Tela de carregamento inicial
 */

#ifndef SPLASH_SCREEN_H
#define SPLASH_SCREEN_H

#include <QWidget>
#include <QFrame>
#include <QLabel>
#include <QVBoxLayout>
#include <QTimer>
#include <QPropertyAnimation>

namespace Liberty {

class SplashScreen : public QWidget {
    Q_OBJECT

public:
    explicit SplashScreen(QWidget* parent = nullptr);
    ~SplashScreen() override = default;

    void startAnimation(std::function<void()> callback);

protected:
    void paintEvent(QPaintEvent* event) override;

private:
    void setupUI();
    QPixmap createLogo();

    QFrame* m_container;
    QLabel* m_logoLabel;
    QLabel* m_titleLabel;
    QLabel* m_subtitleLabel;
    QFrame* m_progressFrame;
    QFrame* m_progressBar;
    QLabel* m_statusLabel;
    
    QPropertyAnimation* m_progressAnimation;
};

} // namespace Liberty

#endif // SPLASH_SCREEN_H
