import { describe, expect, test } from "bun:test";
import {
  canChordTriggers, createDefaultShortcutSlots, decodeShortcutSlots, encodeShortcutSlots,
  isShortcutSlotValid, SHORTCUT_ACTION_CONSUMER, SHORTCUT_TRIGGER_IDS, SHORTCUT_TRIGGER_TAP,
  STICK_TRIGGER_FIRST, STICK_TRIGGER_LAST, type ShortcutSlot,
} from "../src/protocol/buttons";
import { decodePressedButtons, resolvePhysicalButton } from "../src/protocol/controllerState";
import { captureTrigger } from "../src/protocol/shortcutGestures";

const HOME = 20;
const LEFT_UP = 28, LEFT_DOWN = 29, LEFT_LEFT = 30, RIGHT_LEFT = 34;

const volumeUp: ShortcutSlot = {
  triggerA: HOME, triggerB: LEFT_UP, action: SHORTCUT_ACTION_CONSUMER, payload: [0xe9, 0, 0], flags: 0,
};

function stateReport(lx = 128, ly = 128, rx = 128, ry = 128, buttons: [number, number, number] = [8, 0, 0]) {
  const bytes = new Uint8Array(63);
  bytes.set([lx, ly, rx, ry], 0);
  bytes.set(buttons, 7);
  return new DataView(bytes.buffer);
}

describe("analog stick directions as shortcut triggers", () => {
  test("ids match the firmware and skip the remap Disable id", () => {
    expect(STICK_TRIGGER_FIRST).toBe(28);
    expect(STICK_TRIGGER_LAST).toBe(35);
    expect(SHORTCUT_TRIGGER_IDS).not.toContain(27);
    expect(SHORTCUT_TRIGGER_IDS).toContain(35);
  });

  test("Home + Left stick up round-trips through the wire format", () => {
    const slots = createDefaultShortcutSlots();
    slots[0] = volumeUp;
    slots[1] = { ...volumeUp, triggerA: RIGHT_LEFT, triggerB: SHORTCUT_TRIGGER_TAP };
    const bytes = encodeShortcutSlots(slots);
    expect([...bytes.slice(0, 2)]).toEqual([HOME, LEFT_UP]);
    expect(decodeShortcutSlots(bytes)).toEqual(slots);
  });

  test("rejects opposite directions of one stick and unknown ids", () => {
    expect(canChordTriggers(LEFT_UP, LEFT_DOWN)).toBe(false);
    expect(canChordTriggers(LEFT_UP, LEFT_LEFT)).toBe(true);
    expect(canChordTriggers(LEFT_UP, 32)).toBe(true);
    expect(isShortcutSlotValid({ ...volumeUp, triggerA: LEFT_UP, triggerB: LEFT_DOWN })).toBe(false);
    expect(isShortcutSlotValid({ ...volumeUp, triggerB: 27 })).toBe(false);
    expect(isShortcutSlotValid({ ...volumeUp, triggerB: 36 })).toBe(false);
  });

  test("input reports decode stick directions past the press threshold", () => {
    expect(decodePressedButtons(1, stateReport())).toEqual([]);
    expect(decodePressedButtons(1, stateReport(128, 128 - 79))).toEqual([]);
    expect(decodePressedButtons(1, stateReport(128, 0))).toEqual([LEFT_UP]);
    expect(decodePressedButtons(1, stateReport(128, 255))).toEqual([LEFT_DOWN]);
    expect(decodePressedButtons(1, stateReport(128, 128, 0, 128))).toEqual([RIGHT_LEFT]);
    // Home (system byte bit 0) with the left stick pushed up.
    expect(decodePressedButtons(1, stateReport(128, 0, 128, 128, [8, 0, 1]))).toEqual([HOME, LEFT_UP]);
  });

  test("stick ids pass through the remap undo untouched", () => {
    const remap = Array.from({ length: 28 }, (_, index) => index);
    remap[20] = 9;
    expect(resolvePhysicalButton(LEFT_UP, remap)).toBe(LEFT_UP);
  });

  test("capture records Home then a stick direction as a chord", () => {
    const tap: ShortcutSlot = { ...volumeUp, triggerB: SHORTCUT_TRIGGER_TAP };
    const captured = captureTrigger(tap, [HOME, LEFT_UP]);
    expect(captured.triggerA).toBe(HOME);
    expect(captured.triggerB).toBe(LEFT_UP);
    expect(isShortcutSlotValid(captured)).toBe(true);
  });
});
