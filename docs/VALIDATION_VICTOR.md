# Evidencia de la entrega de Víctor

Base: `Nicolas923-source/Ganadito`, commit `dde293bc977ac090d631b6c90a2cb4bb6efcb40e`. Validación inicial del 3 de noviembre de 2026 y repetición completa el 4 de noviembre de 2026 (America/Bogota).

## Integración posterior con N01–N05 — 4 de noviembre de 2026

Contrato #29 integrado en `2ffe7d4`; baseline original de Nicolás `26e8179` (N05 y dependencias), reunido con #35/#36 en la rama aislada `feature/victor/v04-v06-integracion-nicolas`. Esto no fusiona los PR de código en main ni acredita resolución de los [hallazgos](REVIEW_NICOLAS_2026-11-04.md).

| Comprobación de integración | Evidencia local |
|---|---|
| `npm run typecheck` | Todos los workspaces correctos; Svelte 0 errores y 0 advertencias. |
| `npm run build` | API, web Node, contratos y shared correctos. |
| `npm test --workspace=@ganadito/web` | 5/5 correctas: clave, snapshot, envelope público y recibo privado separados. |
| `npm run test:config` | 36/36 correctas: seis sondas de arranque/.env ficticio y treinta guardias de entorno real. No conectan DB. |
| `npm run test:proxy` | 2/2 correctas tras compilar. |
| `npm run test:e2e` | 56/56 correctas; omite los dos casos HTTP, ejecutados aparte. Fixtures explícitos. |
| `npm run test:e2e:http` | 2/2 correctas: modo HTTP predeterminado sin WebSocket/token en URL, snapshot y puja REST. |
| Regresiones rojo → verde | HTTP 200 inesperado no confirma registro/publicación/puja; 409 `IDEMPOTENCY_IN_PROGRESS` conserva la clave. Error 403 de paginación retira datos; cambio de contexto/ruta descarta respuestas anteriores. |
| Configuración del recorrido real | Un test detectado con `--list`; TypeScript focal correcto. Guardia rechaza antes del import backend. Su ejecución real se reserva al job efímero de CI. |
| API/DB/worker reales | Por comprobar en la CI de esta rama. No se ejecutaron pruebas backend contra el PostgreSQL local existente ni Neon. |
| Revisión cruzada y staging | Pendientes; la revisión técnica del asistente detectó/corrigió el caso de idempotencia, pero no sustituye la revisión final de Nicolás. |

La nueva suite real cubre registro VENDEDOR y publicación web, acceso COMPRADOR, puja del navegador, reintento persistido, cierre automático, orden autorizada y rechazo 404 ajeno. Usa datos ficticios y pagos apagados. No se conservan trazas, vídeos ni capturas del recorrido real. El WS operativo permanece deshabilitado por el hallazgo de logs de N04; el pasaporte público sigue inactivo por los pendientes N05.

## Evidencia de la entrega inicial #35/#36

| Comprobación | Resultado |
|---|---|
| Instalación del lockfile con `npm ci` | Correcta; Node 24.21.0, npm 11.19.0. |
| `npm run typecheck` | Correcto en todos los workspaces; web sin errores ni advertencias de Svelte. |
| `npm run build` | Correcto para API, web con adapter-node, contratos y shared. |
| `npm run lint` | Termina correctamente, pero la base no define reglas de lint en los workspaces. No equivale a una auditoría de estilo. |
| `npm test --workspace=@ganadito/web` | 3 pruebas unitarias correctas: idempotencia, snapshot ajeno/incompleto y eventos. |
| `npm run test:proxy` después del build | 2 pruebas correctas de la salida Node: entorno privado, Bearer, consulta, cuerpo POST e idempotencia; las cookies del navegador no se reenvían. |
| `npm run test:e2e` | 24 pruebas Chromium con respuestas controladas; ver suite y reporte local. No usa credenciales reales ni realiza cobros. |
| `git diff --check` | Correcto. |
| Salida Node de producción en localhost | Página de acceso visible en escritorio/móvil; proxy devuelve 502 claro con API apagada. |
| Backend con PostgreSQL/Redis reales | CI del PR de dependencias #35 correcta, incluido `npm test`, con PostGIS 16-3.4 y Redis aislados. [Ejecución 41830581839](https://github.com/Nicolas923-source/Ganadito/actions/runs/41830581839). El PostgreSQL local requiere credenciales no disponibles; no se ejecutaron pruebas que borran datos sobre ese servicio. |
| Recorrido web + API real | Pendiente de N01, contrato de lectura de órdenes y revisión conjunta. |
| Revisión final de Nicolás | Pendiente. No se autoaprueba esta entrega. |

Las pruebas de navegador cubren acceso, cambio de organización, recarga, revocación con JSON y sin JSON, discrepancia perfil/token, vencimiento durante cambio de contexto, navegación móvil, publicación confirmada, lote por ID, errores, puja rechazada, reintento idempotente, reconexión/snapshot, reloj sin adjudicación, consultas lentas, filtros, ausencia de datos, trazabilidad, autorización rechazada, respuestas malformadas y texto de mapa protegido frente a HTML. Dos regresiones adicionales reproducen y corrigen la habilitación de pujas y reintentos durante una reconexión: ambos esperan un snapshot solicitado con el socket actual abierto.

Los fixtures viven solo en `tests/e2e`. El modo operativo no usa sustitución automática por datos de demostración. Los módulos posteriores están deshabilitados, incluidos cobros y confirmaciones externas.

Neon: se inspeccionó en lectura el proyecto conectado y la rama `ganadito-preview`. Su esquema corresponde a otra implementación (`ganadito.app_users`, `ganadito.auctions`, etc.), mientras esta base usa `users`, `organizaciones` y `lotes_subasta`. No se aplicó SQL ni se modificó Neon.

Bloqueos y contratos pendientes: [CONTRACT_REVIEW.md](CONTRACT_REVIEW.md). Procedimiento de staging y recuperación: [infrastructure/deployment](../infrastructure/deployment/README.md).

Reglas de `main` comprobadas en GitHub: ruleset activo `reglas-main` (`26218842`), un PR y una aprobación requeridos; las conversaciones deben resolverse. La lista de checks obligatorios del ruleset está vacía. Ejecutar CI y exigir sus resultados sigue siendo parte del procedimiento; no se modificó la protección ni se eludió la aprobación.
