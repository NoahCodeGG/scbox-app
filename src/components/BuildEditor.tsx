import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { Plus, RotateCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBuildOrders } from "../hooks/useBuildOrders";
import { raceLabel } from "../lib/format";
import { generateBuildFilename } from "../lib/buildFilename";
import { exportBuildJson, parseImportedBuild } from "../lib/buildTransfer";
import { formatClockTime } from "../lib/clockTime";
import {
  validateBuild,
  type DraftBuild,
  type DraftRecurring,
  type DraftStep,
} from "../lib/buildValidation";
import { parseMatchup, raceNameToLetter, type RaceLetter } from "../lib/matchup";
import type { BuildOrder } from "../types/build";
import { BUILDS_CHANGED_EVENT, NAVIGATE_EVENT, type NavigatePayload } from "../lib/events";
import { consumePendingEditorNav } from "../lib/pendingEditorNav";
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

/** Resolve the Chinese label for an opponent race letter (fallback to the letter). */
function opponentLabel(letter: RaceLetter): string {
  return OPPONENT_OPTIONS.find((o) => o.letter === letter)?.label ?? letter;
}

const RACE_LABELS_ZH: Record<AuthorRace, string> = {
  Terran: "人族 (Terran)",
  Protoss: "神族 (Protoss)",
  Zerg: "虫族 (Zerg)",
};

function isAuthorRace(value: string): value is AuthorRace {
  return (AUTHOR_RACES as readonly string[]).includes(value);
}

/** Coerce a stored `race` into one of the three author races (default Terran). */
function normalizeRace(race: string): AuthorRace {
  return isAuthorRace(race) ? race : "Terran";
}

function emptyStep(): DraftStep {
  return { time: "", say: "", sayAs: "" };
}

function emptyRecurring(): DraftRecurring {
  return { startSec: "", intervalSec: "", endSec: "", say: "", sayAs: "" };
}

/** Editor form fields, excluding the derived `matchup`. */
interface EditorForm {
  race: AuthorRace;
  opponent: RaceLetter;
  name: string;
  leadTimeSec: string;
  steps: DraftStep[];
  recurring: DraftRecurring[];
}

function emptyForm(): EditorForm {
  return {
    race: "Terran",
    opponent: "X",
    name: "",
    leadTimeSec: "4",
    steps: [emptyStep()],
    recurring: [],
  };
}

/** Convert a persisted build into editable form fields (numbers → strings). */
function toForm(build: BuildOrder): EditorForm {
  return {
    race: normalizeRace(build.race),
    opponent: parseMatchup(build.matchup)?.opp ?? "X",
    name: build.name ?? "",
    leadTimeSec: String(build.leadTimeSec),
    steps: build.steps.map((step) => ({
      time: formatClockTime(step.time),
      say: step.say,
      sayAs: step.sayAs ?? "",
    })),
    recurring: (build.recurring ?? []).map((cue) => ({
      startSec: formatClockTime(cue.startSec),
      intervalSec: String(cue.intervalSec),
      endSec: cue.endSec !== undefined ? formatClockTime(cue.endSec) : "",
      say: cue.say,
      sayAs: cue.sayAs ?? "",
    })),
  };
}

