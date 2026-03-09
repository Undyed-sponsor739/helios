import type { ToolDefinition } from "../providers/types.js";
import type { RemoteExecutor } from "../remote/executor.js";

export function createRemoteExecTool(
  executor: RemoteExecutor,
): ToolDefinition {
  return {
    name: "remote_exec",
    description:
      "Execute a shell command on a remote machine. Returns stdout, stderr, and exit code.",
    parameters: {
      type: "object",
      properties: {
        machine_id: {
          type: "string",
          description: "ID of the remote machine to run the command on",
        },
        command: {
          type: "string",
          description: "Shell command to execute",
        },
        timeout_seconds: {
          type: "number",
          description: "Optional timeout in seconds",
        },
      },
      required: ["machine_id", "command"],
    },
    execute: async (args) => {
      const result = await executor.exec(
        args.machine_id as string,
        args.command as string,
        args.timeout_seconds
          ? (args.timeout_seconds as number) * 1000
          : undefined,
      );
      return JSON.stringify({
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exitCode,
      });
    },
  };
}

export function createRemoteExecBackgroundTool(
  executor: RemoteExecutor,
): ToolDefinition {
  return {
    name: "remote_exec_background",
    description:
      "Launch a long-running process on a remote machine in the background. Returns PID and log path. Use this for training runs.",
    parameters: {
      type: "object",
      properties: {
        machine_id: {
          type: "string",
          description: "ID of the remote machine",
        },
        command: {
          type: "string",
          description: "Command to run in the background",
        },
        log_path: {
          type: "string",
          description: "Optional path for stdout/stderr log file",
        },
      },
      required: ["machine_id", "command"],
    },
    execute: async (args) => {
      const proc = await executor.execBackground(
        args.machine_id as string,
        args.command as string,
        args.log_path as string | undefined,
      );
      return JSON.stringify({
        pid: proc.pid,
        log_path: proc.logPath,
        machine_id: proc.machineId,
      });
    },
  };
}
