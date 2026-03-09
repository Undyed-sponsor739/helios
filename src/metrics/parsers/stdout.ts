import type { MetricPoint } from "../store.js";

/**
 * Parse training metrics from stdout/log output.
 * Supports common patterns like:
 *   step=1000 loss=0.234 lr=1e-4
 *   [epoch 5] train_loss: 0.123, val_loss: 0.456
 *   Step 100 | Loss: 0.234 | Acc: 0.95
 */
const DEFAULT_PATTERNS = [
  // key=value pairs: loss=0.234
  /(\w+)\s*=\s*([+-]?\d+\.?\d*(?:e[+-]?\d+)?)/gi,
  // key: value pairs: loss: 0.234
  /(\w+)\s*:\s*([+-]?\d+\.?\d*(?:e[+-]?\d+)?)/gi,
];

export function parseStdout(
  output: string,
  customPattern?: string,
): MetricPoint[] {
  const points: MetricPoint[] = [];
  const now = Date.now();
  const lines = output.split("\n").filter((l) => l.trim());

  const patterns = customPattern
    ? [new RegExp(customPattern, "gi")]
    : DEFAULT_PATTERNS;

  // Only parse the last few lines for latest values
  const recentLines = lines.slice(-5);

  for (const line of recentLines) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const name = match[1].toLowerCase();
        const value = parseFloat(match[2]);
        if (!isNaN(value) && isMetricName(name)) {
          points.push({
            metricName: name,
            value,
            timestamp: now,
          });
        }
      }
    }
  }

  return dedup(points);
}

/** Filter likely metric names from noise */
function isMetricName(name: string): boolean {
  const metricKeywords = [
    "loss",
    "acc",
    "accuracy",
    "lr",
    "learning_rate",
    "reward",
    "return",
    "step",
    "epoch",
    "grad",
    "norm",
    "perplexity",
    "ppl",
    "bleu",
    "f1",
    "precision",
    "recall",
    "auc",
    "mse",
    "mae",
    "rmse",
    "kl",
    "entropy",
  ];
  return metricKeywords.some(
    (kw) => name.includes(kw) || kw.includes(name),
  );
}

/** Deduplicate by metric name, keeping last occurrence */
function dedup(points: MetricPoint[]): MetricPoint[] {
  const seen = new Map<string, MetricPoint>();
  for (const p of points) {
    seen.set(p.metricName, p);
  }
  return Array.from(seen.values());
}
