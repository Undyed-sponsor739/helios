import React from "react";
import { Box, Text } from "ink";

interface Message {
  role: string;
  content: string;
}

interface ConversationPanelProps {
  messages: Message[];
  isStreaming: boolean;
}

export function ConversationPanel({
  messages,
  isStreaming,
}: ConversationPanelProps) {
  if (messages.length === 0) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        flexGrow={1}
        paddingX={2}
      >
        <Text color="gray">
          Welcome to Helios. Send a message to start.
        </Text>
      </Box>
    );
  }

  // Show last N messages that fit the viewport
  const visibleMessages = messages.slice(-50);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {visibleMessages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {isStreaming && (
        <Text color="yellow" dimColor>
          ...
        </Text>
      )}
    </Box>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const { role, content } = message;

  switch (role) {
    case "user":
      return (
        <Box marginBottom={1}>
          <Text color="blue" bold>
            You:{" "}
          </Text>
          <Text>{content}</Text>
        </Box>
      );

    case "assistant":
      return (
        <Box marginBottom={1} flexDirection="column">
          <Text color="green" bold>
            Helios:
          </Text>
          <Text>{content}</Text>
        </Box>
      );

    case "tool":
      return (
        <Box marginBottom={0}>
          <Text color="gray" dimColor>
            {content}
          </Text>
        </Box>
      );

    case "error":
      return (
        <Box marginBottom={1}>
          <Text color="red">Error: {content}</Text>
        </Box>
      );

    case "system":
      return (
        <Box marginBottom={1}>
          <Text color="yellow" dimColor>
            {content}
          </Text>
        </Box>
      );

    default:
      return (
        <Box marginBottom={1}>
          <Text>{content}</Text>
        </Box>
      );
  }
}
