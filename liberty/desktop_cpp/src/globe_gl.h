/*
 * globe_gl.h - Globo 3D com OpenGL (C)
 * Oceanos transparentes, continentes amarelos
 */

#ifndef GLOBE_GL_H
#define GLOBE_GL_H

#ifdef __cplusplus
extern "C" {
#endif

#include <GL/gl.h>
#include <GL/glu.h>

typedef struct {
    float rotation_x;
    float rotation_y;
    float rotation_z;
    float rotation_speed;
    int auto_rotate;
    int** continents;
    int continent_count;
} GlobeData;

/* Inicialização */
GlobeData* globe_create(void);
void globe_destroy(GlobeData* globe);

/* Renderização */
void globe_render(GlobeData* globe);
void globe_resize(GlobeData* globe, int width, int height);

/* Controle */
void globe_rotate(GlobeData* globe, float dx, float dy);
void globe_set_auto_rotate(GlobeData* globe, int enable);
void globe_update(GlobeData* globe);

/* Coordenadas */
void lat_lon_to_xyz(float lat, float lon, float radius, float* x, float* y, float* z);

#ifdef __cplusplus
}
#endif

#endif /* GLOBE_GL_H */
