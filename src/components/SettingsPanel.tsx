import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAppVersion } from "../hooks/useAppVersion";
import { useAppName } from "../hooks/useAppName";
import type { Settings } from "../hooks/useSettings";
import {
  DEFAULT_CLICK_THROUGH_SHORTCUT,
  buildAccelerator,
  formatAccelerator,
} from "../lib/shortcut";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface SettingsPanelProps {
  /** Current persisted settings (the source of truth for field values). */
  settings: Settings;
  /** Persist edited settings (normalization happens in the hook). */
  onSave: (next: Settings) => void;
  /** Optional close callback (overlay popover used this; the page is a no-op). */
  onClose?: () => void;
  /** Trigger a manual update check (lifted to App so there is one source). */
  onCheckUpdate: () => Promise<void>;
  /** True while an update check/install is in flight. */
  updateBusy: boolean;
  /** True when a newer version is available. */
  updateAvailable: boolean;
  /** The available version string, or `null`. */
  updateVersion: string | null;
  /** True when the last check confirmed the app is current. */
  updateUpToDate: boolean;
  /** Last update error message, or `null`. */
  updateError: string | null;
}

/** Parse a number input's string; empty/invalid maps to `null`. */
function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Short status line shown next to the manual update-check button. */
function updateStatusText(props: {
  busy: boolean;
  available: boolean;
  version: string | null;
  upToDate: boolean;
  error: string | null;
}): string {
  if (props.busy) return "检查中…";
  if (props.error) return `检查失败：${props.error}`;
  if (props.available && props.version) return `有新版本 v${props.version}`;
  if (props.upToDate) return "已是最新";
  return "";
}

/** Selectable global themes with their Chinese labels (mockup: 浅色/深色/跟随系统). */
const THEME_OPTIONS: ReadonlyArray<{
  value: Settings["theme"];
  label: string;
}> = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

/** Mono uppercase eyebrow label heading a settings group (mockup `.ghead`). */
function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b bg-secondary px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </div>
  );
}

interface ShortcutRecorderProps {
  /** Current accelerator (Tauri format, e.g. `CmdOrCtrl+Shift+S`). */
  value: string;
  /** Called with a new accelerator string when one is recorded or reset. */
  onChange: (accel: string) => void;
}

/**
 * A click-to-record control for a global shortcut. Clicking enters recording
 * mode; the next valid modifier+key `keydown` is captured (via `buildAccelerator`)
 * and stored. Esc cancels recording; a 重置 button restores the default. The
 * captured value is part of the draft and only persisted on Save.
 */
function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const accel = buildAccelerator(e);
      // Ignore incomplete combos (pure modifier / no modifier); keep recording
      // until a valid modifier+key chord arrives.
      if (accel === null) return;
      onChange(accel);
      setRecording(false);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onChange]);

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant={recording ? "default" : "secondary"}
        aria-pressed={recording}
        className="min-w-20 font-mono"
        onClick={() => setRecording((prev) => !prev)}
      >
        {recording ? "录制中…" : formatAccelerator(value)}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setRecording(false);
          onChange(DEFAULT_CLICK_THROUGH_SHORTCUT);
        }}
      >
        重置
      </Button>
    </div>
  );
}

/**
 * The settings view, toggled from the overlay. Holds local draft state so edits
 * are batched and only persisted on Save; closing without saving discards the
 * draft. Field values are seeded from `settings` and re-sync if it changes.
 */
