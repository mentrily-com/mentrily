import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { safePost } from '../../common/safe-http';

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

    // Endpoint URLs are operator-supplied, so dispatch goes through the
    // SSRF-filtered client: an endpoint pointing at cloud metadata or a
    // service on the VM's private network is refused before connecting.
    const response = await safePost(String(endpoint.url), body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      timeout: 10000,
      // Deliver the exact bytes that were signed, and never throw on a
      // non-2xx so the status check below still drives BullMQ retries.
      transformRequest: [(data) => data],
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Webhook dispatch failed with status ${response.status}`);
    }
  }
}
