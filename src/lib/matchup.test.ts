import { describe, expect, it } from "vitest";
import type { BuildOrder } from "../types/build";
import type { PlayerInfo } from "../types/sc2";
import {
  identifyMatchup,
  parseMatchup,
  raceCodeToLetter,
  selectBuild,
} from "./matchup";

function player(overrides: Partial<PlayerInfo>): PlayerInfo {
  return {
    id: 1,
    name: "P1",
    type: "user",
    race: "Terr",
    result: "Undecided",
    ...overrides,
  };
}

function build(matchup: string, race = "Terran"): BuildOrder {
  return { matchup, race, leadTimeSec: 4, steps: [{ time: 17, say: "x" }] };
}

describe("raceCodeToLetter", () => {
  it("maps known race codes", () => {
    expect(raceCodeToLetter("Terr")).toBe("T");
    expect(raceCodeToLetter("Prot")).toBe("P");
    expect(raceCodeToLetter("Zerg")).toBe("Z");
  });

  it("maps random and unknown codes to X", () => {
    expect(raceCodeToLetter("random")).toBe("X");
    expect(raceCodeToLetter("weird")).toBe("X");
  });
});

describe("parseMatchup", () => {
  it("parses a standard matchup", () => {
    expect(parseMatchup("TvP")).toEqual({ mine: "T", opp: "P" });
  });

  it("parses a catch-all matchup", () => {
    expect(parseMatchup("TvX")).toEqual({ mine: "T", opp: "X" });
  });

  it("tolerates lowercase v", () => {
    expect(parseMatchup("Zvz")).toEqual({ mine: "Z", opp: "Z" });
  });

  it("rejects invalid letters", () => {
    expect(parseMatchup("TvQ")).toBeNull();
    expect(parseMatchup("AvB")).toBeNull();
  });

  it("rejects malformed shapes", () => {
    expect(parseMatchup("Terran")).toBeNull();
    expect(parseMatchup("TvPvZ")).toBeNull();
  });
});

describe("identifyMatchup", () => {
  it("returns null with fewer than two players", () => {
    expect(identifyMatchup([])).toBeNull();
    expect(identifyMatchup([player({ id: 1 })])).toBeNull();
  });

  it("picks the first user as me", () => {
    const players = [
      player({ id: 1, name: "Maru", race: "Terr", type: "user" }),
      player({ id: 2, name: "Serral", race: "Zerg", type: "user" }),
    ];
    const result = identifyMatchup(players);
    expect(result).toEqual({ meId: 1, myRace: "T", oppRace: "Z" });
  });

  it("picks the user in a computer-first game", () => {
    const players = [
      player({ id: 1, name: "AI", race: "Prot", type: "computer" }),
      player({ id: 2, name: "Me", race: "Terr", type: "user" }),
    ];
    const result = identifyMatchup(players);
    expect(result).toEqual({ meId: 2, myRace: "T", oppRace: "P" });
  });

  it("falls back to players[0] when no user is present", () => {
    const players = [
      player({ id: 1, name: "A", race: "Prot", type: "computer" }),
      player({ id: 2, name: "B", race: "Zerg", type: "computer" }),
    ];
    const result = identifyMatchup(players);
    expect(result).toEqual({ meId: 1, myRace: "P", oppRace: "Z" });
  });

  it("treats a random opponent as X", () => {
    const players = [
      player({ id: 1, name: "Me", race: "Terr", type: "user" }),
      player({ id: 2, name: "Rng", race: "random", type: "computer" }),
    ];
    const result = identifyMatchup(players);
    expect(result).toEqual({ meId: 1, myRace: "T", oppRace: "X" });
  });

  it("sets oppRace to X with 3+ players", () => {
    const players = [
      player({ id: 1, name: "Me", race: "Terr" }),
      player({ id: 2, name: "B", race: "Zerg" }),
      player({ id: 3, name: "C", race: "Prot" }),
    ];
    const result = identifyMatchup(players);
    expect(result).toEqual({ meId: 1, myRace: "T", oppRace: "X" });
  });
});

describe("selectBuild", () => {
  it("returns null for an empty list", () => {
    expect(selectBuild([], "T", "P")).toBeNull();
  });

  it("prefers the exact matchup", () => {
    const builds = [build("TvX"), build("TvP"), build("TvZ")];
    expect(selectBuild(builds, "T", "P")).toBe(builds[1]);
  });

  it("falls back to the vX catch-all when no exact match", () => {
    const builds = [build("TvX"), build("TvZ")];
    expect(selectBuild(builds, "T", "P")).toBe(builds[0]);
  });

  it("excludes builds for a different race", () => {
    const zergBuild = build("ZvT", "Zerg");
    const terranBuild = build("TvZ");
    const builds = [zergBuild, terranBuild];
    expect(selectBuild(builds, "T", "Z")).toBe(terranBuild);
  });

  it("falls back to builds[0] when no build targets my race", () => {
    const builds = [build("ZvT", "Zerg"), build("PvT", "Protoss")];
    expect(selectBuild(builds, "T", "Z")).toBe(builds[0]);
  });

  it("falls back to the first matching-race build when no exact or catch-all", () => {
    const builds = [build("TvZ"), build("TvP")];
    expect(selectBuild(builds, "T", "T")).toBe(builds[0]);
  });
});
