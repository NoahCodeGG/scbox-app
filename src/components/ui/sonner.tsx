import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * App-themed Sonner toaster. This project does NOT use `next-themes`; the global
 * theme lives in `Settings.theme` and is applied by toggling `.dark` on `<html>`
 * (see `useApplyTheme`). The caller passes the current `theme` value straight
 * through to Sonner so the toasts follow the app's light/dark/system choice.
 *
 * Colors are pulled from the design-system tokens so toasts match the surrounding
 * UI in both light and dark modes.
 */
function Toaster({ theme = "system", ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
