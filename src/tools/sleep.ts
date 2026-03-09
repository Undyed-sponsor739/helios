import type { ToolDefinition } from "../providers/types.js";
import type { SleepManager } from "../scheduler/sleep-manager.js";
import type { TriggerExpression, MetricSource } from "../scheduler/triggers/types.js";

export function createSleepTool(
  sleepManager: SleepManager,
): ToolDefinition {
  return {
    name: "sleep",
    description: `Put yourself to sleep until conditions are met. Use this when waiting for long-running tasks like training. You will be woken when triggers fire.

Trigger types:
- timer: Wake after a duration. Provide wake_after_seconds.
- process_exit: Wake when a remote process exits. Provide machine_id and pid or process_pattern.
- metric: Wake when a metric meets a condition. Provide machine_id, source, field, comparator, threshold.
- file: Wake when a file appears/changes. Provide machine_id, path, mode (exists|modified|size_stable).
- resource: Wake when GPU/CPU crosses a threshold. Provide machine_id, resource, comparator, threshold.

Use logic "any" to wake on the first condition met, "all" to require all conditions.`,
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why you are sleeping (shown to user)",
        },
        wake_conditions: {
          type: "array",
          description: "Conditions that will wake you up",
          items: { type: "object" },
        },
        logic: {
          type: "string",
          enum: ["any", "all"],
          description: "Wake on ANY condition (OR) or ALL conditions (AND)",
        },
        deadline_minutes: {
          type: "number",
          description: "Maximum sleep duration in minutes. Wake regardless after this.",
        },
      },
      required: ["reason", "wake_conditions"],
    },
    execute: async (args) => {
      const reason = args.reason as string;
      const conditions = args.wake_conditions as Record<string, unknown>[];
      const logic = (args.logic as "any" | "all") ?? "any";
      const deadlineMin = args.deadline_minutes as number | undefined;

      const triggerConditions = conditions.map(parseTriggerCondition);

      const expression: TriggerExpression =
        triggerConditions.length === 1
          ? triggerConditions[0]
          : { op: logic === "all" ? "and" : "or", children: triggerConditions };

      const session = await sleepManager.sleep({
        reason,
        expression,
        deadlineMs: deadlineMin ? deadlineMin * 60 * 1000 : undefined,
      });

      return JSON.stringify({
        status: "sleeping",
        session_id: session.id,
        trigger_id: session.trigger.id,
        reason,
        deadline: session.trigger.deadline
          ? new Date(session.trigger.deadline).toISOString()
          : null,
      });
    },
  };
}

function parseTriggerCondition(
  raw: Record<string, unknown>,
): TriggerExpression {
  const type = raw.type as string;

  switch (type) {
    case "timer":
      return {
        kind: "timer",
        wakeAt:
          Date.now() + ((raw.wake_after_seconds as number) ?? 3600) * 1000,
      };

    case "process_exit":
      return {
        kind: "process_exit",
        machineId: raw.machine_id as string,
        pid: raw.pid as number | undefined,
        processPattern: raw.process_pattern as string | undefined,
      };

    case "metric":
      return {
        kind: "metric",
        machineId: raw.machine_id as string,
        source: raw.source as MetricSource,
        field: raw.field as string,
        comparator: raw.comparator as "<" | ">" | "<=" | ">=" | "==" | "!=",
        threshold: raw.threshold as number,
        sustainedChecks: raw.sustained_checks as number | undefined,
      };

    case "file":
      return {
        kind: "file",
        machineId: raw.machine_id as string,
        path: raw.path as string,
        mode: (raw.mode as "exists" | "modified" | "size_stable") ?? "exists",
      };

    case "resource":
      return {
        kind: "resource",
        machineId: raw.machine_id as string,
        resource: raw.resource as
          | "gpu_util"
          | "gpu_memory"
          | "cpu"
          | "memory"
          | "disk",
        comparator: (raw.comparator as "<" | ">" | "<=" | ">=") ?? "<",
        threshold: raw.threshold as number,
        gpuIndex: raw.gpu_index as number | undefined,
      };

    default:
      throw new Error(`Unknown trigger type: ${type}`);
  }
}
