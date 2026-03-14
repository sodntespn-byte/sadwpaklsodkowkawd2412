/*
 * globe_gl.c - Globo 3D com OpenGL (C)
 * Oceanos transparentes, continentes amarelos
 */

#include "globe_gl.h"
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define PI 3.14159265358979323846f
#define DEG_TO_RAD (PI / 180.0f)

/* Estrutura de continente */
typedef struct {
    float min_lat, max_lat;
    float min_lon, max_lon;
} Continent;

static Continent continent_data[] = {
    /* América do Norte */
    {15.0f, 75.0f, -170.0f, -50.0f},
    /* América do Sul */
    {-55.0f, 15.0f, -80.0f, -35.0f},
    /* Europa */
    {35.0f, 72.0f, -10.0f, 60.0f},
    /* África */
    {-35.0f, 38.0f, -20.0f, 55.0f},
    /* Ásia */
    {5.0f, 78.0f, 60.0f, 180.0f},
    /* Oceania */
    {-45.0f, -5.0f, 110.0f, 180.0f}
};

#define CONTINENT_COUNT 6

GlobeData* globe_create(void) {
    GlobeData* globe = (GlobeData*)malloc(sizeof(GlobeData));
    if (!globe) return NULL;
    
    globe->rotation_x = 0.0f;
    globe->rotation_y = 0.0f;
    globe->rotation_z = 0.0f;
    globe->rotation_speed = 0.3f;
    globe->auto_rotate = 1;
    globe->continent_count = CONTINENT_COUNT;
    
    return globe;
}

void globe_destroy(GlobeData* globe) {
    if (globe) {
        free(globe);
    }
}

void lat_lon_to_xyz(float lat, float lon, float radius, float* x, float* y, float* z) {
    float lat_rad = lat * DEG_TO_RAD;
    float lon_rad = lon * DEG_TO_RAD;
    
    *x = radius * cosf(lat_rad) * cosf(lon_rad);
    *y = radius * sinf(lat_rad);
    *z = radius * cosf(lat_rad) * sinf(lon_rad);
}

static void draw_globe_grid(void) {
    /* Linhas de latitude */
    glLineWidth(0.5f);
    
    for (int lat = -90; lat <= 90; lat += 30) {
        glBegin(GL_LINE_LOOP);
        glColor4f(1.0f, 1.0f, 0.0f, 0.1f);
        
        for (int lon = 0; lon < 360; lon += 5) {
            float x, y, z;
            lat_lon_to_xyz((float)lat, (float)lon, 1.01f, &x, &y, &z);
            glVertex3f(x, y, z);
        }
        glEnd();
    }
    
    /* Linhas de longitude */
    for (int lon = 0; lon < 360; lon += 30) {
        glBegin(GL_LINE_STRIP);
        glColor4f(1.0f, 1.0f, 0.0f, 0.1f);
        
        for (int lat = -90; lat <= 90; lat += 5) {
            float x, y, z;
            lat_lon_to_xyz((float)lat, (float)lon, 1.01f, &x, &y, &z);
            glVertex3f(x, y, z);
        }
        glEnd();
    }
}

