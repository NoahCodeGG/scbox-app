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

## Common Mistakes

- Calling `invoke` directly in a component and copy-pasting the same try/catch
  across files instead of extracting a hook.
- Forgetting to unsubscribe a Tauri event `listen` in the effect cleanup,
  causing duplicate handlers after a StrictMode remount.
