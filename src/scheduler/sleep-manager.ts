import { nanoid } from "nanoid";
import { EventEmitter } from "node:events";
import type {
  SleepSession,
  Trigger,
  TriggerExpression,
} from "./triggers/types.js";
import { TriggerScheduler } from "./trigger-scheduler.js";
import type { Orchestrator } from "../core/orchestrator.js";

export interface SleepRequest {
  reason: string;
  expression: TriggerExpression;
  deadlineMs?: number;
  pollIntervalMs?: number;
}

export class SleepManager extends EventEmitter {
  private activeSleep: SleepSession | null = null;

  constructor(
    private scheduler: TriggerScheduler,
    private orchestrator: Orchestrator,
  ) {
    super();

    this.scheduler.on("wake", (session: SleepSession, reason: string) => {
      this.handleWake(session, reason);
    });
  }

  get isSleeping(): boolean {
    return this.activeSleep !== null;
  }

  get currentSleep(): SleepSession | null {
    return this.activeSleep;
  }

  async sleep(request: SleepRequest): Promise<SleepSession> {
    if (this.activeSleep) {
      throw new Error("Already sleeping. Wake first.");
    }

    const session = this.orchestrator.currentSession;
    const provider = this.orchestrator.currentProvider;
    if (!session || !provider) {
      throw new Error("No active session to sleep");
    }

    const trigger: Trigger = {
      id: nanoid(),
      status: "pending",
      expression: request.expression,
      createdAt: Date.now(),
      deadline: request.deadlineMs
        ? Date.now() + request.deadlineMs
        : undefined,
      pollIntervalMs: request.pollIntervalMs,
      sleepReason: request.reason,
      contextSnapshotId: session.id,
      satisfiedLeaves: new Set(),
    };

    const sleepSession: SleepSession = {
      id: nanoid(),
      trigger,
      agentState: {
        sessionId: session.id,
        providerName: provider.name,
        providerSessionId: session.providerSessionId,
        pendingGoal: request.reason,
        activeMachines: [], // TODO: populate from connection pool
      },
      createdAt: Date.now(),
    };

    this.activeSleep = sleepSession;
    this.orchestrator.stateMachine.transition(
      "sleeping",
      request.reason,
    );
    this.scheduler.start(sleepSession);
    this.emit("sleep", sleepSession);

    return sleepSession;
  }

  manualWake(userMessage?: string): void {
    if (!this.activeSleep) return;
    this.scheduler.onUserMessage();
  }

  private handleWake(session: SleepSession, reason: string): void {
    this.activeSleep = null;
    this.orchestrator.stateMachine.transition("active", reason);
    this.emit("wake", session, reason);

    // TODO: Resume agent session with context injection
    // Build wake message with: elapsed time, trigger info, latest metrics
  }

  buildWakeMessage(session: SleepSession): string {
    const elapsed = (session.wokeAt ?? Date.now()) - session.createdAt;
    const elapsedMin = Math.round(elapsed / 60_000);

    const parts = [
      `You slept for ${elapsedMin} minutes.`,
      `Wake reason: ${session.wakeReason}.`,
      `Original goal: ${session.agentState.pendingGoal}`,
    ];

    const satisfied = Array.from(session.trigger.satisfiedLeaves);
    if (satisfied.length > 0) {
      parts.push(`Satisfied conditions: ${satisfied.join(", ")}`);
    }

    return parts.join("\n");
  }
}
