import {
  query as sdkQuery,
  createSdkMcpServer,
  tool as sdkTool,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKMessage,
  Query,
  Options as SDKOptions,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
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
  private activeQuery: Query | null = null;
  /** Cache the SDK session ID so we can resume */
  private sdkSessionIds = new Map<string, string>();

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

    const envKey = process.env.ANTHROPIC_API_KEY;
    if (envKey) {
      await this.authManager.setApiKey("claude", envKey);
      return;
    }

    throw new Error(
      "Claude authentication required. Set ANTHROPIC_API_KEY or run auth flow.",
    );
  }

  async createSession(config: SessionConfig): Promise<Session> {
    const creds = await this.authManager.getCredentials("claude");
    if (!creds) throw new Error("Not authenticated with Claude");

    const session = this.sessionStore.createSession(
      "claude",
      config.model ?? "claude-sonnet-4-20250514",
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
    const creds = await this.authManager.getCredentials("claude");
    if (!creds) throw new Error("Not authenticated");

    // Build MCP server from our tools
    const mcpServer = this.buildMcpServer(tools);

    // Build SDK options
    const options: SDKOptions = {
      model: "claude-sonnet-4-20250514",
      systemPrompt: session.providerId === "claude" ? undefined : undefined,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      includePartialMessages: true,
      maxTurns: 50,
      mcpServers: {
        helios: mcpServer,
      },
      // Disable built-in tools — we only want our MCP tools
      tools: [],
      persistSession: false,
    };

    // Resume if we have a previous SDK session ID
    const sdkSessionId = this.sdkSessionIds.get(session.id);
    if (sdkSessionId) {
      options.resume = sdkSessionId;
    }

    // Set API key in env for the SDK
    if (creds.apiKey) {
      process.env.ANTHROPIC_API_KEY = creds.apiKey;
    } else if (creds.accessToken) {
      // OAuth mode: set the token the same way
      process.env.ANTHROPIC_API_KEY = creds.accessToken;
    }

    const q = sdkQuery({ prompt: message, options });
    this.activeQuery = q;

    try {
      for await (const msg of q) {
        // Capture SDK session ID from first message
        if ("session_id" in msg && msg.session_id && !this.sdkSessionIds.has(session.id)) {
          this.sdkSessionIds.set(session.id, msg.session_id);
          session.providerSessionId = msg.session_id;
        }

        yield* this.mapSdkMessage(msg);
      }
    } finally {
      this.activeQuery = null;
    }
  }

  interrupt(_session: Session): void {
    if (this.activeQuery) {
      this.activeQuery.interrupt();
    }
  }

  async closeSession(session: Session): Promise<void> {
    if (this.activeQuery) {
      this.activeQuery.close();
      this.activeQuery = null;
    }
    this.sdkSessionIds.delete(session.id);
  }

  /**
   * Convert our ToolDefinition[] into an MCP server config
   * that the Claude Agent SDK can consume.
   */
  private buildMcpServer(tools: ToolDefinition[]) {
    const mcpTools = tools.map((t) =>
      sdkTool(
        t.name,
        t.description,
        // Use a passthrough schema — the LLM will send the right args
        // based on the tool description
        this.buildZodSchema(t),
        async (args: Record<string, unknown>) => {
          try {
            const result = await t.execute(args);
            return {
              content: [{ type: "text" as const, text: result }],
            };
          } catch (err) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error: ${err instanceof Error ? err.message : String(err)}`,
                },
              ],
              isError: true,
            };
          }
        },
      ),
    );

    return createSdkMcpServer({
      name: "helios-tools",
      tools: mcpTools,
    });
  }

  /**
   * Build a zod schema from our JSON Schema parameter definition.
   * We create named fields for better LLM tool use.
   */
  private buildZodSchema(tool: ToolDefinition): Record<string, z.ZodTypeAny> {
    const shape: Record<string, z.ZodTypeAny> = {};
    const props = tool.parameters.properties as Record<
      string,
      { type?: string; description?: string; enum?: string[] }
    >;
    const required = new Set(tool.parameters.required ?? []);

    for (const [key, prop] of Object.entries(props)) {
      let field: z.ZodTypeAny;

      if (prop.enum) {
        field = z.enum(prop.enum as [string, ...string[]]);
      } else {
        switch (prop.type) {
          case "number":
            field = z.number();
            break;
          case "boolean":
            field = z.boolean();
            break;
          case "array":
            field = z.array(z.any());
            break;
          case "object":
            field = z.record(z.string(), z.any());
            break;
          default:
            field = z.string();
        }
      }

      if (prop.description) {
        field = field.describe(prop.description);
      }
      if (!required.has(key)) {
        field = field.optional();
      }

      shape[key] = field;
    }

    return shape;
  }

  /**
   * Map SDK messages to our unified AgentEvent stream.
   */
  private *mapSdkMessage(msg: SDKMessage): Generator<AgentEvent> {
    switch (msg.type) {
      case "assistant": {
        // Full assistant message — extract text content
        const textBlocks = msg.message.content.filter(
          (b: { type: string }) => b.type === "text",
        );
        const text = textBlocks
          .map((b: { type: "text"; text: string }) => b.text)
          .join("");
        if (text) {
          yield { type: "text", text, delta: text };
        }

        // Extract tool use blocks
        const toolUseBlocks = msg.message.content.filter(
          (b: { type: string }) => b.type === "tool_use",
        );
        for (const block of toolUseBlocks) {
          const tu = block as {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
          };
          yield {
            type: "tool_call",
            id: tu.id,
            name: tu.name,
            args: tu.input,
          };
        }
        break;
      }

      case "stream_event": {
        // Streaming delta
        const event = msg.event;
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield {
            type: "text",
            text: event.delta.text,
            delta: event.delta.text,
          };
        }
        break;
      }

      case "result": {
        if (msg.subtype === "success") {
          yield {
            type: "done",
            usage: {
              inputTokens: msg.usage.input_tokens,
              outputTokens: msg.usage.output_tokens,
              costUsd: msg.total_cost_usd,
            },
          };
        } else {
          // Error result
          const errMsg = msg as { errors?: string[] };
          yield {
            type: "error",
            error: new Error(
              errMsg.errors?.join("; ") ?? "Unknown SDK error",
            ),
            recoverable: false,
          };
          yield { type: "done" };
        }
        break;
      }

      case "tool_use_summary": {
        // We can surface this as a text event showing what tools were used
        yield {
          type: "text",
          text: "",
          delta: "",
        };
        break;
      }

      // Ignore system/status/auth messages for now — they don't map to user-visible events
      default:
        break;
    }
  }
}
