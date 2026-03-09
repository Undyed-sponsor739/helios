import { TokenStore } from "./token-store.js";
import type { AuthCredentials, AuthMethod } from "../types.js";

export interface AuthConfig {
  claude: {
    method: AuthMethod;
    apiKey?: string;
  };
  openai: {
    method: AuthMethod;
  };
}

export class AuthManager {
  readonly tokenStore: TokenStore;

  constructor() {
    this.tokenStore = new TokenStore();
  }

  async getCredentials(
    provider: "claude" | "openai",
  ): Promise<AuthCredentials | null> {
    const creds = this.tokenStore.get(provider);
    if (!creds) return null;

    if (this.tokenStore.needsRefresh(provider) && creds.refreshToken) {
      return this.refresh(provider, creds);
    }

    return creds;
  }

  async setApiKey(
    provider: "claude" | "openai",
    apiKey: string,
  ): Promise<void> {
    this.tokenStore.set(provider, {
      method: "api_key",
      provider,
      apiKey,
    });
  }

  async setOAuthTokens(
    provider: "claude" | "openai",
    accessToken: string,
    refreshToken: string,
    expiresAt: number,
  ): Promise<void> {
    this.tokenStore.set(provider, {
      method: "oauth",
      provider,
      accessToken,
      refreshToken,
      expiresAt,
    });
  }

  isAuthenticated(provider: "claude" | "openai"): boolean {
    const creds = this.tokenStore.get(provider);
    if (!creds) return false;
    if (creds.method === "api_key") return !!creds.apiKey;
    return !!creds.accessToken && !this.tokenStore.isExpired(provider);
  }

  private async refresh(
    provider: "claude" | "openai",
    creds: AuthCredentials,
  ): Promise<AuthCredentials> {
    // Provider-specific refresh logic will be implemented
    // in the respective provider modules
    throw new Error(
      `Token refresh not yet implemented for ${provider}`,
    );
  }
}
