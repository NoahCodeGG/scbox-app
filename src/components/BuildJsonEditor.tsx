import { cn } from "@/lib/utils";

interface BuildJsonEditorProps {
  /** Filename the build would persist to, e.g. `tvp.json`. */
  filename: string;
  /** Current JSON text shown in the editable textarea (controlled). */
  value: string;
  /** Called on every edit/paste with the raw textarea value. */
  onChange: (value: string) => void;
  /** Whether the current text parses + validates as a build order. */
  valid: boolean;
  /** Validation/parse error message shown when `valid` is false. */
  error: string | null;
  /** Notifies the parent when the textarea gains/loses focus (gates re-sync). */
  onFocusChange: (focused: boolean) => void;
  /** Best-effort copy of the current text to the clipboard. */
  onCopy: () => void;
  /** When true, the textarea is read-only (text stays selectable/copyable). */
  readOnly?: boolean;
}

/**
 * Two-way editable JSON pane for the build editor (mockup `.preview`). The
 * textarea IS the import/export surface: editing/pasting valid JSON updates the
 * form, and the text is selectable/copyable for sharing. Shows a validity
 * indicator: green "JSON 有效" when the text parses + validates, red "JSON 无效"
 * with the error otherwise. Purely controlled — owns no state, just renders what
 * it's given and forwards edits/focus/copy to the parent.
 */
function BuildJsonEditor({
  filename,
  value,
  onChange,
  valid,
  error,
  onFocusChange,
  onCopy,
  readOnly = false,
}: BuildJsonEditorProps) {
  return (
    <div className="xl:sticky xl:top-6">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[13px]">{filename}</span>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-mono text-[12px]",
              valid ? "text-success" : "text-destructive",
            )}
          >
            <span
              className={cn(
                "size-[7px] rounded-full",
                valid ? "bg-success" : "bg-destructive",
              )}
              aria-hidden
            />
            {valid ? "JSON 有效" : "JSON 无效"}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="rounded border border-border px-2 py-0.5 font-mono text-[12px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            复制
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        readOnly={readOnly}
        spellCheck={false}
        aria-label="建造顺序 JSON"
        className={cn(
          "m-0 block h-[480px] w-full resize-none overflow-auto rounded-lg border-0 bg-[#0b0d10] p-[18px] font-mono text-[13px] leading-[1.65] text-[#e7e9ec] outline-none focus-visible:ring-2 focus-visible:ring-ring",
          readOnly && "cursor-not-allowed opacity-70",
        )}
      />
      {!valid && error && (
        <p className="mt-2 font-mono text-[12px] text-destructive">{error}</p>
      )}
    </div>
  );
}

export default BuildJsonEditor;
