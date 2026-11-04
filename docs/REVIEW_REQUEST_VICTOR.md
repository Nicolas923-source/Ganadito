# Solicitud de revisión de Víctor

Repositorio de destino: `Nicolas923-source/Ganadito`. Base del plan: `dde293b`.

## PR de dependencias

Rama: `feature/victor/dependencias-web`, destino `main`.

Título propuesto: **build: preparar dependencias web de Víctor y compatibilidad TypeScript**.

Incluye manifiestos y lockfile, Playwright, adapter-node y TypeScript 6 requerido por SvelteKit 3 ya presente en la base. La configuración raíz explicita raíz de compilación/tipos Node y rutas relativas para mantener los workspaces compatibles. Los scripts nuevos se consumen en la entrega web dependiente. Revisar ambos diffs antes de integrarlos; no confundir la validación del conjunto final con una comprobación independiente de esta rama.

## PR de interfaz e integración V01-V06

Rama: `feature/victor/v01-v06-interfaz`, destino inicial `feature/victor/dependencias-web`.

Título propuesto: **feat(web): conectar acceso, lotes y consultas con estados oficiales**.

La web base sustituía errores de API por datos demo y no tenía acceso/contexto real. Ahora dispone de cliente y proxy REST, sesión validada contra `me`, selección de membresía, publicación/consulta por ID, pujas idempotentes y snapshot tras reconexión. Mapa, Spot y pasaporte consultan las rutas existentes y rechazan respuestas malformadas. La vista de órdenes identifica el aviso recibido, pero requiere la futura consulta autorizada para confirmar su estado. Los pagos y módulos posteriores permanecen deshabilitados.

Rutas permitidas: web, pruebas navegador, despliegue, documentación no API, configuración raíz y CI. No hay cambios de backend, contratos, SQL, seeds o servicios comunes. Los DTO web describen el transporte observado en la base; su aprobación/publicación sigue correspondiendo a Nicolás. [Inventario y solicitudes](CONTRACT_REVIEW.md).

Validación del conjunto final: instalación reproducible, typecheck, build, 3 pruebas unitarias web y 22 Chromium con respuestas controladas. Se verificó la salida Node de producción en localhost y el error 502 cuando la API no está disponible. No se acredita con fixtures la persistencia ni el aislamiento real de organizaciones. [Evidencia](VALIDATION_VICTOR.md).

**Estado: borrador pendiente de Nicolás, CI remota y prueba conjunta con API real.** No fusionar automáticamente. La entrega agrupa los cambios interdependientes de interfaz; revisar por V01-V06 y dividirla antes de integrar si el revisor lo solicita. Los bloqueos N01/N02/N04/N05, lectura de órdenes y contratos se resuelven en PR de Nicolás, conservando su propiedad de archivos.

## Publicación

La conexión GitHub permitió leer código, PR y reglas de `main`, pero devolvió `403 Resource not accessible by integration` al intentar crear la rama. También se intentó publicar mediante Git sin interacción: no hay credenciales locales disponibles. Las ramas y commits locales quedan preparados sin cambiar permisos ni eludir las reglas. Publicar requiere una conexión con escritura sobre este repositorio o autenticación humana de Git.

```powershell
git push -u origin feature/victor/dependencias-web
git push -u origin feature/victor/v01-v06-interfaz
```

Abrir ambos PR como borradores y solicitar revisión cruzada de Nicolás. No aprobar la propia entrega ni activar producción.

Una copia transferible se genera en `tmp/handoff/Ganadito_Victor.bundle` con las dos ramas y el historial necesario. Puede inspeccionarse con `git bundle verify <archivo>` y usarse como origen de `git fetch` en otro clon. No contiene `.env`, credenciales, `node_modules` ni artefactos de navegador. Los PR aún no existen y la CI remota aún no se ha ejecutado.
