# Desarrollo local de Ganadito

Base de revisión: `dde293bc977ac090d631b6c90a2cb4bb6efcb40e`. Las instrucciones siguientes distinguen web, pruebas aisladas y API real. El reparto está en [OWNERSHIP.md](OWNERSHIP.md).

## Instalar desde un clon

```bash
git clone https://github.com/Nicolas923-source/Ganadito.git
cd Ganadito
node --version
npm --version
git --version
npm ci
```

Usar Node fijado en `.nvmrc` y npm compatible con `package.json`; registrar las versiones realmente ejecutadas. No actualizar dependencias o borrar el lockfile para resolver una instalación: Víctor mantiene manifiestos/lockfile en un PR separado. Si la descarga falla, revisar conectividad, versión y error exacto; repetir `npm ci` con el mismo lockfile una vez resuelta la causa.

### Bootstrap de SvelteKit 3

La integración web usa las versiones resueltas del lockfile: SvelteKit `3.1.1`, adaptador Node `6.0.1`, TypeScript `6.0.3` y Playwright `1.64.1`. SvelteKit `3.1.1` declara TypeScript `^6.0.0` como peer; el TypeScript `^5.7.3` de la base era incompatible. El cambio de manifiestos y lockfile debe revisarse en el PR de dependencias separado.

`apps/web/src/env.ts` declara las variables mediante `defineEnvVars`; el código usa `$app/env/public` y `$app/env/private`. `vite.config.ts` configura SvelteKit y el adaptador Node; `svelte-kit sync` se ejecuta antes de `svelte-check` para generar tipos y configuración. No copiar convenciones de SvelteKit anteriores para resolver un error de esta versión.

Para construir un artefacto web Node y arrancarlo después de configurar el entorno del proceso:

```bash
npm run build --workspace=@ganadito/web
npm run start --workspace=@ganadito/web
```

El segundo comando ejecuta `node build/index.js` desde `apps/web`. Para staging se necesita la configuración de host/proxy y los secretos del entorno descritos en el runbook; no equivale a habilitar producción. La API y workers conservan el bloqueo N01 descrito abajo.

## Variables locales

PowerShell:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
```

Bash:

```bash
cp .env.example .env
```

No sobrescribir un `.env` existente. Mantenerlo ignorado por Git. La API base no tiene todavía un arranque N01 que cargue variables y escuche HTTP; copiar un archivo no demuestra que un proceso lo haya leído.

| Variable | Consumidor / comportamiento |
|---|---|
| `PUBLIC_API_URL` | Navegador. Vacío usa REST del mismo origen. Si se configura, es un origen público autorizado, sin secretos. |
| `API_INTERNAL_URL` | Servidor web/proxy de desarrollo; origen API, por defecto `http://127.0.0.1:4000`. No es variable pública. |
| `PUBLIC_WS_URL` | Origen WS opcional; sin él se usa el origen web. Desarrollo reenvía `/api/v1/subastas/:id/live` por Vite. Staging necesita reverse proxy WS o un origen WS autorizado. |
| `DATABASE_URL` o `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` | API y pruebas backend; PostgreSQL/PostGIS ficticio aislado. No exponer al navegador. |
| `REDIS_URL` o `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | API y workers; Redis auxiliar. |
| `JWT_SECRET` | API; secreto del entorno, nunca en Git. N01 debe confirmar validación segura de configuración. |
| `GANADITO_RELEASE_SHA` | Build web; configura el nombre de versión SvelteKit con el SHA revisado. Sin valor, la versión se identifica como `development`. |

La aplicación web puede leer variables desde su entorno SvelteKit. Para una prueba explícita en PowerShell, definir el entorno del proceso que arranca la web:

```powershell
$env:PUBLIC_API_URL=''
$env:API_INTERNAL_URL='http://127.0.0.1:4000'
npm run dev:web -- --host 127.0.0.1 --port 4173 --strictPort
```

En Bash:

```bash
PUBLIC_API_URL='' API_INTERNAL_URL=http://127.0.0.1:4000 npm run dev:web -- --host 127.0.0.1 --port 4173 --strictPort
```

Abrir `http://127.0.0.1:4173`. Una API no disponible debe mostrarse como error con reintento. No habilitar datos demo como fallback ni completar resultados de negocio localmente. Los módulos de etapas posteriores que aún usan simulación no acreditan una integración real.

