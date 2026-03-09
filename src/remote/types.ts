export interface RemoteMachine {
  id: string;
  host: string;
  port: number;
  username: string;
  authMethod: "key" | "agent" | "password";
  keyPath?: string;
  labels?: string[];
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface BackgroundProcess {
  pid: number;
  machineId: string;
  command: string;
  logPath?: string;
  startedAt: number;
}

export interface ConnectionStatus {
  machineId: string;
  connected: boolean;
  lastConnectedAt?: number;
  error?: string;
}
