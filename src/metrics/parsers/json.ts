import type { MetricPoint } from "../store.js";

/**
 * Parse JSON metrics files.
 * Supports flat objects: { "loss": 0.234, "acc": 0.95 }
 * And arrays of objects (takes last entry): [{ "loss": 0.234 }, ...]
 */
export function parseJson(
  content: string,
  fields?: string[],
): MetricPoint[] {
  try {
    const data = JSON.parse(content);
    const now = Date.now();

    // Handle array: take last element
    const obj = Array.isArray(data) ? data[data.length - 1] : data;

    if (typeof obj !== "object" || obj === null) return [];

    const points: MetricPoint[] = [];
    const keys = fields ?? Object.keys(obj);

    for (const key of keys) {
      const value = extractNestedValue(obj, key);
      if (typeof value === "number" && isFinite(value)) {
        points.push({
          metricName: key,
          value,
          timestamp: now,
        });
      }
    }

    return points;
  } catch {
    return [];
  }
}

function extractNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
