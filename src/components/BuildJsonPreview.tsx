import { cn } from "@/lib/utils";

interface BuildJsonPreviewProps {
  /** Filename the build would persist to, e.g. `tvp.json`. */
  filename: string;
  /** Pretty-printed JSON of the validated build, or `null` when invalid. */
  json: string | null;
  /** Validation error message shown when `json` is `null`. */
  error: string | null;
}

/**
 * Sticky, read-only JSON preview of the live build (mockup `.preview`). Shows a
 * validity indicator: green "JSON 有效" with the pretty JSON when the form passes
 * `validateBuild`, or red "JSON 无效" with the error message instead of a stale
 * preview. Purely presentational — derives nothing, just renders what it's given.
 */
function BuildJsonPreview({ filename, json, error }: BuildJsonPreviewProps) {
  const valid = json !== null;

  return (
    <div className="xl:sticky xl:top-6">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-mono text-[13px]">{filename}</span>
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
      </div>
      <pre className="m-0 max-h-[480px] overflow-auto rounded-lg bg-[#0b0d10] p-[18px] font-mono text-[13px] leading-[1.65] text-[#e7e9ec]">
        {valid ? json : (error ?? "JSON 无效")}
      </pre>
    </div>
  );
}

export default BuildJsonPreview;
