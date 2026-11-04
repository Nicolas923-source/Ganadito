import type { FastifyPluginAsync } from 'fastify';
import type WebSocket from 'ws';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import type { JwtUserPayload } from '../auth/types.js';
import { getRedisSubscriber } from '../redis.js';

export interface SubastasWsRoutesOptions {
  subscriber?: Redis;
  hub?: SubastaWsHub;
  pool: pg.Pool;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Hub centralizado de suscripción Redis Pub/Sub para WebSockets de Subastas en Vivo.
 * Multiplexa una única conexión de suscriptor Redis hacia todos los clientes WebSocket activos,
 * evitando conexiones redundantes y eliminando suscripciones huérfanas al desconectarse los clientes.
 */
export class SubastaWsHub {
  private subscriber: Redis;
  private channelClients = new Map<string, Set<WebSocket>>();
  private subscribedChannels = new Set<string>();
  private isListening = false;

  constructor(subscriber: Redis) {
    this.subscriber = subscriber;
    this.ensureListener();
  }

  private ensureListener(): void {
    if (this.isListening) return;
    this.isListening = true;

    this.subscriber.on('message', (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });
  }

  private handleMessage(channel: string, message: string): void {
    const clients = this.channelClients.get(channel);
    if (!clients || clients.size === 0) return;

    for (const socket of clients) {
      try {
        if (socket.readyState === 1 /* WebSocket.OPEN */) {
          socket.send(message);
        }
      } catch (err) {
        // En caso de socket roto durante el envío, la limpieza ocurrirá en el evento 'close'
      }
    }
  }

  /**
   * Conecta un cliente WebSocket al canal de eventos de la subasta indicada.
   */
  async addClient(subastaId: string, socket: WebSocket): Promise<void> {
    const channel = `subasta:events:${subastaId}`;

    let clients = this.channelClients.get(channel);
    if (!clients) {
      clients = new Set<WebSocket>();
      this.channelClients.set(channel, clients);
    }
    clients.add(socket);

    // Si es el primer cliente escuchando este canal, suscribir en Redis
    if (!this.subscribedChannels.has(channel)) {
      this.subscribedChannels.add(channel);
      try {
        await this.subscriber.subscribe(channel);
      } catch (err) {
        // Si falla la suscripción en Redis, remover cliente y reportar
        clients.delete(socket);
        this.subscribedChannels.delete(channel);
        throw err;
      }
    }

    const remove = async () => {
      await this.removeClient(subastaId, socket);
    };

    // Registrar hooks de desconexión y error en el ciclo de vida del socket
    socket.once('close', remove);
    socket.once('error', remove);

    // Si el socket se cerró antes de completar la suscripción
    if (socket.readyState !== 1 /* WebSocket.OPEN */ && socket.readyState !== 0 /* CONNECTING */) {
      await remove();
    }
  }

  /**
   * Desconecta un cliente de un canal específico y desuscribe de Redis si no quedan más clientes.
   */
  async removeClient(subastaId: string, socket: WebSocket): Promise<void> {
    const channel = `subasta:events:${subastaId}`;
    const clients = this.channelClients.get(channel);

    if (clients) {
      clients.delete(socket);

      if (clients.size === 0) {
        this.channelClients.delete(channel);
        this.subscribedChannels.delete(channel);
        try {
          await this.subscriber.unsubscribe(channel);
        } catch {
          // Ignorar errores durante desuscripción de cierre
        }
      }
    }
  }

  /**
   * Devuelve la cantidad de clientes activos para una subasta específica.
   */
  getActiveSubscribersCount(subastaId: string): number {
    const channel = `subasta:events:${subastaId}`;
    return this.channelClients.get(channel)?.size ?? 0;
  }

  /**
   * Cierra ordenadamente el hub, desuscribiendo todos los canales y cerrando sockets activos.
   */
  async close(): Promise<void> {
    for (const [channel, clients] of this.channelClients.entries()) {
      for (const socket of clients) {
        try {
          socket.close(1001, 'Server shutting down');
        } catch {}
      }
      try {
        await this.subscriber.unsubscribe(channel);
      } catch {}
    }

    this.channelClients.clear();
    this.subscribedChannels.clear();
  }
}

/**
 * Plugin Fastify para las rutas de WebSocket de Subastas en Vivo.
 */
export const subastasWsRoutes: FastifyPluginAsync<SubastasWsRoutesOptions> = async (
  fastify,
  options
) => {
  let hub = options.hub;

  const getHub = (): SubastaWsHub => {
    if (!hub) {
      const subscriber = options.subscriber ?? getRedisSubscriber();
      hub = new SubastaWsHub(subscriber);
    }
    return hub;
  };

  fastify.addHook('onClose', async () => {
    if (hub) {
      await hub.close();
    }
  });

  /**
   * GET /api/v1/subastas/:id/live
   * Endpoint WebSocket para transmisión en tiempo real de eventos de subasta (pujas aceptadas, cierre).
   */
  fastify.get<{ Params: { id: string }; Querystring: { access_token?: string } }>(
    '/subastas/:id/live',
    { websocket: true },
    async (socket, request) => {
      const id = request.params.id?.trim();

      if (!id || !UUID_RE.test(id)) {
        socket.close(1008, 'ID de subasta inválido.');
        return;
      }

      // Los navegadores no pueden enviar cabeceras en el upgrade: se acepta ?access_token=
      // (token de 15 min) o Authorization: Bearer para clientes no navegador.
      const header = request.headers.authorization;
      const token =
        request.query.access_token ??
        (header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined);

      try {
        const decoded = token ? fastify.jwt.verify<JwtUserPayload>(token) : null;
        if (!decoded?.user_id) throw new Error('sin sesión');
      } catch {
        socket.close(1008, 'Sesión requerida.');
        return;
      }

      const lote = await options.pool.query('SELECT 1 FROM lotes_subasta WHERE id = $1', [id]);
      if (lote.rowCount === 0) {
        socket.close(1008, 'Lote de subasta no encontrado.');
        return;
      }

      await getHub().addClient(id, socket);
    }
  );
};