function SettingsPanel({
  settings,
  onSave,
  onClose,
  onCheckUpdate,
  updateBusy,
  updateAvailable,
  updateVersion,
  updateUpToDate,
  updateError,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<Settings>(settings);
  const version = useAppVersion();
  const appName = useAppName();

  // Re-seed the draft if the persisted settings change while the panel is open
  // (e.g. an external load resolved after first render).
  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const submit = (): void => {
    onSave(draft);
    onClose?.();
  };

  const statusText = updateStatusText({
    busy: updateBusy,
    available: updateAvailable,
    version: updateVersion,
    upToDate: updateUpToDate,
    error: updateError,
  });

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground"
      aria-label="设置"
    >
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">设置</h2>
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
            改动持久化后即时生效
          </p>
        </div>
      </header>

      <Card className="gap-0 overflow-hidden py-0">
        <GroupHeading>对局识别</GroupHeading>
        <CardContent className="px-3 py-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-port" className="text-[13px]">
              Client API 端口
            </Label>
            <Input
              id="settings-port"
              type="number"
              min={1}
              max={65535}
              className="h-8 font-mono text-[13px]"
              value={draft.clientApiPort}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  clientApiPort: Number(e.currentTarget.value),
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <GroupHeading>播报</GroupHeading>
        <CardContent className="flex flex-col px-3 py-0">
          <div className="flex flex-col gap-1.5 py-3">
            <Label htmlFor="settings-lead" className="text-[13px]">
              提前播报时间
            </Label>
            <p className="text-[11px] leading-tight text-muted-foreground">
              覆盖流程自带的提前播报秒数，留空用流程设定。
            </p>
            <div className="flex items-center gap-2">
              <Input
                id="settings-lead"
                type="number"
                min={0}
                step={0.5}
                placeholder="默认"
                className="h-8 w-24 font-mono text-[13px]"
                value={draft.leadTimeSecOverride ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    leadTimeSecOverride: parseOptionalNumber(
                      e.currentTarget.value,
                    ),
                  }))
                }
              />
              <span className="font-mono text-[11px] text-muted-foreground">
                秒
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3 py-3">
            <Label htmlFor="settings-voice" className="text-[13px]">
              语音播报
            </Label>
            <Switch
              id="settings-voice"
              checked={draft.voiceEnabled}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, voiceEnabled: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2 py-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="settings-rate" className="text-[13px]">
                语音速度
              </Label>
              <span className="font-mono text-[13px] tabular-nums">
                {draft.voiceRate.toFixed(1)}×
              </span>
            </div>
            <Slider
              id="settings-rate"
              min={0.5}
              max={2}
              step={0.1}
              value={draft.voiceRate}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, voiceRate: value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <GroupHeading>悬浮窗</GroupHeading>
        <CardContent className="flex flex-col px-3 py-0">
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="settings-clickthrough" className="text-[13px]">
                穿透模式
              </Label>
              <span className="font-mono text-[11px] text-warning">
                ⚠ 开启后按 {formatAccelerator(draft.clickThroughShortcut)} 解除
              </span>
            </div>
            <Switch
              id="settings-clickthrough"
              checked={draft.clickThrough}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, clickThrough: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[13px]">穿透快捷键</Label>
              <span className="text-[11px] leading-tight text-muted-foreground">
                点击录制，按下含修饰键的组合键。
              </span>
            </div>
            <ShortcutRecorder
              value={draft.clickThroughShortcut}
              onChange={(accel) =>
                setDraft((prev) => ({ ...prev, clickThroughShortcut: accel }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <GroupHeading>外观</GroupHeading>
        <CardContent className="flex flex-col px-3 py-0">
          <div className="flex items-center justify-between gap-3 py-3">
            <Label className="text-[13px]">主题</Label>
            <div className="flex items-center gap-1">
              {THEME_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={draft.theme === option.value ? "default" : "secondary"}
                  aria-pressed={draft.theme === option.value}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, theme: option.value }))
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="settings-prerelease" className="text-[13px]">
                预发布版本更新
              </Label>
              <span className="text-[11px] leading-tight text-muted-foreground">
                开启后会更新到测试版（beta）。
              </span>
            </div>
            <Switch
              id="settings-prerelease"
              checked={draft.prereleaseUpdates}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, prereleaseUpdates: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button type="button" size="sm" onClick={submit}>
          保存设置
        </Button>
      </div>

      <Separator />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void onCheckUpdate();
          }}
          disabled={updateBusy}
        >
          <RefreshCw className={updateBusy ? "animate-spin" : undefined} />
          检查更新
        </Button>
        <span className="text-[12px] text-muted-foreground">{statusText}</span>
      </div>

      {(appName || version) && (
        <footer className="text-center text-[11px] text-muted-foreground">
          {appName ?? ""}
          {version ? ` v${version}` : ""}
        </footer>
      )}
    </section>
  );
}

export default SettingsPanel;
