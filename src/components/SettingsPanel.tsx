import { useEffect, useState } from "react";
import { useAppVersion } from "../hooks/useAppVersion";
import type { Settings } from "../hooks/useSettings";
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
  /** Close the panel without further action. */
  onClose: () => void;
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

/** Mono uppercase eyebrow label heading a settings group (mockup `.ghead`). */
function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b bg-secondary px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
      {children}
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

  // Re-seed the draft if the persisted settings change while the panel is open
  // (e.g. an external load resolved after first render).
  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const submit = (): void => {
    onSave(draft);
    onClose();
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="关闭设置"
        >
          ×
        </Button>
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
              覆盖 build order 自带的 leadTimeSec，留空用 build 设定。
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
              value={[draft.voiceRate]}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, voiceRate: value[0] }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <GroupHeading>悬浮窗</GroupHeading>
        <CardContent className="px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="settings-clickthrough" className="text-[13px]">
                穿透模式
              </Label>
              <span className="font-mono text-[11px] text-warning">
                ⚠ 开启后按 Ctrl+Shift+S 解除
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
          variant="secondary"
          size="sm"
          onClick={() => {
            void onCheckUpdate();
          }}
          disabled={updateBusy}
        >
          检查更新
        </Button>
        <span className="text-[12px] text-muted-foreground">{statusText}</span>
      </div>

      <footer className="text-center text-[11px] text-muted-foreground">
        SCBox Assistant{version ? ` v${version}` : ""}
      </footer>
    </section>
  );
}

export default SettingsPanel;
