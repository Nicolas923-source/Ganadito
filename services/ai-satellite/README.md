# services/ai-satellite

Servicio auxiliar de IA de Ganadito, hecho con FastAPI y OpenCV. Todo lo que devuelve es **orientativo**: `es_vinculante=false`. Ningún resultado de este servicio decide un precio, una liquidación ni una disputa.

## Ejecutar y probar

```bash
cd services/ai-satellite
.venv/Scripts/python -m pytest -q
.venv/Scripts/python run.py   # puerto 8001
```

La CI del monorepo **todavía no ejecuta estas pruebas**: falta un job de Python en `.github/workflows`, y ese archivo es de Víctor.

## Estado real de cada endpoint

| Endpoint | Estado |
|---|---|
| `POST /api/v1/peso/estimar` | **Etapa 1 implementada.** Hace zoometría explicable con calibración. No está validada con pesajes reales. |
| `POST /api/v1/bromatologia/analizar-color` | Convierte la imagen a CIELAB con un umbral de L\* < 46. Es un cálculo real, pero el umbral no está validado en campo. |
| `POST /api/v1/bromatologia/checklist-minsa` | Aplica reglas fijas de temperatura, color y olor. |
| `POST /api/v1/vision/analizar-video` | **Simulado.** La condición corporal se deriva del contraste de la imagen, y el biotipo y la edad dental son valores fijos. Si no puede leer el video, genera fotogramas aleatorios. No debe presentarse como una medición. |

## Estimación de peso: etapa 1 (zoometría)

**Entrada.** Un fotograma de **perfil** del animal (el que elija el comunero en la app), con:

1. **Calibración**, que puede hacerse de dos formas:
   - `ARUCO`: una tarjeta impresa con un marcador ArUco (`DICT_4X4_50` por defecto) de lado conocido, por ejemplo 20 cm. El lado se mide **en el borde exterior del cuadrado negro**, sin el margen blanco. La tarjeta se coloca **junto al animal, en su mismo plano** y de frente a la cámara.
   - `REFERENCIA`: dos puntos de un objeto de largo conocido, como una vara de 1 m, en el mismo plano.
2. **Cuatro puntos anatómicos** que marca el comunero:
   - punta del hombro (encuentro);
   - punta de la nalga (isquion);
   - la cruz;
   - el punto inferior del pecho detrás del codo.
3. Opcional: `perimetro_toracico_cm`, medido con cinta. Reduce la incertidumbre.

**Cálculo.**

- Largo corporal = distancia de hombro a nalga. Profundidad de pecho = distancia de la cruz al pecho. Ambas se pasan a cm con la calibración.
- El perímetro torácico se toma medido con cinta o se aproxima como una elipse. El ancho de esa elipse es la profundidad × **0,65**, que es un supuesto sin calibrar, con un rango de 0,55 a 0,75.
- El peso sale de la fórmula de Schaeffer en unidades métricas: `kg = PT² × L / 10 838`.
- El rango se calcula con los extremos del supuesto ± **10 %**. Ese 10 % representa el error por marcado de puntos y perspectiva, y también es un supuesto por medir.

**Salida.** El endpoint devuelve:

- `peso_estimado_kg`, `rango_min_kg` y `rango_max_kg`;
- `advertencias`;
- `es_vinculante=false` y `validado=false`;
- `muestra`, con las medidas intermedias para la etapa 2.

**Rechazos.** El endpoint responde 422 cuando:

- no hay marcador, hay varios sin `marcador_id`, el marcador es muy pequeño o está muy inclinado;
- un punto queda fuera de la imagen;
- el Base64 es inválido;
- las medidas o el peso salen del rango plausible;
- llega un campo desconocido.

Responde 413 si la imagen supera 8 MB o 8000 px de lado.

**Límites conocidos.**

- Si el animal no está de perfil y perpendicular a la cámara, o si el marcador no está en su plano, la escala se distorsiona.
- La fórmula de Schaeffer no está calibrada para el ganado criollo altoandino.
- La precisión real es **desconocida** hasta medirla.

## Estimación de peso: etapa 2 (con datos del piloto)

1. **Guardar cada estimación en PostgreSQL**, a través de la API y con el consentimiento del productor: el fotograma, los puntos, la `muestra`, la versión del método y, si existe, el **peso real** de una balanza disponible en una instalación colaboradora. Este servicio no guarda nada.
2. **Medir el error** comparando contra la muestra pesada (error absoluto medio y error porcentual por tipo de animal). Con eso se recalibran la relación ancho/profundidad y el rango.
3. **Modelo automático de puntos anatómicos**, para detectarlos sin que el comunero los toque. Se entrena con los puntos marcados y los pesos reales del piloto, y se compara contra la etapa 1 con los mismos datos. Solo reemplaza a la etapa 1 si mide mejor.

Para la etapa 2 falta definir un contrato en `docs/api`, una columna o tabla en una migración y el permiso de uso de las imágenes.
