export const REPORT_BUTTON_REMAP = 0xfa;
export const REPORT_BUTTON_SHORTCUT = 0xfb;

export const BUTTON_NAMES = [
  "DPadNorth",
  "DPadNorthEast",
  "DPadEast",
  "DPadSouthEast",
  "DPadSouth",
  "DPadSouthWest",
  "DPadWest",
  "DPadNorthWest",
  "Square",
  "Cross",
  "Circle",
  "Triangle",
  "L1",
  "R1",
  "L2",
  "R2",
  "Create",
  "Options",
  "L3",
  "R3",
  "Home",
  "Pad",
  "Mute",
  "LeftFunction",
  "RightFunction",
  "LeftPaddle",
  "RightPaddle",
  "Disable",
] as const;

export const BUTTON_TRANSLATION_KEYS = [
  "dPadNorth",
  "dPadNorthEast",
  "dPadEast",
  "dPadSouthEast",
  "dPadSouth",
  "dPadSouthWest",
  "dPadWest",
  "dPadNorthWest",
  "square",
  "cross",
  "circle",
  "triangle",
  "l1",
  "r1",
  "l2",
  "r2",
  "create",
  "options",
  "l3",
  "r3",
  "home",
  "pad",
  "mute",
  "leftFunction",
  "rightFunction",
  "leftPaddle",
  "rightPaddle",
  "disable",
] as const;

export const BUTTON_REMAP_COUNT = BUTTON_NAMES.length;
export const BUTTON_SOURCE_COUNT = BUTTON_REMAP_COUNT - 1;
export const BUTTON_DISABLE_ID = BUTTON_REMAP_COUNT - 1;
export const DUALSENSE_BUTTON_SOURCE_COUNT = 23;
export const DPAD_MAX_ID = 7;

export const SHORTCUT_COUNT = 9;
export const SHORTCUT_SIZE = 7;
export const SHORTCUT_STORAGE_SIZE = SHORTCUT_COUNT * SHORTCUT_SIZE;
export const SHORTCUT_DISABLED = 0xff;
export const SHORTCUT_TRIGGER_TAP = 0xfd;
export const SHORTCUT_TRIGGER_DOUBLE_TAP = 0xfe;
export const SHORTCUT_FLAG_DOUBLE_TAP = 0x01;
export const SHORTCUT_FLAG_HOLD = 0x02;
export const SHORTCUT_FLAG_MASK = SHORTCUT_FLAG_DOUBLE_TAP | SHORTCUT_FLAG_HOLD;
export const SHORTCUT_KEY_USAGE_MAX = 0x73;
export const SHORTCUT_CONSUMER_USAGE_MAX = 0x02ff;

export const SHORTCUT_ACTION_KEYBOARD = 0;
export const SHORTCUT_ACTION_BT_DISCONNECT = 1;
export const SHORTCUT_ACTION_CONSUMER = 2;

export type ShortcutAction =
  | typeof SHORTCUT_ACTION_KEYBOARD
  | typeof SHORTCUT_ACTION_BT_DISCONNECT
  | typeof SHORTCUT_ACTION_CONSUMER;

export interface ShortcutSlot {
  triggerA: number;
  triggerB: number;
  action: ShortcutAction;
  payload: [number, number, number];
  flags: number;
}

export const DEFAULT_BUTTON_REMAP: readonly number[] = Object.freeze(
  Array.from({ length: BUTTON_REMAP_COUNT }, (_, index) => index),
);

export function createDisabledShortcut(): ShortcutSlot {
  return {
    triggerA: SHORTCUT_DISABLED,
    triggerB: SHORTCUT_DISABLED,
    action: SHORTCUT_ACTION_KEYBOARD,
    payload: [0, 0, 0],
    flags: 0,
  };
}

export function createDefaultShortcutSlots(): ShortcutSlot[] {
  return Array.from({ length: SHORTCUT_COUNT }, createDisabledShortcut);
}

export function decodeButtonRemap(source: ArrayBuffer | DataView | Uint8Array): number[] {
  const bytes = reportPayload(source, REPORT_BUTTON_REMAP, BUTTON_REMAP_COUNT);
  const remap = Array.from(bytes.slice(0, BUTTON_REMAP_COUNT));
  const invalidIndex = remap.findIndex((button) => button < 0 || button >= BUTTON_REMAP_COUNT);

  if (invalidIndex >= 0) {
    throw new ButtonProtocolError("invalidRemap", {
      index: invalidIndex,
      value: remap[invalidIndex],
    });
  }

  return remap;
}

export function encodeButtonRemap(remap: readonly number[]): Uint8Array<ArrayBuffer> {
  if (remap.length !== BUTTON_REMAP_COUNT) {
    throw new ButtonProtocolError("invalidRemapLength", {
      count: remap.length,
      expected: BUTTON_REMAP_COUNT,
    });
  }

  const bytes = new Uint8Array(new ArrayBuffer(BUTTON_REMAP_COUNT));
  remap.forEach((button, index) => {
    if (!Number.isInteger(button) || button < 0 || button >= BUTTON_REMAP_COUNT) {
      throw new ButtonProtocolError("invalidRemap", { index, value: button });
    }
    bytes[index] = button;
  });
  return bytes;
}

