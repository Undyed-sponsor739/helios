import React from "react";
import { Box, Text } from "ink";
import type { Orchestrator } from "../../core/orchestrator.js";

interface StatusBarProps {
  orchestrator: Orchestrator;
}

export function StatusBar({ orchestrator }: StatusBarProps) {
  const state = orchestrator.currentState;
  const provider = orchestrator.currentProvider;
  const cost = orchestrator.totalCostUsd;

  const stateColor = {
    idle: "gray",
    active: "green",
    sleeping: "yellow",
    waiting: "blue",
    error: "red",
  }[state] as string;

  return (
    <Box paddingX={1}>
      <Text bold color="magenta">
        HELIOS
      </Text>
      <Text color="gray"> | </Text>
      <Text color="cyan">{provider?.displayName ?? "No provider"}</Text>
      <Text color="gray"> | </Text>
      <Text color={stateColor}>
        {state.toUpperCase()}
      </Text>
      {cost > 0 && (
        <>
          <Text color="gray"> | </Text>
          <Text color="gray">${cost.toFixed(4)}</Text>
        </>
      )}
    </Box>
  );
}
