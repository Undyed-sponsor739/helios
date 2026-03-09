import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface InputBarProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function InputBar({
  onSubmit,
  disabled = false,
  placeholder = "Send a message...",
}: InputBarProps) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  useInput((input, key) => {
    if (disabled) return;

    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim());
        setHistory((prev) => [value.trim(), ...prev]);
        setValue("");
        setHistoryIdx(-1);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    if (key.upArrow && history.length > 0) {
      const newIdx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(newIdx);
      setValue(history[newIdx]);
      return;
    }

    if (key.downArrow) {
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setValue("");
      } else {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setValue(history[newIdx]);
      }
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
      setHistoryIdx(-1);
    }
  });

  return (
    <Box paddingX={1}>
      <Text color="cyan" bold>
        {">"}{" "}
      </Text>
      {value ? (
        <Text>{value}</Text>
      ) : (
        <Text color="gray" dimColor>
          {disabled ? "Waiting for response..." : placeholder}
        </Text>
      )}
    </Box>
  );
}
