# Preparación de staging y recuperación

Este directorio prepara V06. No activa producción, no provisiona servicios ni ejecuta migraciones en una base compartida. El despliegue integrado está condicionado al arranque N01, contratos revisados, lectura autorizada de órdenes y revisión final de Nicolás. Ver [solicitudes de integración](../../docs/CONTRACT_REVIEW.md).

## Configuración por entorno

| Variable / recurso | Desarrollo | Staging |
|---|---|---|
| `PUBLIC_API_URL` | Vacío: REST al mismo origen y proxy Svelte. | Vacío para proxy del servidor; si se define un origen público, debe estar autorizado y soportar las peticiones de sesión. Nunca contiene secretos. |
| `API_INTERNAL_URL` | `http://127.0.0.1:4000`, solo servidor. | Origen privado/autorizado de la API; configurar en el host del servidor web. No exponer credenciales en variables `PUBLIC_*`. |
| `PUBLIC_WS_URL` | Opcional: origen `ws://` o `wss://`; sin él se usa el origen web. El proxy Vite de desarrollo reenvía WS a `API_INTERNAL_URL`. | Origen `wss://` autorizado o reverse proxy que admita Upgrade de `/api/v1/subastas/:id/live`. El proxy REST de Svelte no sustituye el proxy WS. |
| `PUBLIC_LIVE_AUCTIONS_ENABLED` | `false`: snapshots HTTP y pujas REST. | Conservar `false` hasta corregir la exposición del JWT en logs y revisar revocación del canal con Nicolás. |
| `DATABASE_URL` o `DATABASE_*` | Solo API/servicios locales con datos ficticios. | Secretos del host de API, base de staging aislada confirmada por Nicolás. No reutilizar por coincidencia un proyecto Neon existente. |
| `REDIS_URL` o `REDIS_*` | Solo API/workers locales. | Redis de staging; PostgreSQL conserva la autoridad de estado. |
| `JWT_SECRET` | Valor ficticio de desarrollo. | Secreto propio del entorno administrado fuera de Git; N01 debe rechazar configuración insegura. |
| `GANADITO_RELEASE_SHA` | Opcional, `development` si falta. | SHA completo del código revisado, inyectado al construir la web y registrado junto al artefacto. |
| Pagos y servicios externos | Desactivados en este recorrido. | Desactivados hasta habilitación, contrato y pruebas separadas. No inferir que una variable habilita el cobro. |

El servidor web usa `@sveltejs/adapter-node` `6.0.1` con SvelteKit `3.1.1`. `npm run start --workspace=@ganadito/web` ejecuta el artefacto `build/index.js` desde la web; el host debe configurar el entorno del proceso y enrutar REST/WS. El `build` por sí solo no demuestra que el host soporte proxy REST, secretos de servidor ni WebSocket. No usar el servidor Vite de desarrollo como servidor de staging.

## Arranque API de integración

Con Node 24, `npm run start:api` ejecuta `apps/api/src/server.ts` mediante `tsx`; `npm run dev:api` añade vigilancia para desarrollo. Los scripts cargan el `.env` de la raíz si existe y conservan las variables inyectadas por el host. No copiar un `.env` local a staging: inyectar la configuración del entorno autorizado.

El ejemplo local fija `API_HOST=127.0.0.1`, `API_PORT=4000` y `API_INTERNAL_URL=http://127.0.0.1:4000`. Ajustar el host privado de escucha y el destino del proxy de forma coordinada en staging. Establecer expresamente `RUN_MIGRATIONS_ON_START=false` hasta que Nicolás confirme el destino y la estrategia de migración; N01 migra por defecto fuera de producción. El ejemplo también fija `START_WORKERS=false`: Nicolás coordina su activación para outbox y cierre automático, que por defecto N01 inicia si falta esa variable. Activar ambos flags solo en local ficticio o staging coordinado. El servidor comprueba PostgreSQL antes de escuchar y cierra conexiones y workers con `SIGINT`/`SIGTERM`.

