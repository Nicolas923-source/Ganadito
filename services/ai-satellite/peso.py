"""
Estimación orientativa del peso vivo bovino a partir de un fotograma de perfil.

Etapa 1 (este módulo): zoometría explicable.
  1. Calibración píxel -> centímetro con un marcador ArUco impreso de lado conocido,
     colocado junto al animal y en su mismo plano, o con dos puntos de una referencia
     de longitud conocida (por ejemplo, una vara de 1 m).
  2. El comunero marca 4 puntos anatómicos en el fotograma:
       - punta del hombro (encuentro) y punta de la nalga (isquion) -> largo corporal;
       - cruz y punto inferior del pecho detrás del codo          -> profundidad de pecho.
  3. El perímetro torácico se toma medido con cinta, si se envía, o se aproxima como
     una elipse (profundidad x ancho supuesto). El ancho es un SUPUESTO sin calibrar.
  4. Fórmula de Schaeffer en unidades métricas: kg = PT(cm)^2 * L(cm) / 10 838.

El resultado es SIEMPRE orientativo (es_vinculante=False, validado=False): no es un
pesaje, puede equivocarse y no debe usarse para liquidar por kilogramo. Las pujas se
hacen por el precio total del lote.

Etapa 2 (futura): cada estimación devuelve `muestra`, con las medidas intermedias,
para guardarla en PostgreSQL junto al peso real de una muestra pesada en el piloto.
Con esos pares se calibran los supuestos y, más adelante, se entrena un modelo
automático de puntos anatómicos.
"""

from __future__ import annotations

import base64
import binascii
import math
from typing import Literal

import cv2
import numpy as np
from pydantic import BaseModel, ConfigDict, Field, model_validator

METODO = "ZOOMETRIA_SCHAEFFER_V0"

# Constante de Schaeffer convertida a cm y kg: 300 * 2.54^3 / 0.45359237 = 10 838.
CONSTANTE_SCHAEFFER_CM_KG = 300 * 2.54**3 / 0.45359237

# Relación ancho/profundidad del tórax. SUPUESTO inicial, sin calibrar con datos
# peruanos: el valor central y el rango se ajustarán con los pesajes del piloto.
RELACION_ANCHO_PROFUNDIDAD_CENTRAL = 0.65
RELACION_ANCHO_PROFUNDIDAD_RANGO = (0.55, 0.75)

# Error adicional por marcado de puntos y perspectiva (supuesto, por medir).
ERROR_MEDICION_RELATIVO = 0.10

# Límites de plausibilidad para bovinos adultos y de recría.
LARGO_CM_RANGO = (70.0, 230.0)
PROFUNDIDAD_CM_RANGO = (35.0, 110.0)
PERIMETRO_CM_RANGO = (90.0, 280.0)
PESO_KG_RANGO = (60.0, 1200.0)

LADO_MARCADOR_MIN_PX = 24.0
MAX_IMAGEN_BYTES = 8 * 1024 * 1024
MAX_IMAGEN_LADO_PX = 8000

DICCIONARIOS_ARUCO = {
    "DICT_4X4_50": cv2.aruco.DICT_4X4_50,
    "DICT_5X5_50": cv2.aruco.DICT_5X5_50,
    "DICT_6X6_50": cv2.aruco.DICT_6X6_50,
}


class EstimacionPesoError(ValueError):
    """Entrada válida en forma, pero imposible de estimar (se responde con 422)."""


class ImagenDemasiadoGrandeError(ValueError):
    """La imagen supera el tamaño permitido (se responde con 413)."""


Punto = tuple[float, float]


class PuntosAnatomicos(BaseModel):
    model_config = ConfigDict(extra="forbid")

    punta_hombro: Punto = Field(description="Encuentro, en píxeles (x, y) del fotograma")
    punta_nalga: Punto = Field(description="Isquion, en píxeles (x, y)")
    cruz: Punto = Field(description="Parte más alta de la cruz, en píxeles (x, y)")
    pecho_inferior: Punto = Field(description="Punto inferior del pecho detrás del codo, en píxeles (x, y)")


