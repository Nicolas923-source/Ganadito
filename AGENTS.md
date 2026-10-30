# Reglas Operativas para Agentes de IA en Ganadito

Este documento rige la conducta técnica y prioridades de los agentes de IA (Google Antigravity y subagentes) en el proyecto Ganadito.

---

## 1. Jerarquía de autoridad y decisión

Cuando existan instrucciones o criterios en conflicto, la prioridad estricta es:

1. **Requisitos expresos del propietario y decisiones aprobadas.**
2. **Seguridad, legalidad e integridad de datos.**
3. **Arquitectura y contratos aprobados de Ganadito.**
4. **Skill especializada del dominio de negocio.**
5. **Skills generales de ingeniería y flujo de trabajo.**
6. **Preferencias de formato y ahorro de tokens.**

---

## 2. Invariantes de arquitectura

- **Monolito Modular con Arquitectura Hexagonal y CQRS selectivo:** No convertir el sistema a microservicios prematuros ni generar servicios independientes no autorizados.
- **Autoridad de persistencia:** **PostgreSQL 16 + PostGIS 3.4** es la única fuente de verdad transaccional y comercial.
- **Rol de Redis:** Herramienta auxiliar para caché, presencia y mensajería en tiempo real. **Nunca fuente de verdad**. Si Redis se reinicia, ningún estado transaccional debe perderse o quedar corrupto.
- **Pujas de subastas:** Toda puja debe confirmarse en PostgreSQL con control de concurrencia e idempotencia antes de notificarse a clientes vía WebSocket/SSE.
- **Pagos peruanos e integraciones:** No asumir ni inventar capacidades de preautorización, escrow o retención automática en billeteras (Yape / Plin) sin documentación oficial del proveedor.
- **Geolocalización:** Respetar la privacidad de ubicación exacta de establos y ganaderos según permisos del usuario.

---

## 3. Principios de trabajo para el agente

- **Ingeniero riguroso, no generador complaciente:** Aclara únicamente decisiones que cambien materialmente el alcance o riesgo. No tomes atajos inseguros.
- **Evidencia antes de aserciones:** No declares que un componente, base de datos o servicio funciona hasta presentar evidencia reproducible de comandos ejecutados.
- **Mínimo cambio necesario:** Proporciona la solución más simple, robusta y mantenible que satisfaga los requisitos sin sobreingeniería.
- **Protección de secretos y datos:** Prohibido registrar, imprimir o subir archivos `.env`, claves privadas o volcados de datos reales.
- **Cero cambios destructivos sin autorización:** No borres bases de datos, volúmenes de Docker, historial de Git ni archivos sin confirmación explícita.
