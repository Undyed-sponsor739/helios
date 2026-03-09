import type {
  AgentEvent,
  ToolDefinition,
  ToolCallEvent,
} from "../providers/types.js";

/**
 * Processes tool calls from the agent loop.
 * Given a stream of AgentEvents, intercepts tool_call events,
 * executes the tool, and yields the result.
 */
export async function* processToolCalls(
  events: AsyncGenerator<AgentEvent>,
  tools: ToolDefinition[],
): AsyncGenerator<AgentEvent> {
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  for await (const event of events) {
    yield event;

    if (event.type === "tool_call") {
      const tool = toolMap.get(event.name);
      if (!tool) {
        yield {
          type: "tool_result",
          callId: event.id,
          result: `Unknown tool: ${event.name}`,
          isError: true,
        };
        continue;
      }

      try {
        const result = await tool.execute(event.args);
        yield {
          type: "tool_result",
          callId: event.id,
          result,
        };
      } catch (err) {
        yield {
          type: "tool_result",
          callId: event.id,
          result: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
        };
      }
    }
  }
}

/**
 * Collects all text from a stream of AgentEvents.
 */
export async function collectText(
  events: AsyncGenerator<AgentEvent>,
): Promise<string> {
  let text = "";
  for await (const event of events) {
    if (event.type === "text" && event.delta) {
      text += event.delta;
    }
  }
  return text;
}

/**
 * Extracts tool calls from a stream of AgentEvents.
 */
export async function collectToolCalls(
  events: AsyncGenerator<AgentEvent>,
): Promise<ToolCallEvent[]> {
  const calls: ToolCallEvent[] = [];
  for await (const event of events) {
    if (event.type === "tool_call") {
      calls.push(event);
    }
  }
  return calls;
}
