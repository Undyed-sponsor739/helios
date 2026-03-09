import { getDb } from "../store/database.js";

export interface MetricPoint {
  metricName: string;
  value: number;
  step?: number;
  timestamp: number;
}

export class MetricStore {
  insert(
    taskId: string,
    machineId: string,
    point: MetricPoint,
  ): void {
    const db = getDb();
    db.prepare(
      `INSERT INTO metrics (task_id, machine_id, metric_name, value, step, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      taskId,
      machineId,
      point.metricName,
      point.value,
      point.step ?? null,
      point.timestamp,
    );
  }

  insertBatch(
    taskId: string,
    machineId: string,
    points: MetricPoint[],
  ): void {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO metrics (task_id, machine_id, metric_name, value, step, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const insertMany = db.transaction((pts: MetricPoint[]) => {
      for (const p of pts) {
        stmt.run(
          taskId,
          machineId,
          p.metricName,
          p.value,
          p.step ?? null,
          p.timestamp,
        );
      }
    });

    insertMany(points);
  }

  getLatest(
    taskId: string,
    metricName: string,
  ): MetricPoint | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT * FROM metrics
         WHERE task_id = ? AND metric_name = ?
         ORDER BY timestamp DESC LIMIT 1`,
      )
      .get(taskId, metricName) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      metricName: row.metric_name as string,
      value: row.value as number,
      step: row.step as number | undefined,
      timestamp: row.timestamp as number,
    };
  }

  getSeries(
    taskId: string,
    metricName: string,
    limit = 200,
  ): MetricPoint[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM metrics
         WHERE task_id = ? AND metric_name = ?
         ORDER BY timestamp ASC
         LIMIT ?`,
      )
      .all(taskId, metricName, limit) as Record<string, unknown>[];

    return rows.map((row) => ({
      metricName: row.metric_name as string,
      value: row.value as number,
      step: row.step as number | undefined,
      timestamp: row.timestamp as number,
    }));
  }

  getMetricNames(taskId: string): string[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT DISTINCT metric_name FROM metrics WHERE task_id = ?`,
      )
      .all(taskId) as { metric_name: string }[];
    return rows.map((r) => r.metric_name);
  }

  /** Clean up metrics older than retentionDays */
  cleanup(retentionDays: number): number {
    const db = getDb();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const result = db
      .prepare("DELETE FROM metrics WHERE timestamp < ?")
      .run(cutoff);
    return result.changes;
  }
}
