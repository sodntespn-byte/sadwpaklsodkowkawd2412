"""
Globo 3D com oceanos transparentes e continentes amarelos
"""
from PyQt5.QtWidgets import QOpenGLWidget
from PyQt5.QtCore import QTimer, Qt
from PyQt5.QtGui import QColor
from OpenGL.GL import *
from OpenGL.GLU import *
import math
import numpy as np

class GlobeWidget(QOpenGLWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.rotation_x = 0
        self.rotation_y = 0
        self.rotation_z = 0
        self.auto_rotate = True
        self.rotation_speed = 0.3
        
        self.setMinimumSize(400, 400)
        
        # Timer para rotação automática
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.rotate)
        self.timer.start(16)  # ~60 FPS
        
        # Dados dos continentes (simplificado)
        self.continents = self.generate_continents()
        
    def generate_continents(self):
        """Gera pontos dos continentes"""
        continents = []
        
        # América do Norte
        na = []
        for lat in range(15, 75, 3):
            for lon in range(-170, -50, 5):
                na.append((lat, lon))
        continents.append(na)
        
        # América do Sul
        sa = []
        for lat in range(-55, 15, 3):
            for lon in range(-80, -35, 5):
                sa.append((lat, lon))
        continents.append(sa)
        
        # Europa
        eu = []
        for lat in range(35, 72, 3):
            for lon in range(-10, 60, 5):
                eu.append((lat, lon))
        continents.append(eu)
        
        # África
        af = []
        for lat in range(-35, 38, 3):
            for lon in range(-20, 55, 5):
                af.append((lat, lon))
        continents.append(af)
        
        # Ásia
        asia = []
        for lat in range(5, 78, 3):
            for lon in range(60, 180, 5):
                asia.append((lat, lon))
        continents.append(asia)
        
        # Oceania
        oc = []
        for lat in range(-45, -5, 3):
            for lon in range(110, 180, 5):
                oc.append((lat, lon))
        continents.append(oc)
        
        return continents
    
    def lat_lon_to_xyz(self, lat, lon, radius=1.0):
        """Converte latitude/longitude para XYZ"""
        lat_rad = math.radians(lat)
        lon_rad = math.radians(lon)
        
        x = radius * math.cos(lat_rad) * math.cos(lon_rad)
        y = radius * math.sin(lat_rad)
        z = radius * math.cos(lat_rad) * math.sin(lon_rad)
        
        return x, y, z
    
    def initializeGL(self):
        glClearColor(0.0, 0.0, 0.0, 0.0)  # Fundo transparente
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
        glEnable(GL_POINT_SMOOTH)
        glEnable(GL_LINE_SMOOTH)
        glHint(GL_POINT_SMOOTH_HINT, GL_NICEST)
        glHint(GL_LINE_SMOOTH_HINT, GL_NICEST)
        
    def resizeGL(self, w, h):
        glViewport(0, 0, w, h)
        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        gluPerspective(45, w / h if h > 0 else 1, 0.1, 100.0)
        glMatrixMode(GL_MODELVIEW)
        
    def paintGL(self):
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
        glLoadIdentity()
        
        # Posição da câmera
        glTranslatef(0.0, 0.0, -3.0)
        
        # Rotação do globo
        glRotatef(self.rotation_x, 1, 0, 0)
        glRotatef(self.rotation_y, 0, 1, 0)
        glRotatef(self.rotation_z, 0, 0, 1)
        
        # Desenha grade do globo (linhas de latitude/longitude)
        self.draw_globe_grid()
        
        # Desenha continentes
        self.draw_continents()
        
        # Desenha borda do globo
        self.draw_globe_outline()
        
    def draw_globe_grid(self):
        """Desenha a grade do globo"""
        glLineWidth(0.5)
        
        # Linhas de latitude
        for lat in range(-90, 91, 30):
            glBegin(GL_LINE_LOOP)
            glColor4f(1.0, 1.0, 0.0, 0.1)  # Amarelo muito transparente
            for lon in range(0, 360, 5):
                x, y, z = self.lat_lon_to_xyz(lat, lon, 1.01)
                glVertex3f(x, y, z)
            glEnd()
        
        # Linhas de longitude
        for lon in range(0, 360, 30):
            glBegin(GL_LINE_STRIP)
            glColor4f(1.0, 1.0, 0.0, 0.1)
            for lat in range(-90, 91, 5):
                x, y, z = self.lat_lon_to_xyz(lat, lon, 1.01)
                glVertex3f(x, y, z)
            glEnd()
    
    def draw_continents(self):
        """Desenha os continentes em amarelo"""
        glPointSize(3.0)
        
        for continent in self.continents:
            glBegin(GL_POINTS)
            glColor4f(1.0, 1.0, 0.0, 0.9)  # Amarelo brilhante
            
            for lat, lon in continent:
                x, y, z = self.lat_lon_to_xyz(lat, lon, 1.02)
                glVertex3f(x, y, z)
            glEnd()
        
        # Desenha contorno dos continentes
        glLineWidth(1.5)
        for continent in self.continents:
            glBegin(GL_LINE_LOOP)
            glColor4f(1.0, 1.0, 0.0, 0.6)
            
            # Pega apenas pontos da borda
            for i, (lat, lon) in enumerate(continent[::10]):
                x, y, z = self.lat_lon_to_xyz(lat, lon, 1.02)
                glVertex3f(x, y, z)
            glEnd()
    
    def draw_globe_outline(self):
        """Desenha o contorno do globo"""
        glLineWidth(2.0)
        glBegin(GL_LINE_LOOP)
        glColor4f(1.0, 1.0, 0.0, 0.3)
        
        for i in range(360):
            angle = math.radians(i)
            x = math.cos(angle) * 1.0
            z = math.sin(angle) * 1.0
            glVertex3f(x, 0.0, z)
        glEnd()
        
        # Círculo vertical
        glBegin(GL_LINE_LOOP)
        for i in range(360):
            angle = math.radians(i)
            x = math.cos(angle) * 1.0
            y = math.sin(angle) * 1.0
            glVertex3f(x, y, 0.0)
        glEnd()
    
    def rotate(self):
        if self.auto_rotate:
            self.rotation_y += self.rotation_speed
            if self.rotation_y >= 360:
                self.rotation_y -= 360
            self.update()
    
    def mousePressEvent(self, event):
        self.auto_rotate = False
        self.last_pos = event.pos()
        
    def mouseMoveEvent(self, event):
        if event.buttons() & Qt.LeftButton:
            dx = event.x() - self.last_pos.x()
            dy = event.y() - self.last_pos.y()
            
            self.rotation_y += dx * 0.5
            self.rotation_x += dy * 0.5
            
            self.last_pos = event.pos()
            self.update()
            
    def mouseReleaseEvent(self, event):
        self.auto_rotate = True
