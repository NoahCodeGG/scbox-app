// Pure helper to generate a safe `*.json` filename for a NEW build. The Rust
// side independently sanitizes whatever it receives (defense in depth), but
// generating a clean name here keeps files human-readable (e.g. `tvz-2.json`).

/** Filenames already present (defaults + user builds), used to avoid collisions. */
export type ExistingFilenames = readonly string[];

/**
 * Slugify a source string into a filename-safe base. Keeps Unicode letters and
 * numbers (so CJK names like `两船兵` survive), folds any run of other characters
 * (whitespace, punctuation, path separators) into a single `-`, lowercases
 * ASCII, and trims edge `-`. Returns `build` only when nothing usable remains.
 */
function slugify(source: string): string {
  const slug = source
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "build" : slug;
}

/**
 * Generate a unique `<slug>.json` filename for a new build, suffixing `-2`,
 * `-3`, … if needed to avoid clobbering an existing file (case-insensitive).
 * `source` is typically the build's name (falling back to its matchup). Pass the
 * FULL existing set (defaults + user builds) so a new user build never collides
 * with a read-only default.
 */
export function generateBuildFilename(
  source: string,
  existing: ExistingFilenames,
): string {
  const base = slugify(source);
  const taken = new Set(existing.map((name) => name.toLowerCase()));

  let candidate = `${base}.json`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}-${n}.json`;
    n++;
  }
  return candidate;
}
