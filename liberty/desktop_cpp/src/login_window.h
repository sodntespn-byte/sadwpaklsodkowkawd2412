/*
 * login_window.h - Tela de login com globo 3D
 */

#ifndef LOGIN_WINDOW_H
#define LOGIN_WINDOW_H

#include <QWidget>
#include <QFrame>
#include <QLineEdit>
#include <QPushButton>
#include <QLabel>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QOpenGLWidget>
#include <QTimer>
#include <QMouseEvent>

namespace Liberty {

class GlobeGLWidget : public QOpenGLWidget {
    Q_OBJECT

public:
    explicit GlobeGLWidget(QWidget* parent = nullptr);
    ~GlobeGLWidget() override;

protected:
    void initializeGL() override;
    void resizeGL(int w, int h) override;
    void paintGL() override;
    void mousePressEvent(QMouseEvent* event) override;
    void mouseMoveEvent(QMouseEvent* event) override;
    void mouseReleaseEvent(QMouseEvent* event) override;

private:
    void* m_globe;
    QTimer* m_timer;
    QPoint m_lastPos;
};

class LoginWindow : public QWidget {
    Q_OBJECT

public:
    explicit LoginWindow(QWidget* parent = nullptr);
    ~LoginWindow() override = default;

signals:
    void loginSuccess(const QString& username, const QString& email);
    void registerRequested();

private slots:
    void onLoginClicked();
    void onRegisterClicked();

private:
    void setupUI();
    QPixmap createSmallLogo();

    GlobeGLWidget* m_globeWidget;
    QLineEdit* m_emailInput;
    QLineEdit* m_passwordInput;
    QPushButton* m_loginBtn;
    QPushButton* m_registerBtn;
};

} // namespace Liberty

#endif // LOGIN_WINDOW_H
