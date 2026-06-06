import type { MouseEvent } from "react";
import type { ConnectionStatus } from "../types/sc2";
import "./DiagnosticPanel.css";

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
  if (!isOpen) return null;

  const reason = reasonText(status, currentPort);

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    // Close when clicking the backdrop (not the card)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleOpenSettings = () => {
    onOpenSettings();
    onClose();
  };

  return (
    <div
      className="diagnostic-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-labelledby="diagnostic-title"
      aria-modal="true"
    >
      <div className="diagnostic-card">
        <div className="diagnostic-header">
          <h2 id="diagnostic-title" className="diagnostic-title">
            无法连接到星际争霸 2
          </h2>
          <button
            type="button"
            className="diagnostic-close"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="diagnostic-body">
          {reason && <p className="diagnostic-reason">{reason}</p>}
          <p className="diagnostic-intro">请检查以下事项：</p>
          <ol className="diagnostic-checklist">
            <li>星际争霸 2 是否正在运行？</li>
            <li>是否启用了 Client API？</li>
            <li>
              启动参数中是否包含{" "}
              <code className="diagnostic-code">-clientapi {currentPort}</code>
              ？
            </li>
          </ol>

          <div className="diagnostic-howto">
            <p className="diagnostic-howto-title">如何启用 Client API：</p>
            <p className="diagnostic-howto-text">
              在 Battle.net 启动器中，点击星际争霸 2 →{" "}
              <strong>选项</strong> → <strong>游戏设置</strong> →{" "}
              <strong>附加命令行参数</strong>，添加：
            </p>
            <input
              type="text"
              className="diagnostic-command"
              value={`-clientapi ${currentPort}`}
              readOnly
              aria-label="Client API 启动参数"
            />
          </div>
        </div>

        <div className="diagnostic-actions">
          <button
            type="button"
            className="diagnostic-btn diagnostic-btn-secondary"
            onClick={onRetry}
          >
            重试连接
          </button>
          <button
            type="button"
            className="diagnostic-btn diagnostic-btn-secondary"
            onClick={handleOpenSettings}
          >
            修改端口
          </button>
          <button
            type="button"
            className="diagnostic-btn diagnostic-btn-primary"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
