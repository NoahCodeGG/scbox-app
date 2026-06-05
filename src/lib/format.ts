/** Format SC2 in-game `displayTime` (seconds) as `m:ss`. */
export function formatGameTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const RACE_LABELS: Record<string, string> = {
  Terr: "Terran",
  Prot: "Protoss",
  Zerg: "Zerg",
  random: "Random",
};

/** Map the API's short race code to a readable label. */
export function raceLabel(race: string): string {
  return RACE_LABELS[race] ?? race;
}
