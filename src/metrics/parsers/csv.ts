import type { MetricPoint } from "../store.js";

/**
 * Parse CSV training logs.
 * Expects header row with column names, values in subsequent rows.
 * Returns metrics from the last row.
 */
export function parseCsv(content: string): MetricPoint[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const lastLine = lines[lines.length - 1];
  const values = lastLine.split(",").map((v) => v.trim());
  const now = Date.now();

  const points: MetricPoint[] = [];

  for (let i = 0; i < headers.length; i++) {
    const value = parseFloat(values[i]);
    if (!isNaN(value)) {
      points.push({
        metricName: headers[i],
        value,
        timestamp: now,
        step: extractStep(headers, values),
      });
    }
  }

  return points;
}

function extractStep(
  headers: string[],
  values: string[],
): number | undefined {
  const stepIdx = headers.findIndex(
    (h) =>
      h.toLowerCase() === "step" ||
      h.toLowerCase() === "epoch" ||
      h.toLowerCase() === "iteration",
  );
  if (stepIdx === -1) return undefined;
  const step = parseInt(values[stepIdx], 10);
  return isNaN(step) ? undefined : step;
}
