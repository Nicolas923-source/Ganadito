# Los 24 hitos del flujo inicial V01–V06

Son **24 en total**, no 24 tareas adicionales: seis bloques con cuatro criterios cada uno. Se conserva el denominador del informe anterior. I = implementación y comprobación estática; F = navegador con respuestas controladas; R = integración real con datos ficticios; A = aceptación cruzada de Nicolás. Los tres primeros son evidencia técnica; el cuarto necesita al otro programador.

Base de esta entrega: `5b73e470` de main. #37 y #44 ya están integrados por otras acciones; esta entrega conserva las correcciones originales de Nicolás #46/#50. El trabajo previo se preservó localmente sin publicar duplicados. No se fusiona ni se despliega en esta entrega.

## Matriz y comprobación

| Bloque | I | F | R | A: revisión cruzada pendiente |
|---|---|---|---|---|
| V01 base web | Cliente, proxy, carga/error/reintento y build Node | Respuestas inválidas/errores sin sustitución demo | Web compilada con API HTTP real | Revisar ejecución, cliente y errores |
| V02 acceso/contexto | Sesión y contexto emitidos por servidor | 401/403, expiración, cambio de organización y respuestas tardías | Registro, login, recarga y organización ajena | Revisar permisos y cancelación |
| V03 lotes/pujas | Formularios y snapshot oficial | Validación, recibo, reintento idempotente y navegación | Mismo lote publicado en la web y pujado realmente | Revisar confirmación y reintentos |
| V04 cierre/órdenes | Consulta REST y recuperación HTTP | Sin adjudicar por reloj local; errores y aislamiento | Worker cierra el mismo lote; orden persistida y ajeno rechazado | Revisar cierre, orden y recuperación |
| V05 mapa/Spot/trazabilidad | Aproximación visible, DTO nullable y vistas discriminadas | Anónimo/ajeno/dueño, XSS, errores y cambios de contexto | **Pendiente de la CI final de esta entrega:** mapa/Spot por actor, pasaporte privado e integridad y API pública sin hashes | Revisar privacidad y decisiones públicas |
| V06 navegador/entrega | CI, guardias y runbook; artefacto con SHA | Suite fixtures y modo HTTP | PostGIS/Redis efímeros, API/worker reales y web adapter-node compilada | Revisar evidencia y acordar staging/recuperación |

La evidencia de las filas distintas de V05-R ya existía en #37/#44; se repite en la CI de esta entrega para detectar regresiones del conjunto. La columna R acredita el recorrido ejecutado y no todas las combinaciones posibles del producto. La nueva prueba V05 debe pasar antes de elevar el índice histórico de 17/24 a **18/24**. Las seis A permanecen pendientes; 18/24 sería 75% del índice de evidencia, no 75% del esfuerzo o de toda Ganadito.

## Hallazgos de Nicolás contrastados con la nueva base

Se revisaron los diffs completos de #46/#50 y sus CI exactas verdes ([41972443910](https://github.com/Nicolas923-source/Ganadito/actions/runs/41972443910), [41975488394](https://github.com/Nicolas923-source/Ganadito/actions/runs/41975488394)). Lookup seguro, rechazo de tipos nuevos inválidos y omisión pública de hashes están implementados; no se repiten como defectos abiertos.

- [#46, revisión 5785013448](https://github.com/Nicolas923-source/Ganadito/pull/46#pullrequestreview-5785013448): el DTO cercano aún heredaba dirección obligatoria pese al null público real. Esta entrega corrige solo ese tipo bajo transferencia y añade regresión de compilación rojo→verde; el DTO privado de creación sigue exigiendo string. Nicolás revisará el arreglo.
- [#50, revisión 5785012960](https://github.com/Nicolas923-source/Ganadito/pull/50#pullrequestreview-5785012960): los registros idempotentes anteriores a la migración 0014 conservan `organizacion_id=NULL` y el servicio devuelve su recibo sin comprobar la organización. Reproducción sin DB con el servicio real instrumentado: org A guardada/activa B → 409; registro heredado NULL → recibo original. Falta recuperar la organización original o fallar con conflicto opaco y probar los tres casos de legado. Pujas/SQL siguen siendo rutas de Nicolás, fuera de la transferencia V05. La prueba con cuentas nuevas no acredita una actualización de datos existentes.

Este segundo bloqueo impide afirmar que el flujo comercial completo está libre de defectos, aunque los recorridos de nueva instalación pasen. El índice registra evidencia cubierta y no elimina hallazgos de compatibilidad. No se aprobó ninguno de esos dos PR completos ni el arreglo propio.

La revisión de #47 también reconoció membresía Bearer, revocación respondida y limpieza corregidas; encontró un [P2 de consulta de autorización que queda pendiente, revisión 5785067356](https://github.com/Nicolas923-source/Ganadito/pull/47#pullrequestreview-5785067356). Sin deadline, el supervisor omite revalidaciones posteriores mientras el hub sigue entregando hasta vencer la credencial. Se reprodujo sin red con una promesa PostgreSQL pendiente. Debe corregirlo Nicolás en WS; la recuperación validada aquí sigue siendo HTTP y el transporte WS web permanece apagado. No se presenta su CI verde como prueba de este caso.

## Revisión que se solicita a Nicolás

Revisar el diff final de Víctor y sus pruebas, incluido el pequeño arreglo del DTO de dirección pública bajo [transferencia V05](TRANSFERENCIA_V05_2026-11-04.md). Confirmar cada aceptación sobre el SHA revisado y corregir los hallazgos antes de marcar su A. Ni Codex ni su revisión independiente sustituyen esta aceptación. El hecho de que un PR esté integrado tampoco la demuestra.

El modo probado conserva snapshots HTTP y pujas REST. Transporte WS web, ruta pública web de pasaporte, pagos reales e integraciones externas no habilitadas permanecen apagados. La API mantiene sus endpoints de WS/pasaporte. Habilitarlos requiere revisión y pruebas específicas. Staging compartido y producción no se desplegaron; no se usó Neon ni PostgreSQL local existente para pruebas reales.

El alcance comercial posterior (IA en campo, proveedor de pagos, mayoristas, logística y otros módulos) no tiene un porcentaje global acordado en esta matriz. No se garantiza ausencia universal de errores ni se declara aceptación 24/24 antes de la revisión cruzada.
