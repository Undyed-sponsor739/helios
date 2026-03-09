import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { ConversationPanel } from "./panels/conversation.js";
import { TaskListPanel } from "./panels/task-list.js";
import { MetricsDashboard } from "./panels/metrics-dashboard.js";
import { SleepPanel } from "./panels/sleep-panel.js";
import { StatusBar } from "./components/status-bar.js";
import { InputBar } from "./components/input-bar.js";
import type { Orchestrator } from "../core/orchestrator.js";
import type { SleepManager } from "../scheduler/sleep-manager.js";

type Panel = "conversation" | "tasks" | "metrics";

interface LayoutProps {
  orchestrator: Orchestrator;
  sleepManager: SleepManager;
}

export function Layout({ orchestrator, sleepManager }: LayoutProps) {
  const { exit } = useApp();
  const [activePanel, setActivePanel] = useState<Panel>("conversation");
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [isStreaming, setIsStreaming] = useState(false);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      if (isStreaming) {
        orchestrator.interrupt();
      } else {
        exit();
      }
    }

    if (key.tab) {
      setActivePanel((prev) => {
        const panels: Panel[] = ["conversation", "tasks", "metrics"];
        const idx = panels.indexOf(prev);
        return panels[(idx + 1) % panels.length];
      });
    }
  });

  const handleSubmit = useCallback(
    async (input: string) => {
      if (!input.trim()) return;

      // Handle slash commands
      if (input.startsWith("/")) {
        handleSlashCommand(input, orchestrator);
        return;
      }

      // Wake agent if sleeping
      if (sleepManager.isSleeping) {
        sleepManager.manualWake(input);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "user", content: input },
      ]);
      setIsStreaming(true);

      try {
        let assistantText = "";
        for await (const event of orchestrator.send(input)) {
          if (event.type === "text" && event.delta) {
            assistantText += event.delta;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                last.content = assistantText;
              } else {
                updated.push({
                  role: "assistant",
                  content: assistantText,
                });
              }
              return updated;
            });
          }

          if (event.type === "tool_call") {
            setMessages((prev) => [
              ...prev,
              {
                role: "tool",
                content: `> ${event.name}(${JSON.stringify(event.args).slice(0, 100)})`,
              },
            ]);
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            content:
              err instanceof Error ? err.message : "Unknown error",
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [orchestrator, sleepManager],
  );

  const isSleeping = sleepManager.isSleeping;

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Main content area */}
      <Box flexGrow={1} flexDirection="row">
        {/* Sidebar: tasks */}
        <Box
          width={20}
          flexDirection="column"
          borderStyle="single"
          borderColor={activePanel === "tasks" ? "cyan" : "gray"}
        >
          <TaskListPanel active={activePanel === "tasks"} />
        </Box>

        {/* Center: conversation or sleep */}
        <Box
          flexGrow={1}
          flexDirection="column"
          borderStyle="single"
          borderColor={
            activePanel === "conversation" ? "cyan" : "gray"
          }
        >
          {isSleeping ? (
            <SleepPanel sleepManager={sleepManager} />
          ) : (
            <ConversationPanel
              messages={messages}
              isStreaming={isStreaming}
            />
          )}
        </Box>
      </Box>

      {/* Metrics bar (collapsed) */}
      <Box
        height={6}
        borderStyle="single"
        borderColor={activePanel === "metrics" ? "cyan" : "gray"}
      >
        <MetricsDashboard active={activePanel === "metrics"} />
      </Box>

      {/* Status bar */}
      <StatusBar orchestrator={orchestrator} />

      {/* Input */}
      <InputBar
        onSubmit={handleSubmit}
        disabled={isStreaming}
        placeholder={
          isSleeping
            ? "Type to wake agent..."
            : "Send a message..."
        }
      />
    </Box>
  );
}

function handleSlashCommand(
  input: string,
  orchestrator: Orchestrator,
): void {
  const [cmd, ...args] = input.slice(1).split(" ");
  switch (cmd) {
    case "switch":
      orchestrator
        .switchProvider(args[0] as "claude" | "openai")
        .catch(() => {});
      break;
    case "quit":
    case "exit":
      process.exit(0);
    default:
      break;
  }
}
