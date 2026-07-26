import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import * as dns from 'dns';
import { promisify } from 'util';

const lookupAsync = promisify(dns.lookup);

function isPrivateIP(ip: string): boolean {
  if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
  if (
    ip === '::1' ||
    ip.startsWith('fe80:') ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  )
    return true;
  const parts = ip.split('.');
  if (parts.length === 4) {
    const [p1, p2] = [parseInt(parts[0], 10), parseInt(parts[1], 10)];
    if (
      p1 === 10 ||
      p1 === 127 ||
      p1 === 0 ||
      (p1 === 172 && p2 >= 16 && p2 <= 31) ||
      (p1 === 192 && p2 === 168) ||
      (p1 === 169 && p2 === 254)
    ) {
      return true;
    }
  }
  return false;
}

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

    const urlString = String(endpoint.url);
    let resolvedAddress: string;
    let originalHost: string;
    let urlProtocol: string;
    let urlPort: string;
    let urlPathAndQuery: string;

    try {
      const parsedUrl = new URL(urlString);
      originalHost = parsedUrl.hostname;
      urlProtocol = parsedUrl.protocol;
      urlPort = parsedUrl.port;
      urlPathAndQuery = parsedUrl.pathname + parsedUrl.search;

      const { address } = await lookupAsync(originalHost);
      resolvedAddress = address;

      if (isPrivateIP(resolvedAddress)) {
        this.logger.warn(
          `SSRF Blocked: Webhook URL resolves to private IP (${resolvedAddress})`,
        );
        return; // Fail securely without exposing internal data
      }
    } catch (error) {
      this.logger.warn(
        `SSRF Blocked: Invalid URL or DNS resolution failed for webhook: ${urlString}`,
      );
      return;
    }

    // Protect against DNS rebinding by forcing the request to the exact resolved IP address.
    // Construct the URL using the resolved IP address to prevent a second DNS lookup.
    // Format IPv6 addresses properly with brackets if necessary.
    const ipHost = resolvedAddress.includes(':')
      ? `[${resolvedAddress}]`
      : resolvedAddress;
    const finalPort = urlPort ? `:${urlPort}` : '';
    const fetchUrl = `${urlProtocol}//${ipHost}${finalPort}${urlPathAndQuery}`;

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        // Override the Host header to match the original requested hostname,
        // so the destination server handles virtual hosting correctly.
        Host: originalHost,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch failed with status ${response.status}`);
    }
  }
}
