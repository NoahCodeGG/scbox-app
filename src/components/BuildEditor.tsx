import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { Plus, RotateCw, Save, Trash2 } from "lucide-react";
import { useBuildOrders } from "../hooks/useBuildOrders";
import { raceLabel } from "../lib/format";
import { supplyToTime } from "../lib/supplyTime";
import { generateBuildFilename } from "../lib/buildFilename";
import { exportBuildJson, parseImportedBuild } from "../lib/buildTransfer";
import {
  validateBuild,
  type DraftBuild,
  type DraftStep,
} from "../lib/buildValidation";
import { parseMatchup, raceNameToLetter, type RaceLetter } from "../lib/matchup";
import type { BuildOrder } from "../types/build";
import { BUILDS_CHANGED_EVENT } from "../lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import BuildJsonEditor from "./BuildJsonEditor";

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
 * Serialize the current form to pretty JSON for the editable pane. When the form
 * validates, use the clean canonical export; otherwise build a plain object that
 * mirrors the raw form fields so the pane still shows JSON mid-edit without
 * crashing (the indicator will flag it invalid).
 */
function formToJson(form: EditorForm): string {
  const result = validateBuild(toDraft(form));
  if (result.ok) return exportBuildJson(result.build);

  const lenient = {
    matchup: `${raceNameToLetter(form.race)}v${form.opponent}`,
    race: form.race,
    leadTimeSec: form.leadTimeSec,
    steps: form.steps.map((step) => ({
      time: step.time,
      say: step.say,
      ...(step.supply.trim() !== "" ? { supply: step.supply } : {}),
    })),
  };
  return JSON.stringify(lenient, null, 2);
}

/** Mono uppercase eyebrow label (mockup `.field label` / `.sect-label`). */
function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="font-mono text-[12px] uppercase tracking-[0.05em] text-muted-foreground"
    >
      {children}
    </Label>
  );
}

/**
 * Build-order editor, rendered in its own `editor` window (see `main.tsx` label
 * routing). Provides CRUD over builds and steps, a supply→time helper, a live
 * JSON preview, and persists via the `save_build_order` / `delete_build_order`
 * Rust commands. After a successful write it emits `BUILDS_CHANGED_EVENT` so the
 * overlay reloads without a restart.
 */
