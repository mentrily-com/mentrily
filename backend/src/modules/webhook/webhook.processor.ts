import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Agent } from 'undici';
import * as dns from 'dns';
import * as ipaddr from 'ipaddr.js';
import * as tls from 'tls';
import * as net from 'net';

@Processor('webhook-dispatch', {
  stalledInterval: 300000,
  maxStalledCount: 3,
  concurrency: 10,
})
@Injectable()
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  // SSRF Protection: Custom undici Agent to block requests to private/internal IPs
  private readonly ssrfAgent = new Agent({
    connect: (opts: any, cb: any) => {
      dns.lookup(opts.hostname, { all: true }, (err, addresses) => {
        if (err) return cb(err);

        for (const address of addresses) {
          try {
            const ip = ipaddr.parse(address.address);
            if (ip.range() !== 'unicast') {
              return cb(new Error(`SSRF Blocked: Attempted connection to internal/private IP ${address.address}`));
            }
          } catch (e) {
            return cb(new Error(`SSRF Blocked: Invalid IP address format ${address.address}`));
          }
        }

        // Proceed with connection using a validated IP address
        // Using addresses[0].address prevents TOCTOU / DNS rebinding
        const validatedIp = addresses[0].address;

        if (opts.protocol === 'https:') {
          cb(
            null,
            tls.connect({
              host: validatedIp,
              port: opts.port,
              servername: opts.servername || opts.hostname,
            })
          );
        } else {
          cb(
            null,
            net.connect({
              host: validatedIp,
              port: opts.port,
            })
          );
        }
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

    const response = await fetch(String(endpoint.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
      // @ts-ignore - undici Agent is compatible with Node.js fetch dispatcher
      dispatcher: this.ssrfAgent,
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch failed with status ${response.status}`);
    }
  }
}
