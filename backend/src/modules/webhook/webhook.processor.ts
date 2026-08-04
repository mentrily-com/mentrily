import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Agent, fetch as undiciFetch } from 'undici';
import * as dns from 'dns/promises';
import * as ipaddr from 'ipaddr.js';
import * as net from 'net';
import * as tls from 'tls';

const ssrfAgent = new Agent({
  connect: async (opts: any, callback: any) => {
    let called = false;
    const done = (err: Error | null, socket?: net.Socket | tls.TLSSocket) => {
      if (!called) {
        called = true;
        callback(err, socket);
      }
    };

    try {
      const hostname = opts.hostname || opts.host;
      const addresses = await dns.lookup(hostname, { all: true });

      for (const addr of addresses) {
        const parsed = ipaddr.parse(addr.address);
        if (parsed.range() !== 'unicast') {
          throw new Error(`SSRF Blocked: Forbidden IP range ${parsed.range()}`);
        }
      }

      const validIp = addresses[0].address;

      const socketOpts = {
        host: validIp,
        port: opts.port,
      };

      if (opts.protocol === 'https:') {
        const socket = tls.connect({
          ...socketOpts,
          servername: opts.servername || opts.hostname,
        });
        socket.on('secureConnect', () => done(null, socket));
        socket.on('error', (err) => done(err));
      } else {
        const socket = net.connect(socketOpts);
        socket.on('connect', () => done(null, socket));
        socket.on('error', (err) => done(err));
      }
    } catch (err) {
      done(err instanceof Error ? err : new Error(String(err)));
    }
  },
});

@Processor('webhook-dispatch', {
  stalledInterval: 300000,
  maxStalledCount: 3,
  concurrency: 10,
})
@Injectable()
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name !== 'dispatch') {
      this.logger.warn(`Unknown job type: ${job.name}`);
      return;
    }

    const endpoint = job.data?.endpoint;
    const event = String(job.data?.event || '');
    const timestamp = String(job.data?.timestamp || new Date().toISOString());
    const payload = job.data?.payload || {};

    const body = JSON.stringify({
      event,
      timestamp,
      data: payload,
    });

    const signature = createHmac('sha256', String(endpoint.secret || ''))
      .update(body)
      .digest('hex');

    const response = await undiciFetch(String(endpoint.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
      dispatcher: ssrfAgent,
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch failed with status ${response.status}`);
    }
  }
}
