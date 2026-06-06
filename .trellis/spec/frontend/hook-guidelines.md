# Hook Guidelines

> Custom hooks and async data patterns in `scbox-app`.

---

## Naming

- Custom hooks start with `use` and live in `src/hooks/` (`useGreeting.ts`).
- A hook file exports one primary hook matching its filename.

---

## Wrapping Tauri Commands

The app's "data fetching" is IPC to Rust via `invoke` from
`@tauri-apps/api/core` (see `App.tsx:12`). There is no React Query / SWR here.
Wrap each command call in a hook so components stay declarative and the async +
error handling lives in one place.

```tsx
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useGreeting() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const greet = useCallback(async (name: string) => {
    try {
      setError(null);
      const result = await invoke<string>("greet", { name });
      setMessage(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return { message, error, greet };
}
```

Rules:
- Always type the result: `invoke<string>(...)`, never untyped.
- The command name (`"greet"`) and argument keys (`{ name }`) must match the
  Rust `#[tauri::command]` signature exactly — see
  [../tauri/ipc-commands.md](../tauri/ipc-commands.md).
- Always wrap `invoke` in `try/catch`; a rejected command surfaces the Rust
  error here, and the UI must show it rather than swallow it.

---

## Effects

- Give every `useEffect` a correct dependency array; the project enforces
  `strict` TS but has no React-hooks lint rule, so review deps manually.
- Effects must be safe under StrictMode's dev double-invoke — make
  subscriptions/listeners idempotent and return a cleanup function. This
  matters for Tauri event listeners (`listen` from `@tauri-apps/api/event`),
  which must be unsubscribed in cleanup.

---

## Timer-Based State Tracking

For hooks that track duration or trigger actions after a timeout (e.g., "show warning after 30s of disconnection"):

```tsx
import { useEffect, useRef, useState } from "react";

interface ConnectionDiagnostic {
  shouldShowPanel: boolean;
  openDiagnostic: () => void;
  closeDiagnostic: () => void;
}

export function useConnectionDiagnostic(
  isConnected: boolean,
  thresholdMs: number = 30000
): ConnectionDiagnostic {
  const [isDismissed, setIsDismissed] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!isConnected && !isDismissed) {
      // Start countdown to show panel
      timerRef.current = window.setTimeout(() => {
        setShouldShow(true);
      }, thresholdMs);
    } else {
      // Connected or dismissed — hide panel and reset
      setShouldShow(false);
      if (isConnected) {
        setIsDismissed(false); // Reset dismissal on reconnect
      }
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isConnected, isDismissed, thresholdMs]);

  return {
    shouldShowPanel: shouldShow,
    openDiagnostic: () => setShouldShow(true),
    closeDiagnostic: () => {
      setShouldShow(false);
      setIsDismissed(true);
    },
  };
}
```

**Key points:**
- Use `useRef` to store timer ID (persists across renders, doesn't trigger re-renders)
- Always clear timer in cleanup to prevent memory leaks and stale timeouts
- Reset dismissal state on reconnect so panel can reappear on future disconnections
- `window.setTimeout` returns `number` (not `NodeJS.Timeout`) in browser/Tauri context
- StrictMode-safe: cleanup function clears timer even on double-mount

**Common pattern:** "Do X after Y seconds of condition Z being true"
1. Start timer when condition becomes true
2. Clear timer when condition becomes false or component unmounts
3. Store timer ID in ref (not state)
4. Always cleanup in `useEffect` return

**Reference implementation:** `useConnectionDiagnostic.ts`

---

## Common Mistakes

- Calling `invoke` directly in a component and copy-pasting the same try/catch
  across files instead of extracting a hook.
- Forgetting to unsubscribe a Tauri event `listen` in the effect cleanup,
  causing duplicate handlers after a StrictMode remount.