static void draw_continents(void) {
    /* Desenha continentes como pontos */
    glPointSize(3.0f);
    
    for (int c = 0; c < CONTINENT_COUNT; c++) {
        Continent* cont = &continent_data[c];
        
        glBegin(GL_POINTS);
        glColor4f(1.0f, 1.0f, 0.0f, 0.9f);
        
        for (float lat = cont->min_lat; lat <= cont->max_lat; lat += 3.0f) {
            for (float lon = cont->min_lon; lon <= cont->max_lon; lon += 5.0f) {
                float x, y, z;
                lat_lon_to_xyz(lat, lon, 1.02f, &x, &y, &z);
                glVertex3f(x, y, z);
            }
        }
        glEnd();
    }
    
    /* Contorno dos continentes */
    glLineWidth(1.5f);
    
    for (int c = 0; c < CONTINENT_COUNT; c++) {
        Continent* cont = &continent_data[c];
        
        glBegin(GL_LINE_LOOP);
        glColor4f(1.0f, 1.0f, 0.0f, 0.6f);
        
        /* Borda superior */
        for (float lon = cont->min_lon; lon <= cont->max_lon; lon += 10.0f) {
            float x, y, z;
            lat_lon_to_xyz(cont->max_lat, lon, 1.02f, &x, &y, &z);
            glVertex3f(x, y, z);
        }
        /* Borda direita */
        for (float lat = cont->max_lat; lat >= cont->min_lat; lat -= 5.0f) {
            float x, y, z;
            lat_lon_to_xyz(lat, cont->max_lon, 1.02f, &x, &y, &z);
            glVertex3f(x, y, z);
        }
        /* Borda inferior */
        for (float lon = cont->max_lon; lon >= cont->min_lon; lon -= 10.0f) {
            float x, y, z;
            lat_lon_to_xyz(cont->min_lat, lon, 1.02f, &x, &y, &z);
            glVertex3f(x, y, z);
        }
        /* Borda esquerda */
        for (float lat = cont->min_lat; lat <= cont->max_lat; lat += 5.0f) {
            float x, y, z;
            lat_lon_to_xyz(lat, cont->min_lon, 1.02f, &x, &y, &z);
            glVertex3f(x, y, z);
        }
        
        glEnd();
    }
}

static void draw_globe_outline(void) {
    /* Círculo horizontal (equador) */
    glLineWidth(2.0f);
    glBegin(GL_LINE_LOOP);
    glColor4f(1.0f, 1.0f, 0.0f, 0.3f);
    
    for (int i = 0; i < 360; i++) {
        float angle = i * DEG_TO_RAD;
        glVertex3f(cosf(angle), 0.0f, sinf(angle));
    }
    glEnd();
    
    /* Círculo vertical (meridiano) */
    glBegin(GL_LINE_LOOP);
    for (int i = 0; i < 360; i++) {
        float angle = i * DEG_TO_RAD;
        glVertex3f(cosf(angle), sinf(angle), 0.0f);
    }
    glEnd();
}

void globe_render(GlobeData* globe) {
    if (!globe) return;
    
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glLoadIdentity();
    
    /* Posição da câmera */
    glTranslatef(0.0f, 0.0f, -3.0f);
    
    /* Rotação do globo */
    glRotatef(globe->rotation_x, 1.0f, 0.0f, 0.0f);
    glRotatef(globe->rotation_y, 0.0f, 1.0f, 0.0f);
    glRotatef(globe->rotation_z, 0.0f, 0.0f, 1.0f);
    
    /* Desenha componentes */
    draw_globe_grid();
    draw_continents();
    draw_globe_outline();
}

void globe_resize(GlobeData* globe, int width, int height) {
    if (!globe) return;
    
    if (height == 0) height = 1;
    
    glViewport(0, 0, width, height);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluPerspective(45.0, (double)width / (double)height, 0.1, 100.0);
    glMatrixMode(GL_MODELVIEW);
}

void globe_rotate(GlobeData* globe, float dx, float dy) {
    if (!globe) return;
    
    globe->rotation_y += dx * 0.5f;
    globe->rotation_x += dy * 0.5f;
}

void globe_set_auto_rotate(GlobeData* globe, int enable) {
    if (globe) {
        globe->auto_rotate = enable;
    }
}

void globe_update(GlobeData* globe) {
    if (!globe) return;
    
    if (globe->auto_rotate) {
        globe->rotation_y += globe->rotation_speed;
        if (globe->rotation_y >= 360.0f) {
            globe->rotation_y -= 360.0f;
        }
    }
}

/* Inicialização OpenGL */
void globe_init_gl(void) {
    glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glEnable(GL_POINT_SMOOTH);
    glEnable(GL_LINE_SMOOTH);
    glHint(GL_POINT_SMOOTH_HINT, GL_NICEST);
    glHint(GL_LINE_SMOOTH_HINT, GL_NICEST);
}
