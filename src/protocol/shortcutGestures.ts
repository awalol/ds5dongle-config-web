import {
  BUTTON_SOURCE_COUNT, DPAD_MAX_ID, SHORTCUT_FLAG_DOUBLE_TAP, SHORTCUT_FLAG_HOLD,
  SHORTCUT_TRIGGER_DOUBLE_TAP, SHORTCUT_TRIGGER_TAP, type ShortcutSlot,
} from "./buttons";

export type TriggerGesture = "tap" | "doubleTap" | "chord" | "doubleChord" | "hold" | "holdChord";

export function isHoldGesture(gesture: TriggerGesture): boolean {
  return gesture === "hold" || gesture === "holdChord";
}

export function isChordGesture(gesture: TriggerGesture): boolean {
  return gesture === "chord" || gesture === "doubleChord" || gesture === "holdChord";
}

export function getGesture(slot: ShortcutSlot): TriggerGesture {
  if (slot.flags & SHORTCUT_FLAG_HOLD) {
    return slot.triggerB === SHORTCUT_TRIGGER_TAP ? "hold" : "holdChord";
  }
  if (slot.triggerB === SHORTCUT_TRIGGER_TAP) return "tap";
  if (slot.triggerB === SHORTCUT_TRIGGER_DOUBLE_TAP) return "doubleTap";
  return slot.flags & SHORTCUT_FLAG_DOUBLE_TAP ? "doubleChord" : "chord";
}

export function validSecondTrigger(triggerA: number, current: number): number {
  const valid = (button: number) => Number.isInteger(button) && button >= 0 &&
    button < BUTTON_SOURCE_COUNT && button !== triggerA &&
    !(button <= DPAD_MAX_ID && triggerA <= DPAD_MAX_ID);
  return valid(current) ? current : [17, 16, 20, 8].find(valid) ?? 8;
}

/** Shared by the editor and controller capture so mode flags never drift. */
export function setGesture(slot: ShortcutSlot, gesture: TriggerGesture): ShortcutSlot {
  const triggerA = slot.triggerA >= 0 && slot.triggerA < BUTTON_SOURCE_COUNT ? slot.triggerA : 20;
  return {
    ...slot,
    triggerA,
    triggerB: isChordGesture(gesture) ? validSecondTrigger(triggerA, slot.triggerB)
      : gesture === "doubleTap" ? SHORTCUT_TRIGGER_DOUBLE_TAP : SHORTCUT_TRIGGER_TAP,
    flags: isHoldGesture(gesture) ? SHORTCUT_FLAG_HOLD
      : gesture === "doubleChord" ? SHORTCUT_FLAG_DOUBLE_TAP : 0,
  };
}

export function captureTrigger(slot: ShortcutSlot, buttons: readonly number[]): ShortcutSlot {
  if (buttons.length === 0) return slot;
  const gesture = getGesture(slot);
  const chord = buttons.length > 1;
  const double = gesture === "doubleTap" || gesture === "doubleChord";
  const nextGesture = isHoldGesture(gesture) ? (chord ? "holdChord" : "hold")
    : double ? (chord ? "doubleChord" : "doubleTap") : (chord ? "chord" : "tap");
  return setGesture({ ...slot, triggerA: buttons[0], triggerB: buttons[1] }, nextGesture);
}
