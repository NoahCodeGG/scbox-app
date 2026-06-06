import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { useBuildOrders } from "../hooks/useBuildOrders";
import { raceLabel } from "../lib/format";
import { supplyToTime } from "../lib/supplyTime";
import { generateBuildFilename } from "../lib/buildFilename";
import {
  validateBuild,
  type DraftBuild,
  type DraftStep,
} from "../lib/buildValidation";
import type { BuildOrder } from "../types/build";
import { BUILDS_CHANGED_EVENT } from "../lib/events";
import "./BuildEditor.css";

function emptyStep(): DraftStep {
  return { time: "", say: "", supply: "" };
}

function emptyDraft(): DraftBuild {
  return { matchup: "", race: "Terran", leadTimeSec: "4", steps: [emptyStep()] };
}

/** Convert a persisted build into editable form fields (numbers → strings). */
function toDraft(build: BuildOrder): DraftBuild {
  return {
    matchup: build.matchup,
    race: build.race,
    leadTimeSec: String(build.leadTimeSec),
    steps: build.steps.map((step) => ({
      time: String(step.time),
      say: step.say,
      supply: step.supply === undefined ? "" : String(step.supply),
    })),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Build-order editor, rendered in its own `editor` window (see `main.tsx` label
 * routing). Provides CRUD over builds and steps, a supply→time helper, and
 * persists via the `save_build_order` / `delete_build_order` Rust commands.
 * After a successful write it emits `BUILDS_CHANGED_EVENT` so the overlay
 * reloads without a restart.
 */
export default function BuildEditor() {
  const { stored, errors, loadError, reload } = useBuildOrders();

  // null selection = composing a new (not-yet-saved) build.
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftBuild>(emptyDraft);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existingFilenames = useMemo(
    () => stored.map((s) => s.filename),
    [stored],
  );

  function selectBuild(filename: string, build: BuildOrder): void {
    setSelectedFilename(filename);
    setDraft(toDraft(build));
    setSaveError(null);
  }

  function startNew(): void {
    setSelectedFilename(null);
    setDraft(emptyDraft());
    setSaveError(null);
  }

  function updateField(field: "matchup" | "race" | "leadTimeSec", value: string): void {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function updateStep(index: number, field: keyof DraftStep, value: string): void {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step,
      ),
    }));
  }

  function addStep(): void {
    setDraft((prev) => ({ ...prev, steps: [...prev.steps, emptyStep()] }));
  }

  function removeStep(index: number): void {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }

  function estimateTime(index: number): void {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => {
        if (i !== index) return step;
        const supply = Number(step.supply.trim());
        if (step.supply.trim() === "" || !Number.isFinite(supply)) return step;
        return { ...step, time: String(supplyToTime(supply)) };
      }),
    }));
  }

  async function notifyChanged(): Promise<void> {
    reload();
    await emit(BUILDS_CHANGED_EVENT);
  }

  async function handleSave(): Promise<void> {
    const result = validateBuild(draft);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    const filename =
      selectedFilename ??
      generateBuildFilename(result.build.matchup, existingFilenames);

    setBusy(true);
    setSaveError(null);
    try {
      await invoke("save_build_order", { filename, build: result.build });
      setSelectedFilename(filename);
      await notifyChanged();
    } catch (e: unknown) {
      setSaveError(`保存失败：${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (selectedFilename === null) {
      startNew();
      return;
    }
    if (!window.confirm(`删除建造顺序 ${selectedFilename}？`)) return;

    setBusy(true);
    setSaveError(null);
    try {
      await invoke("delete_build_order", { filename: selectedFilename });
      startNew();
      await notifyChanged();
    } catch (e: unknown) {
      setSaveError(`删除失败：${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="editor">
      <header className="editor-header">
        <h1 className="editor-title">建造顺序编辑器</h1>
        <button type="button" className="editor-btn" onClick={reload}>
          重载
        </button>
      </header>

      {loadError && (
        <div className="editor-error">无法加载建造顺序：{loadError}</div>
      )}
      {errors.length > 0 && (
        <ul className="editor-parse-errors">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <div className="editor-body">
        <aside className="editor-sidebar">
          <button type="button" className="editor-btn editor-new" onClick={startNew}>
            + 新建
          </button>
          {stored.length === 0 ? (
            <p className="editor-empty">暂无建造顺序</p>
          ) : (
            <ul className="editor-build-list">
              {stored.map(({ filename, build }) => (
                <li key={filename}>
                  <button
                    type="button"
                    className={`editor-build-item ${
                      filename === selectedFilename ? "is-selected" : ""
                    }`}
                    onClick={() => selectBuild(filename, build)}
                  >
                    <span className="editor-build-matchup">{build.matchup}</span>
                    <span className="editor-build-race">
                      {raceLabel(build.race)}
                    </span>
                    <span className="editor-build-meta">
                      {build.steps.length} 步
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="editor-form">
          <div className="editor-meta-row">
            <label className="editor-label">
              对阵
              <input
                className="editor-input"
                value={draft.matchup}
                placeholder="TvP"
                onChange={(e) => updateField("matchup", e.target.value)}
              />
            </label>
            <label className="editor-label">
              种族
              <input
                className="editor-input"
                value={draft.race}
                placeholder="Terran"
                onChange={(e) => updateField("race", e.target.value)}
              />
            </label>
            <label className="editor-label">
              提前播报(秒)
              <input
                className="editor-input"
                value={draft.leadTimeSec}
                inputMode="decimal"
                onChange={(e) => updateField("leadTimeSec", e.target.value)}
              />
            </label>
          </div>

          <div className="editor-steps-head">
            <span>步骤</span>
            <button type="button" className="editor-btn" onClick={addStep}>
              + 添加步骤
            </button>
          </div>

          <ul className="editor-steps">
            {draft.steps.map((step, index) => (
              <li key={index} className="editor-step">
                <input
                  className="editor-input editor-step-supply"
                  value={step.supply}
                  placeholder="人口"
                  inputMode="numeric"
                  onChange={(e) => updateStep(index, "supply", e.target.value)}
                />
                <button
                  type="button"
                  className="editor-btn editor-est"
                  onClick={() => estimateTime(index)}
                  title="按人口估算时间"
                >
                  估算→
                </button>
                <input
                  className="editor-input editor-step-time"
                  value={step.time}
                  placeholder="秒"
                  inputMode="decimal"
                  onChange={(e) => updateStep(index, "time", e.target.value)}
                />
                <input
                  className="editor-input editor-step-say"
                  value={step.say}
                  placeholder="语音内容，如「14 补给站」"
                  onChange={(e) => updateStep(index, "say", e.target.value)}
                />
                <button
                  type="button"
                  className="editor-btn editor-del-step"
                  onClick={() => removeStep(index)}
                  aria-label="删除步骤"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {saveError && <div className="editor-error">{saveError}</div>}

          <div className="editor-actions">
            <button
              type="button"
              className="editor-btn editor-save"
              onClick={() => void handleSave()}
              disabled={busy}
            >
              保存
            </button>
            <button
              type="button"
              className="editor-btn editor-delete"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              {selectedFilename === null ? "清空" : "删除"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
