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
import { parseMatchup, raceNameToLetter, type RaceLetter } from "../lib/matchup";
import type { BuildOrder } from "../types/build";
import { BUILDS_CHANGED_EVENT } from "../lib/events";
import "./BuildEditor.css";

/** Authoring races (Random is not a valid build race). */
const AUTHOR_RACES = ["Terran", "Protoss", "Zerg"] as const;
type AuthorRace = (typeof AUTHOR_RACES)[number];

/** Opponent options including a catch-all "any". */
const OPPONENT_OPTIONS: ReadonlyArray<{ letter: RaceLetter; label: string }> = [
  { letter: "T", label: "人族 (Terran)" },
  { letter: "P", label: "神族 (Protoss)" },
  { letter: "Z", label: "虫族 (Zerg)" },
  { letter: "X", label: "任意 (Any)" },
];

const RACE_LABELS_ZH: Record<AuthorRace, string> = {
  Terran: "人族 (Terran)",
  Protoss: "神族 (Protoss)",
  Zerg: "虫族 (Zerg)",
};

/** Status banner shown after a save/delete attempt. */
type Status = { kind: "success" | "error"; message: string } | null;

function isAuthorRace(value: string): value is AuthorRace {
  return (AUTHOR_RACES as readonly string[]).includes(value);
}

/** Coerce a stored `race` into one of the three author races (default Terran). */
function normalizeRace(race: string): AuthorRace {
  return isAuthorRace(race) ? race : "Terran";
}

function emptyStep(): DraftStep {
  return { time: "", say: "", supply: "" };
}

/** Editor form fields, excluding the derived `matchup`. */
interface EditorForm {
  race: AuthorRace;
  opponent: RaceLetter;
  leadTimeSec: string;
  steps: DraftStep[];
}

function emptyForm(): EditorForm {
  return { race: "Terran", opponent: "X", leadTimeSec: "4", steps: [emptyStep()] };
}

/** Convert a persisted build into editable form fields (numbers → strings). */
function toForm(build: BuildOrder): EditorForm {
  return {
    race: normalizeRace(build.race),
    opponent: parseMatchup(build.matchup)?.opp ?? "X",
    leadTimeSec: String(build.leadTimeSec),
    steps: build.steps.map((step) => ({
      time: String(step.time),
      say: step.say,
      supply: step.supply === undefined ? "" : String(step.supply),
    })),
  };
}

/** Compose the validation draft from the form (matchup is derived here). */
function toDraft(form: EditorForm): DraftBuild {
  const matchup = `${raceNameToLetter(form.race)}v${form.opponent}`;
  return {
    matchup,
    race: form.race,
    leadTimeSec: form.leadTimeSec,
    steps: form.steps,
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
  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [status, setStatus] = useState<Status>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const existingFilenames = useMemo(
    () => stored.map((s) => s.filename),
    [stored],
  );

  function selectBuild(filename: string, build: BuildOrder): void {
    setSelectedFilename(filename);
    setForm(toForm(build));
    setStatus(null);
    setConfirmingDelete(false);
  }

  function startNew(): void {
    setSelectedFilename(null);
    setForm(emptyForm());
    setStatus(null);
    setConfirmingDelete(false);
  }

  function updateRace(value: AuthorRace): void {
    setForm((prev) => ({ ...prev, race: value }));
  }

  function updateOpponent(value: RaceLetter): void {
    setForm((prev) => ({ ...prev, opponent: value }));
  }

  function updateLeadTime(value: string): void {
    setForm((prev) => ({ ...prev, leadTimeSec: value }));
  }

  function updateStep(index: number, field: keyof DraftStep, value: string): void {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step,
      ),
    }));
  }

  function addStep(): void {
    setForm((prev) => ({ ...prev, steps: [...prev.steps, emptyStep()] }));
  }

  function removeStep(index: number): void {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }

  function estimateTime(index: number): void {
    setForm((prev) => ({
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
    const result = validateBuild(toDraft(form));
    if (!result.ok) {
      setStatus({ kind: "error", message: result.error });
      return;
    }
    const filename =
      selectedFilename ??
      generateBuildFilename(result.build.matchup, existingFilenames);

    setBusy(true);
    setStatus(null);
    try {
      await invoke("save_build_order", { filename, build: result.build });
      setSelectedFilename(filename);
      await notifyChanged();
      setStatus({ kind: "success", message: `已保存：${filename}` });
    } catch (e: unknown) {
      setStatus({ kind: "error", message: `保存失败：${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (selectedFilename === null) return;
    const filename = selectedFilename;

    setBusy(true);
    setStatus(null);
    setConfirmingDelete(false);
    try {
      await invoke("delete_build_order", { filename });
      startNew();
      await notifyChanged();
      setStatus({ kind: "success", message: `已删除：${filename}` });
    } catch (e: unknown) {
      setStatus({ kind: "error", message: `删除失败：${errorMessage(e)}` });
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
              种族
              <select
                className="editor-input"
                value={form.race}
                onChange={(e) => updateRace(e.currentTarget.value as AuthorRace)}
              >
                {AUTHOR_RACES.map((race) => (
                  <option key={race} value={race}>
                    {RACE_LABELS_ZH[race]}
                  </option>
                ))}
              </select>
            </label>
            <label className="editor-label">
              对手
              <select
                className="editor-input"
                value={form.opponent}
                onChange={(e) =>
                  updateOpponent(e.currentTarget.value as RaceLetter)
                }
              >
                {OPPONENT_OPTIONS.map(({ letter, label }) => (
                  <option key={letter} value={letter}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="editor-label">
              对阵
              <span className="editor-matchup-derived">
                {raceNameToLetter(form.race)}v{form.opponent}
              </span>
            </label>
            <label className="editor-label">
              提前播报(秒)
              <input
                className="editor-input"
                value={form.leadTimeSec}
                inputMode="decimal"
                onChange={(e) => updateLeadTime(e.currentTarget.value)}
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
            {form.steps.map((step, index) => (
              <li key={index} className="editor-step">
                <input
                  className="editor-input editor-step-supply"
                  value={step.supply}
                  placeholder="人口"
                  inputMode="numeric"
                  onChange={(e) =>
                    updateStep(index, "supply", e.currentTarget.value)
                  }
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
                  onChange={(e) =>
                    updateStep(index, "time", e.currentTarget.value)
                  }
                />
                <input
                  className="editor-input editor-step-say"
                  value={step.say}
                  placeholder="语音内容，如「14 补给站」"
                  onChange={(e) =>
                    updateStep(index, "say", e.currentTarget.value)
                  }
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

          {status && (
            <div
              className={
                status.kind === "success" ? "editor-success" : "editor-error"
              }
            >
              {status.message}
            </div>
          )}

          <div className="editor-actions">
            <button
              type="button"
              className="editor-btn editor-save"
              onClick={() => void handleSave()}
              disabled={busy}
            >
              保存
            </button>
            {selectedFilename === null ? (
              <button
                type="button"
                className="editor-btn editor-delete"
                onClick={startNew}
                disabled={busy}
              >
                清空
              </button>
            ) : confirmingDelete ? (
              <>
                <button
                  type="button"
                  className="editor-btn editor-delete"
                  onClick={() => void confirmDelete()}
                  disabled={busy}
                >
                  确认删除
                </button>
                <button
                  type="button"
                  className="editor-btn"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                >
                  取消
                </button>
              </>
            ) : (
              <button
                type="button"
                className="editor-btn editor-delete"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
              >
                删除
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
