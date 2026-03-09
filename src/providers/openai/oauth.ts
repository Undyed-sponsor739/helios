import { randomBytes, createHash } from "node:crypto";
import { exec } from "node:child_process";
import type { AuthManager } from "../auth/auth-manager.js";

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CALLBACK_PORT = 1455;
const CALLBACK_PATH = "/auth/callback";
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`;

/**
 * OpenAI OAuth 2.0 + PKCE flow.
 *
 * Authenticates via ChatGPT Plus/Pro subscription.
 * Reference: numman-ali/opencode-openai-codex-auth
 */
export class OpenAIOAuth {
  constructor(private authManager: AuthManager) {}

  /**
   * Start the OAuth login flow.
   * 1. Generate PKCE code_verifier + code_challenge
   * 2. Start local callback server
   * 3. Open browser to auth URL
   * 4. Wait for callback with auth code
   * 5. Exchange code for tokens
   * 6. Store tokens
   */
  async login(): Promise<void> {
    const { verifier, challenge } = this.generatePKCE();
    const state = randomBytes(32).toString("hex");

    const authUrl = this.buildAuthUrl(challenge, state);

    // Start callback server
    const code = await this.startCallbackServer(state);

    // Exchange code for tokens
    const tokens = await this.exchangeCode(code, verifier);

    // Store
    await this.authManager.setOAuthTokens(
      "openai",
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
    );
  }

  /**
   * Refresh an expired token.
   */
  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }> {
    // TODO: Implement token refresh against OpenAI's token endpoint
    throw new Error("OpenAI token refresh not yet implemented");
  }

  private generatePKCE(): { verifier: string; challenge: string } {
    const verifier = randomBytes(32)
      .toString("base64url")
      .replace(/[^a-zA-Z0-9\-._~]/g, "");
    const challenge = createHash("sha256")
      .update(verifier)
      .digest("base64url");
    return { verifier, challenge };
  }

  private buildAuthUrl(challenge: string, state: string): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      scope: "openid profile email",
    });

    return `https://auth.openai.com/authorize?${params.toString()}`;
  }

  private async startCallbackServer(expectedState: string): Promise<string> {
    // TODO: Start Hono server on CALLBACK_PORT
    // Listen for GET on CALLBACK_PATH
    // Validate state parameter
    // Return authorization code
    throw new Error("Callback server not yet implemented");
  }

  private async exchangeCode(
    code: string,
    verifier: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }> {
    // TODO: POST to OpenAI token endpoint
    // Include code, verifier, client_id, redirect_uri
    throw new Error("Token exchange not yet implemented");
  }

  private openBrowser(url: string): void {
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    exec(`${cmd} "${url}"`);
  }
}
