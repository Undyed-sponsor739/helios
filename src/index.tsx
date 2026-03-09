#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import { App } from "./app.js";

// Parse CLI args
const args = process.argv.slice(2);
let defaultProvider: "claude" | "openai" = "claude";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--provider" && args[i + 1]) {
    const p = args[i + 1];
    if (p === "claude" || p === "openai") {
      defaultProvider = p;
    }
    i++;
  }
}

// Render
const { waitUntilExit } = render(
  <App defaultProvider={defaultProvider} />,
);

waitUntilExit().then(() => {
  process.exit(0);
});
