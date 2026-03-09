import { Hono } from "hono";
import { serve } from "@hono/node-server";

const CALLBACK_PORT = 1455;

interface CallbackResult {
  code: string;
  state: string;
}

/**
 * Local HTTP server for OAuth callback.
 * Listens on 127.0.0.1:1455 for the redirect from the OAuth provider.
 */
export function startCallbackServer(
  expectedState: string,
): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const app = new Hono();
    let server: ReturnType<typeof serve> | null = null;

    app.get("/auth/callback", (c) => {
      const code = c.req.query("code");
      const state = c.req.query("state");
      const error = c.req.query("error");

      if (error) {
        // Close server after responding
        setTimeout(() => server?.close(), 100);
        reject(new Error(`OAuth error: ${error}`));
        return c.html(
          "<h1>Authentication failed</h1><p>You can close this tab.</p>",
        );
      }

      if (!code || !state) {
        setTimeout(() => server?.close(), 100);
        reject(new Error("Missing code or state in callback"));
        return c.html(
          "<h1>Authentication failed</h1><p>Missing parameters.</p>",
        );
      }

      if (state !== expectedState) {
        setTimeout(() => server?.close(), 100);
        reject(new Error("State mismatch — possible CSRF"));
        return c.html(
          "<h1>Authentication failed</h1><p>Invalid state.</p>",
        );
      }

      setTimeout(() => server?.close(), 100);
      resolve({ code, state });

      return c.html(
        "<h1>Authenticated!</h1><p>You can close this tab and return to Helios.</p>",
      );
    });

    server = serve({
      fetch: app.fetch,
      port: CALLBACK_PORT,
      hostname: "127.0.0.1",
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server?.close();
      reject(new Error("OAuth callback timed out after 5 minutes"));
    }, 5 * 60 * 1000);
  });
}
