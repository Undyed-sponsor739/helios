import type {
  ModelProvider,
  ToolDefinition,
  Session,
  SessionConfig,
  AgentEvent,
} from "../providers/types.js";
import { AgentStateMachine } from "./state-machine.js";
import { SessionStore } from "../store/session-store.js";

export interface OrchestratorConfig {
  defaultProvider: "claude" | "openai";
  systemPrompt: string;
}

export class Orchestrator {
  private providers = new Map<string, ModelProvider>();
  private activeProvider: ModelProvider | null = null;
  private activeSession: Session | null = null;
  private tools: ToolDefinition[] = [];
  readonly stateMachine = new AgentStateMachine();
  readonly sessionStore = new SessionStore();

  constructor(private config: OrchestratorConfig) {}

  registerProvider(provider: ModelProvider): void {
    this.providers.set(provider.name, provider);
  }

  registerTool(tool: ToolDefinition): void {
    this.tools.push(tool);
  }

  registerTools(tools: ToolDefinition[]): void {
    this.tools.push(...tools);
  }

  getProvider(name?: string): ModelProvider | null {
    if (name) return this.providers.get(name) ?? null;
    return this.activeProvider;
  }

  async switchProvider(name: "claude" | "openai"): Promise<void> {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider "${name}" not registered`);

    if (!(await provider.isAuthenticated())) {
      await provider.authenticate();
    }

    this.activeProvider = provider;
  }

  async startSession(config?: Partial<SessionConfig>): Promise<Session> {
    if (!this.activeProvider) {
      await this.switchProvider(this.config.defaultProvider);
    }

    const sessionConfig: SessionConfig = {
      systemPrompt: this.config.systemPrompt,
      ...config,
    };

    const session =
      await this.activeProvider!.createSession(sessionConfig);
    this.activeSession = session;
    this.stateMachine.transition("active", "Session started");
    return session;
  }

  async *send(message: string): AsyncGenerator<AgentEvent> {
    if (!this.activeProvider || !this.activeSession) {
      throw new Error("No active session");
    }

    this.sessionStore.updateLastActive(this.activeSession.id);
    this.sessionStore.addMessage(this.activeSession.id, "user", message);

    let fullResponse = "";

    for await (const event of this.activeProvider.send(
      this.activeSession,
      message,
      this.tools,
    )) {
      if (event.type === "text" && event.delta) {
        fullResponse += event.delta;
      }
      yield event;
    }

    if (fullResponse) {
      this.sessionStore.addMessage(
        this.activeSession.id,
        "assistant",
        fullResponse,
      );
    }
  }

  interrupt(): void {
    if (this.activeProvider && this.activeSession) {
      this.activeProvider.interrupt(this.activeSession);
    }
  }

  get currentSession(): Session | null {
    return this.activeSession;
  }

  get currentProvider(): ModelProvider | null {
    return this.activeProvider;
  }

  get currentState() {
    return this.stateMachine.state;
  }
}
