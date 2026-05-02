import fp from 'fastify-plugin';
import {
  getAllowedWebOrigins,
  isAllowedSubdomainOrigin,
} from './config/app-brand';

export default fp(async (fastify, opts) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const isProduction = process.env.NODE_ENV === 'production';
    const allowedOrigins = getAllowedWebOrigins(!isProduction);
    const isAllowedOrigin =
      typeof origin === 'string' &&
      (allowedOrigins.includes(origin) || isAllowedSubdomainOrigin(origin));

    reply.header('Vary', 'Origin');
    reply.header(
      'Access-Control-Allow-Headers',
      String(
        request.headers['access-control-request-headers'] ||
          'Authorization, Content-Type, X-CSRF-Token, Svix-Id, Svix-Signature, Svix-Timestamp',
      ),
    );
    reply.header(
      'Access-Control-Allow-Methods',
      'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT',
    );
    reply.header('Access-Control-Max-Age', '300');

    if (isAllowedOrigin) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    if (request.method.toUpperCase() === 'OPTIONS') {
      return reply.code(204).send();
    }
  });
});
