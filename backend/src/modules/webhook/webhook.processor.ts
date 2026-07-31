import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { fetch, Agent } from 'undici';
import * as dns from 'dns';
import * as net from 'net';
import * as tls from 'tls';
import * as ipaddr from 'ipaddr.js';

function isPrivateIP(ip: string): boolean {
  try {
    const parsed = ipaddr.parse(ip);
    const range = parsed.range();
    return range !== 'unicast'; // Block loopback, private, carrierGradeNat, linkLocal, multicast, broadcast, etc.
  } catch (e) {
    // If it can't be parsed, block it to be safe
    return true;
  }
}

const ssrfAgent = new Agent({
  connect: (opts: any, cb: any) => {
    dns.lookup(opts.hostname, { all: true }, (err, addresses) => {
      if (err) return cb(err, null);

      for (const { address } of addresses) {
        if (isPrivateIP(address)) {
          return cb(new Error('SSRF blocked: Private IP address detected'), null);
        }
      }

      const ip = addresses[0].address;

      if (opts.protocol === 'https:') {
        const socket = tls.connect({
          ...opts,
          host: ip,
          port: opts.port || 443,
          servername: opts.servername || opts.hostname,
        });
        cb(null, socket);
      } else {
        const socket = net.connect({
          ...opts,
          host: ip,
          port: opts.port || 80,
        });
        cb(null, socket);
      }
    });
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

    const response = await fetch(String(endpoint.url), {
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
