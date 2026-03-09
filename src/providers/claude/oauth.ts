import type { AuthManager } from "../auth/auth-manager.js";

/**
 * Claude OAuth flow (grey-area).
 *
 * Uses Claude's OAuth PKCE flow to obtain sk-ant-oat01-* tokens.
 * These work with Claude Pro/Max subscriptions but violate
 * Anthropic's ToS for third-party tools.
 *
 * Reference: anthropic-auth crate pattern, adapted to TypeScript.
 */
export class ClaudeOAuth {
  constructor(private authManager: AuthManager) {}

  /**
   * Start the OAuth flow.
   * Opens browser to Claude's auth page, listens for callback.
   */
  async login(): Promise<void> {
    // TODO: Implement Claude OAuth PKCE flow
    // 1. Generate code_verifier + code_challenge
    // 2. Open browser to Claude auth URL
    // 3. Listen on local callback server
    // 4. Exchange code for tokens
    // 5. Store via authManager.setOAuthTokens()
    throw new Error("Claude OAuth not yet implemented");
  }

  /**
   * Refresh an expired OAuth token.
   */
  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }> {
    // TODO: Implement token refresh
    throw new Error("Claude OAuth refresh not yet implemented");
  }
}
