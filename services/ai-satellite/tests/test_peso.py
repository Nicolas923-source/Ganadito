"""Pruebas de la estimación orientativa de peso vivo (zoometría + calibración ArUco)."""

import base64
import math

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from main import app
from peso import peso_schaeffer_kg

client = TestClient(app)

URL = "/api/v1/peso/estimar"
LADO_MARCADOR_PX = 100
LADO_MARCADOR_CM = 20.0  # => 0,2 cm por píxel

# Largo 700 px = 140 cm; profundidad 350 px = 70 cm.
PUNTOS = {
    "punta_hombro": [300, 400],
    "punta_nalga": [1000, 400],
    "cruz": [400, 250],
    "pecho_inferior": [400, 600],
}


def _png_b64(img: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return base64.b64encode(buf.tobytes()).decode()


def _imagen(marcadores: list[tuple[int, int, int]]) -> str:
    """Fondo blanco 1200x800 con marcadores ArUco (id, x, y) de 100 px."""
    img = np.full((800, 1200, 3), 255, dtype=np.uint8)
    dic = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    for marcador_id, x, y in marcadores:
        m = cv2.aruco.generateImageMarker(dic, marcador_id, LADO_MARCADOR_PX)
        img[y : y + LADO_MARCADOR_PX, x : x + LADO_MARCADOR_PX] = cv2.cvtColor(m, cv2.COLOR_GRAY2BGR)
    return _png_b64(img)


def _perimetro_elipse(profundidad: float, relacion: float) -> float:
    a, b = profundidad / 2, profundidad * relacion / 2
    h = (a - b) ** 2 / (a + b) ** 2
    return math.pi * (a + b) * (1 + 3 * h / (10 + math.sqrt(4 - 3 * h)))


def _cuerpo_aruco(**extra) -> dict:
    return {
        "imagen_base64": _imagen([(7, 50, 50)]),
        "puntos": PUNTOS,
        "calibracion": {"tipo": "ARUCO", "lado_cm": LADO_MARCADOR_CM},
        **extra,
    }


def test_schaeffer_metrica_coincide_con_formula_imperial():
    # 200 cm x 150 cm calculado en pulgadas y libras, y convertido a kg.
    perimetro_in, largo_in = 200 / 2.54, 150 / 2.54
    esperado_kg = perimetro_in**2 * largo_in / 300 * 0.45359237
    assert peso_schaeffer_kg(200, 150) == pytest.approx(esperado_kg, rel=1e-9)


def test_aruco_calibra_y_estima_con_rango_y_sin_ser_vinculante():
    r = client.post(URL, json=_cuerpo_aruco())
    assert r.status_code == 200, r.text
    d = r.json()

    m = d["muestra"]
    assert m["fuente_calibracion"] == "ARUCO"
    # La detección ArUco puede diferir ~1 px en el lado del marcador.
    assert m["cm_por_pixel"] == pytest.approx(0.2, rel=0.02)
    assert m["largo_corporal_cm"] == pytest.approx(140, rel=0.02)
    assert m["profundidad_pecho_cm"] == pytest.approx(70, rel=0.02)
    assert m["perimetro_medido"] is False
    assert m["relacion_ancho_profundidad_supuesta"] == 0.65

    esperado = (
        _perimetro_elipse(m["profundidad_pecho_cm"], 0.65) ** 2
        * m["largo_corporal_cm"]
        / (300 * 2.54**3 / 0.45359237)
    )
    assert d["peso_estimado_kg"] == pytest.approx(esperado, rel=0.005)
    assert d["rango_min_kg"] < d["peso_estimado_kg"] < d["rango_max_kg"]
    assert d["es_vinculante"] is False
    assert d["validado"] is False
    assert d["metodo"] == "ZOOMETRIA_SCHAEFFER_V0"
    assert any("no es un pesaje" in a for a in d["advertencias"])


def test_perimetro_medido_con_cinta_reemplaza_al_supuesto():
    r = client.post(URL, json=_cuerpo_aruco(perimetro_toracico_cm=180))
    assert r.status_code == 200, r.text
    d = r.json()
    largo = d["muestra"]["largo_corporal_cm"]
    esperado = peso_schaeffer_kg(180, largo)
    assert d["peso_estimado_kg"] == pytest.approx(esperado, abs=0.1)
    assert d["rango_min_kg"] == pytest.approx(esperado * 0.9, abs=0.1)
    assert d["rango_max_kg"] == pytest.approx(esperado * 1.1, abs=0.1)
    assert d["muestra"]["perimetro_medido"] is True
    assert d["muestra"]["relacion_ancho_profundidad_supuesta"] is None


def test_calibracion_por_referencia_sin_imagen():
    cuerpo = {
        "puntos": PUNTOS,
        "calibracion": {"tipo": "REFERENCIA", "punto_a": [100, 700], "punto_b": [600, 700], "distancia_cm": 100},
    }
    r = client.post(URL, json=cuerpo)
    assert r.status_code == 200, r.text
    m = r.json()["muestra"]
    assert m["cm_por_pixel"] == pytest.approx(0.2)
    assert m["largo_corporal_cm"] == pytest.approx(140)
    assert m["lado_marcador_px"] is None


def test_sin_marcador_responde_422():
    cuerpo = _cuerpo_aruco()
    cuerpo["imagen_base64"] = _imagen([])
    r = client.post(URL, json=cuerpo)
    assert r.status_code == 422
    assert "marcador" in r.json()["detail"]


def test_dos_marcadores_sin_id_responde_422_y_con_id_funciona():
    cuerpo = _cuerpo_aruco()
    cuerpo["imagen_base64"] = _imagen([(7, 50, 50), (3, 1000, 600)])
    assert client.post(URL, json=cuerpo).status_code == 422

    cuerpo["calibracion"]["marcador_id"] = 7
    r = client.post(URL, json=cuerpo)
    assert r.status_code == 200, r.text


def test_medidas_implausibles_responden_422():
    # Si el marcador midiera 80 cm, el animal tendría 5,6 m de largo.
    cuerpo = _cuerpo_aruco()
    cuerpo["calibracion"]["lado_cm"] = 80
    r = client.post(URL, json=cuerpo)
    assert r.status_code == 422
    assert "fuera del rango plausible" in r.json()["detail"]


def test_punto_fuera_de_la_imagen_responde_422():
    cuerpo = _cuerpo_aruco()
    cuerpo["puntos"] = {**PUNTOS, "punta_nalga": [5000, 400]}
    r = client.post(URL, json=cuerpo)
    assert r.status_code == 422
    assert "fuera de la imagen" in r.json()["detail"]


def test_aruco_sin_imagen_es_rechazado_por_validacion():
    cuerpo = _cuerpo_aruco()
    del cuerpo["imagen_base64"]
    assert client.post(URL, json=cuerpo).status_code == 422


def test_base64_invalido_responde_422():
    cuerpo = _cuerpo_aruco()
    cuerpo["imagen_base64"] = "esto-no-es-base64!!"
    r = client.post(URL, json=cuerpo)
    assert r.status_code == 422


def test_campos_desconocidos_son_rechazados():
    cuerpo = _cuerpo_aruco(precio_por_kg=10)
    assert client.post(URL, json=cuerpo).status_code == 422
