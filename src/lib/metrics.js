// Process-local metrics for GET /metrics.
//
// Serverless caveat, stated in the output itself: every instance keeps its own
// counters, so a scrape is one sample, not a fleet total. Sum across instances
// in Prometheus. Counters reset when the platform recycles the instance, which
// is why they are counters (Prometheus handles resets) and never gauges.

const BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
const startedAt = Date.now();

const requestCounts = new Map(); // "METHOD status" -> count
const bucketCounts = new Array(BUCKETS.length).fill(0); // non-cumulative
let durationSum = 0;
let durationCount = 0;
const llmCalls = new Map(); // model -> count
const llmFailures = new Map(); // error code -> count

const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);

const escapeLabel = (value) =>
  String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

export const recordRequest = (method, status, durationMs) => {
  const ms = Number.isFinite(durationMs) ? durationMs : 0;
  bump(requestCounts, `${method} ${status}`);
  durationSum += ms;
  durationCount += 1;
  const bucket = BUCKETS.findIndex((limit) => ms <= limit);
  if (bucket !== -1) bucketCounts[bucket] += 1;
};

export const recordLlmCall = (model) => bump(llmCalls, model || 'unknown');
export const recordLlmFailure = (code) => bump(llmFailures, code || 'LLM_UNAVAILABLE');

export const resetMetrics = () => {
  requestCounts.clear();
  bucketCounts.fill(0);
  durationSum = 0;
  durationCount = 0;
  llmCalls.clear();
  llmFailures.clear();
};

export const renderMetrics = () => {
  const lines = [
    '# HELP http_requests_total HTTP requests handled by this instance.',
    '# TYPE http_requests_total counter',
  ];
  for (const [key, count] of [...requestCounts].sort(([a], [b]) => a.localeCompare(b))) {
    const [method, status] = key.split(' ');
    lines.push(`http_requests_total{method="${escapeLabel(method)}",status="${escapeLabel(status)}"} ${count}`);
  }

  lines.push(
    '# HELP http_request_duration_ms Request duration in milliseconds.',
    '# TYPE http_request_duration_ms histogram'
  );
  let cumulative = 0;
  for (let i = 0; i < BUCKETS.length; i += 1) {
    cumulative += bucketCounts[i];
    lines.push(`http_request_duration_ms_bucket{le="${BUCKETS[i]}"} ${cumulative}`);
  }
  lines.push(`http_request_duration_ms_bucket{le="+Inf"} ${durationCount}`);
  lines.push(`http_request_duration_ms_sum ${durationSum}`);
  lines.push(`http_request_duration_ms_count ${durationCount}`);

  lines.push(
    '# HELP llm_calls_total Successful LLM responses by model (per instance).',
    '# TYPE llm_calls_total counter'
  );
  for (const [model, count] of [...llmCalls].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`llm_calls_total{model="${escapeLabel(model)}"} ${count}`);
  }

  lines.push(
    '# HELP llm_call_failures_total Failed LLM calls by error code (per instance).',
    '# TYPE llm_call_failures_total counter'
  );
  for (const [code, count] of [...llmFailures].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`llm_call_failures_total{code="${escapeLabel(code)}"} ${count}`);
  }

  lines.push(
    '# HELP process_uptime_seconds Seconds since this instance started.',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${((Date.now() - startedAt) / 1000).toFixed(3)}`
  );

  return `${lines.join('\n')}\n`;
};