Mantener `PAYMENTS_ENABLED=false` y dejar `WEBHOOK_SECRET` y `PAYMENTS_CHECKOUT_BASE_URL` vacíos. `PAYMENTS_PROVIDER=SIMULADOR` describe configuración y no habilita un proveedor externo. El comando de arranque y la prueba aislada de entorno no sustituyen la evidencia PostgreSQL, Redis, navegador y revisión cruzada de la versión final.

## Preparar una versión

1. Integrar contratos y dependencias en el orden de [VICTOR_DELIVERY.md](../../docs/VICTOR_DELIVERY.md). Actualizar la rama y obtener revisión cruzada del código final.
2. Ejecutar en instalación limpia:

   ```bash
   npm ci
   npm run typecheck
   npm run lint
   npm test
   npm run build
   npx playwright install --with-deps chromium
   npm run test:e2e
   ```

   Las pruebas backend requieren PostgreSQL con PostGIS y Redis aislados. El job navegador usa respuestas controladas explícitas y no necesita una base compartida. Si falta un servicio o comando, registrar **no ejecutado/fallido**, no sustituirlo con un health fijo.
   En una construcción candidata de staging, establecer antes `GANADITO_RELEASE_SHA` al resultado de `git rev-parse HEAD` en el entorno del proceso de build. Construir y registrar el mismo checkout revisado; no etiquetar un árbol con cambios pendientes como si correspondiera al SHA publicado.
3. Registrar la identidad del artefacto desde un checkout sin cambios pendientes:

   ```bash
   git status --short
   git rev-parse HEAD
   git log -1 --format=%cI
   node --version
   npm --version
   ```

   En PowerShell, inventariar migraciones y su contenido sin ejecutarlas:

   ```powershell
   Get-ChildItem -LiteralPath infrastructure/database/migrations -Filter '*.sql' |
     Sort-Object Name | Select-Object Name
   Get-ChildItem -LiteralPath infrastructure/database/migrations -Filter '*.sql' |
     Sort-Object Name | Get-FileHash -Algorithm SHA256
   Get-FileHash -LiteralPath package-lock.json -Algorithm SHA256
   ```

   En Bash:

   ```bash
   git ls-files infrastructure/database/migrations
   sha256sum infrastructure/database/migrations/*.sql package-lock.json
   ```
4. Copiar [release-record.example.md](release-record.example.md) a un registro de versión sin secretos. Registrar SHA web, SHA API, contrato, hashes, migraciones realmente aplicadas, resultados y versión anterior recuperable. Nicolás confirma el estado real de la base; la lista de archivos no demuestra aplicación.
5. Confirmar host, entorno, base ficticia aislada, origen REST y ruta WS. Usar el arranque N01 anterior y coordinar con Nicolás migraciones y workers. Registrar la API como operativa únicamente después de verificar el recorrido real del SHA revisado.
6. El responsable de staging despliega únicamente el artefacto revisado en el entorno autorizado. Este runbook no autoriza producción ni crea un despliegue automático en CI.

## Recorrido real de aceptación

La integración añade el job `browser-real`: web 4180, API 4181, PostGIS 16-3.4 y Redis 7 efímeros, cuentas ficticias, pagos y WS apagados. `npm run test:e2e:real` exige las guardias documentadas en [DEVELOPMENT.md](../../docs/DEVELOPMENT.md); no usar una base existente para ejecutarlo. Su resultado acredita únicamente el recorrido de ese SHA en CI y no constituye despliegue ni aceptación de staging. Mantener `PUBLIC_LIVE_AUCTIONS_ENABLED=false` hasta corregir el registro de tokens de N04.

Usar datos ficticios acordados con Nicolás y dos organizaciones. Adjuntar evidencia de navegador y API con fecha, SHA e IDs ficticios. No guardar contraseñas ni JWT en capturas/reportes compartidos.

