import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

const errorRate = new Rate('errors');
const reserveDepletionErrors = new Counter('reserve_depletion_errors');
const timeoutErrors = new Counter('timeout_errors');
const activeUsers = new Gauge('active_users');
const successfulGames = new Counter('successful_games');

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 2000,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '3m', target: 500 },
        { duration: '2m', target: 1000 },
        { duration: '1m', target: 1500 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    errors: ['rate<0.15'],
    http_req_duration: ['p(95)<2000'],
    successful_games: ['count>1000'],
  },
};

export default function () {
  activeUsers.add(1);
  
  const wager = Math.floor(Math.random() * 10000000) + 1000000;
  const side = Math.random() > 0.5 ? 'heads' : 'tails';
  
  const res = http.post('http://localhost:5173/api/start', JSON.stringify({
    wager,
    side
  }), { 
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s'
  });
  
  const success = check(res, {
    'game started': (r) => r.status === 200,
    'no timeout': (r) => r.status !== 0,
  });
  
  if (!success) {
    if (res.status === 0) {
      timeoutErrors.add(1);
    } else if (res.status === 400 || res.status === 503) {
      reserveDepletionErrors.add(1);
    }
    errorRate.add(1);
  } else {
    successfulGames.add(1);
  }
  
  activeUsers.add(-1);
  sleep(Math.random() * 2);
}

export function handleSummary(data) {
  const summary = {
    test_type: 'stress',
    timestamp: new Date().toISOString(),
    peak_vus: data.metrics.vus_max?.values?.max || 0,
    total_requests: data.metrics.http_reqs?.values?.count || 0,
    successful_games: data.metrics.successful_games?.values?.count || 0,
    error_rate: data.metrics.errors?.values?.rate || 0,
    reserve_depletion_errors: data.metrics.reserve_depletion_errors?.values?.count || 0,
    timeout_errors: data.metrics.timeout_errors?.values?.count || 0,
    p95_latency: data.metrics.http_req_duration?.values['p(95)'] || 0,
    p99_latency: data.metrics.http_req_duration?.values['p(99)'] || 0,
  };
  
  console.log('\n=== STRESS TEST SUMMARY ===');
  console.log(`Peak VUs: ${summary.peak_vus}`);
  console.log(`Total Requests: ${summary.total_requests}`);
  console.log(`Successful Games: ${summary.successful_games}`);
  console.log(`Error Rate: ${(summary.error_rate * 100).toFixed(2)}%`);
  console.log(`Reserve Depletion Errors: ${summary.reserve_depletion_errors}`);
  console.log(`Timeout Errors: ${summary.timeout_errors}`);
  console.log(`P95 Latency: ${summary.p95_latency.toFixed(2)}ms`);
  
  return {
    'stdout': JSON.stringify(summary, null, 2),
    'stress-test-results.json': JSON.stringify(data),
  };
}
