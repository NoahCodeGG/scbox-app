// Pure helpers around build-order loading: the in-memory bundled fallback used
// when the Rust `load_build_orders` command hard-fails. Kept DOM-free so it is
// unit-testable in the node test env.

import type { BuildOrder } from "../types/build";
import terranStandard from "../data/builds/terran-standard.json";

/**
 * The bundled default build, used ONLY as an in-memory fallback when the Rust
 * command rejects (so the overlay can still guide). Built explicitly (instead
 * of a bare `as` cast) so a renamed/missing required field fails the build, and
 * doc-only keys like `_note` are dropped.
 */
export const FALLBACK_BUILD: BuildOrder = {
  matchup: terranStandard.matchup,
  race: terranStandard.race,
  leadTimeSec: terranStandard.leadTimeSec,
  steps: terranStandard.steps.map((step) => ({
    time: step.time,
    say: step.say,
  })),
};
