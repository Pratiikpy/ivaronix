/**
 * Custom multi-line text input for the Ink TUI.
 *
 * ink-text-input only supports single-line. Claude Code-style chat needs
 * multi-line composition (paste a code block, write a long prompt). This
 * component handles:
 *
 *   - char insertion at cursor
 *   - shift+enter or backslash-continuation for newline
 *   - plain enter to submit
 *   - backspace, delete
 *   - arrow keys (left/right within a line, up/down across lines)
 *   - home/end to jump to line edges
 *   - ctrl+a / ctrl+e for full home/end on the current line
 *   - paste support: any \n in the inserted chunk is preserved
 *
 * Renders each line of `value` on its own row with a cursor block on the
 * active position. The blink is intentionally absent — Ink re-renders too
 * often for blinking to look smooth without manual throttling.
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmit: (final: string) => void;
  placeholder?: string;
  /** When true the editor stops accepting input (e.g. while a turn is busy). */
  disabled?: boolean;
}

export function MultiLineInput({ value, onChange, onSubmit, placeholder, disabled }: Props): React.ReactElement {
  const [cursor, setCursor] = React.useState<number>(value.length);

  // Clamp cursor whenever value changes from outside (e.g. parent reset to '')
  React.useEffect(() => {
    if (cursor > value.length) setCursor(value.length);
  }, [value, cursor]);

  useInput((input, key) => {
    if (disabled) return;

    // Shift+Enter or Alt+Enter → newline (Ink reports key.return + key.shift OR
    // the input as `\\\n` depending on terminal). We also treat the special
    // `\\` trailing backslash as a continuation hint when followed by enter.
    if (key.return) {
      if (key.shift) {
        const next = value.slice(0, cursor) + '\n' + value.slice(cursor);
        onChange(next);
        setCursor(cursor + 1);
        return;
      }
      // Plain enter: if the line ends with a backslash, treat as continuation
      const beforeCursor = value.slice(0, cursor);
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const currentLine = beforeCursor.slice(lineStart);
      if (currentLine.endsWith('\\')) {
        // Replace the trailing \ with a newline
        const next = beforeCursor.slice(0, -1) + '\n' + value.slice(cursor);
        onChange(next);
        setCursor(cursor); // cursor stays at the newline position
        return;
      }
      // Plain enter with no continuation → submit
      onSubmit(value);
      return;
    }

    if (key.backspace || key.delete) {
      if (cursor === 0) return;
      const next = value.slice(0, cursor - 1) + value.slice(cursor);
      onChange(next);
      setCursor(cursor - 1);
      return;
    }

    // Arrow keys
    if (key.leftArrow) {
      if (cursor > 0) setCursor(cursor - 1);
      return;
    }
    if (key.rightArrow) {
      if (cursor < value.length) setCursor(cursor + 1);
      return;
    }
    if (key.upArrow) {
      // Move to same column on previous line
      const before = value.slice(0, cursor);
      const lineStart = before.lastIndexOf('\n');
      if (lineStart < 0) return; // already on first line
      const col = cursor - (lineStart + 1);
      const prevStart = before.slice(0, lineStart).lastIndexOf('\n') + 1;
      const prevLineLen = lineStart - prevStart;
      setCursor(prevStart + Math.min(col, prevLineLen));
      return;
    }
    if (key.downArrow) {
      const after = value.slice(cursor);
      const nextNl = after.indexOf('\n');
      if (nextNl < 0) return; // already on last line
      const before = value.slice(0, cursor);
      const lineStart = before.lastIndexOf('\n') + 1;
      const col = cursor - lineStart;
      const nextLineStart = cursor + nextNl + 1;
      const afterNext = value.slice(nextLineStart);
      const nextNextNl = afterNext.indexOf('\n');
      const nextLineLen = nextNextNl < 0 ? afterNext.length : nextNextNl;
      setCursor(nextLineStart + Math.min(col, nextLineLen));
      return;
    }

    // Home / End on current line
    if (key.ctrl && input === 'a') {
      const lineStart = value.slice(0, cursor).lastIndexOf('\n') + 1;
      setCursor(lineStart);
      return;
    }
    if (key.ctrl && input === 'e') {
      const after = value.slice(cursor);
      const nextNl = after.indexOf('\n');
      setCursor(nextNl < 0 ? value.length : cursor + nextNl);
      return;
    }

    // Plain typed text or pasted chunk. Ink delivers paste as a single input
    // burst; if the burst contains \n we keep them.
    if (input && !key.meta && !key.ctrl) {
      const next = value.slice(0, cursor) + input + value.slice(cursor);
      onChange(next);
      setCursor(cursor + input.length);
    }
  });

  // Render: split value into lines, mark the cursor on the right line.
  if (!value) {
    return (
      <Box>
        <Text color="green">{'› '}</Text>
        <Text color="gray" inverse> </Text>
        <Text dimColor>{placeholder ?? ''}</Text>
      </Box>
    );
  }

  const lines = value.split('\n');
  // Find which line the cursor is on
  let acc = 0;
  let curLineIdx = 0;
  let curCol = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i]!.length;
    if (cursor <= acc + lineLen) {
      curLineIdx = i;
      curCol = cursor - acc;
      break;
    }
    acc += lineLen + 1; // +1 for the \n
  }

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Box key={i}>
          <Text color="green">{i === 0 ? '› ' : '  '}</Text>
          {i === curLineIdx ? (
            <Text>
              {line.slice(0, curCol)}
              <Text inverse> </Text>
              {line.slice(curCol)}
            </Text>
          ) : (
            <Text>{line || ' '}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
