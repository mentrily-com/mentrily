import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { fetch, Agent } from 'undici';
import { lookup } from 'dns';

function isPrivateIp(ip: string): boolean {
  if (!ip) return false;
  const parts = ip.split('.');
  if (parts.length === 4) {
    if (
      parts[0] === '10' ||
      parts[0] === '127' ||
      parts[0] === '0' ||
      (parts[0] === '192' && parts[1] === '168') ||
      (parts[0] === '169' && parts[1] === '254') ||
      (parts[0] === '172' && parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31)
    ) {
      return true;
    }
  }
  if (ip.includes(':')) {
    const ipLower = ip.toLowerCase();
    if (
      ipLower === '::1' ||
      ipLower === '::' ||
      ipLower.startsWith('fc') ||
      ipLower.startsWith('fd') ||
      ipLower.startsWith('fe8') ||
      ipLower.startsWith('fe9') ||
      ipLower.startsWith('fea') ||
      ipLower.startsWith('feb')
    ) {
      return true;
    }
    if (ipLower.startsWith('::ffff:')) {
      return isPrivateIp(ipLower.substring(7));
    }
  }
  return false;
}

const safeDispatcher = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      lookup(hostname, options, (err, addresses, family) => {
        if (err) return callback(err, '', 0);

        // Ensure all returned IPs are public to prevent SSRF via DNS multi-A-record fallback
        if (Array.isArray(addresses)) {
          for (const addr of addresses) {
            if (isPrivateIp(addr.address)) {
              return callback(new Error(`SSRF blocked: ${addr.address}`), '', 0);
            }
          }
        } else {
          if (isPrivateIp(addresses as unknown as string)) {
            return callback(new Error(`SSRF blocked: ${addresses}`), '', 0);
          }
        }

        callback(null, addresses, family);
      });
    },
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
      dispatcher: safeDispatcher,
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch failed with status ${response.status}`);
    }
  }
}