export default function BuildEditor() {
  const { stored, errors, loadError, reload } = useBuildOrders();

  // null selection = composing a new (not-yet-saved) build.
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [status, setStatus] = useState<Status>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // Text mirror of the form for the editable JSON pane. The form stays the
  // canonical source of truth; `jsonText` is regenerated from it ONLY while the
  // pane is unfocused (see effect below), so typing never reformats mid-edit.
  const [jsonText, setJsonText] = useState("");
  const [jsonFocused, setJsonFocused] = useState(false);

  const existingFilenames = useMemo(
    () => stored.map((s) => s.filename),
    [stored],
  );

  // Validate once per render to drive both the live preview and its filename.
  const result = useMemo(() => validateBuild(toDraft(form)), [form]);
  const previewFilename = useMemo(() => {
    if (selectedFilename !== null) return selectedFilename;
    const derived = `${raceNameToLetter(form.race)}v${form.opponent}`;
    return generateBuildFilename(derived, existingFilenames);
  }, [selectedFilename, form.race, form.opponent, existingFilenames]);

  // The pane's valid/invalid indicator reflects whether the CURRENT json text
  // parses + validates (coincides with the form's `validateBuild` since
  // `parseImportedBuild` delegates to it).
  const jsonResult = useMemo(() => parseImportedBuild(jsonText), [jsonText]);

  // form → JSON: regenerate the text mirror from the form, but only while the
  // pane is unfocused so we never reformat under the user's cursor. Gating on
  // `jsonFocused` also prevents a sync loop with the json → form handler.
  useEffect(() => {
    if (jsonFocused) return;
    setJsonText(formToJson(form));
  }, [form, jsonFocused]);

  // json → form: a user edit/paste. Always mirror the raw text; only push into
  // the form when it parses + validates, so invalid JSON can't corrupt the form.
  function handleJsonChange(value: string): void {
    setJsonText(value);
    const parsed = parseImportedBuild(value);
    if (parsed.ok) {
      setForm(toForm(parsed.build));
    }
  }

  function handleJsonFocusChange(focused: boolean): void {
    setJsonFocused(focused);
  }

  async function handleCopyJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(jsonText);
      setStatus({ kind: "success", message: "已复制到剪贴板" });
    } catch {
      setStatus({
        kind: "error",
        message: "复制失败，请手动选中文本并按 Cmd+C 复制",
      });
    }
  }

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
    <main className="min-h-screen bg-muted/40 text-foreground">
      <div className="mx-auto max-w-[1080px] px-6 py-8 sm:px-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Build Order 编辑器
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              可视化编辑步骤 · 自动生成 JSON · 保存到 builds 目录
            </p>
          </div>
          <div className="flex gap-2.5">
            <Button type="button" variant="outline" onClick={reload}>
              <RotateCw />
              重载
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy}
            >
              <Save />
              保存
            </Button>
          </div>
        </header>

        {loadError && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            无法加载建造顺序：{loadError}
          </div>
        )}
        {errors.length > 0 && (
          <ul className="mb-4 list-disc space-y-1 rounded-md border border-warning/40 bg-warning/5 py-2 pr-3 pl-7 text-sm text-warning">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[208px_minmax(0,1.25fr)] xl:grid-cols-[208px_minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* sidebar build list */}
          <aside className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={startNew}
            >
              <Plus />
              新建
            </Button>
            {stored.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">
                暂无建造顺序
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {stored.map(({ filename, build }) => {
                  const selected = filename === selectedFilename;
                  return (
                    <li key={filename}>
                      <button
                        type="button"
                        onClick={() => selectBuild(filename, build)}
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                          selected
                            ? "border-foreground bg-secondary"
                            : "border-border hover:border-foreground/40",
                        )}
                      >
                        <span className="font-mono text-[13px] tabular-nums">
                          {build.matchup}
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          {raceLabel(build.race)} · {build.steps.length} 步
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* editor form */}
          <section className="flex flex-col">
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>race</FieldLabel>
                <Select value={form.race} onValueChange={(v) => updateRace(v as AuthorRace)}>
                  <SelectTrigger className="w-full font-mono text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTHOR_RACES.map((race) => (
                      <SelectItem key={race} value={race}>
                        {RACE_LABELS_ZH[race]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>opponent</FieldLabel>
                <Select
                  value={form.opponent}
                  onValueChange={(v) => updateOpponent(v as RaceLetter)}
                >
                  <SelectTrigger className="w-full font-mono text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPPONENT_OPTIONS.map(({ letter, label }) => (
                      <SelectItem key={letter} value={letter}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="editor-lead">leadTimeSec</FieldLabel>
                <Input
                  id="editor-lead"
                  inputMode="decimal"
                  className="font-mono text-[13px]"
                  value={form.leadTimeSec}
                  onChange={(e) => updateLeadTime(e.currentTarget.value)}
                />
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-muted-foreground">
                步骤 · steps
              </span>
              <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                对阵 {raceNameToLetter(form.race)}v{form.opponent} ·{" "}
                {form.steps.length} 步
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {form.steps.map((step, index) => (
                <li
                  key={index}
                  className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border bg-card p-2"
                >
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8 w-16 font-mono text-[13px]"
                      value={step.supply}
                      placeholder="人口"
                      inputMode="numeric"
                      onChange={(e) =>
                        updateStep(index, "supply", e.currentTarget.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="px-2 font-mono text-[12px]"
                      onClick={() => estimateTime(index)}
                      title="按人口估算时间"
                    >
                      估算→
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8 w-16 font-mono text-[13px]"
                      value={step.time}
                      placeholder="秒"
                      inputMode="decimal"
                      onChange={(e) =>
                        updateStep(index, "time", e.currentTarget.value)
                      }
                    />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      s
                    </span>
                  </div>
                  <Input
                    className="h-8 text-[14px]"
                    value={step.say}
                    placeholder="语音内容，如「14 补给站」"
                    onChange={(e) =>
                      updateStep(index, "say", e.currentTarget.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeStep(index)}
                    aria-label="删除步骤"
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="ghost"
              className="mt-2.5 w-full justify-center border border-dashed border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              onClick={addStep}
            >
              <Plus />
              添加步骤
            </Button>

            <div className="mt-6 flex items-center justify-between border-t pt-5">
              <span className="font-mono text-[12px] text-muted-foreground">
                builds/{previewFilename}
              </span>
              <span className="font-mono text-[12px] text-muted-foreground">
                按时间自动排序
              </span>
            </div>

            {status && (
              <div
                className={cn(
                  "mt-4 rounded-md border px-3 py-2 text-sm",
                  status.kind === "success"
                    ? "border-success/40 bg-success/5 text-success"
                    : "border-destructive/40 bg-destructive/5 text-destructive",
                )}
              >
                {status.message}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy}
              >
                <Save />
                保存
              </Button>
              {selectedFilename === null ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startNew}
                  disabled={busy}
                >
                  清空
                </Button>
              ) : confirmingDelete ? (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void confirmDelete()}
                    disabled={busy}
                  >
                    确认删除
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={busy}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={busy}
                >
                  删除
                </Button>
              )}
            </div>

          </section>

          {/* live, editable JSON pane (import = edit/paste, export = copy) */}
          <div className="lg:col-span-2 xl:col-span-1">
            <BuildJsonEditor
              filename={previewFilename}
              value={jsonText}
              onChange={handleJsonChange}
              valid={jsonResult.ok}
              error={jsonResult.ok ? null : jsonResult.error}
              onFocusChange={handleJsonFocusChange}
              onCopy={() => void handleCopyJson()}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