- Acceder como comprador/vendedor y seleccionar un contexto devuelto por API; probar 401, 403 y expiración. Si `me` y JWT divergen tras un cambio externo de contexto, mostrar el estado de sesión y solicitar nuevo acceso.
- Publicar un lote válido y consultar su ID oficial. Hasta integrar un contrato GET de listado, usar consulta por ID y no afirmar que existe catálogo completo.
- Enviar puja, probar reintento conservando clave para la misma solicitud y conflicto de clave con solicitud distinta. Nicolás prueba concurrencia y persistencia; la web refleja el resultado del servidor.
- Interrumpir WS y restablecerlo; obtener snapshot de nuevo antes de reanudar pujas. Confirmar precio, versión y cierre oficiales; no adjudicar por el reloj del navegador.
- Nicolás ejecuta el cierre con el mecanismo y permisos acordados. Consultar la orden por el contrato de lectura aprobado y verificar vínculo al lote y `PENDIENTE_PAGO`. La web no debe fabricar una orden cuando la ruta de lectura no exista.
- Consultar mapa, Spot y pasaporte: resultados válidos, ausencia y error; organización ajena y campos privados conforme al contrato. No enviar eventos simulados a servicios externos.

La suite con fixtures no sustituye este recorrido. La [CI 41884285818](https://github.com/Nicolas923-source/Ganadito/actions/runs/41884285818) ya acredita acceso, publicación, puja, cierre y orden en servicios efímeros del SHA `17a3af7`. No acredita staging, concurrencia no cubierta, privacidad resuelta ni transporte WS de producción. Mientras falten las correcciones bloqueantes y la revisión final de Nicolás, V06 no queda aceptado al 100%.

## Recuperación sin pérdida de datos

1. Registrar incidente, entorno, SHA afectado, último SHA aceptado y síntomas. Suspender promoción de la versión y coordinar escrituras/worker con Nicolás si el fallo afecta transacciones.
2. Identificar el artefacto anterior y sus migraciones compatibles en el registro de versión. Verificar si el cambio es solo web o también API/esquema. No ejecutar SQL inverso ni reiniciar una base para arreglar una pantalla.
3. Si el esquema es compatible, el responsable del host vuelve a desplegar el artefacto anterior identificado por SHA y conserva las variables del entorno. Anotar ID del despliegue y hora. No usar `git reset --hard`, force-push ni borrado de volúmenes como recuperación operativa.
4. Si el esquema es incompatible o se sospecha pérdida de datos, Nicolás prepara una corrección hacia adelante o restauración coordinada sobre una copia aislada. Un snapshot de Neon no se restaura ni sobrescribe sin autorización explícita. No alterar migraciones ya aplicadas.
5. Verificar acceso, snapshot, lectura de órdenes, privacidad y WS en la versión recuperada, además de una operación PostgreSQL. Confirmar que órdenes y efectos no se duplicaron y que pagos siguen desactivados.
6. Registrar responsable, resultado, SHA recuperado, impacto y acciones pendientes. Reabrir promoción solo tras checks y revisión cruzada.

## Migraciones presentes en la base dde293b

1. `0001_initial_schema.sql`
2. `0002_ordenes_compra.sql`
3. `0003_pagos_transacciones.sql`
4. `0004_liquidaciones_vendedores.sql`
5. `0005_trazabilidad_bovina.sql`
6. `0006_compras_mayoristas_pools.sql`
7. `0007_gmx_ordenes_matching.sql`
8. `0008_logistica_fletes.sql`
9. `0009_integraciones_tributarias_financieras.sql`

Este inventario es de archivos versionados, no un registro de ejecución. Nicolás mantiene migraciones y seeds, identifica versiones aplicadas y coordina cualquier cambio en staging.

La integración N01–N05 añade `0010_contexto_activo_unico.sql` y `0011_pujas_organizacion_postora.sql`, incluidas sin modificaciones desde la rama de Nicolás. La CI real usa el arranque versionado sobre DB efímera; confirmar por separado el historial aplicado en staging.
