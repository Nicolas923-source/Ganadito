# Evidencia de la entrega de Víctor

Base: `Nicolas923-source/Ganadito`, commit `dde293bc977ac090d631b6c90a2cb4bb6efcb40e`. Validación inicial del 3 de noviembre de 2026 y repetición completa el 4 de noviembre de 2026 (America/Bogota).

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
