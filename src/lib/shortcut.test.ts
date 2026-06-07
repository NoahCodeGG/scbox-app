import { describe, expect, it } from "vitest";
import type { ShortcutKeyEvent } from "./shortcut";
import {
  DEFAULT_CLICK_THROUGH_SHORTCUT,
  buildAccelerator,
  formatAccelerator,
} from "./shortcut";

/** Build a `ShortcutKeyEvent` with no modifiers, overriding as needed. */
function keyEvent(over: Partial<ShortcutKeyEvent>): ShortcutKeyEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: "",
    ...over,
  };
}

describe("buildAccelerator", () => {
  it("builds the default-style combo from meta+shift+letter", () => {
    expect(
      buildAccelerator(keyEvent({ metaKey: true, shiftKey: true, key: "s" })),
    ).toBe("CmdOrCtrl+Shift+S");
  });

  it("maps ctrl to CmdOrCtrl too", () => {
    expect(
      buildAccelerator(keyEvent({ ctrlKey: true, shiftKey: true, key: "S" })),
    ).toBe("CmdOrCtrl+Shift+S");
  });

  it("supports alt as the modifier", () => {
    expect(buildAccelerator(keyEvent({ altKey: true, key: "t" }))).toBe(
      "Alt+T",
    );
  });

  it("orders CmdOrCtrl, Shift, Alt, then key", () => {
    expect(
      buildAccelerator(
        keyEvent({ ctrlKey: true, shiftKey: true, altKey: true, key: "p" }),
      ),
    ).toBe("CmdOrCtrl+Shift+Alt+P");
  });

  it("accepts digits and function keys as the main key", () => {
    expect(buildAccelerator(keyEvent({ ctrlKey: true, key: "1" }))).toBe(
      "CmdOrCtrl+1",
    );
    expect(buildAccelerator(keyEvent({ altKey: true, key: "F5" }))).toBe(
      "Alt+F5",
    );
  });

  it("returns null with no modifier", () => {
    expect(buildAccelerator(keyEvent({ key: "s" }))).toBeNull();
  });

  it("returns null for a Shift-only combo (Shift is not a real modifier)", () => {
    expect(buildAccelerator(keyEvent({ shiftKey: true, key: "s" }))).toBeNull();
  });

  it("returns null for a pure-modifier keypress", () => {
    expect(
      buildAccelerator(keyEvent({ metaKey: true, key: "Meta" })),
    ).toBeNull();
    expect(
      buildAccelerator(keyEvent({ ctrlKey: true, key: "Control" })),
    ).toBeNull();
    expect(
      buildAccelerator(keyEvent({ altKey: true, key: "Alt" })),
    ).toBeNull();
  });

  it("returns null for an unsupported main key", () => {
    expect(
      buildAccelerator(keyEvent({ ctrlKey: true, key: "Enter" })),
    ).toBeNull();
  });
});

describe("formatAccelerator", () => {
  it("renders modifier symbols compactly", () => {
    expect(formatAccelerator("CmdOrCtrl+Shift+S")).toBe("⌘⇧S");
    expect(formatAccelerator("Alt+T")).toBe("⌥T");
  });

  it("renders the default shortcut", () => {
    expect(formatAccelerator(DEFAULT_CLICK_THROUGH_SHORTCUT)).toBe("⌘⇧S");
  });
});
