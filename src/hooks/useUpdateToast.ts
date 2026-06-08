import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useUpdateCheck } from "./useUpdateCheck";

/**
 * Resident startup update prompt for the main window.
 *
 * `useUpdateCheck` runs one detect-only check on mount, but it is otherwise only
 * mounted by the routed Settings page — so a user who never opens 设置 never
 * learns an update exists. Calling this hook from the always-mounted MainWindow
 * shell fixes that: as soon as the resident check flags `available`, it raises a
 * Sonner toast ("发现新版本 v{version}") with a「立即更新」action that downloads,
 * installs, and relaunches via `install()`.
 *
 * The Settings page keeps its own `useUpdateCheck` instance for the inline
 * status text; only this hook raises the toast, so the two instances never
 * double-prompt.
 *
 * @param prereleaseUpdates Follow the pre-release channel, mirroring the saved
 *   setting so the startup prompt matches what 检查更新 would do.
 */
export function useUpdateToast(prereleaseUpdates = false): void {
  const { available, version, install } = useUpdateCheck(prereleaseUpdates);

  // One prompt per session: `available` can re-fire across re-renders (e.g. the
  // settings save → reload path), so guard with a ref that survives renders but
  // never triggers one. StrictMode's double-invoke is harmless — the ref is set
  // before the second effect run reads it.
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!available || !version || promptedRef.current) return;
    promptedRef.current = true;

    toast(`发现新版本 v${version}`, {
      description: "点击立即更新以下载安装并重启应用。",
      duration: Infinity,
      action: {
        label: "立即更新",
        onClick: () => {
          // `install()` never throws — it captures failures into its own error
          // state — so the loading toast just signals work has started. A
          // successful install relaunches the process, so there is no success
          // path to handle here.
          toast.loading("正在下载更新…");
          void install();
        },
      },
    });
  }, [available, version, install]);
}