## PostgreSQL/PostGIS y Redis de desarrollo

Si Docker está instalado, los servicios locales definidos por Nicolás se administran con:

```bash
docker compose -f infrastructure/docker/compose.yaml up -d
docker compose -f infrastructure/docker/compose.yaml ps
docker compose -f infrastructure/docker/compose.yaml logs -f
```

Para detener sin borrar volúmenes:

```bash
docker compose -f infrastructure/docker/compose.yaml down
```

Nicolás mantiene Docker, migraciones y seeds. No ejecutar cambios de esquema o `npm run seed` contra una base compartida o un proyecto Neon sin confirmar entorno, permiso y datos ficticios. No usar `down -v` para solucionar una pantalla. Si Docker o PostgreSQL/Redis no están disponibles, registrar esa limitación; el navegador aislado sigue siendo una verificación distinta.

## API y workers: dependencia N01

En `dde293b`, `npm run dev:api` termina con un mensaje `echo`; no escucha HTTP. `apps/api/src/index.ts` exporta la fábrica y módulos, y `buildApp()` crea Fastify. Falta el comando real de arranque, carga de entorno, parada y workers. No presentar `npm run dev:api`, `node dist/index.js` ni un `/health` fijo como servidor operativo.

Nicolás debe publicar N01 y comunicar a Víctor scripts, variables y dependencias. Ver [CONTRACT_REVIEW.md](CONTRACT_REVIEW.md). Después se añadirá aquí el comando confirmado y su evidencia de una operación PostgreSQL, junto con el ciclo de vida del worker de cierre/outbox. Hasta entonces el recorrido real de aceptación permanece pendiente.

## Calidad y navegador

Desde la raíz:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

- `npm test` ejecuta pruebas backend y requiere servicios locales/CI aislados. No usar una base de producción para pasar tests.
- `npm run lint` coordina scripts presentes; un paquete sin script no queda validado por omisión.
- `npm run test:e2e` usa `tests/e2e/playwright.config.ts` y arranca la web en `127.0.0.1:4173`. Sus respuestas controladas están identificadas como fixtures y no conectan Neon ni staging.
- La evidencia de navegador se escribe en `playwright-report/` y `test-results/`. CI conserva esos artefactos durante siete días; no adjuntar secretos o datos reales.
- Las pruebas con fixtures verifican interfaz y solicitudes. La concurrencia, idempotencia persistida, separación entre organizaciones y generación real de órdenes requieren tests de Nicolás y un recorrido conjunto con la API.

Ver comandos, registro de versión, inventario de migraciones y recuperación en el [runbook de staging](../infrastructure/deployment/README.md). Los resultados reales pertenecen al PR y al registro de versión, no se deducen de esta lista.

## Diagnóstico

| Síntoma | Comprobación y respuesta |
|---|---|
| Web muestra error de API | Comprobar el origen configurado y que N01 esté disponible; no activar demo automáticamente. |
| 401 o sesión expirada | Mostrar expiración y volver a acceder; no renovar ni fabricar permisos localmente. |
| 403 o contexto cambió | Mostrar falta de acceso/contexto; comprobar sesión y membresía con la API. |
| WS desconectado | Revisar origen y Upgrade del proxy; recuperar snapshot oficial tras conectar antes de reanudar la interacción. |
| Órdenes no disponibles | Falta GET en la base; solicitar contrato a Nicolás, conservar estado explícito sin inventar orden. |
| Puerto 4173 ocupado | Detener el proceso propio o acordar otro puerto y actualizar su configuración; no terminar procesos ajenos. |
| Fallan tests de DB/Redis | Confirmar servicios y variables del entorno de pruebas; registrar fallo completo. |

La aceptación final exige CI del SHA final, revisión de Nicolás y pruebas web + API real con datos ficticios. Ver [VICTOR_DELIVERY.md](VICTOR_DELIVERY.md).