/** Compose the validation draft from the form (matchup is derived here). */
function toDraft(form: EditorForm): DraftBuild {
  const matchup = `${raceNameToLetter(form.race)}v${form.opponent}`;
  return {
    matchup,
    race: form.race,
    name: form.name,
    leadTimeSec: form.leadTimeSec,
    steps: form.steps,
    recurring: form.recurring,
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
    name: form.name,
    leadTimeSec: form.leadTimeSec,
    steps: form.steps.map((step) => {
      const sayAs = step.sayAs.trim();
      return sayAs === ""
        ? { time: step.time, say: step.say }
        : { time: step.time, say: step.say, sayAs };
    }),
    ...(form.recurring.length
      ? {
          recurring: form.recurring.map((cue) => {
            const sayAs = cue.sayAs.trim();
            const endSec = cue.endSec.trim();
            return {
              say: cue.say,
              ...(sayAs === "" ? {} : { sayAs }),
              startSec: cue.startSec,
              intervalSec: cue.intervalSec,
              ...(endSec === "" ? {} : { endSec }),
            };
          }),
        }
      : {}),
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
 * routing). Provides CRUD over builds and steps, a live
 * JSON preview, and persists via the `save_build_order` / `delete_build_order`
 * Rust commands. After a successful write it emits `BUILDS_CHANGED_EVENT` so the
 * overlay reloads without a restart.
 */
export default function BuildEditor() {
  const { stored, errors, loadError, reload } = useBuildOrders();

  // null selection = composing a new (not-yet-saved) build.
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [form, setForm] = useState<EditorForm>(emptyForm);
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

  // Whether the currently-selected build is a read-only embedded default.
  const selectedReadOnly = useMemo(() => {
    if (selectedFilename === null) return false;
    return stored.find((s) => s.filename === selectedFilename)?.readOnly ?? false;
  }, [selectedFilename, stored]);

  // Filename base derived from the build's name (falling back to its matchup).
  const filenameSource = useMemo(
    () => (form.name.trim() !== "" ? form.name : `${raceNameToLetter(form.race)}v${form.opponent}`),
    [form.name, form.race, form.opponent],
  );

  const previewFilename = useMemo(() => {
    if (selectedFilename !== null) return selectedFilename;
    return generateBuildFilename(filenameSource, existingFilenames);
  }, [selectedFilename, filenameSource, existingFilenames]);

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
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选中文本并按 Cmd+C 复制");
    }
  }

  function selectBuild(filename: string, build: BuildOrder): void {
    setSelectedFilename(filename);
    setForm(toForm(build));
    setConfirmingDelete(false);
  }

  // Robust auto-select for "navigate to editor and select this build".
  //
  // The main window is hide-not-destroy, so BuildEditor may already be mounted
  // when the overlay's edit button fires again. We can't rely on a one-shot
  // mount effect: `pendingSelectRef` holds the target filename and is applied
  // (then cleared) whenever it is set AND `stored` is loaded. Three entry points
  // feed it, covering every ordering:
  //   1. mount      — consume the module stash (event arrived before we mounted)
  //   2. live event — listen for NAVIGATE_EVENT (already mounted, repeat click)
  //   3. stored load — re-apply after async builds finish loading
  const pendingSelectRef = useRef<string | null>(null);

  const applySelection = useCallback(() => {
    const filename = pendingSelectRef.current;
    if (filename === null) return; // nothing pending: leave current selection
    if (stored.length === 0) return; // builds not loaded yet: keep pending
    pendingSelectRef.current = null; // consume now to prevent re-running
    const match = stored.find((s) => s.filename === filename);
    if (match) selectBuild(filename, match.build);
    // selectBuild only calls stable state setters; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  // Entry 1: on mount, consume any stash left by NavigationBridge before we
  // mounted. Empty/none yields null, so we leave the current selection alone.
  useEffect(() => {
    const filename = consumePendingEditorNav();
    if (filename !== null) {
      pendingSelectRef.current = filename;
      applySelection();
    }
    // Run once on mount; applySelection is stable enough and re-running here
    // would re-consume an already-empty stash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Entry 2: live NAVIGATE_EVENT while already mounted (e.g. user is on /editor
  // and clicks the overlay edit button again — navigate() is a no-op and the
  // mount effect never re-runs, so we must catch the event directly here).
  // An empty/undefined filename means "just open" → null → no forced selection.
  useEffect(() => {
    const unlisten = listen<NavigatePayload>(NAVIGATE_EVENT, (e) => {
      if (e.payload?.route !== "/editor") return;
      const filename = e.payload.filename?.trim() ? e.payload.filename : null;
      pendingSelectRef.current = filename;
      applySelection();
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [applySelection]);

  // Entry 3: when stored finishes (re)loading, apply any pending selection that
  // was deferred because builds weren't loaded when the event/stash arrived.
  useEffect(() => {
    applySelection();
  }, [applySelection]);

  // Re-sync the open form to disk when the build list reloads (manual 重载, or
  // after save/delete). Editor stored only changes on mount / manual reload /
  // post-save reload (it does NOT listen to external BUILDS_CHANGED), so this
  // never clobbers edits from an unrelated/background reload.
  useEffect(() => {
    if (selectedFilename === null) return; // unsaved new draft: keep as-is
    const match = stored.find((s) => s.filename === selectedFilename);
    if (match) {
      setForm(toForm(match.build)); // refresh to the on-disk version
    } else {
      startNew(); // selected file gone (deleted): reset
    }
    // selectedFilename intentionally omitted: only re-sync on a stored reload,
    // not when the user switches selection (selectBuild already sets the form).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  function startNew(): void {
    setSelectedFilename(null);
    setForm(emptyForm());
    setConfirmingDelete(false);
  }

  function updateRace(value: AuthorRace): void {
    setForm((prev) => ({ ...prev, race: value }));
  }

  function updateOpponent(value: RaceLetter): void {
    setForm((prev) => ({ ...prev, opponent: value }));
  }

  function updateName(value: string): void {
    setForm((prev) => ({ ...prev, name: value }));
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

  function updateRecurring(
    index: number,
    field: keyof DraftRecurring,
    value: string,
  ): void {
    setForm((prev) => ({
      ...prev,
      recurring: prev.recurring.map((cue, i) =>
        i === index ? { ...cue, [field]: value } : cue,
      ),
    }));
  }

  function addRecurring(): void {
    setForm((prev) => ({
      ...prev,
      recurring: [...prev.recurring, emptyRecurring()],
    }));
  }

  function removeRecurring(index: number): void {
    setForm((prev) => ({
      ...prev,
      recurring: prev.recurring.filter((_, i) => i !== index),
    }));
  }

  async function notifyChanged(): Promise<void> {
    reload();
    await emit(BUILDS_CHANGED_EVENT);
  }

  async function handleSave(): Promise<void> {
    if (selectedReadOnly) return; // defaults are read-only; use "copy" instead
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const filename =
      selectedFilename ??
      generateBuildFilename(filenameSource, existingFilenames);

    setBusy(true);
    try {
      await invoke("save_build_order", { filename, build: result.build });
      setSelectedFilename(filename);
      await notifyChanged();
      toast.success(`已保存：${filename}`);
    } catch (e: unknown) {
      toast.error(`保存失败：${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Copy the currently-selected read-only default into a new, editable user
   * build. Generates a fresh filename from the build's name so it never collides
   * with the default, persists it, then selects the new writable copy.
   */
  async function handleCopyToMine(): Promise<void> {
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const filename = generateBuildFilename(filenameSource, existingFilenames);

    setBusy(true);
    try {
      await invoke("save_build_order", { filename, build: result.build });
      setSelectedFilename(filename);
      await notifyChanged();
      toast.success(`已复制为我的流程：${filename}`);
    } catch (e: unknown) {
      toast.error(`复制失败：${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (selectedFilename === null) return;
    const filename = selectedFilename;

    setBusy(true);
    setConfirmingDelete(false);
    try {
      await invoke("delete_build_order", { filename });
      startNew();
      await notifyChanged();
      toast.success(`已删除：${filename}`);
    } catch (e: unknown) {
      toast.error(`删除失败：${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              流程编辑器
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
            {selectedReadOnly ? (
              <Button
                type="button"
                onClick={() => void handleCopyToMine()}
                disabled={busy}
              >
                <Plus />
                复制为我的流程
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy}
              >
                <Save />
                保存
              </Button>
            )}
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[208px_minmax(0,1.25fr)] xl:grid-cols-[208px_minmax(0,1.25fr)_minmax(0,1fr)]">
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
              <ul className="flex max-h-[calc(100vh-180px)] flex-col gap-1.5 overflow-y-auto pr-1">
                {stored.map(({ filename, build, readOnly }) => {
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
                        <span className="flex w-full items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium">
                            {build.name?.trim() ? build.name : build.matchup}
                          </span>
                          {readOnly && (
                            <span className="shrink-0 rounded bg-muted px-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                              默认
                            </span>
                          )}
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          {build.matchup} · {raceLabel(build.race)} ·{" "}
                          {build.steps.length} 步
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
            {selectedReadOnly && (
              <div className="mb-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                这是内置默认流程（只读）。点「复制为我的流程」生成可编辑副本。
              </div>
            )}
            <fieldset disabled={selectedReadOnly} className="contents">
            <div className="mb-4 flex flex-col gap-1.5">
              <FieldLabel htmlFor="editor-name">名称</FieldLabel>
              <Input
                id="editor-name"
                className="w-full text-[14px]"
                value={form.name}
                placeholder="如「TvZ 两船兵」"
                onChange={(e) => updateName(e.currentTarget.value)}
              />
            </div>
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>种族</FieldLabel>
                <Select value={form.race} onValueChange={(v) => updateRace(v as AuthorRace)}>
                  <SelectTrigger className="w-full font-mono text-[13px]">
                    <SelectValue>{RACE_LABELS_ZH[form.race]}</SelectValue>
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
                <FieldLabel>对手</FieldLabel>
                <Select
                  value={form.opponent}
                  onValueChange={(v) => updateOpponent(v as RaceLetter)}
                >
                  <SelectTrigger className="w-full font-mono text-[13px]">
                    <SelectValue>{opponentLabel(form.opponent)}</SelectValue>
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
                <FieldLabel htmlFor="editor-lead">提前播报秒数</FieldLabel>
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
                步骤
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
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border bg-card p-2"
                >
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8 w-28 font-mono text-[13px]"
                      value={step.time}
                      placeholder="90 或 1:30"
                      inputMode="decimal"
                      onChange={(e) =>
                        updateStep(index, "time", e.currentTarget.value)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Input
                      className="h-8 text-[14px]"
                      value={step.say}
                      placeholder="语音内容，如「14 补给站」"
                      onChange={(e) =>
                        updateStep(index, "say", e.currentTarget.value)
                      }
                    />
                    <Input
                      className="h-8 text-[13px] text-muted-foreground"
                      value={step.sayAs}
                      placeholder="朗读文案（可选），如「造两辆火车」"
                      onChange={(e) =>
                        updateStep(index, "sayAs", e.currentTarget.value)
                      }
                    />
                  </div>
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

            <div className="mt-6 mb-3 flex items-center justify-between">
              <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-muted-foreground">
                循环提醒（注卵/菌毯等）
              </span>
              <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                {form.recurring.length} 条
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {form.recurring.map((cue, index) => (
                <li
                  key={index}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-md border bg-card p-2"
                >
                  <div className="flex flex-col gap-1.5">
                    <Input
                      className="h-8 text-[14px]"
                      value={cue.say}
                      placeholder="语音内容，如「注卵」"
                      onChange={(e) =>
                        updateRecurring(index, "say", e.currentTarget.value)
                      }
                    />
                    <Input
                      className="h-8 text-[13px] text-muted-foreground"
                      value={cue.sayAs}
                      placeholder="朗读文案（可选），如「女王补卵」"
                      onChange={(e) =>
                        updateRecurring(index, "sayAs", e.currentTarget.value)
                      }
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <FieldLabel>起始</FieldLabel>
                        <Input
                          className="h-8 font-mono text-[13px]"
                          value={cue.startSec}
                          placeholder="162 或 2:42"
                          inputMode="decimal"
                          onChange={(e) =>
                            updateRecurring(
                              index,
                              "startSec",
                              e.currentTarget.value,
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <FieldLabel>间隔</FieldLabel>
                        <Input
                          className="h-8 font-mono text-[13px]"
                          value={cue.intervalSec}
                          placeholder="29 或 0:29"
                          inputMode="decimal"
                          onChange={(e) =>
                            updateRecurring(
                              index,
                              "intervalSec",
                              e.currentTarget.value,
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <FieldLabel>结束</FieldLabel>
                        <Input
                          className="h-8 font-mono text-[13px]"
                          value={cue.endSec}
                          placeholder="留空=到对局结束（如 10:00）"
                          inputMode="decimal"
                          onChange={(e) =>
                            updateRecurring(
                              index,
                              "endSec",
                              e.currentTarget.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeRecurring(index)}
                    aria-label="删除循环提醒"
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
              onClick={addRecurring}
            >
              <Plus />
              添加循环提醒
            </Button>

            <div className="mt-6 flex items-center justify-between border-t pt-5">
              <span className="font-mono text-[12px] text-muted-foreground">
                builds/{previewFilename}
              </span>
              <span className="font-mono text-[12px] text-muted-foreground">
                按时间自动排序
              </span>
            </div>
            </fieldset>

            <div className="mt-4 flex items-center gap-2">
              {selectedReadOnly ? (
                <Button
                  type="button"
                  onClick={() => void handleCopyToMine()}
                  disabled={busy}
                >
                  <Plus />
                  复制为我的流程
                </Button>
              ) : (
                <>
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
                </>
              )}
            </div>

          </section>

          {/* live, editable JSON pane (import = edit/paste, export = copy) */}
          <div className="md:col-span-2 xl:col-span-1">
            <BuildJsonEditor
              filename={previewFilename}
              value={jsonText}
              onChange={handleJsonChange}
              valid={jsonResult.ok}
              error={jsonResult.ok ? null : jsonResult.error}
              onFocusChange={handleJsonFocusChange}
              onCopy={() => void handleCopyJson()}
              readOnly={selectedReadOnly}
            />
          </div>
        </div>
    </div>
  );
}
