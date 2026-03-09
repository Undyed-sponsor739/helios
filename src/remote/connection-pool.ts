import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import type {
  RemoteMachine,
  ExecResult,
  ConnectionStatus,
} from "./types.js";

interface PooledConnection {
  client: Client;
  machine: RemoteMachine;
  connected: boolean;
  lastUsedAt: number;
  reconnectAttempts: number;
}

export class ConnectionPool {
  private connections = new Map<string, PooledConnection>();
  private machines = new Map<string, RemoteMachine>();

  addMachine(machine: RemoteMachine): void {
    this.machines.set(machine.id, machine);
  }

  removeMachine(id: string): void {
    this.disconnect(id);
    this.machines.delete(id);
  }

  async connect(machineId: string): Promise<void> {
    const machine = this.machines.get(machineId);
    if (!machine) throw new Error(`Unknown machine: ${machineId}`);

    const existing = this.connections.get(machineId);
    if (existing?.connected) return;

    const client = new Client();

    return new Promise((resolve, reject) => {
      client.on("ready", () => {
        this.connections.set(machineId, {
          client,
          machine,
          connected: true,
          lastUsedAt: Date.now(),
          reconnectAttempts: 0,
        });
        resolve();
      });

      client.on("error", (err) => {
        const conn = this.connections.get(machineId);
        if (conn) conn.connected = false;
        reject(err);
      });

      client.on("close", () => {
        const conn = this.connections.get(machineId);
        if (conn) conn.connected = false;
      });

      const connectConfig: Record<string, unknown> = {
        host: machine.host,
        port: machine.port,
        username: machine.username,
        keepaliveInterval: 30_000,
        keepaliveCountMax: 3,
      };

      if (machine.authMethod === "key" && machine.keyPath) {
        connectConfig.privateKey = readFileSync(machine.keyPath);
      } else if (machine.authMethod === "agent") {
        connectConfig.agent = process.env.SSH_AUTH_SOCK;
      }

      client.connect(connectConfig);
    });
  }

  async exec(machineId: string, command: string): Promise<ExecResult> {
    const conn = await this.getConnection(machineId);
    conn.lastUsedAt = Date.now();

    return new Promise((resolve, reject) => {
      conn.client.exec(command, (err, stream) => {
        if (err) return reject(err);

        let stdout = "";
        let stderr = "";

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });
        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
        stream.on("close", (code: number) => {
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });
      });
    });
  }

  async execBackground(
    machineId: string,
    command: string,
    logPath?: string,
  ): Promise<{ pid: number; logPath: string }> {
    const log = logPath ?? `/tmp/helios-${Date.now()}.log`;
    const wrappedCmd = `nohup ${command} > ${log} 2>&1 & echo $!`;
    const result = await this.exec(machineId, wrappedCmd);
    const pid = parseInt(result.stdout.trim(), 10);
    if (isNaN(pid)) {
      throw new Error(
        `Failed to get PID. stdout: ${result.stdout}, stderr: ${result.stderr}`,
      );
    }
    return { pid, logPath: log };
  }

  async isProcessRunning(
    machineId: string,
    pid: number,
  ): Promise<boolean> {
    const result = await this.exec(
      machineId,
      `kill -0 ${pid} 2>/dev/null && echo "running" || echo "stopped"`,
    );
    return result.stdout.trim() === "running";
  }

  async tailFile(
    machineId: string,
    path: string,
    lines = 50,
  ): Promise<string> {
    const result = await this.exec(machineId, `tail -n ${lines} ${path}`);
    return result.stdout;
  }

  getStatus(machineId: string): ConnectionStatus {
    const conn = this.connections.get(machineId);
    return {
      machineId,
      connected: conn?.connected ?? false,
      lastConnectedAt: conn?.lastUsedAt,
      error: undefined,
    };
  }

  getAllStatuses(): ConnectionStatus[] {
    return Array.from(this.machines.keys()).map((id) =>
      this.getStatus(id),
    );
  }

  disconnect(machineId: string): void {
    const conn = this.connections.get(machineId);
    if (conn) {
      conn.client.end();
      this.connections.delete(machineId);
    }
  }

  disconnectAll(): void {
    for (const [id] of this.connections) {
      this.disconnect(id);
    }
  }

  private async getConnection(
    machineId: string,
  ): Promise<PooledConnection> {
    let conn = this.connections.get(machineId);
    if (!conn?.connected) {
      await this.connect(machineId);
      conn = this.connections.get(machineId);
    }
    if (!conn?.connected) {
      throw new Error(`Cannot connect to ${machineId}`);
    }
    return conn;
  }
}
