// Pure helper to generate a safe `*.json` filename for a NEW build. The Rust
// side independently sanitizes whatever it receives (defense in depth), but
// generating a clean name here keeps files human-readable (e.g. `tvp-2.json`).

/** Filenames already present in the builds dir, used to avoid collisions. */
export type ExistingFilenames = readonly string[];

/** Slugify a matchup into a filename-safe base (lowercase, ascii word chars). */
function slugify(matchup: string): string {
  const slug = matchup
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "build" : slug;
}

/**
 * Generate a unique `<slug>.json` filename for a new build, suffixing `-2`,
 * `-3`, … if needed to avoid clobbering an existing file (case-insensitive).
 */
export function generateBuildFilename(
  matchup: string,
  existing: ExistingFilenames,
): string {
  const base = slugify(matchup);
  const taken = new Set(existing.map((name) => name.toLowerCase()));

  let candidate = `${base}.json`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}-${n}.json`;
    n++;
  }
  return candidate;
}
