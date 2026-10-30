import type { FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import type { JwtUserPayload, RolOrganizacion } from './types.js';

export function createAuthMiddleware(pool: pg.Pool) {
  /**
   * PreHandler hook que valida el JWT y comprueba en PostgreSQL que la sesión
   * y membresía organizacional activa sigan siendo válidas.
   */
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
      // 1. Verificar firma y expiración del JWT
      const decoded = await request.jwtVerify<JwtUserPayload>();

      if (!decoded || !decoded.user_id) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Token de acceso no válido o incompleto.'
        });
      }

      // 2. Comprobar que el usuario exista en PostgreSQL
      const userRes = await pool.query<{ id: string; email: string; nombre: string }>(
        'SELECT id, email, nombre FROM users WHERE id = $1',
        [decoded.user_id]
      );

      if (userRes.rows.length === 0) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'El usuario asociado al token no existe.'
        });
      }

      const user = userRes.rows[0]!;

      // 3. Si el token incluye active_organization_id, comprobar en PostgreSQL que la membresía esté activa
      let activeOrgName: string | undefined;
      let activeRole: RolOrganizacion | undefined = decoded.active_role;

      if (decoded.active_organization_id) {
        const membershipRes = await pool.query<{
          rol: RolOrganizacion;
          razon_social: string;
          is_active_context: boolean;
        }>(
          `SELECT uor.rol, o.razon_social, uor.is_active_context
           FROM user_organizaciones_roles uor
           JOIN organizaciones o ON o.id = uor.organizacion_id
           WHERE uor.user_id = $1 AND uor.organizacion_id = $2`,
          [decoded.user_id, decoded.active_organization_id]
        );

        if (membershipRes.rows.length === 0) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'El usuario no pertenece a la organización especificada en la sesión.'
          });
        }

        const currentMembership = membershipRes.rows[0]!;
        if (!currentMembership.is_active_context) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'El contexto de esta organización ya no está activo. Conmute su contexto activo.'
          });
        }

        activeOrgName = currentMembership.razon_social;
        activeRole = currentMembership.rol;
      }

      // 4. Inyectar sesión autenticada en el request
      request.userSession = {
        userId: user.id,
        email: user.email,
        nombre: user.nombre,
        activeOrganizationId: decoded.active_organization_id,
        activeRole,
        activeOrganizationName: activeOrgName
      };
    } catch (err: any) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: err.message || 'Token de autenticación expirado o inválido.'
      });
    }
  };
}
