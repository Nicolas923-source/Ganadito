# Ganadito — Plataforma Ganadera y Comercial

> **Estado actual del proyecto:** Fase 1 — Preparación oficial del repositorio y entorno de desarrollo. No apto ni destinado aún para producción. No se ha implementado código funcional de negocio.

---

## 1. Visión general

**Ganadito** es una plataforma digital integral orientada a modernizar y dinamizar el ecosistema comercial ganadero en el Perú, facilitando la interacción transparente y confiable entre ganaderos, compradores, camales, transportistas y entidades del sector.

## 2. Arquitectura de alto nivel

El proyecto está diseñado bajo un modelo de **monolito modular con arquitectura hexagonal y CQRS selectivo**:
- **`apps/web`**: Frontend web interactivo construido con **SvelteKit** y **TypeScript**.
- **`apps/api`**: Backend transaccional de alto rendimiento construido con **Node.js**, **Fastify** y **TypeScript**.
- **`packages/contracts`**: Esquemas de datos, DTOs y contratos compartidos fuertemente tipados.
- **`packages/shared`**: Utilidades puras transversales.
- **`packages/config`**: Configuraciones compartidas de compilación, linter y tipos.
- **`services/ai`**: Servicio satélite para modelos de visión artificial y análisis de ganado (**Python 3.11/3.12**), desacoplado del núcleo transaccional.
- **Persistencia**: **PostgreSQL 16** con extensión **PostGIS 3.4** como única fuente de verdad transaccional y geoespacial.
- **Caché y mensajería efímera**: **Redis 7** (sin rol de persistencia autoritativa).

---

## 3. Requisitos de desarrollo verificados

| Herramienta | Versión verificada en entorno |
|---|---|
| **Node.js** | `v24.20.0` (fijado en `.nvmrc`) |
| **npm** | `11.19.0` |
| **Git** | `2.56.0` |
| **Python** | `3.12.8` (para `services/ai`) |
| **Docker Engine** | `29.7.2` |
| **Docker Compose** | Compatible con v2 |

---

## 4. Guías y Documentación

Para comenzar a trabajar en el proyecto, consulta la documentación oficial en el directorio `docs/`:

- 🚀 [**Guía de instalación y entorno local (`docs/DEVELOPMENT.md`)**](file:///d:/Copia%20-%20VISUAL%20CODE%20-%20Proyectos/Ganadito%20Versi%C3%B3n%201.0/docs/DEVELOPMENT.md): Instrucciones paso a paso para configurar tu máquina, variables de entorno, Docker y comandos de ejecución.
- 🌿 [**Flujo de trabajo y Git (`docs/GIT_WORKFLOW.md`)**](file:///d:/Copia%20-%20VISUAL%20CODE%20-%20Proyectos/Ganadito%20Versi%C3%B3n%201.0/docs/GIT_WORKFLOW.md): Reglas de ramas, commits convencionales, flujo de Pull Requests y protocolo ante fuga de secretos.
- 🏛️ [**Arquitectura técnica y límites (`docs/ARCHITECTURE.md`)**](file:///d:/Copia%20-%20VISUAL%20CODE%20-%20Proyectos/Ganadito%20Versi%C3%B3n%201.0/docs/ARCHITECTURE.md): Principios arquitectónicos, responsabilidades por módulo y decisiones registradas.
- 🤖 [**Reglas operativas para Agentes de IA (`AGENTS.md`)**](file:///d:/Copia%20-%20VISUAL%20CODE%20-%20Proyectos/Ganadito%20Versi%C3%B3n%201.0/AGENTS.md): Directrices y prioridades de trabajo para asistentes automatizados en Antigravity.

---

## 5. Reporte de incidencias y contribución

- Para proponer nuevas funciones o reportar fallos, abre un Issue en GitHub utilizando las plantillas disponibles en [`.github/ISSUE_TEMPLATE/`](file:///d:/Copia%20-%20VISUAL%20CODE%20-%20Proyectos/Ganadito%20Versi%C3%B3n%201.0/.github/ISSUE_TEMPLATE/).
- Todo cambio debe integrarse a través de Pull Request siguiendo la plantilla [`.github/PULL_REQUEST_TEMPLATE.md`](file:///d:/Copia%20-%20VISUAL%20CODE%20-%20Proyectos/Ganadito%20Versi%C3%B3n%201.0/.github/PULL_REQUEST_TEMPLATE.md).
