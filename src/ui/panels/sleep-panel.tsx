import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { SleepManager } from "../../scheduler/sleep-manager.js";
import type { TriggerExpression } from "../../scheduler/triggers/types.js";

interface SleepPanelProps {
  sleepManager: SleepManager;
}

export function SleepPanel({ sleepManager }: SleepPanelProps) {
  const [now, setNow] = useState(Date.now());

  // Update every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const session = sleepManager.currentSleep;
  if (!session) return null;

  const elapsed = now - session.createdAt;
  const elapsedStr = formatDuration(elapsed);
  const deadline = session.trigger.deadline;
  const remaining = deadline ? deadline - now : null;

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      paddingX={2}
    >
      <Text color="yellow" bold>
        Agent Sleeping
      </Text>
      <Text color="gray">
        Reason: {session.trigger.sleepReason}
      </Text>
      <Text color="gray">Elapsed: {elapsedStr}</Text>
      {remaining !== null && remaining > 0 && (
        <Text color="gray">
          Deadline in: {formatDuration(remaining)}
        </Text>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text bold>Active Triggers:</Text>
        <TriggerDisplay
          expression={session.trigger.expression}
          satisfiedLeaves={session.trigger.satisfiedLeaves}
          path="root"
        />
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press Enter or type to wake manually
        </Text>
      </Box>
    </Box>
  );
}

function TriggerDisplay({
  expression,
  satisfiedLeaves,
  path,
}: {
  expression: TriggerExpression;
  satisfiedLeaves: Set<string>;
  path: string;
}) {
  if ("op" in expression) {
    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Text color="gray">
          {expression.op.toUpperCase()}:
        </Text>
        {expression.children.map((child, i) => (
          <TriggerDisplay
            key={i}
            expression={child}
            satisfiedLeaves={satisfiedLeaves}
            path={`${path}.${i}`}
          />
        ))}
      </Box>
    );
  }

  const satisfied = satisfiedLeaves.has(path);
  const icon = satisfied ? "+" : "o";
  const color = satisfied ? "green" : "gray";

  return (
    <Box paddingLeft={2}>
      <Text color={color}>
        {icon} {describeCondition(expression)}
      </Text>
    </Box>
  );
}

function describeCondition(expr: TriggerExpression): string {
  if ("op" in expr) return `${expr.op}(...)`;

  switch (expr.kind) {
    case "timer":
      return `Timer: wake at ${new Date(expr.wakeAt).toLocaleTimeString()}`;
    case "process_exit":
      return `Process exit: ${expr.processPattern ?? `PID ${expr.pid}`} on ${expr.machineId}`;
    case "metric":
      return `Metric: ${expr.field} ${expr.comparator} ${expr.threshold}`;
    case "file":
      return `File ${expr.mode}: ${expr.path} on ${expr.machineId}`;
    case "resource":
      return `Resource: ${expr.resource} ${expr.comparator} ${expr.threshold}%`;
    case "user_message":
      return "User message";
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
