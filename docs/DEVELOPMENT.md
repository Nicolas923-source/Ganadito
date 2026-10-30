# Ganadito — Guía de Desarrollo Local

Esta guía describe el procedimiento paso a paso para configurar el entorno de trabajo local de Ganadito desde una máquina limpia.

---

## 1. Versiones y requisitos del sistema

Asegúrate de contar con las siguientes herramientas instaladas y verificadas:

| Herramienta | Versión verificada | Verificación | Enlace oficial |
|---|---|---|---|
| **Node.js** | `>= 24.20.0` (fijado en `.nvmrc`) | `node --version` | [nodejs.org](https://nodejs.org/) |
| **npm** | `>= 11.19.0` | `npm --version` | Incluido con Node.js |
| **Git** | `>= 2.56.0` | `git --version` | [git-scm.com](https://git-scm.com/) |
| **Docker Engine** | `>= 29.7.0` | `docker --version` | [docker.com](https://www.docker.com/) |
| **Docker Compose** | Compatible v2 | `docker compose version` | Incluido en Docker Desktop |
| **Python** *(opcional para services/ai)* | `>= 3.11.x` o `3.12.x` | `python --version` | [python.org](https://www.python.org/) |

---

## 2. Puesta en marcha paso a paso

### Paso 1: Clonar el repositorio

```bash
git clone git@github.com:USUARIO_O_ORGANIZACION/ganadito.git
cd ganadito
```

### Paso 2: Fijar la versión de Node.js

Si utilizas `nvm` (Node Version Manager en Linux/macOS) o `nvm-windows`:

```bash
nvm use
```
*(El archivo `.nvmrc` contiene la versión oficial: `24.20.0`)*.

### Paso 3: Configurar variables de entorno

Copia el archivo de ejemplo para generar tu configuración local:

**En Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

**En Linux / macOS / Bash:**
```bash
cp .env.example .env
```

> [!IMPORTANT]
> El archivo `.env` nunca debe subirse al repositorio. Contiene únicamente credenciales y puertos de desarrollo local.

### Paso 4: Levantar servicios de infraestructura local (Docker)

Inicia los contenedores de **PostgreSQL (con PostGIS)** y **Redis**:

```bash
docker compose -f infrastructure/docker/compose.yaml up -d
```

Verifica que los contenedores estén saludables (`healthy`):
```bash
docker compose -f infrastructure/docker/compose.yaml ps
```

### Paso 5: Instalar dependencias del monorepo

```bash
npm install
```
*(En entornos de CI o despliegue limpio donde exista `package-lock.json`, utiliza `npm ci`)*.

---

## 3. Comandos de desarrollo y calidad

Los siguientes comandos se ejecutan desde la raíz del monorepo y coordinan todos los paquetes y aplicaciones mediante npm workspaces:

### Verificación de tipos (TypeScript)
```bash
npm run typecheck
```

### Linteo de código
```bash
npm run lint
```

### Ejecución de pruebas
```bash
npm test
```

### Compilación / Build del monorepo
```bash
npm run build
```

### Ejecución individual por aplicación
```bash
# Frontend Web (apps/web)
npm run dev:web

# Backend API (apps/api)
npm run dev:api
```

---

## 4. Gestión de infraestructura Docker

Para administrar los contenedores de base de datos y caché:

| Acción | Comando |
|---|---|
| Iniciar en segundo plano | `docker compose -f infrastructure/docker/compose.yaml up -d` |
| Ver estado | `docker compose -f infrastructure/docker/compose.yaml ps` |
| Ver logs en tiempo real | `docker compose -f infrastructure/docker/compose.yaml logs -f` |
| Detener servicios | `docker compose -f infrastructure/docker/compose.yaml down` |

> [!WARNING]
> Nunca ejecutes `docker compose down -v` a menos que desees borrar deliberadamente todos los datos de tu base de datos local y Redis.

---

## 5. Solución de problemas frecuentes

### 1. Error de puerto ocupado (5432 o 6379)
Si tienes instancias nativas de PostgreSQL o Redis ejecutándose en tu máquina:
- Cambia `DATABASE_PORT` (ej. `5433`) o `REDIS_PORT` (ej. `6380`) en tu archivo local `.env`.
- Docker Compose leerá automáticamente estos valores de tu `.env`.

### 2. Error de versiones de Node.js
Si npm falla por versión de Node incompatible, comprueba con `node -v` que estés ejecutando Node 24 o superior.

### 3. Problemas con permisos o dependencias
Si las dependencias se corrompen o presentan inconsistencias locales:
```powershell
# Limpieza en Windows PowerShell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

---

## 6. Lista de comprobación para certificar el entorno

Antes de comenzar a desarrollar, valida que tu máquina cumpla con todos estos puntos:
- [ ] `node -v` retorna v24.x.
- [ ] `npm run typecheck` finaliza sin errores.
- [ ] `docker compose -f infrastructure/docker/compose.yaml ps` muestra los servicios arriba.
- [ ] El archivo `.env` existe y no está rastreado por Git (`git status` debe mostrarlo ignorado).
