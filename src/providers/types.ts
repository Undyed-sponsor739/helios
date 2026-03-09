import { z } from "zod";

// --- Agent Events (unified across providers) ---

export interface TextEvent {
  type: "text";
  text: string;
  /** Incremental delta for streaming */
  delta?: string;
}

export interface ToolCallEvent {
  type: "tool_call";
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: "tool_result";
  callId: string;
  result: string;
  isError?: boolean;
}

export interface ErrorEvent {
  type: "error";
  error: Error;
  recoverable: boolean;
}

export interface DoneEvent {
  type: "done";
  usage?: TokenUsage;
}

export type AgentEvent =
  | TextEvent
  | ToolCallEvent
  | ToolResultEvent
  | ErrorEvent
  | DoneEvent;

// --- Token Usage ---

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
}

// --- Session ---

export interface Session {
  id: string;
  providerId: string;
  providerSessionId?: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface SessionConfig {
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// --- Tool Definition ---

export const ToolParameterSchema = z.object({
  type: z.literal("object"),
  properties: z.record(z.string(), z.any()),
  required: z.array(z.string()).optional(),
});

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.infer<typeof ToolParameterSchema>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// --- Provider Interface ---

export interface ModelProvider {
  readonly name: "claude" | "openai";
  readonly displayName: string;

  /** Check if the provider is authenticated */
  isAuthenticated(): Promise<boolean>;

  /** Initiate authentication flow */
  authenticate(): Promise<void>;

  /** Create a new conversation session */
  createSession(config: SessionConfig): Promise<Session>;

  /** Resume an existing session */
  resumeSession(id: string): Promise<Session>;

  /** Send a message and stream events */
  send(
    session: Session,
    message: string,
    tools: ToolDefinition[],
  ): AsyncGenerator<AgentEvent>;

  /** Interrupt the current generation */
  interrupt(session: Session): void;

  /** Clean up session resources */
  closeSession(session: Session): Promise<void>;
}

// --- Auth Types ---

export type AuthMethod = "api_key" | "oauth";

export interface AuthCredentials {
  method: AuthMethod;
  provider: "claude" | "openai";
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  expiresAt?: number;
}
