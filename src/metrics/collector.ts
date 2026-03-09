import type { ConnectionPool } from "../remote/connection-pool.js";
import { MetricStore, type MetricPoint } from "./store.js";
import { parseStdout } from "./parsers/stdout.js";
import { parseCsv } from "./parsers/csv.js";
import { parseJson } from "./parsers/json.js";

export interface CollectorConfig {
  taskId: string;
  machineId: string;
  source:
    | { type: "stdout"; logPath: string; pattern?: string }
    | { type: "csv"; path: string }
    | { type: "json"; path: string; fields?: string[] }
    | { type: "tensorboard"; logdir: string };
}

export class MetricCollector {
  private configs: CollectorConfig[] = [];
  private lastOffsets = new Map<string, number>(); // track file read position

  constructor(
    private pool: ConnectionPool,
    private store: MetricStore,
  ) {}

  addSource(config: CollectorConfig): void {
    this.configs.push(config);
  }

  removeSource(taskId: string): void {
    this.configs = this.configs.filter((c) => c.taskId !== taskId);
  }

  /** Collect latest metrics from all configured sources */
  async collectAll(): Promise<MetricPoint[]> {
    const allPoints: MetricPoint[] = [];

    for (const config of this.configs) {
      try {
        const points = await this.collect(config);
        if (points.length > 0) {
          this.store.insertBatch(
            config.taskId,
            config.machineId,
            points,
          );
          allPoints.push(...points);
        }
      } catch {
        // Silently skip failed collections
      }
    }

    return allPoints;
  }

  private async collect(
    config: CollectorConfig,
  ): Promise<MetricPoint[]> {
    switch (config.source.type) {
      case "stdout": {
        const output = await this.pool.tailFile(
          config.machineId,
          config.source.logPath,
          20,
        );
        return parseStdout(output, config.source.pattern);
      }

      case "csv": {
        const result = await this.pool.exec(
          config.machineId,
          `cat ${config.source.path}`,
        );
        return parseCsv(result.stdout);
      }

      case "json": {
        const result = await this.pool.exec(
          config.machineId,
          `cat ${config.source.path}`,
        );
        return parseJson(result.stdout, config.source.fields);
      }

      case "tensorboard": {
        // TODO: Implement TensorBoard event file parsing
        return [];
      }
    }
  }
}
