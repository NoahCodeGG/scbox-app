import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { generateBuildFilename } from "../lib/buildFilename";
import { exportBuildJson, parseImportedBuild } from "../lib/buildTransfer";
import { BUILDS_CHANGED_EVENT } from "../lib/events";
import type { BuildOrder } from "../types/build";
import "./BuildTransferPanel.css";

/** Status banner kind/message, shared with the parent editor. */
export type TransferStatus =
  | { kind: "success" | "error"; message: string }
  | null;

interface BuildTransferPanelProps {
  /** The currently selected saved build, or null if none is selected. */
  selectedBuild: BuildOrder | null;
  /** Filenames already in the builds dir, for collision-free naming. */
  existingFilenames: readonly string[];
  /** Disables actions while a write is in flight (shared busy flag). */
  busy: boolean;
  setBusy: (busy: boolean) => void;
  /** Reuse the editor's single status banner for all feedback. */
  setStatus: (status: TransferStatus) => void;
  /** Reload the build list after a successful import. */
  reload: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Import/export panel for sharing build orders as portable JSON text. Export
 * fills the textarea with the selected build's clean JSON; 复制 best-effort copies
 * it; 导入 parses + validates pasted JSON and saves it as a NEW file (never
 * overwrites). Transport is plain text only — no Tauri dialog/clipboard plugin.
 */
function BuildTransferPanel({
  selectedBuild,
  existingFilenames,
  busy,
  setBusy,
  setStatus,
  reload,
}: BuildTransferPanelProps) {
  const [transferText, setTransferText] = useState("");

  function handleExport(): void {
    if (selectedBuild === null) {
      setStatus({ kind: "error", message: "请先选择一个建造顺序" });
      return;
    }
    setTransferText(exportBuildJson(selectedBuild));
    setStatus({ kind: "success", message: "已导出到下方文本框" });
  }

  async function handleCopy(): Promise<void> {
    if (transferText.trim() === "") {
      setStatus({ kind: "error", message: "没有可复制的内容" });
      return;
    }
    try {
      await navigator.clipboard.writeText(transferText);
      setStatus({ kind: "success", message: "已复制到剪贴板" });
    } catch {
      setStatus({
        kind: "error",
        message: "复制失败，请手动选中文本框内容并按 Cmd+C 复制",
      });
    }
  }

  async function handleImport(): Promise<void> {
    const result = parseImportedBuild(transferText);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.error });
      return;
    }
    const filename = generateBuildFilename(
      result.build.matchup,
      existingFilenames,
    );

    setBusy(true);
    setStatus(null);
    try {
      await invoke("save_build_order", { filename, build: result.build });
      reload();
      await emit(BUILDS_CHANGED_EVENT);
      setStatus({ kind: "success", message: `已导入：${filename}` });
    } catch (e: unknown) {
      setStatus({ kind: "error", message: `导入失败：${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="editor-transfer">
      <div className="editor-transfer-head">
        <span>导入 / 导出（分享）</span>
        <div className="editor-transfer-actions">
          <button
            type="button"
            className="editor-btn"
            onClick={handleExport}
            disabled={busy}
          >
            导出
          </button>
          <button
            type="button"
            className="editor-btn"
            onClick={() => void handleCopy()}
            disabled={busy}
          >
            复制
          </button>
          <button
            type="button"
            className="editor-btn"
            onClick={() => void handleImport()}
            disabled={busy}
          >
            导入
          </button>
        </div>
      </div>
      <textarea
        className="editor-transfer-text"
        value={transferText}
        placeholder="导出后此处显示 JSON；或在此粘贴他人分享的 JSON 后点击「导入」"
        spellCheck={false}
        onChange={(e) => setTransferText(e.currentTarget.value)}
      />
    </section>
  );
}

export default BuildTransferPanel;
