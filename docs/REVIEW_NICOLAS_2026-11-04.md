# Revisión de las entregas de Nicolás — 4 de noviembre de 2026

Revisor: Víctor con Codex. La revisión conserva la propiedad de archivos: no se corrigió código de API, SQL ni contratos de Nicolás. Sus commits se reunieron sin modificaciones en una rama aislada para verificar la integración; no se fusionaron en `main`.

## Contrato y secuencia

El usuario autorizó expresamente **solo** la aprobación y fusión del PR [#29](https://github.com/Nicolas923-source/Ganadito/pull/29). Se comprobó que contenía únicamente `docs/api/contrato-v1-acceso-lotes.md`, SHA `70fc1a5`, CI correcta y base `main`. Se revisaron rutas, sesión, errores, idempotencia, eventos y lectura de órdenes. Quedó integrado en `2ffe7d4`. Esto no aprueba las implementaciones de backend ni sus migraciones.

N01 aporta arranque real y migraciones versionadas; N02 agrega permisos por organización/rol; N03 endurece pujas; N04 agrega órdenes y nueva proyección WS; N05 agrega privacidad de lecturas. La rama N05 ya contiene N01/N02/N03/N04, A1/outbox, A2/roles y N06/pagos; A4/seed sigue independiente. No contar los commits heredados como cambios nuevos de cada PR.

## Hallazgos para corregir por su autor

| PR / revisión fijada | Prioridad | Hallazgo y caso | Corrección solicitada |
|---|---|---|---|
| #26, `894ad3a` | P1 | `seed.ts:46` valida `new URL(DATABASE_URL).hostname`, mientras el driver admite sobrescribir host por query. `postgresql://localhost/seed_demo?host=remote.example.invalid` pasa como local y `pg-connection-string` resuelve destino remoto. | Validar el destino efectivo del driver o rechazar overrides antes de toda conexión/migración. |
| #32, `fed849e` | P1 | `subastas.service.ts:299-300` usa `NOW()` fijado al comenzar la transacción antes de esperar `FOR UPDATE`. Bloquear un lote, enviar puja antes del cierre y liberar después: el chequeo conserva tiempo anterior. Es un caso de reproducción por ejecutar en DB aislada. | Evaluar el reloj real después de obtener el bloqueo; añadir regresión con dos conexiones y anti-sniping desactivado. |
| #32, `fed849e` | P2 | Snapshot calcula `es_abierta` solo con estado y cierre (`:193`), pero la nueva escritura rechaza inicio futuro (`:323-324`). Un lote ACTIVO con inicio futuro aparece abierto aunque toda puja es rechazada. | Incluir inicio en el cálculo oficial y probar coherencia snapshot/POST. |
| #33, `503adf2` | P1 | WS acepta JWT en `access_token` (`subastas.ws.ts:187-189`), y `server.ts:57` habilita logger sin redacción. Ensayo local Fastify con marcador sintético confirmó que incoming request registra toda la URL. | Redactar credencial antes de escribir logs o acordar ticket efímero de alcance WS. No habilitar este transporte en producción mientras tanto. |
| #33, `503adf2` | P2 | `ordenes-consulta.service.ts:35` convierte timestamptz a Date/ms para el cursor; el filtro `:82` compara con precisión de microsegundos. Fechas `.123900` y `.123800`, limit=1: el cursor `.123000` omite la segunda. El parser OID1184 confirmó la pérdida. | Conservar precisión de la clave ordenada dentro del cursor; regresión con valores en el mismo milisegundo. |
| #34, `4e636bc` | P1 | Mapa aproxima establos ajenos, pero `spot.service.ts:195-196` aún publica ST_Y/ST_X exactos por `/cotizaciones/pizarra`, junto con establecimiento_id. | Aplicar la misma política de privacidad a todas las lecturas públicas, incluido Spot. |
| #34, `4e636bc` | P2 | Redacción por regex (`trazabilidad.service.ts:13,21-22`) deja `dirección`, `teléfono` y `conductor:{nombre,documento}`. La metadata libre se expone en pasaporte público. Una prueba pura con datos ficticios lo confirmó. | Acordar proyección pública explícita o esquema público permitido; cubrir claves acentuadas, anidadas y texto libre. |
| #34, `4e636bc` | P2 | Respuesta nueva añade `vista`, `ubicacion_aproximada` y autor/dirección nullable, pero los tipos compartidos no lo representan; aparece `null as unknown as string`. | Publicar DTO tipado consistente antes de cerrar V05, sin casts que oculten nulabilidad. |

Los marcadores y ejemplos anteriores son ficticios. No se usaron JWT reales para reproducir logs ni se conectó el seed a una base de datos.

Revisiones `REQUEST_CHANGES` publicadas sobre los SHA de la tabla: [#26](https://github.com/Nicolas923-source/Ganadito/pull/26#pullrequestreview-5769055166), [#32](https://github.com/Nicolas923-source/Ganadito/pull/32#pullrequestreview-5769055482), [#33](https://github.com/Nicolas923-source/Ganadito/pull/33#pullrequestreview-5769055789) y [#34](https://github.com/Nicolas923-source/Ganadito/pull/34#pullrequestreview-5769056109).

Actualización posterior revisada: N05 `26e8179` incorpora cambios originales de Nicolás en parada acotada de workers (cinco segundos), prueba de ciclo colgado y puerto API 4000. Se revisó su diff completo y se incorporó como baseline de verificación, sin modificar fuentes de API. Los cambios no corrigen los hallazgos de la tabla; las solicitudes de cambios siguen vigentes.

## Decisiones que requieren coordinación

- N03 no incluye organización activa en la huella de idempotencia. Definir si repetir la misma clave tras cambiar de organización consulta la operación original o es un conflicto; la web crea claves distintas para intenciones/contextos nuevos.
- El WS verifica firma y expiración, pero no la membresía/contexto actuales del middleware HTTP. Definir revocación y alcance de la sala antes de su habilitación.
- Conservar hashes públicos de metadata privada de baja entropía permite verificar candidatos por diccionario. Se demostró con datos sintéticos. Acordar qué evidencia de integridad debe ser pública; no cambiar la cadena ni su contrato unilateralmente.
- El contrato de acceso podría explicitar el DTO de `user` y perfil, hoy descrito por nombre; los consumidores actuales se contrastaron con la implementación.

## Trabajo de Víctor desbloqueado

- Configurar scripts N01 y carga explícita de `.env` raíz, alinear API 4000/proxy y mantener pagos apagados.
- Permitir autorregistro COMPRADOR/VENDEDOR y consumir el contexto confirmado.
- Implementar GET de listado/detalle de órdenes, estados vacíos, cursor y cambio de contexto, con pago no disponible.
- Adaptar parser del envelope público WS, pero conservarlo apagado por defecto por el hallazgo de logs. El modo HTTP consulta snapshots oficiales y envía pujas REST; el servidor mantiene toda decisión comercial.
- Añadir CI con navegador y API reales sobre DB/Redis efímeros, sin trazas con credenciales, seeds ni conexiones a Neon o bases locales existentes.

No se declara aceptación final ni privacidad resuelta mientras permanezcan los hallazgos de backend y la revisión cruzada de los cambios de Víctor.
