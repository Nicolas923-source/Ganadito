# Contrato API v1: consulta autorizada (N05)

Este documento completa la sección 7 de `contrato-v1-acceso-lotes.md`. Los cambios son aditivos: no se renombra ni se quita ningún campo.

## `GET /establecimientos/cercanos`
Ruta pública. El token es opcional, pero si se envía uno inválido la respuesta es `401`.

Query: `lat`, `lon`, `radio_km` (≤ 2000), `tipo`, `limit` (≤ 100), `offset`.

Lo que recibe cada caso:

| Quién consulta | `ESTABLO` propio | `ESTABLO` ajeno | Otros tipos (CAMAL, FERIA_GANADERA, …) |
|---|---|---|---|
| Organización dueña | exacto + `direccion_texto` | — | exacto |
| Otra organización o anónimo | — | **aproximado** (rejilla de 0.01°, ≈1.1 km), `direccion_texto: null` | exacto |

- Campo nuevo `ubicacion_aproximada: boolean`. Cuando vale `true`, la web debe dibujar un área o un marcador difuso, no un punto exacto.
- Para las ubicaciones aproximadas, el filtro por radio y `distancia_km` se calculan sobre el punto aproximado. Así no se puede deducir la ubicación real combinando varias consultas.

## `GET /trazabilidad/bovinos/:id/pasaporte`
Ruta pública, usada por el QR. El token es opcional.

- Campo nuevo `vista`:
  - `"COMPLETA"` solo para la organización propietaria del bovino.
  - `"PUBLICA"` para todos los demás.
- En la vista `PUBLICA`:
  - `eventos[].autor_id` es `null`.
  - En `eventos[].metadata`, las claves con ubicación o datos personales (`gps`, `lat`, `lon`, `coordenadas`, `direccion`, `dni*`, `ruc`, `telefono`, `email`, `placa`, …) valen `"[REDACTADO]"`.
- Los hashes no cambian. La integridad se comprueba con `GET /trazabilidad/bovinos/:id/verificar`, que recalcula en el servidor. La web **no** debe recalcular hashes con la metadata redactada.

## `GET /cotizaciones/pizarra` (Spot)
Sin cambios. Para publicar una cotización ya se exige que el establecimiento pertenezca a la organización activa.
