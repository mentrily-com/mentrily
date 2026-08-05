import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Agent, fetch as undiciFetch } from 'undici';
import * as ipaddr from 'ipaddr.js';
import * as dns from 'dns';
import * as net from 'net';
import * as tls from 'tls';

const ssrfAgent = new Agent({
  connect(opts, callback) {
    let called = false;
    const safeCallback = (err, socket) => {
      if (!called) {
        called = true;
        callback(err, socket);
      }
    };

    dns.lookup(opts.hostname || opts.host, { all: true }, (err, addresses) => {
      if (err) return safeCallback(err, null);

      for (const { address } of addresses) {
        try {
          const ip = ipaddr.parse(address);
          if (ip.range() !== 'unicast') {
            return safeCallback(
              new Error(`SSRF Prevention: IP ${address} is not allowed.`),
              null,
            );
          }
        } catch (e) {
          return safeCallback(
            new Error(`SSRF Prevention: Invalid IP ${address}.`),
            null,
          );
        }
      }

      const ip = addresses[0].address;

      const connectOpts: any = {
        host: ip,
        port: opts.port || (opts.protocol === 'https:' ? 443 : 80),
      };

      if (opts.protocol === 'https:') {
        connectOpts.servername = opts.servername || opts.hostname || opts.host;
        const socket = tls.connect(connectOpts);
        socket.on('secureConnect', () => safeCallback(null, socket));
        socket.on('error', (err) => safeCallback(err, null));
      } else {
        const socket = net.connect(connectOpts);
        socket.on('connect', () => safeCallback(null, socket));
        socket.on('error', (err) => safeCallback(err, null));
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
