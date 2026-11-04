# Integración de la API de Nicolás — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** conectar las órdenes autorizadas, alinear el arranque y verificar web + API reales en una rama aislada, conservando bloqueadas las promociones con hallazgos de Nicolás.

**Architecture:** conservar SvelteKit/Fastify, PostgreSQL como autoridad y Redis como transporte. Consumir el contrato integrado por PR #29; no editar implementaciones, contratos ni migraciones de Nicolás. Las pruebas reales usan exclusivamente PostgreSQL/PostGIS y Redis efímeros de CI.

**Tech Stack:** Node 24, SvelteKit 3, TypeScript 6, Fastify 5, Playwright, PostGIS 16-3.4 y Redis 7.

**Spec:** `docs/VICTOR_DELIVERY.md`, `docs/OWNERSHIP.md`, `docs/api/contrato-v1-acceso-lotes.md` (PR #29, autorizado por el usuario y fusionado en `2ffe7d4`).

## Global Constraints

- Víctor modifica solo web, navegador, manifiestos, configuración/CI, despliegue y documentación no API.
- No editar SQL, backend ni contratos de Nicolás. No ejecutar seeds ni migraciones en bases locales ajenas o Neon.
- Los pagos permanecen desactivados y las respuestas fallidas nunca se sustituyen con demo.
- No fusionar PR de código de Nicolás ni PR propios sin revisión. Solo #29 tuvo autorización de fusión.
- WS con token en URL queda apagado por defecto hasta corregir su exposición en logs; el modo HTTP usa snapshots oficiales y REST.
- Prueba real: DB exacta `ganadito_e2e_test`, host loopback, sin query de conexión, flag explícito de entorno aislado y trazas sin credenciales.

## Review Focus

1. Cambio de organización o expiración durante lectura: cancelar respuesta anterior y vaciar datos privados.
2. Orden ajena/inexistente: mismo 404, sin concluir que el recurso existe ni inventar importes.
3. Cursor opaco/repetido: no duplicar filas ni solicitar páginas indefinidamente; el defecto de precisión del servidor se reporta a Nicolás.
4. Eventos duplicados, retrasados o con salto: no deducir resultado; recuperar snapshot y consultar órdenes autorizadas.
5. Entorno de pruebas mal dirigido o captura de JWT: rechazar antes de conectar y no usar trazas de red con credenciales reales de prueba.

## Task 1: arranque y entorno de integración

**Files:** `apps/api/package.json`, `package.json`, `.env.example`, `docs/DEVELOPMENT.md`, `infrastructure/deployment/README.md`, pruebas de navegador/configuración de arranque en `tests/e2e/**`.

**Interfaces:** consume `apps/api/src/server.ts` de N01; produce comandos `dev:api`/`start:api` que cargan `.env` raíz si existe, respetando variables inyectadas. Puerto API 4000 y proxy coherentes. Registro web permite únicamente COMPRADOR/VENDEDOR (campo existente `rol_inicial`).

- [ ] Probar carga del entorno con valores ficticios y registro VENDEDOR antes de cambiar scripts/formulario.
- [ ] Implementar scripts y documentación sin nuevas dependencias ni cambios de backend; pagos `false`.
- [ ] Verificar comandos con proceso aislado, typecheck y pruebas pertinentes; registrar commit.

## Task 2: órdenes autorizadas

**Files:** crear `apps/web/src/lib/orders.ts`, modificar `apps/web/src/routes/ordenes/+page.svelte`, crear `apps/web/src/routes/ordenes/[id]/+page.svelte` y `tests/e2e/orders.spec.ts`.

**Interfaces:** GET `/api/v1/ordenes?rol=comprador|vendedor&limit=20&cursor=...` devuelve `{data,next_cursor}`; GET `/ordenes/:id` devuelve orden. Orden: IDs, `codigo_lote`, estado, importes confirmados, comprador nullable, vendedor y fecha. Consumir `apiRequest`, `session` y signals existentes; no calcular comisiones ni resultados.

- [ ] Escribir/regresar pruebas de lista, detalle, vacío, 404, 403, página siguiente, cursor repetido y cambio de contexto; comprobar rojo.
- [ ] Implementar guardas DTO, listado, detalle y filtro local opcional `lote_id`; distinguir página sin coincidencias de ausencia global.
- [ ] Mantener pago desactivado, verificar pruebas y typecheck; registrar commit.

## Task 3: tiempo real compatible y modo HTTP seguro

**Files:** `apps/web/src/lib/auctions/**`, `apps/web/src/routes/subastas/[id]/+page.svelte`, componentes de subasta, `apps/web/src/env.ts`, `apps/web/src/lib/config.ts`, `tests/e2e/auctions.spec.ts`, config Playwright de fixtures.

**Interfaces:** WS `{event_type,lote_id,data}` sin datos privados ni clave de idempotencia. Respuesta HTTP de puja conserva su clave. `PUBLIC_LIVE_AUCTIONS_ENABLED=false` por defecto: no enviar JWT por URL; usar polling oficial. En modo explícito de pruebas/habilitación, autenticación WS del contrato y snapshot posterior a abrir el socket actual. Cierre enlaza `/ordenes?lote_id=<id>` y nunca usa una orden inferida de WS.

- [ ] Probar envelope nuevo, duplicados/saltos, cierre sin `orden_id`, ausencia de JWT en modo predeterminado y suspensión durante recuperación; comprobar rojo.
- [ ] Implementar parser separado de recibos REST y eventos públicos, fallback HTTP visible y opt-in WS sin registrar URL/token.
- [ ] Verificar suite completa de subastas, errores y reintento idempotente; registrar commit.

## Task 4: navegador + API reales y revisión entregable

**Files:** `tests/e2e/real/**`, `.github/workflows/ci.yml`, manifiesto raíz para comandos de pruebas, `docs/REVIEW_NICOLAS_2026-11-04.md`, documentos de evidencia/despliegue.

**Interfaces:** launcher de pruebas importa `startServer({logger:false})` sin modificar backend; exige DB efímera y pagos apagados. CI arranca API/Redis reales, crea cuentas ficticias por API y ejercita acceso, publicación, puja, cierre y consulta de orden. Fixtures y suite real permanecen separados; no afirmar que esto valida un proveedor externo.

- [ ] Añadir guardia de destino antes de cualquier conexión y probar rechazo de DB no permitida.
- [ ] Crear suite real con trazas de red apagadas y datos ficticios; añadir job CI aislado.
- [ ] Reproducir y publicar hallazgos de revisión en los PR correspondientes; no corregir archivos de Nicolás.
- [ ] Ejecutar checks locales, publicar rama/PR dependiente en borrador y observar CI hasta su resultado. Registrar bloqueos que permanezcan.

## Estado y decisiones

- Revisión N01–N05 y A1/A2/A4/N06 realizada en lectura. Hallazgos de logs WS, ubicación Spot, redacción, seed, reloj y cursor requieren corrección por Nicolás.
- #29 es el único PR autorizado para fusionar: revisión y CI verificadas; ya está en `main`. Los PR de código siguen abiertos.
- Rama de verificación combina commits originales de Nicolás con la entrega web anterior; no cambia sus archivos y no se promoverá mientras permanezcan bloqueantes.
