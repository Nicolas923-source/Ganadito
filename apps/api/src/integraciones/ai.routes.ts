import type { FastifyPluginAsync } from 'fastify';
import { AiClientService } from './ai-client.service.js';
import type {
  VideoAnalisisInput,
  AnalisisBromatologicoInput,
  ChecklistMinsaInput
} from '@ganadito/contracts';

export interface AiRoutesOptions {
  aiClient?: AiClientService;
  aiServiceUrl?: string;
}

export const aiRoutes: FastifyPluginAsync<AiRoutesOptions> = async (fastify, options) => {
  const aiClient =
    options.aiClient ??
    new AiClientService({
      baseUrl: options.aiServiceUrl
    });

  // Exponer referencia en la instancia para pruebas o reconfiguración dinámica
  (fastify as any).aiClient = aiClient;

  /**
   * POST /api/v1/ia/vision/analizar-video
   * POST /api/v1/ia/analizar-video
   * Delega el análisis de video de 15s (ExpoGanadito) al satélite Python con Circuit Breaker y fallback no bloqueante.
   */
  const handleAnalizarVideo = async (request: { body: VideoAnalisisInput }, reply: any) => {
    const resultado = await aiClient.analizarVideo(request.body ?? {});
    return reply.status(200).send(resultado);
  };

  fastify.post<{ Body: VideoAnalisisInput }>('/vision/analizar-video', handleAnalizarVideo);
  fastify.post<{ Body: VideoAnalisisInput }>('/analizar-video', handleAnalizarVideo);

  /**
   * POST /api/v1/ia/bromatologia/analizar-color
   * POST /api/v1/ia/analizar-color
   * Delega el análisis colorimétrico CIELAB (Dr. Ganadito) al satélite Python con fallback resiliente.
   */
  const handleAnalizarColor = async (request: { body: AnalisisBromatologicoInput }, reply: any) => {
    const resultado = await aiClient.analizarColorBromatologico(request.body ?? {});
    return reply.status(200).send(resultado);
  };

  fastify.post<{ Body: AnalisisBromatologicoInput }>('/bromatologia/analizar-color', handleAnalizarColor);
  fastify.post<{ Body: AnalisisBromatologicoInput }>('/analizar-color', handleAnalizarColor);

  /**
   * POST /api/v1/ia/bromatologia/checklist-minsa
   * POST /api/v1/ia/checklist-minsa
   * Evalúa el checklist sanitario RM N.° 822-2018/MINSA con fallback resiliente.
   */
  const handleChecklistMinsa = async (request: { body: ChecklistMinsaInput }, reply: any) => {
    const resultado = await aiClient.evaluarChecklistMinsa(request.body ?? ({} as any));
    return reply.status(200).send(resultado);
  };

  fastify.post<{ Body: ChecklistMinsaInput }>('/bromatologia/checklist-minsa', handleChecklistMinsa);
  fastify.post<{ Body: ChecklistMinsaInput }>('/checklist-minsa', handleChecklistMinsa);
};
