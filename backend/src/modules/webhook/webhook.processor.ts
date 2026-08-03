import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Agent, fetch } from 'undici';
import * as dns from 'dns';
import * as ipaddr from 'ipaddr.js';
import * as tls from 'tls';
import * as net from 'net';

// 🛡️ Sentinel: Implement SSRF protection using a custom undici Agent.
// Defines the agent outside the class to prevent memory/connection leaks.
const safeAgent = new Agent({
  connect: (opts, callback) => {
    const host = opts.hostname || opts.host;
    dns.lookup(host, { all: true }, (err, addresses) => {
      if (err) return callback(err, null);

      for (const addr of addresses) {
        try {
          const ip = ipaddr.parse(addr.address);
          // Only allow unicast addresses (blocks loopback, private, multicast, etc.)
          if (ip.range() !== 'unicast') {
            return callback(new Error(`SSRF Blocked: IP ${addr.address} is not allowed`), null);
          }
        } catch (e) {
          return callback(new Error('Invalid IP'), null);
        }
      }

      // Use the first resolved and validated IP to prevent DNS rebinding attacks (TOCTOU)
      const ip = addresses[0].address;
      const port = opts.port || (opts.protocol === 'https:' ? 443 : 80);

      let called = false;
      const done = (err: Error | null, socket: tls.TLSSocket | net.Socket | null) => {
        if (!called) {
          called = true;
          callback(err, socket);
        }
      };

      if (opts.protocol === 'https:') {
        const socket = tls.connect({
          host: ip,
          port: port,
          servername: opts.servername || host,
        });
        socket.on('secureConnect', () => done(null, socket));
        socket.on('error', (err) => done(err, null));
      } else {
        const socket = net.connect({
          host: ip,
          port: port,
        });
        socket.on('connect', () => done(null, socket));
        socket.on('error', (err) => done(err, null));
      }
    });
  }
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

    // 🛡️ Sentinel: Use custom fetch with safeAgent dispatcher for SSRF mitigation
    const response = await fetch(String(endpoint.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
      dispatcher: safeAgent,
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch failed with status ${response.status}`);
    }
  }
}
