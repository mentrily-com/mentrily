import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import * as dns from 'dns/promises';

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

    const urlStr = String(endpoint.url);
    let urlObj;
    try {
      urlObj = new URL(urlStr);
    } catch (e) {
      throw new Error(`Invalid webhook URL`);
    }

    // SSRF Protection: Resolve hostname to IP to check against private/internal ranges
    let lookupResult;
    try {
      lookupResult = await dns.lookup(urlObj.hostname);
    } catch (e) {
      throw new Error(`Invalid webhook hostname: unable to resolve`);
    }
    const ip = lookupResult.address;

    const isPrivateIp = (ipAddr: string) => {
      return (
        ipAddr === '127.0.0.1' ||
        ipAddr === '::1' ||
        ipAddr.startsWith('10.') ||
        ipAddr.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ipAddr) ||
        ipAddr.startsWith('169.254.') ||
        ipAddr.startsWith('fd') ||
        ipAddr.startsWith('fe80')
      );
    };

    if (isPrivateIp(ip)) {
      throw new Error('Blocked: Attempted to access internal network');
    }

    // Prevent TOCTOU (DNS Rebinding) by fetching via the resolved IP
    // Since node doesn't natively expose DNS override in global fetch easily for HTTPS (SNI issues)
    // we use `undici` dynamically which is Node.js's underlying fetch engine.
    const { fetch: undiciFetch, Agent } = await import('undici');

    const agent = new Agent({
      connect: {
        lookup: (hostname, options, callback) => {
          callback(null, [{ address: ip, family: lookupResult.family || 4 }]);
        }
      }
    });

    const response = await undiciFetch(urlStr, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
      dispatcher: agent,
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch failed with status ${response.status}`);
    }
  }
}