class CalibracionAruco(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tipo: Literal["ARUCO"] = "ARUCO"
    lado_cm: float = Field(gt=2.0, le=100.0, description="Lado impreso del marcador, en cm")
    diccionario: Literal["DICT_4X4_50", "DICT_5X5_50", "DICT_6X6_50"] = "DICT_4X4_50"
    marcador_id: int | None = Field(default=None, ge=0, le=49)


class CalibracionReferencia(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tipo: Literal["REFERENCIA"] = "REFERENCIA"
    punto_a: Punto
    punto_b: Punto
    distancia_cm: float = Field(gt=5.0, le=500.0)


class EstimacionPesoInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    imagen_base64: str | None = Field(
        default=None,
        description="Fotograma de perfil en PNG/JPEG Base64. Obligatorio con calibración ARUCO.",
    )
    puntos: PuntosAnatomicos
    calibracion: CalibracionAruco | CalibracionReferencia = Field(discriminator="tipo")
    perimetro_toracico_cm: float | None = Field(
        default=None,
        gt=0,
        description="Perímetro torácico medido con cinta, si existe. Reduce la incertidumbre.",
    )

    @model_validator(mode="after")
    def _aruco_requiere_imagen(self) -> "EstimacionPesoInput":
        if self.calibracion.tipo == "ARUCO" and not self.imagen_base64:
            raise ValueError("La calibración ARUCO requiere 'imagen_base64'.")
        return self


class MuestraZoometrica(BaseModel):
    """Medidas intermedias para guardar y, en la etapa 2, comparar con el peso real."""

    cm_por_pixel: float
    fuente_calibracion: Literal["ARUCO", "REFERENCIA"]
    lado_marcador_px: float | None = None
    largo_corporal_cm: float
    profundidad_pecho_cm: float
    perimetro_toracico_cm: float
    perimetro_medido: bool
    relacion_ancho_profundidad_supuesta: float | None


class EstimacionPesoResult(BaseModel):
    peso_estimado_kg: float
    rango_min_kg: float
    rango_max_kg: float
    metodo: str = METODO
    es_vinculante: bool = False
    validado: bool = False
    advertencias: list[str]
    muestra: MuestraZoometrica
    estado: Literal["COMPLETADO"] = "COMPLETADO"


# ---------------------------------------------------------------------------
# Funciones puras
# ---------------------------------------------------------------------------

def peso_schaeffer_kg(perimetro_cm: float, largo_cm: float) -> float:
    return perimetro_cm**2 * largo_cm / CONSTANTE_SCHAEFFER_CM_KG


def perimetro_elipse_cm(profundidad_cm: float, relacion_ancho: float) -> float:
    """Perímetro de una elipse de ejes profundidad y ancho (aproximación de Ramanujan II)."""
    a = profundidad_cm / 2.0
    b = profundidad_cm * relacion_ancho / 2.0
    h = ((a - b) ** 2) / ((a + b) ** 2)
    return math.pi * (a + b) * (1 + 3 * h / (10 + math.sqrt(4 - 3 * h)))


def _distancia(p: Punto, q: Punto) -> float:
    return math.hypot(p[0] - q[0], p[1] - q[1])


def decodificar_fotograma(imagen_b64: str) -> np.ndarray:
    if "," in imagen_b64:
        imagen_b64 = imagen_b64.split(",", 1)[1]
    # Base64 ocupa 4/3 del binario: se descarta antes de decodificar.
    if len(imagen_b64) > MAX_IMAGEN_BYTES * 4 // 3 + 4:
        raise ImagenDemasiadoGrandeError("La imagen supera el máximo de 8 MB.")
    try:
        raw = base64.b64decode(imagen_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise EstimacionPesoError("La imagen no es Base64 válido.") from exc
    img = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise EstimacionPesoError("No se pudo decodificar la imagen (se acepta PNG o JPEG).")
    if max(img.shape[:2]) > MAX_IMAGEN_LADO_PX:
        raise ImagenDemasiadoGrandeError("La imagen supera los 8000 píxeles de lado.")
    return img


def detectar_marcador_aruco(img_bgr: np.ndarray, cal: CalibracionAruco) -> float:
    """Devuelve el lado medio del marcador en píxeles."""
    gris = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    diccionario = cv2.aruco.getPredefinedDictionary(DICCIONARIOS_ARUCO[cal.diccionario])
    detector = cv2.aruco.ArucoDetector(diccionario, cv2.aruco.DetectorParameters())
    esquinas, ids, _ = detector.detectMarkers(gris)
    if ids is None or len(ids) == 0:
        raise EstimacionPesoError("No se detectó el marcador de calibración en la imagen.")

    candidatos = [
        (int(i), e.reshape(4, 2))
        for i, e in zip(ids.flatten(), esquinas)
        if cal.marcador_id is None or int(i) == cal.marcador_id
    ]
    if not candidatos:
        raise EstimacionPesoError(f"No se encontró el marcador con id {cal.marcador_id}.")
    if len(candidatos) > 1:
        raise EstimacionPesoError("Hay más de un marcador en la imagen: indique 'marcador_id'.")

    _, c = candidatos[0]
    lados = [float(np.linalg.norm(c[k] - c[(k + 1) % 4])) for k in range(4)]
    lado_px = sum(lados) / 4.0
    if lado_px < LADO_MARCADOR_MIN_PX:
        raise EstimacionPesoError("El marcador se ve demasiado pequeño: acérquese o imprímalo más grande.")
    # Un cuadrado visto muy en ángulo deforma la escala: se exige poca distorsión.
    if max(lados) / min(lados) > 1.25:
        raise EstimacionPesoError("El marcador está muy inclinado respecto de la cámara.")
    return lado_px


def _validar_puntos_en_imagen(puntos: PuntosAnatomicos, alto: int, ancho: int) -> None:
    for nombre, (x, y) in puntos.model_dump().items():
        if not (0 <= x < ancho and 0 <= y < alto):
            raise EstimacionPesoError(f"El punto '{nombre}' está fuera de la imagen.")


def _en_rango(valor: float, rango: tuple[float, float], etiqueta: str) -> None:
    if not (rango[0] <= valor <= rango[1]):
        raise EstimacionPesoError(
            f"{etiqueta} de {valor:.1f} fuera del rango plausible ({rango[0]:.0f}-{rango[1]:.0f}): "
            "revise los puntos o la calibración."
        )


def estimar_peso(payload: EstimacionPesoInput) -> EstimacionPesoResult:
    advertencias = [
        "Estimación orientativa: no es un pesaje y puede equivocarse.",
        "No usar para liquidar por kilogramo; la puja es por el precio total del lote.",
    ]

    lado_px: float | None = None
    if isinstance(payload.calibracion, CalibracionAruco):
        img = decodificar_fotograma(payload.imagen_base64 or "")
        _validar_puntos_en_imagen(payload.puntos, img.shape[0], img.shape[1])
        lado_px = detectar_marcador_aruco(img, payload.calibracion)
        cm_por_px = payload.calibracion.lado_cm / lado_px
        advertencias.append("El marcador debe estar junto al animal y en su mismo plano.")
    else:
        if payload.imagen_base64:
            img = decodificar_fotograma(payload.imagen_base64)
            _validar_puntos_en_imagen(payload.puntos, img.shape[0], img.shape[1])
        ref_px = _distancia(payload.calibracion.punto_a, payload.calibracion.punto_b)
        if ref_px < LADO_MARCADOR_MIN_PX:
            raise EstimacionPesoError("La referencia de calibración es demasiado corta en la imagen.")
        cm_por_px = payload.calibracion.distancia_cm / ref_px

    p = payload.puntos
    largo_cm = _distancia(p.punta_hombro, p.punta_nalga) * cm_por_px
    profundidad_cm = _distancia(p.cruz, p.pecho_inferior) * cm_por_px
    _en_rango(largo_cm, LARGO_CM_RANGO, "Largo corporal (cm)")
    _en_rango(profundidad_cm, PROFUNDIDAD_CM_RANGO, "Profundidad de pecho (cm)")

    if payload.perimetro_toracico_cm is not None:
        perimetro = payload.perimetro_toracico_cm
        _en_rango(perimetro, PERIMETRO_CM_RANGO, "Perímetro torácico (cm)")
        relacion: float | None = None
        central = peso_schaeffer_kg(perimetro, largo_cm)
        bajo, alto = central, central
    else:
        relacion = RELACION_ANCHO_PROFUNDIDAD_CENTRAL
        perimetro = perimetro_elipse_cm(profundidad_cm, relacion)
        central = peso_schaeffer_kg(perimetro, largo_cm)
        r_min, r_max = RELACION_ANCHO_PROFUNDIDAD_RANGO
        bajo = peso_schaeffer_kg(perimetro_elipse_cm(profundidad_cm, r_min), largo_cm)
        alto = peso_schaeffer_kg(perimetro_elipse_cm(profundidad_cm, r_max), largo_cm)
        advertencias.append(
            "Perímetro torácico aproximado a partir de la profundidad de pecho con un ancho supuesto, "
            "aún no calibrado con pesajes reales."
        )

    _en_rango(central, PESO_KG_RANGO, "Peso estimado (kg)")
    rango_min = bajo * (1 - ERROR_MEDICION_RELATIVO)
    rango_max = alto * (1 + ERROR_MEDICION_RELATIVO)

    return EstimacionPesoResult(
        peso_estimado_kg=round(central, 1),
        rango_min_kg=round(rango_min, 1),
        rango_max_kg=round(rango_max, 1),
        advertencias=advertencias,
        muestra=MuestraZoometrica(
            cm_por_pixel=round(cm_por_px, 5),
            fuente_calibracion=payload.calibracion.tipo,
            lado_marcador_px=round(lado_px, 2) if lado_px is not None else None,
            largo_corporal_cm=round(largo_cm, 1),
            profundidad_pecho_cm=round(profundidad_cm, 1),
            perimetro_toracico_cm=round(perimetro, 1),
            perimetro_medido=payload.perimetro_toracico_cm is not None,
            relacion_ancho_profundidad_supuesta=relacion,
        ),
    )
