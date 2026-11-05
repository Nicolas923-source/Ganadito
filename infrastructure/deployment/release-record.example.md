# Registro de versión de staging

Plantilla: rellenar valores reales antes de una promoción. No contiene ni solicita secretos. Un campo pendiente mantiene pendiente la aceptación correspondiente.

| Campo | Valor |
|---|---|
| Fecha y zona horaria | Pendiente (ISO 8601 con offset) |
| Responsable de despliegue | Pendiente |
| Entorno / host autorizado | Pendiente |
| SHA web | Pendiente |
| SHA API / worker | Pendiente |
| PR web / revisión de Nicolás | Pendiente |
| PR API / revisión de Víctor | Pendiente |
| PR de contrato / SHA integrado | Pendiente |
| Node / npm realmente usados | Pendiente |
| Hash SHA256 de lockfile | Pendiente |
| `GANADITO_RELEASE_SHA` utilizado en build web | Pendiente; debe coincidir con SHA web |
| Origen REST / ruta WS (sin credenciales) | Pendiente |
| Base ficticia aislada confirmada por Nicolás | Pendiente (identificador sin credenciales) |
| Migraciones aplicadas y hashes confirmados | Pendiente |
| Último SHA aceptado y artefacto recuperable | Pendiente |
| Compatibilidad de esquema para recuperación | Pendiente |
| Pagos / integraciones externas | Desactivados; confirmar en la versión probada |

## Evidencia

| Validación | Comando / caso | Resultado y enlace seguro |
|---|---|---|
| Instalación | `npm ci` | Pendiente |
| Tipos / lint | `npm run typecheck`, `npm run lint` | Pendiente |
| Backend aislado | `npm test` con PostGIS/Redis de pruebas | Pendiente |
| Build | `npm run build` | Pendiente |
| Navegador aislado | `npm run test:e2e`; fixtures explícitos | Pendiente; no acredita API real |
| CI del SHA final | URL del run | Pendiente |
| Acceso y aislamiento entre organizaciones | Web + API reales, datos ficticios | Pendiente |
| Lote → puja → cierre → orden pendiente | IDs ficticios y SHA web/API | Pendiente |
| Reconexión WS → snapshot oficial | Interrupción y recuperación | Pendiente |
| Mapa / Spot / trazabilidad y privacidad | Éxito, ausencia, error, denegación | Pendiente |
| Revisión cruzada del código final | Revisor y URL | Pendiente |

## Incidente o recuperación

- Inicio y motivo: pendiente.
- SHA origen y SHA restaurado: pendiente.
- Estado de escrituras/workers acordado con Nicolás: pendiente.
- Compatibilidad y estado de migraciones: pendiente.
- Resultado de verificación posterior: pendiente.
- Incidencias abiertas y responsable: pendiente.
