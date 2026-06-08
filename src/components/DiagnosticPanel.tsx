import type { ConnectionStatus } from "../types/sc2";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DiagnosticPanelProps {
  isOpen: boolean;
  currentPort: number;
  status: ConnectionStatus;
  onClose: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
}

/**
 * A human-readable reason line for the current disconnect `status`. `ok` has no
 * reason (the panel only shows while disconnected); the switch is exhaustive
 * over the union so a new status can't be silently dropped.
 */
function reasonText(status: ConnectionStatus, port: number): string | null {
  switch (status) {
    case "ok":
      return null;
    case "unreachable":
      return "SC2 未运行，或端口不正确";
    case "timeout":
      return "连接超时（SC2 无响应）";
    case "bad_http":
    case "bad_body":
      return `端口 ${port} 可能被其他程序占用`;
  }
}

/**
 * A modal diagnostic panel that appears when SC2 connection fails for 30s.
 * Provides a checklist, how-to instructions, and action buttons (retry,
 * change port, close). Auto-hides when connection succeeds.
 */
export default function DiagnosticPanel({
  isOpen,
  currentPort,
  status,
  onClose,
  onOpenSettings,
  onRetry,
}: DiagnosticPanelProps) {
  const reason = reasonText(status, currentPort);

  const handleOpenSettings = () => {
    onOpenSettings();
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>无法连接到星际争霸 2</DialogTitle>
          {reason && <DialogDescription>{reason}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-3 text-[13px]">
          <p className="text-muted-foreground">请检查以下事项：</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>星际争霸 2 是否正在运行？</li>
            <li>是否启用了 Client API？</li>
            <li>
              启动参数中是否包含{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
                -clientapi {currentPort}
              </code>
              ？
            </li>
          </ol>

          <div className="flex flex-col gap-2 rounded-md border bg-secondary p-3">
            <p className="font-medium">如何启用 Client API：</p>
            <p className="text-muted-foreground">
              在 Battle.net 启动器中，点击星际争霸 2 → <strong>选项</strong> →{" "}
              <strong>游戏设置</strong> → <strong>附加命令行参数</strong>，添加：
            </p>
            <Input
              type="text"
              className="font-mono text-[13px]"
              value={`-clientapi ${currentPort}`}
              readOnly
              aria-label="Client API 启动参数"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onRetry}>
            重试连接
          </Button>
          <Button type="button" variant="outline" onClick={handleOpenSettings}>
            修改端口
          </Button>
          <Button type="button" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
