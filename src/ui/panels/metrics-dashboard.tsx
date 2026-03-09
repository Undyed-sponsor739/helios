import React from "react";
import { Box, Text } from "ink";

interface MetricsDashboardProps {
  active: boolean;
}

export function MetricsDashboard({ active }: MetricsDashboardProps) {
  // TODO: Connect to MetricStore and render live charts with asciichart
  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Text bold color={active ? "cyan" : "white"}>
        Metrics
      </Text>
      <Text color="gray" dimColor>
        No active metrics. Start a training run to see live charts.
      </Text>
    </Box>
  );
}

/**
 * Render a simple sparkline from values.
 * Uses block characters for a compact display.
 */
export function sparkline(values: number[], width = 40): string {
  if (values.length === 0) return "";

  const blocks = [" ", "\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Sample values to fit width
  const sampled =
    values.length <= width
      ? values
      : values.filter(
          (_, i) =>
            Math.floor((i * width) / values.length) !==
            Math.floor(((i - 1) * width) / values.length),
        );

  return sampled
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (blocks.length - 1));
      return blocks[idx];
    })
    .join("");
}
