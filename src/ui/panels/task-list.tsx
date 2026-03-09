import React from "react";
import { Box, Text } from "ink";

interface TaskListPanelProps {
  active: boolean;
}

export function TaskListPanel({ active }: TaskListPanelProps) {
  // TODO: Connect to task store
  const tasks: Array<{
    id: string;
    name: string;
    status: string;
  }> = [];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color={active ? "cyan" : "white"}>
        Tasks
      </Text>
      {tasks.length === 0 ? (
        <Text color="gray" dimColor>
          No tasks
        </Text>
      ) : (
        tasks.map((task) => (
          <Box key={task.id}>
            <Text>
              {statusIcon(task.status)} {task.name}
            </Text>
          </Box>
        ))
      )}
    </Box>
  );
}

function statusIcon(status: string): string {
  switch (status) {
    case "running":
      return "*";
    case "completed":
      return "+";
    case "failed":
      return "x";
    case "sleeping":
      return "z";
    default:
      return "-";
  }
}
