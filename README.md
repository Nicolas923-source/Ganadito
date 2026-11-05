# Ganadito

Plataforma ganadera y comercial construida como monolito modular: SvelteKit/TypeScript en `apps/web`, Fastify/TypeScript en `apps/api`, contratos en `packages/contracts` y PostgreSQL/PostGIS como autoridad transaccional. Redis se usa para caché y difusión de eventos.

El recorrido inicial es acceso y organización → lote → puja → cierre → orden pendiente de pago. Esta rama de integración ([PR #37](https://github.com/Nicolas923-source/Ganadito/pull/37)) reúne la web de Víctor con los commits originales N01–N05 de Nicolás y el contrato aprobado #29. Ya incluye arranque HTTP, órdenes REST y una prueba real del recorrido con PostgreSQL, Redis y worker en CI. El catálogo de subastas sigue pendiente: la consulta actual es por identificador.

La [CI del código integrado](https://github.com/Nicolas923-source/Ganadito/actions/runs/41885077011) pasó sobre `27c3cd8`: 108 pruebas backend, 56 de navegador con fixtures, dos del modo HTTP y un recorrido real completo, además de tipos y compilación. Esto no sustituye las correcciones pendientes ni la revisión humana cruzada. Estado por PR: [revisión de Nicolás](docs/REVIEW_NICOLAS_2026-11-04.md). Producción, cobros reales e integraciones externas no habilitadas permanecen desactivados.

## Desarrollo web

Se requiere Node según [.nvmrc](.nvmrc) y npm compatible con [package.json](package.json). Instalar el lockfile desde la raíz:

```bash
npm ci
npm run dev:web -- --host 127.0.0.1 --port 4173 --strictPort
```

La web consulta la API configurada; una API ausente produce un estado de error visible. Para REST al mismo origen, dejar `PUBLIC_API_URL` vacío y configurar `API_INTERNAL_URL=http://127.0.0.1:4000` en el servidor web. La sala usa snapshots HTTP periódicos y pujas REST. `PUBLIC_LIVE_AUCTIONS_ENABLED=false` conserva el transporte WS apagado hasta resolver su hallazgo de seguridad; no se sustituyen fallos por datos ficticios.

## API de desarrollo

Después de configurar PostgreSQL/PostGIS y Redis con datos ficticios y revisar los destinos, arrancar desde la raíz:

```bash
npm run dev:api
```

Para arrancar sin vigilancia, usar `npm run start:api`. Ambos comandos cargan el `.env` raíz si existe y respetan las variables ya inyectadas. El ejemplo fija `API_HOST=127.0.0.1`, `API_PORT=4000`, `RUN_MIGRATIONS_ON_START=false`, `START_WORKERS=false` y `PAYMENTS_ENABLED=false`. Nicolás y el responsable del entorno deben acordar la activación de migraciones y workers sobre una base ficticia aislada; sin workers no se acredita el cierre automático. La [guía de desarrollo](docs/DEVELOPMENT.md) describe el arranque, las variables y sus límites.

## Validación

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:e2e:http
npm run test:config
```

Los tests backend requieren PostgreSQL/PostGIS y Redis aislados. `test:e2e` y `test:e2e:http` usan fixtures identificados; `test:config` comprueba el entorno sin conectar a servicios. `test:e2e:real` es una suite separada con API y persistencia reales que la CI ejecuta únicamente sobre PostGIS/Redis efímeros, con guardias de destino y pagos apagados. Su [configuración aislada](docs/DEVELOPMENT.md#navegador-con-api-y-persistencia-reales-en-ci) rechaza destinos remotos o distintos del destino de prueba permitido; no usar bases compartidas, el PostgreSQL local existente ni Neon para ese comando. Consultar resultados y límites del SHA final en CI y en el PR. No almacenar secretos ni datos reales en reportes.

## Trabajo entre Víctor y Nicolás

- [Instalación, comandos y variables](docs/DEVELOPMENT.md).
- [Propiedad de archivos y reservas](docs/OWNERSHIP.md).
- [Entregas V01-V06 y cola de PR](docs/VICTOR_DELIVERY.md).
- [Inventario de contratos y solicitudes a Nicolás](docs/CONTRACT_REVIEW.md).
- [Ramas, revisión cruzada e integración](docs/GIT_WORKFLOW.md).
- [Staging, versión y recuperación](infrastructure/deployment/README.md).
- [Arquitectura](docs/ARCHITECTURE.md) y [reglas de agentes](AGENTS.md).

Cada entrega requiere rutas asignadas, contrato identificado, pruebas pertinentes y revisión del otro programador. Las dependencias se publican en PR separado. Reportar incidencias usando las [plantillas](.github/ISSUE_TEMPLATE/) y describir alcance, evidencia y limitaciones en el [PR](.github/PULL_REQUEST_TEMPLATE.md).
