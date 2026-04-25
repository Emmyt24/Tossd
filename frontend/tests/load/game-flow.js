import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const gameFlowDuration = new Trend('game_flow_duration');
const gameStartLatency = new Trend('game_start_latency');
const cashOutLatency = new Trend('cash_out_latency');
const concurrentGames = new Counter('concurrent_games');

export const options = {
  scenarios: {
    concurrent_players: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 500 },
        { duration: '1m', target: 1000 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    errors: ['rate<0.05'],
    game_flow_duration: ['p(95)<3000', 'p(99)<5000'],
    game_start_latency: ['p(95)<800'],
    cash_out_latency: ['p(95)<600'],
  },
};

export default function () {
  const flowStart = Date.now();
  
  // Homepage load
  let res = http.get('http://localhost:5173');
  check(res, { 'homepage loaded': (r) => r.status === 200 });
  sleep(0.5);
  
  // Wallet connection simulation
  const connectStart = Date.now();
  res = http.post('http://localhost:5173/api/connect', JSON.stringify({
    wallet: 'freighter'
  }), { headers: { 'Content-Type': 'application/json' } });
  sleep(0.3);
  
  // Game start
  const gameStart = Date.now();
  res = http.post('http://localhost:5173/api/start', JSON.stringify({
    wager: 5000000,
    side: Math.random() > 0.5 ? 'heads' : 'tails'
  }), { headers: { 'Content-Type': 'application/json' } });
  
  const gameStartSuccess = check(res, {
    'game started': (r) => r.status === 200 || r.status === 404,
  });
  gameStartLatency.add(Date.now() - gameStart);
  concurrentGames.add(1);
  
  sleep(1);
  
  // Reveal
  res = http.post('http://localhost:5173/api/reveal', JSON.stringify({
    secret: 'test_secret_' + __VU + '_' + __ITER
  }), { headers: { 'Content-Type': 'application/json' } });
  sleep(0.5);
  
  // Cash out
  const cashOutStart = Date.now();
  res = http.post('http://localhost:5173/api/cashout', null, {
    headers: { 'Content-Type': 'application/json' }
  });
  cashOutLatency.add(Date.now() - cashOutStart);
  
  const flowSuccess = gameStartSuccess && check(res, {
    'cash out completed': (r) => r.status === 200 || r.status === 404,
  });
  
  errorRate.add(!flowSuccess);
  gameFlowDuration.add(Date.now() - flowStart);
  
  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    metrics: {
      total_requests: data.metrics.http_reqs?.values?.count || 0,
      error_rate: data.metrics.errors?.values?.rate || 0,
      avg_response_time: data.metrics.http_req_duration?.values?.avg || 0,
      p95_response_time: data.metrics.http_req_duration?.values['p(95)'] || 0,
      p99_response_time: data.metrics.http_req_duration?.values['p(99)'] || 0,
      game_flow_p95: data.metrics.game_flow_duration?.values['p(95)'] || 0,
      concurrent_games: data.metrics.concurrent_games?.values?.count || 0,
    },
    thresholds_passed: Object.keys(data.metrics).every(
      key => !data.metrics[key].thresholds || 
             Object.values(data.metrics[key].thresholds).every(t => t.ok)
    ),
  };
  
  return {
    'stdout': JSON.stringify(summary, null, 2),
    'game-flow-results.json': JSON.stringify(data),
  };
}
