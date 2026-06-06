import { useEffect, useState } from "react";
import type { Settings } from "../hooks/useSettings";
import "./SettingsPanel.css";

interface SettingsPanelProps {
  /** Current persisted settings (the source of truth for field values). */
  settings: Settings;
  /** Persist edited settings (normalization happens in the hook). */
  onSave: (next: Settings) => void;
  /** Close the panel without further action. */
  onClose: () => void;
}

/** Parse a number input's string; empty/invalid maps to `null`. */
function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * The settings view, toggled from the overlay. Holds local draft state so edits
 * are batched and only persisted on Save; closing without saving discards the
 * draft. Field values are seeded from `settings` and re-sync if it changes.
 */
function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const [draft, setDraft] = useState<Settings>(settings);

  // Re-seed the draft if the persisted settings change while the panel is open
  // (e.g. an external load resolved after first render).
  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const submit = (): void => {
    onSave(draft);
    onClose();
  };

  return (
    <section className="settings-panel" aria-label="设置">
      <header className="settings-panel-head">
        <span className="settings-panel-title">设置</span>
        <button
          type="button"
          className="settings-panel-close"
          onClick={onClose}
          aria-label="关闭设置"
        >
          ×
        </button>
      </header>

      <label className="settings-field">
        <span className="settings-field-label">我的名字</span>
        <input
          className="settings-field-input"
          value={draft.playerName}
          placeholder="输入游戏内名称"
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, playerName: e.currentTarget.value }))
          }
        />
      </label>

      <label className="settings-field">
        <span className="settings-field-label">客户端端口</span>
        <input
          className="settings-field-input"
          type="number"
          min={1}
          max={65535}
          value={draft.clientApiPort}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              clientApiPort: Number(e.currentTarget.value),
            }))
          }
        />
      </label>

      <label className="settings-field">
        <span className="settings-field-label">提前播报（秒，留空用建造默认）</span>
        <input
          className="settings-field-input"
          type="number"
          min={0}
          step={0.5}
          value={draft.leadTimeSecOverride ?? ""}
          placeholder="默认"
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              leadTimeSecOverride: parseOptionalNumber(e.currentTarget.value),
            }))
          }
        />
      </label>

      <label className="settings-field settings-field-inline">
        <span className="settings-field-label">语音播报</span>
        <input
          type="checkbox"
          checked={draft.voiceEnabled}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              voiceEnabled: e.currentTarget.checked,
            }))
          }
        />
      </label>

      <label className="settings-field">
        <span className="settings-field-label">
          语速 ({draft.voiceRate.toFixed(1)}x)
        </span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={draft.voiceRate}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              voiceRate: Number(e.currentTarget.value),
            }))
          }
        />
      </label>

      <div className="settings-panel-actions">
        <button type="button" className="settings-save-btn" onClick={submit}>
          保存
        </button>
      </div>
    </section>
  );
}

export default SettingsPanel;
