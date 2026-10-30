# Ganadito — Flujo de Trabajo con Git y GitHub

Este documento establece las reglas obligatorias de control de versiones y colaboración para el equipo de desarrollo de Ganadito.

---

## 1. Estrategia de ramas

- **`main`**: Rama protegida principal. Contiene únicamente código integrado, validado por CI y aprobado. Prohibido hacer push directo a `main`.
- **`feature/<nombre>`**: Para el desarrollo de nuevas funcionalidades (ej. `feature/mapa-comercial`).
- **`fix/<nombre>`**: Para corrección de defectos o bugs (ej. `fix/auth-session`).
- **`hotfix/<nombre>`**: Para reparaciones urgentes y críticas sobre `main`.
- **`chore/<nombre>`**: Para tareas de mantenimiento, configuración, tooling o dependencias (ej. `chore/monorepo-setup`).
- **`docs/<nombre>`**: Para actualización de documentación técnica (ej. `docs/installation-guide`).

---

## 2. Convención de commits

Se utiliza la especificación **Conventional Commits**. Los mensajes deben ser claros, en tiempo presente y con el formato:

```text
<tipo>: <descripción concisa>

[cuerpo opcional detallando el motivo o contexto]
```

### Tipos permitidos
- `feat`: Nueva característica de cara al usuario o contrato de API.
- `fix`: Corrección de un fallo.
- `docs`: Modificaciones exclusivamente en documentación.
- `refactor`: Cambio de código que no corrige un bug ni añade una feature.
- `test`: Añadir o corregir pruebas automatizadas.
- `chore`: Modificaciones en procesos de construcción, herramientas o librerías auxiliares.
- `ci`: Cambios en flujos de integración continua (GitHub Actions).
- `perf`: Mejoras de rendimiento demostrables.

> ❌ **Prohibidos mensajes genéricos:** Evita commits como `actualización`, `cambios varios`, `fix bug`, `listo`.

---

## 3. Ciclo de trabajo diario

1. **Partir siempre de la versión más reciente de `main`:**
   ```bash
   git switch main
   git pull --ff-only origin main
   ```

2. **Crear una rama con nombre descriptivo:**
   ```bash
   git switch -c feature/nombre-de-la-tarea
   ```

3. **Realizar cambios y commits pequeños y cohesivos:**
   ```bash
   git status
   git diff
   git add ruta/al/archivo
   git commit -m "feat: implementar contrato de pujas"
   ```

4. **Mantener la rama sincronizada:**
   ```bash
   git fetch origin
   git merge origin/main
   # O alternativamente rebase si no se ha publicado la rama
   ```

5. **Ejecutar validaciones locales antes de enviar:**
   ```bash
   npm run typecheck
   npm test
   ```

6. **Publicar la rama en GitHub y abrir Pull Request:**
   ```bash
   git push -u origin feature/nombre-de-la-tarea
   ```

---

## 4. Revisión y fusión de Pull Requests (PR)

- Cada PR debe completar la plantilla [`.github/PULL_REQUEST_TEMPLATE.md`](file:///d:/Copia%20-%20VISUAL%20CODE%20-%20Proyectos/Ganadito%20Versi%C3%B3n%201.0/.github/PULL_REQUEST_TEMPLATE.md).
- Todos los checks de GitHub Actions (CI) deben estar en verde.
- El segundo programador debe revisar el código y dejar comentarios o su aprobación.
- Se recomienda el método **Squash and merge** para mantener un historial lineal y limpio en `main`.
- Eliminar la rama remota tras la integración.

---

## 5. Colaboración entre dos programadores

- Cada programador trabaja en ramas separadas e independientes.
- Ninguno debe hacer push a la rama en curso del otro sin acuerdo previo.
- Para inspeccionar o probar la rama del compañero:
  ```bash
  git fetch origin
  git switch --track origin/feature/rama-del-companero
  ```
- No compartir credenciales, claves SSH ni tokens personales.

---

## 6. Protocolo de emergencia ante fuga de secretos

> [!CAUTION]
> Si por error se commitea un secreto (claves privadas, tokens de API, contraseñas, URLs de base de datos con credenciales reales):

1. **Rotación inmediata del secreto:**
   Accede de inmediato al proveedor (PostgreSQL, proveedor de pagos, nube) y **revoca / rota la credencial expuesta**. Asume que ya ha sido comprometida.
2. **Borrar el archivo en un commit posterior NO ES SUFICIENTE:**
   El secreto permanece registrado en el historial de Git de por vida a menos que se purgue.
3. **Comunicación al equipo:**
   Notifica inmediatamente al propietario y al equipo antes de forzar cambios en ramas remotas.
4. **Limpieza del historial:**
   Utiliza herramientas especializadas como `git-filter-repo` o `BFG Repo-Cleaner` para eliminar permanentemente el archivo o cadena del historial de Git en coordinación con el equipo.
5. **Restablecer ramas:**
   Todos los colaboradores deberán reiniciar sus clones locales a partir del nuevo historial limpio.
