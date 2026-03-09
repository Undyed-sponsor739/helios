import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { Layout } from "./ui/layout.js";
import { Orchestrator } from "./core/orchestrator.js";
import { ClaudeProvider } from "./providers/claude/provider.js";
import { OpenAIProvider } from "./providers/openai/provider.js";
import { AuthManager } from "./providers/auth/auth-manager.js";
import { ConnectionPool } from "./remote/connection-pool.js";
import { RemoteExecutor } from "./remote/executor.js";
import { FileSync } from "./remote/file-sync.js";
import { TriggerScheduler } from "./scheduler/trigger-scheduler.js";
import { SleepManager } from "./scheduler/sleep-manager.js";
import { MetricStore } from "./metrics/store.js";
import {
  createRemoteExecTool,
  createRemoteExecBackgroundTool,
} from "./tools/remote-exec.js";
import {
  createUploadTool,
  createDownloadTool,
} from "./tools/remote-sync.js";
import { createMetricsQueryTool } from "./tools/metrics-query.js";
import { createSleepTool } from "./tools/sleep.js";
import { createListMachinesTool } from "./tools/list-machines.js";

const SYSTEM_PROMPT = `You are Helios, an autonomous ML research agent. You help researchers design, run, and monitor machine learning experiments on remote machines.

Your capabilities:
- Execute commands on remote machines via SSH
- Launch and monitor training runs
- Track metrics (loss, accuracy, rewards, etc.)
- Transfer files between local and remote machines
- Sleep and set triggers to wake on conditions (training complete, metric threshold, etc.)
- Analyze training curves and suggest adjustments

Your approach:
- Think step-by-step about experiment design
- Monitor for common issues: loss divergence, NaN, OOM, dead GPUs
- Proactively suggest improvements based on observed metrics
- When a training run will take a while, sleep with appropriate triggers rather than polling manually
- Be concise in responses but thorough in analysis

Available tools: remote_exec, remote_exec_background, remote_upload, remote_download, metrics_query, sleep, list_machines`;

interface AppProps {
  defaultProvider?: "claude" | "openai";
}

export function App({ defaultProvider = "claude" }: AppProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orchestrator, setOrchestrator] = useState<Orchestrator | null>(
    null,
  );
  const [sleepManager, setSleepManager] = useState<SleepManager | null>(
    null,
  );

  useEffect(() => {
    async function init() {
      try {
        // Auth
        const authManager = new AuthManager();

        // Providers
        const claudeProvider = new ClaudeProvider(authManager);
        const openaiProvider = new OpenAIProvider(authManager);

        // Remote
        const connectionPool = new ConnectionPool();
        const executor = new RemoteExecutor(connectionPool);
        const fileSync = new FileSync();

        // Metrics
        const metricStore = new MetricStore();

        // Orchestrator
        const orch = new Orchestrator({
          defaultProvider,
          systemPrompt: SYSTEM_PROMPT,
        });

        orch.registerProvider(claudeProvider);
        orch.registerProvider(openaiProvider);

        // Register tools
        orch.registerTools([
          createRemoteExecTool(executor),
          createRemoteExecBackgroundTool(executor),
          createUploadTool(fileSync),
          createDownloadTool(fileSync),
          createMetricsQueryTool(metricStore),
          createListMachinesTool(connectionPool),
        ]);

        // Scheduler
        const triggerScheduler = new TriggerScheduler(connectionPool);
        const sleepMgr = new SleepManager(triggerScheduler, orch);

        // Register sleep tool (needs sleep manager)
        orch.registerTool(createSleepTool(sleepMgr));

        // Start session
        await orch.startSession();

        setOrchestrator(orch);
        setSleepManager(sleepMgr);
        setReady(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Initialization failed",
        );
      }
    }

    init();
  }, [defaultProvider]);

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>
          Helios initialization failed:
        </Text>
        <Text color="red">{error}</Text>
        <Text color="gray">
          Ensure ANTHROPIC_API_KEY is set or run with --provider openai
        </Text>
      </Box>
    );
  }

  if (!ready || !orchestrator || !sleepManager) {
    return (
      <Box padding={1}>
        <Text color="yellow">Starting Helios...</Text>
      </Box>
    );
  }

  return (
    <Layout orchestrator={orchestrator} sleepManager={sleepManager} />
  );
}
