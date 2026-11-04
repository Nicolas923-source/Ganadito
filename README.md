# Ganadito

Plataforma ganadera y comercial construida como monolito modular: SvelteKit/TypeScript en `apps/web`, Fastify/TypeScript en `apps/api`, contratos en `packages/contracts` y PostgreSQL/PostGIS como autoridad transaccional. Redis se usa para caché y difusión de eventos.

El recorrido inicial es acceso y organización → lote → puja → cierre → orden pendiente de pago. La preparación web y sus pruebas aisladas no acreditan todavía el recorrido integrado. En la base revisada `dde293b`, la API tiene rutas y pruebas, pero su script `dev` no inicia un servidor HTTP; faltan contratos de lectura de listado de subastas y de órdenes. Ver [brechas de integración](docs/CONTRACT_REVIEW.md). Producción, cobros reales e integraciones externas no habilitadas permanecen desactivados.

## Desarrollo web

Se requiere Node según [.nvmrc](.nvmrc) y npm compatible con [package.json](package.json). Instalar el lockfile desde la raíz:

```bash
npm ci
npm run dev:web -- --host 127.0.0.1 --port 4173 --strictPort
```

La web consulta la API configurada; una API ausente produce un estado de error visible. Para REST al mismo origen, dejar `PUBLIC_API_URL` vacío y configurar `API_INTERNAL_URL` en el servidor web. La guía explica el proxy de desarrollo y la configuración WS; no se sustituyen fallos por datos ficticios.

## Validación

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Los tests backend requieren PostgreSQL/PostGIS y Redis aislados. Los e2e de navegador usan fixtures identificados y prueban la interfaz; no acreditan permisos, concurrencia ni persistencia de una API real. Consultar resultados y límites del SHA final en CI y en el PR. No almacenar secretos ni datos reales en reportes.

## Trabajo entre Víctor y Nicolás

- [Instalación, comandos y variables](docs/DEVELOPMENT.md).
- [Propiedad de archivos y reservas](docs/OWNERSHIP.md).
- [Entregas V01-V06 y cola de PR](docs/VICTOR_DELIVERY.md).
- [Inventario de contratos y solicitudes a Nicolás](docs/CONTRACT_REVIEW.md).
- [Ramas, revisión cruzada e integración](docs/GIT_WORKFLOW.md).
- [Staging, versión y recuperación](infrastructure/deployment/README.md).
- [Arquitectura](docs/ARCHITECTURE.md) y [reglas de agentes](AGENTS.md).

Cada entrega requiere rutas asignadas, contrato identificado, pruebas pertinentes y revisión del otro programador. Las dependencias se publican en PR separado. Reportar incidencias usando las [plantillas](.github/ISSUE_TEMPLATE/) y describir alcance, evidencia y limitaciones en el [PR](.github/PULL_REQUEST_TEMPLATE.md).
