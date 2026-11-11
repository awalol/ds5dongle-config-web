import { describe, expect, test } from "bun:test";
import {
  createDefaultShortcutSlots, decodeShortcutSlots, encodeShortcutSlots,
  isShortcutSlotValid, type ShortcutSlot,
} from "../src/protocol/buttons";
import {
  captureTrigger, getGesture, setGesture, type TriggerGesture,
} from "../src/protocol/shortcutGestures";
import { Ds5BridgeHidClient } from "../src/protocol/ds5BridgeHid";

const slot: ShortcutSlot = {
  triggerA: 12, triggerB: 13, action: 0, payload: [4, 43, 0], flags: 4,
};

describe("modifier hold", () => {
  test("matches firmware and Python Alt+Tab bytes, preserving ordered roles", () => {
    const slots = createDefaultShortcutSlots();
    slots[0] = slot;
    slots[1] = { ...slot, triggerA: 13, triggerB: 12 };
    const bytes = encodeShortcutSlots(slots);
    expect(bytes.length).toBe(63);
    expect([...bytes.slice(0, 14)]).toEqual([12, 13, 0, 4, 43, 0, 4, 13, 12, 0, 4, 43, 0, 4]);
    expect(decodeShortcutSlots(bytes)).toEqual(slots);
    expect(decodeShortcutSlots(new Uint8Array([0xfb, ...bytes]))).toEqual(slots);
  });

  const invalid: Record<string, Partial<ShortcutSlot>> = {
    "single trigger": { triggerB: 253 },
    "double trigger": { triggerB: 254 },
    "same buttons": { triggerB: 12 },
    "two dpad directions": { triggerA: 0, triggerB: 1 },
    "missing modifiers": { payload: [0, 43, 0] },
    "missing key": { payload: [4, 0, 0] },
    "reserved key": { payload: [4, 1, 0] },
    "key out of range": { payload: [4, 116, 0] },
    "media action": { action: 2 },
    "disconnect action": { action: 1 },
    "double flag": { flags: 5 },
    "hold flag": { flags: 6 },
    "all flags": { flags: 7 },
    "unknown flag": { flags: 8 },
  };
  for (const [name, patch] of Object.entries(invalid)) {
    test(`rejects ${name}`, () => {
      const value = { ...slot, ...patch };
      expect(isShortcutSlotValid(value)).toBe(false);
      const slots = createDefaultShortcutSlots();
      slots[0] = value;
      expect(() => encodeShortcutSlots(slots)).toThrow();
      const bytes = encodeShortcutSlots(createDefaultShortcutSlots());
      bytes.set([value.triggerA, value.triggerB, value.action, ...value.payload, value.flags]);
      expect(() => decodeShortcutSlots(bytes)).toThrow();
    });
  }

  test("all gesture transitions replace flags and preserve the output", () => {
    const modes: TriggerGesture[] = ["tap", "doubleTap", "chord", "doubleChord", "hold", "holdChord", "modifierHold"];
    for (const from of modes) {
      for (const to of modes) {
        const converted = setGesture(setGesture(slot, from), to);
        expect(getGesture(converted)).toBe(to);
        expect(isShortcutSlotValid(converted)).toBe(true);
        expect(converted.payload).toEqual(slot.payload);
      }
    }
    const incomplete = setGesture({ ...slot, flags: 2, payload: [0, 43, 0] }, "modifierHold");
    expect(incomplete.payload).toEqual([0, 43, 0]); // Do not invent a modifier.
    expect(isShortcutSlotValid(incomplete)).toBe(false);
  });

  test("capture keeps the mode and role order; incomplete/invalid capture changes nothing", () => {
    const next = captureTrigger(slot, [13, 12]);
    expect(next).toEqual({ ...slot, triggerA: 13, triggerB: 12 });
    for (const buttons of [[], [9], [9, 9], [0, 1], [12, 253], [27, 12], [12, 13, 9]]) {
      expect(captureTrigger(slot, buttons)).toBe(slot);
    }
  });
});

describe("modifier hold device read-back", () => {
  for (const supportsMode of [true, false]) {
    test(supportsMode ? "saves only after a successful read-back" : "reports old firmware and does not save to flash", async () => {
      const previousWindow = globalThis.window;
      // WebHID's settling delay uses a browser timer.
      Object.defineProperty(globalThis, "window", {
        configurable: true, writable: true, value: { setTimeout: globalThis.setTimeout },
      });
      const sent: number[] = [];
      let bytes = encodeShortcutSlots(createDefaultShortcutSlots());
      const device = {
        opened: true,
        async sendFeatureReport(report: number, data: Uint8Array) {
          sent.push(report);
          if (report === 0xfb && supportsMode) bytes = new Uint8Array(data);
        },
        async receiveFeatureReport() { return new DataView(bytes.buffer); },
      } as unknown as HIDDevice;
      try {
        const client = new Ds5BridgeHidClient(device);
        const slots = createDefaultShortcutSlots();
        slots[0] = slot;
        if (supportsMode) {
          expect(await client.applyShortcuts(slots)).toEqual(slots);
          expect(sent).toEqual([0xfb, 0xf6]);
        } else {
          await expect(client.applyShortcuts(slots)).rejects.toMatchObject({
            code: "modifierHoldVerificationFailed",
          });
          expect(sent).toEqual([0xfb]);
        }
      } finally {
        if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
        else globalThis.window = previousWindow;
      }
    });
  }
});
