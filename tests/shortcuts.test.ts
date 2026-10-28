import { describe, expect, test } from "bun:test";
import {
  createDefaultShortcutSlots, decodeShortcutSlots, encodeShortcutSlots,
  isShortcutSlotValid, SHORTCUT_ACTION_KEYBOARD, SHORTCUT_ACTION_CONSUMER,
  SHORTCUT_ACTION_BT_DISCONNECT, SHORTCUT_FLAG_HOLD, SHORTCUT_FLAG_DOUBLE_TAP,
  SHORTCUT_TRIGGER_TAP, SHORTCUT_TRIGGER_DOUBLE_TAP, type ShortcutSlot,
} from "../src/protocol/buttons";
import { captureTrigger, getGesture, setGesture, type TriggerGesture } from "../src/protocol/shortcutGestures";

const hold: ShortcutSlot = {
  triggerA: 9, triggerB: SHORTCUT_TRIGGER_TAP, action: SHORTCUT_ACTION_KEYBOARD,
  payload: [1, 6, 0], flags: SHORTCUT_FLAG_HOLD,
};

describe("hold wire protocol", () => {
  test("matches firmware 7-byte layout and preserves the flag in raw/prefixed reports", () => {
    const slots = createDefaultShortcutSlots();
    slots[0] = hold;
    slots[1] = { ...hold, triggerA: 12, triggerB: 13 };
    const bytes = encodeShortcutSlots(slots);
    expect(bytes.length).toBe(63);
    expect([...bytes.slice(0, 14)]).toEqual([9, 253, 0, 1, 6, 0, 2, 12, 13, 0, 1, 6, 0, 2]);
    expect(decodeShortcutSlots(bytes)).toEqual(slots);
    expect(decodeShortcutSlots(new Uint8Array([0xfb, ...bytes]))).toEqual(slots);
  });

  for (const [name, patch] of [
    ["double tap sentinel", { triggerB: SHORTCUT_TRIGGER_DOUBLE_TAP }],
    ["double flag", { flags: SHORTCUT_FLAG_HOLD | SHORTCUT_FLAG_DOUBLE_TAP }],
    ["consumer", { action: SHORTCUT_ACTION_CONSUMER }],
    ["disconnect", { action: SHORTCUT_ACTION_BT_DISCONNECT }],
    ["same button", { triggerB: 9 }],
    ["two dpad directions", { triggerA: 0, triggerB: 1 }],
    ["unknown flag", { flags: 4 }],
  ] as const) {
    test(`rejects ${name} while holding`, () => {
      const invalid = { ...hold, ...patch };
      expect(isShortcutSlotValid(invalid)).toBe(false);
      const slots = createDefaultShortcutSlots();
      slots[0] = invalid;
      expect(() => encodeShortcutSlots(slots)).toThrow();
      const raw = encodeShortcutSlots(createDefaultShortcutSlots());
      raw.set([invalid.triggerA, invalid.triggerB, invalid.action, ...invalid.payload, invalid.flags]);
      expect(() => decodeShortcutSlots(raw)).toThrow();
    });
  }
});

describe("editor and capture share gesture conversion", () => {
  const modes: TriggerGesture[] = ["tap", "doubleTap", "chord", "doubleChord", "hold", "holdChord"];
  for (const mode of modes) {
    test(`${mode} is valid and survives switching from every other mode`, () => {
      for (const source of modes) {
        const slot = setGesture(setGesture(hold, source), mode);
        expect(getGesture(slot)).toBe(mode);
        expect(isShortcutSlotValid(slot)).toBe(true);
      }
    });
  }
  test("recording one or two buttons preserves hold instead of converting it to a pulse", () => {
    const chord = captureTrigger(hold, [12, 13]);
    expect(getGesture(chord)).toBe("holdChord");
    expect(chord.flags).toBe(2);
    const single = captureTrigger(chord, [8]);
    expect(getGesture(single)).toBe("hold");
    expect(single.triggerB).toBe(253);
    expect(single.payload).toEqual(hold.payload);
    expect(captureTrigger(single, [])).toBe(single);
  });
  test("legacy double capture retains double semantics", () => {
    const double = setGesture(hold, "doubleTap");
    expect(getGesture(captureTrigger(double, [12, 13]))).toBe("doubleChord");
    expect(getGesture(captureTrigger(setGesture(hold, "doubleChord"), [12]))).toBe("doubleTap");
  });
  test("changing the first chord button avoids duplicate/dpad combinations", () => {
    const slot = setGesture({ ...hold, triggerA: 0, triggerB: 1 }, "holdChord");
    expect(slot.triggerB).toBeGreaterThan(7);
    expect(isShortcutSlotValid(slot)).toBe(true);
  });
});
