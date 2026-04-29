import fp from 'fastify-plugin';

export default fp(async (fastify, opts) => {
  fastify.addHook('onRequest', async (request, reply) => {
    // Allow Authorization header for CORS preflight
    reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-CSRF-Token');
  });
});
