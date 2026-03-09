import type {
  ModelProvider,
  ToolDefinition,
  Session,
  SessionConfig,
  AgentEvent,
} from "../types.js";
import type { AuthManager } from "../auth/auth-manager.js";
import { SessionStore } from "../../store/session-store.js";

export class ClaudeProvider implements ModelProvider {
  readonly name = "claude" as const;
  readonly displayName = "Claude";

  private authManager: AuthManager;
  private sessionStore: SessionStore;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
    this.sessionStore = new SessionStore();
  }

  async isAuthenticated(): Promise<boolean> {
    return this.authManager.isAuthenticated("claude");
  }

  async authenticate(): Promise<void> {
    const creds = await this.authManager.getCredentials("claude");
    if (creds) return;

    // Check for env var first
    const envKey = process.env.ANTHROPIC_API_KEY;
    if (envKey) {
      await this.authManager.setApiKey("claude", envKey);
      return;
    }

    // TODO: Interactive auth prompt (API key entry or OAuth flow)
    throw new Error(
      "Claude authentication required. Set ANTHROPIC_API_KEY or run auth flow.",
    );
  }

  async createSession(config: SessionConfig): Promise<Session> {
    const creds = await this.authManager.getCredentials("claude");
    if (!creds)
      throw new Error("Not authenticated with Claude");

    const session = this.sessionStore.createSession(
      "claude",
      config.model ?? "claude-sonnet-4-20250514",
    );

    // TODO: Initialize Agent SDK session or raw API session
    // based on creds.method (api_key vs oauth)

    return session;
  }

  async resumeSession(id: string): Promise<Session> {
    const session = this.sessionStore.getSession(id);
    if (!session) throw new Error(`Session ${id} not found`);
    return session;
  }

  async *send(
    session: Session,
    message: string,
    tools: ToolDefinition[],
  ): AsyncGenerator<AgentEvent> {
    const creds = await this.authManager.getCredentials("claude");
    if (!creds) throw new Error("Not authenticated");

    // TODO: Implement based on auth method
    // - API key: Use Claude Agent SDK query()
    // - OAuth: Use raw Anthropic API with bearer token

    yield {
      type: "text",
      text: "[Claude provider not yet implemented]",
      delta: "[Claude provider not yet implemented]",
    };
    yield { type: "done" };
  }

  interrupt(_session: Session): void {
    // TODO: Cancel in-flight request
  }

  async closeSession(_session: Session): Promise<void> {
    // TODO: Clean up provider-side session
  }
}