export function decodeShortcutSlots(source: ArrayBuffer | DataView | Uint8Array): ShortcutSlot[] {
  const bytes = reportPayload(source, REPORT_BUTTON_SHORTCUT, SHORTCUT_STORAGE_SIZE);
  const slots = Array.from({ length: SHORTCUT_COUNT }, (_, index) => {
    const offset = index * SHORTCUT_SIZE;
    return {
      triggerA: bytes[offset],
      triggerB: bytes[offset + 1],
      action: bytes[offset + 2] as ShortcutAction,
      payload: [bytes[offset + 3], bytes[offset + 4], bytes[offset + 5]] as [number, number, number],
      flags: bytes[offset + 6],
    };
  });

  const invalidIndex = slots.findIndex((slot) => !isShortcutSlotValid(slot) && !isShortcutDisabled(slot));
  if (invalidIndex >= 0) {
    throw new ButtonProtocolError("invalidShortcut", { slot: invalidIndex + 1 });
  }

  return slots.map((slot) => (isShortcutDisabled(slot) ? createDisabledShortcut() : slot));
}

export function encodeShortcutSlots(slots: readonly ShortcutSlot[]): Uint8Array<ArrayBuffer> {
  if (slots.length !== SHORTCUT_COUNT) {
    throw new ButtonProtocolError("invalidShortcutLength", {
      count: slots.length,
      expected: SHORTCUT_COUNT,
    });
  }

  const bytes = new Uint8Array(new ArrayBuffer(SHORTCUT_STORAGE_SIZE));
  slots.forEach((slot, index) => {
    const normalized = isShortcutDisabled(slot) ? createDisabledShortcut() : slot;
    if (!isShortcutDisabled(normalized) && !isShortcutSlotValid(normalized)) {
      throw new ButtonProtocolError("invalidShortcut", { slot: index + 1 });
    }

    const offset = index * SHORTCUT_SIZE;
    bytes.set(
      [
        normalized.triggerA,
        normalized.triggerB,
        normalized.action,
        normalized.payload[0],
        normalized.payload[1],
        normalized.payload[2],
        normalized.flags,
      ],
      offset,
    );
  });
  return bytes;
}

export function isShortcutDisabled(slot: ShortcutSlot): boolean {
  return slot.triggerA === SHORTCUT_DISABLED;
}

export function isShortcutSlotValid(slot: ShortcutSlot): boolean {
  if (!Number.isInteger(slot.triggerA) || slot.triggerA < 0 || slot.triggerA >= BUTTON_SOURCE_COUNT) {
    return false;
  }
  if (!Number.isInteger(slot.flags) || (slot.flags & ~SHORTCUT_FLAG_MASK) !== 0) {
    return false;
  }

  if ((slot.flags & SHORTCUT_FLAG_HOLD) !== 0 && (
    slot.action !== SHORTCUT_ACTION_KEYBOARD ||
    (slot.flags & SHORTCUT_FLAG_DOUBLE_TAP) !== 0 ||
    slot.triggerB === SHORTCUT_TRIGGER_DOUBLE_TAP
  )) {
    return false;
  }

  if (slot.triggerB === SHORTCUT_TRIGGER_TAP || slot.triggerB === SHORTCUT_TRIGGER_DOUBLE_TAP) {
    if ((slot.flags & SHORTCUT_FLAG_DOUBLE_TAP) !== 0) {
      return false;
    }
  } else if (
    !Number.isInteger(slot.triggerB) ||
    slot.triggerB < 0 ||
    slot.triggerB >= BUTTON_SOURCE_COUNT ||
    slot.triggerA === slot.triggerB ||
    (slot.triggerA <= DPAD_MAX_ID && slot.triggerB <= DPAD_MAX_ID)
  ) {
    return false;
  }

  if (slot.action === SHORTCUT_ACTION_KEYBOARD) {
    return (
      slot.payload[1] <= SHORTCUT_KEY_USAGE_MAX &&
      (slot.payload[0] !== 0 || slot.payload[1] !== 0)
    );
  }
  if (slot.action === SHORTCUT_ACTION_CONSUMER) {
    const usage = slot.payload[0] | (slot.payload[1] << 8);
    return usage > 0 && usage <= SHORTCUT_CONSUMER_USAGE_MAX;
  }
  return slot.action === SHORTCUT_ACTION_BT_DISCONNECT;
}

export function buttonRemapsEqual(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function shortcutSlotsEqual(left: readonly ShortcutSlot[], right: readonly ShortcutSlot[]): boolean {
  return (
    left.length === right.length &&
    left.every((slot, index) => {
      const other = right[index];
      return (
        slot.triggerA === other.triggerA &&
        slot.triggerB === other.triggerB &&
        slot.action === other.action &&
        slot.flags === other.flags &&
        slot.payload.every((value, payloadIndex) => value === other.payload[payloadIndex])
      );
    })
  );
}

export class ButtonProtocolError extends Error {
  constructor(
    public readonly code:
      | "invalidBytes"
      | "invalidRemap"
      | "invalidRemapLength"
      | "invalidShortcut"
      | "invalidShortcutLength"
      | "remapVerificationFailed"
      | "shortcutVerificationFailed",
    public readonly values: Record<string, unknown>,
  ) {
    super(code);
    this.name = "ButtonProtocolError";
  }
}

function reportPayload(
  source: ArrayBuffer | DataView | Uint8Array,
  reportId: number,
  expectedSize: number,
): Uint8Array {
  const bytes = toUint8Array(source);
  const offset = bytes.length >= expectedSize + 1 && bytes[0] === reportId ? 1 : 0;

  if (bytes.length - offset < expectedSize) {
    throw new ButtonProtocolError("invalidBytes", {
      count: bytes.length - offset,
      expected: expectedSize,
      report: `0x${reportId.toString(16).toUpperCase()}`,
    });
  }

  return bytes.slice(offset, offset + expectedSize);
}

function toUint8Array(source: ArrayBuffer | DataView | Uint8Array): Uint8Array {
  if (source instanceof Uint8Array) {
    return source;
  }
  if (source instanceof DataView) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }
  return new Uint8Array(source);
}
