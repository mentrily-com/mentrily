import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Agent, fetch as undiciFetch } from 'undici';
import * as ipaddr from 'ipaddr.js';
import * as dns from 'dns';
import * as net from 'net';
import * as tls from 'tls';

function isIpAllowed(ip: string): boolean {
  try {
    const parsed = ipaddr.parse(ip);
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

@Processor('webhook-dispatch', {
  stalledInterval: 300000,
  maxStalledCount: 3,
  concurrency: 10,
})
@Injectable()
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  private readonly agent = new Agent({
    connect: (opts, callback) => {
      let called = false;
      const hostname = opts.hostname || opts.host;

      if (!hostname) {
        callback(new Error('Invalid hostname'), null);
        return;
      }

      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err || !addresses || addresses.length === 0) {
          if (!called) {
            called = true;
            callback(new Error(`DNS resolution failed for ${hostname}`), null);
          }
          return;
        }

        // SSRF Protection: validate all resolved IPs
        for (const addr of addresses) {
          if (!isIpAllowed(addr.address)) {
            if (!called) {
              called = true;
              callback(
                new Error(
                  `SSRF Prevention: IP ${addr.address} for hostname ${hostname} is not allowed`,
                ),
                null,
              );
            }
            return;
          }
        }

        // Use the first resolved and validated IP
        const ip = addresses[0].address;
        const port = Number(opts.port);
        const protocol = opts.protocol;
        const isHttps = protocol === 'https:';

        const socket = isHttps
          ? tls.connect({
              host: ip,
              port,
              servername: opts.servername || opts.hostname || undefined,
            })
          : net.connect({ host: ip, port });

        socket.on('error', (socketErr) => {
          if (!called) {
            called = true;
            callback(socketErr, null);
          }
        });

        socket.on(isHttps ? 'secureConnect' : 'connect', () => {
          if (!called) {
            called = true;
            callback(null, socket);
          }
        });
      });
    },
  });

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
      dispatcher: this.agent,
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch failed with status ${response.status}`);
    }
  }
}
