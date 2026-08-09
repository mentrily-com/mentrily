import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Agent, fetch as undiciFetch } from 'undici';
import * as ipaddr from 'ipaddr.js';
import * as dns from 'dns';
import * as tls from 'tls';
import * as net from 'net';

function buildSsrfSafeAgent() {
  return new Agent({
    connect(opts: any, callback: any) {
      const hostname = opts.hostname || opts.host;
      const port = Number(opts.port) || (opts.protocol === 'https:' ? 443 : 80);
      let called = false;

      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) {
          if (!called) {
            called = true;
            callback(err, null);
          }
          return;
        }

        let isSafe = true;
        let targetIp = null;

        for (const addr of addresses) {
          try {
            const parsed = ipaddr.parse(addr.address);
            if (parsed.range() !== 'unicast') {
              isSafe = false;
              break;
            }
            if (!targetIp) {
              targetIp = addr.address;
            }
          } catch (e) {
            isSafe = false;
            break;
          }
        }

        if (!isSafe || !targetIp) {
          const ssrfError = new Error(
            `SSRF blocked: Refusing connection to restricted IP range for ${hostname}`,
          );
          if (!called) {
            called = true;
            callback(ssrfError, null);
          }
          return;
        }

        const socketOptions = {
          host: targetIp,
          port: port,
          servername: opts.servername || hostname,
        };

        const socket =
          opts.protocol === 'https:'
            ? tls.connect(socketOptions)
            : net.connect(socketOptions);

        socket.on('error', (err) => {
          if (!called) {
            called = true;
            callback(err, null);
          }
        });

        if (opts.protocol === 'https:') {
          socket.on('secureConnect', () => {
            if (!called) {
              called = true;
              callback(null, socket);
            }
          });
        } else {
          socket.on('connect', () => {
            if (!called) {
              called = true;
              callback(null, socket);
            }
          });
        }
      });
    },
  });
}

@Processor('webhook-dispatch', {
  stalledInterval: 300000,
  maxStalledCount: 3,
  concurrency: 10,
})
@Injectable()
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);
  private readonly ssrfSafeAgent = buildSsrfSafeAgent();

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

    // Use the custom SSRF-safe undici fetch
    const response = await undiciFetch(String(endpoint.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
      dispatcher: this.ssrfSafeAgent,
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch failed with status ${response.status}`);
    }
  }
}
