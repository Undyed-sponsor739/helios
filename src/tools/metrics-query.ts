import type { ToolDefinition } from "../providers/types.js";
import { MetricStore } from "../metrics/store.js";
import { analyzeMetric } from "../metrics/analyzer.js";

export function createMetricsQueryTool(
  store: MetricStore,
): ToolDefinition {
  return {
    name: "metrics_query",
    description:
      "Query collected training metrics. Can get latest values, time series, or trend analysis.",
    parameters: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "ID of the task to query metrics for",
        },
        metric_name: {
          type: "string",
          description:
            "Name of the metric (e.g., 'loss', 'accuracy'). Omit to list all available metrics.",
        },
        mode: {
          type: "string",
          enum: ["latest", "series", "analyze", "list"],
          description:
            "Query mode: 'latest' for most recent value, 'series' for time series, 'analyze' for trend analysis, 'list' for available metric names",
        },
        limit: {
          type: "number",
          description: "Max number of data points for series mode",
        },
      },
      required: ["task_id"],
    },
    execute: async (args) => {
      const taskId = args.task_id as string;
      const metricName = args.metric_name as string | undefined;
      const mode = (args.mode as string) ?? "latest";
      const limit = (args.limit as number) ?? 100;

      if (mode === "list" || !metricName) {
        const names = store.getMetricNames(taskId);
        return JSON.stringify({ metrics: names });
      }

      switch (mode) {
        case "latest": {
          const point = store.getLatest(taskId, metricName);
          return JSON.stringify(point ?? { error: "No data" });
        }

        case "series": {
          const points = store.getSeries(taskId, metricName, limit);
          return JSON.stringify({
            metric: metricName,
            count: points.length,
            values: points.map((p) => ({
              value: p.value,
              step: p.step,
              timestamp: p.timestamp,
            })),
          });
        }

        case "analyze": {
          const points = store.getSeries(taskId, metricName, 100);
          const analysis = analyzeMetric(points);
          return JSON.stringify({
            metric: metricName,
            ...analysis,
          });
        }

        default:
          return JSON.stringify({ error: `Unknown mode: ${mode}` });
      }
    },
  };
}
