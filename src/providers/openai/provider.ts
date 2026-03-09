import type {
  ModelProvider,
  ToolDefinition,
  Session,
  SessionConfig,
  AgentEvent,
} from "../types.js";
import type { AuthManager } from "../auth/auth-manager.js";
import { SessionStore } from "../../store/session-store.js";

export class OpenAIProvider implements ModelProvider {
  readonly name = "openai" as const;
  readonly displayName = "OpenAI";

  private authManager: AuthManager;
  private sessionStore: SessionStore;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
    this.sessionStore = new SessionStore();
  }

  async isAuthenticated(): Promise<boolean> {
    return this.authManager.isAuthenticated("openai");
  }

  async authenticate(): Promise<void> {
    const creds = await this.authManager.getCredentials("openai");
    if (creds) return;

    // Import OAuth module and start flow
    const { OpenAIOAuth } = await import("./oauth.js");
    const oauth = new OpenAIOAuth(this.authManager);
    await oauth.login();
  }

  async createSession(config: SessionConfig): Promise<Session> {
    const creds = await this.authManager.getCredentials("openai");
    if (!creds)
      throw new Error("Not authenticated with OpenAI");

    const session = this.sessionStore.createSession(
      "openai",
      config.model ?? "gpt-4.1",
    );

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
    const creds = await this.authManager.getCredentials("openai");
    if (!creds) throw new Error("Not authenticated");

    // TODO: Implement OpenAI Responses API call
    // - Use OAuth bearer token
    // - Route to chatgpt.com/backend-api/codex/responses
    // - Handle streaming SSE responses
    // - Process tool calls

    yield {
      type: "text",
      text: "[OpenAI provider not yet implemented]",
      delta: "[OpenAI provider not yet implemented]",
    };
    yield { type: "done" };
  }

  interrupt(_session: Session): void {
    // TODO: Cancel in-flight request
  }

  async closeSession(_session: Session): Promise<void> {
    // TODO: Clean up
  }
}
