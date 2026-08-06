import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Agent, fetch as undiciFetch } from 'undici';
import * as dns from 'dns';
import * as ipaddr from 'ipaddr.js';
import * as tls from 'tls';
import * as net from 'net';

function isSafeIp(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return false;
  try {
    const parsed = ipaddr.parse(ip);
    const range = parsed.range();

    // Check if it's an IPv4-mapped IPv6 address
    if (range === 'ipv4Mapped' && parsed.kind() === 'ipv6') {
      const ipv4 = (parsed as ipaddr.IPv6).toIPv4Address();
      return ipv4.range() === 'unicast';
    }

    return range === 'unicast';
  } catch {
    return false;
  }
}

const ssrfSafeAgent = new Agent({
  connect(opts, callback) {
    let called = false;
    const done = (err: Error | null, socket?: any) => {
      if (!called) {
        called = true;
        callback(err, socket);
      }
    };

    const hostname = opts.hostname || opts.host;
    if (!hostname) {
      return done(new Error('No hostname provided'));
    }

    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) return done(err);

      const safeAddresses = addresses.filter((a) => isSafeIp(a.address));

      if (safeAddresses.length === 0) {
        return done(
          new Error(`SSRF Prevention: Blocked access to ${hostname}`),
        );
      }

      const ip = safeAddresses[0].address;
      let socket: net.Socket | tls.TLSSocket;

      if (opts.protocol === 'https:') {
        socket = tls.connect({
          host: ip,
          port: (opts.port as unknown as number) || 443,
          servername: opts.servername || opts.hostname || opts.host,
        });
        socket.on('secureConnect', () => done(null, socket));
      } else {
        socket = net.connect({
          host: ip,
          port: (opts.port as unknown as number) || 80,
        });
        socket.on('connect', () => done(null, socket));
      }

      socket.on('error', (e) => done(e));
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

    const response = await undiciFetch(String(endpoint.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
      dispatcher: ssrfSafeAgent,
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch failed with status ${response.status}`);
    }
  }
}
