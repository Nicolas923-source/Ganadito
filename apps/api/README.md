# @ganadito/api

Servicio backend de Ganadito desarrollado con **Node.js**, **Fastify** y **TypeScript**.

## Arquitectura
Monolito modular con arquitectura hexagonal y CQRS selectivo.
- Núcleo transaccional respaldado por PostgreSQL 16 + PostGIS 3.4.
- Caché y mensajería efímera con Redis 7.
- Sin código de negocio en esta fase de inicialización.
