# Component Guidelines

> How React components are built in `scbox-app`.

---

## Baseline

React 18.3 with the automatic JSX runtime (`tsconfig.json` → `"jsx":
"react-jsx"`), so **do not** `import React` just to use JSX. Import only the
hooks/APIs you use, as `App.tsx` does:

```tsx
import { useState } from "react";
```

`src/main.tsx` wraps the tree in `<React.StrictMode>`. Keep it — write effects
and event handlers that tolerate StrictMode's development double-invoke.

---

## Component Structure

Use plain **function components**. Do not use `React.FC`.

```tsx
interface GreetFormProps {
  onSubmit: (name: string) => void;
}

function GreetForm({ onSubmit }: GreetFormProps) {
  const [name, setName] = useState("");

  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name);
      }}
    >
      <input
        onChange={(e) => setName(e.currentTarget.value)}
        placeholder="Enter a name..."
      />
      <button type="submit">Greet</button>
    </form>
  );
}

export default GreetForm;
```

Conventions visible in `App.tsx`:
- Default-export the primary component.
- Read input values via `e.currentTarget.value` (typed) rather than
  `e.target.value`.
- Handle `onSubmit` on the `<form>` and call `e.preventDefault()` — don't wire
  submit logic onto the button's `onClick`.

---

## Props

- Define props as a named `interface` (e.g. `GreetFormProps`).
- Type callback props explicitly: `onSubmit: (name: string) => void`.
- Destructure props in the parameter list.

---

## Styling

Plain CSS via `className`, imported per-component (`import "./App.css"`). There
is no CSS-in-JS or utility framework in this project. When adding a component,
pair it with its own `.css` file and import it from the component.

---

## Modal Overlays

For modal dialogs or overlays that appear on top of the main UI:

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {children}
      </div>
    </div>
  );
}
```

**Key points:**
- Conditional render (`if (!isOpen) return null`) rather than CSS `display: none`
- `role="dialog"` + `aria-modal="true"` for accessibility
- `aria-labelledby` references the modal's title element
- Click on overlay closes modal; `stopPropagation` on content prevents that
- CSS: `.modal-overlay` has `position: fixed; inset: 0; z-index: 1000;` with semi-transparent background

**Example CSS:**
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: var(--bg-color);
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

**Reference implementation:** `DiagnosticPanel.tsx` + `DiagnosticPanel.css`

---

## Common Mistakes

- Adding `import React from "react"` unnecessarily (the JSX transform handles
  it).
- Calling a Tauri command directly during render instead of in an event handler
  or effect — `invoke` is async and must not run while rendering.
- Letting `App.tsx` accumulate every feature's state; extract early.
