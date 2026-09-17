import { performance } from 'perf_hooks';

export interface BenchmarkConfig {
  name: string;
  totalRequests: number;
  concurrency: number;
  requestFn: (index: number) => Promise<{ status: number; ok: boolean; body?: any; error?: string }>;
}

export interface BenchmarkResult {
  name: string;
  totalRequests: number;
  concurrency: number;
  durationSec: number;
  rps: number;
  successful: number;
  rateLimited429: number;
  serverErrors5xx: number;
  clientErrors4xx: number;
  networkErrors: number;
  latencies: {
    min: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    mean: number;
  };
}

export async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
  const { name, totalRequests, concurrency, requestFn } = config;
  console.log(`\n===============================================================`);
  console.log(`🚀 RUNNING BENCHMARK: ${name}`);
  console.log(`   Total Requests: ${totalRequests} | Concurrency: ${concurrency}`);
  console.log(`===============================================================`);

  const latencies: number[] = [];
  let successful = 0;
  let rateLimited429 = 0;
  let serverErrors5xx = 0;
  let clientErrors4xx = 0;
  let networkErrors = 0;

  let requestIndex = 0;
  const startTime = performance.now();

  async function worker() {
    while (true) {
      const currentIndex = requestIndex++;
      if (currentIndex >= totalRequests) {
        break;
      }

      const reqStart = performance.now();
      try {
        const res = await requestFn(currentIndex);
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);

        if (res.status === 429) {
          rateLimited429++;
        } else if (res.status >= 200 && res.status < 300) {
          successful++;
        } else if (res.status >= 500) {
          serverErrors5xx++;
        } else if (res.status >= 400) {
          clientErrors4xx++;
        } else {
          clientErrors4xx++;
        }
      } catch (err: any) {
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);
        networkErrors++;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker());
  await Promise.all(workers);

  const endTime = performance.now();
  const durationSec = (endTime - startTime) / 1000;
  const rps = durationSec > 0 ? totalRequests / durationSec : 0;

  latencies.sort((a, b) => a - b);
  const count = latencies.length || 1;
  const sum = latencies.reduce((acc, val) => acc + val, 0);

  const getPercentile = (p: number) => {
    if (latencies.length === 0) return 0;
    const idx = Math.min(Math.floor((p / 100) * latencies.length), latencies.length - 1);
    return latencies[idx];
  };

  const result: BenchmarkResult = {
    name,
    totalRequests,
    concurrency,
    durationSec: Number(durationSec.toFixed(2)),
    rps: Number(rps.toFixed(1)),
    successful,
    rateLimited429,
    serverErrors5xx,
    clientErrors4xx,
    networkErrors,
    latencies: {
      min: Number((latencies[0] || 0).toFixed(2)),
      p50: Number(getPercentile(50).toFixed(2)),
      p90: Number(getPercentile(90).toFixed(2)),
      p95: Number(getPercentile(95).toFixed(2)),
      p99: Number(getPercentile(99).toFixed(2)),
      max: Number((latencies[latencies.length - 1] || 0).toFixed(2)),
      mean: Number((sum / count).toFixed(2)),
    },
  };

  printBenchmarkReport(result);
  return result;
}

export function printBenchmarkReport(res: BenchmarkResult) {
  const errorRate = (((res.totalRequests - res.successful) / res.totalRequests) * 100).toFixed(1);
  const isHealthy = res.serverErrors5xx === 0 && res.networkErrors === 0 && Number(errorRate) < 1.0;
  const isDegraded = res.serverErrors5xx > 0 || res.latencies.p99 > 1500;
  const statusBadge = isHealthy ? '✅ HOLDS (EXCELLENT)' : isDegraded ? '⚠️ DEGRADED / ELEVATED LATENCY' : '❌ BREAKS (CRITICAL)';

  console.log(`\n---------------------------------------------------------------`);
  console.log(`📊 RESULTS: ${res.name}`);
  console.log(`---------------------------------------------------------------`);
  console.log(`Verdict:           ${statusBadge}`);
  console.log(`Total Requests:    ${res.totalRequests}`);
  console.log(`Concurrency:       ${res.concurrency} virtual users`);
  console.log(`Total Duration:    ${res.durationSec}s`);
  console.log(`Throughput (RPS):  ${res.rps} req/sec`);
  console.log(`---------------------------------------------------------------`);
  console.log(`Successful (2xx):  ${res.successful}`);
  console.log(`Throttled (429):   ${res.rateLimited429}`);
  console.log(`Client Errors 4xx: ${res.clientErrors4xx}`);
  console.log(`Server Errors 5xx: ${res.serverErrors5xx}`);
  console.log(`Network Failures:  ${res.networkErrors}`);
  console.log(`Error Rate:        ${errorRate}%`);
  console.log(`---------------------------------------------------------------`);
  console.log(`Latency Percentiles:`);
  console.log(`  Min:   ${res.latencies.min.toFixed(1)} ms`);
  console.log(`  P50:   ${res.latencies.p50.toFixed(1)} ms (Median)`);
  console.log(`  P90:   ${res.latencies.p90.toFixed(1)} ms`);
  console.log(`  P95:   ${res.latencies.p95.toFixed(1)} ms`);
  console.log(`  P99:   ${res.latencies.p99.toFixed(1)} ms`);
  console.log(`  Max:   ${res.latencies.max.toFixed(1)} ms`);
  console.log(`  Mean:  ${res.latencies.mean.toFixed(1)} ms`);
  console.log(`===============================================================\n`);
}
