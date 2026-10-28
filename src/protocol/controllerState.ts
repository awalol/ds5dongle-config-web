import { BUTTON_REMAP_COUNT, DPAD_MAX_ID } from "./buttons";

// Button state lives in bytes 7-9 of USBGetStateData (DS5Dongle/src/utils.h).
const BUTTON_BYTE_DPAD_FACE = 7;
const BUTTON_BYTE_SHOULDER = 8;
const BUTTON_BYTE_SYSTEM = 9;
const STATE_PAYLOAD_MIN_SIZE = BUTTON_BYTE_SYSTEM + 1;
const DPAD_NONE = 8;

/**
 * The dongle sends controller state on this input report
 * (`tud_hid_report(0x01, ...)` in DS5Dongle/src/main.cpp), with USBGetStateData
 * as the whole payload.
 */
export const STATE_REPORT_ID = 0x01;

// Bit index -> button id, in USBGetStateData bitfield order. Bit 9.3 is UNK1.
const FACE_BUTTON_IDS: readonly number[] = [8, 9, 10, 11];
const SHOULDER_BUTTON_IDS: readonly number[] = [12, 13, 14, 15, 16, 17, 18, 19];
const SYSTEM_BUTTON_IDS: readonly (number | null)[] = [20, 21, 22, null, 23, 24, 25, 26];

/**
 * Buttons currently held down, as source ids matching BUTTON_NAMES, or null when
 * the report does not carry controller state.
 */
export function decodePressedButtons(reportId: number, data: DataView): number[] | null {
  if (reportId !== STATE_REPORT_ID || data.byteLength < STATE_PAYLOAD_MIN_SIZE) {
    return null;
  }

  const dpadFace = data.getUint8(BUTTON_BYTE_DPAD_FACE);
  const pressed: number[] = [];

  // The d-pad reports one of eight directions rather than four bits, and
  // diagonals are their own ids, so a single value covers the whole pad.
  const direction = dpadFace & 0x0f;
  if (direction !== DPAD_NONE && direction <= DPAD_MAX_ID) {
    pressed.push(direction);
  }

  collectBits(pressed, dpadFace >> 4, FACE_BUTTON_IDS);
  collectBits(pressed, data.getUint8(BUTTON_BYTE_SHOULDER), SHOULDER_BUTTON_IDS);
  collectBits(pressed, data.getUint8(BUTTON_BYTE_SYSTEM), SYSTEM_BUTTON_IDS);

  return pressed;
}

/**
 * Maps a button id seen in an input report back to the physical control that
 * produced it. The dongle remaps the report before sending it upstream
 * (`button_remap_apply` in DS5Dongle/src/main.cpp) while shortcut triggers are
 * matched against the untouched state, so a stored remap has to be undone
 * before a captured button can be used as a trigger.
 */
export function resolvePhysicalButton(reported: number, remap: readonly number[]): number {
  if (remap.length !== BUTTON_REMAP_COUNT || remap[reported] === reported) {
    return reported;
  }

  // The reported control is mapped elsewhere, so the press came from whichever
  // source targets it. Several sources can share a target; the first one wins.
  const source = remap.indexOf(reported);
  return source >= 0 ? source : reported;
}

function collectBits(pressed: number[], bits: number, buttonIds: readonly (number | null)[]) {
  buttonIds.forEach((button, bit) => {
    if (button !== null && (bits & (1 << bit)) !== 0) {
      pressed.push(button);
    }
  });
}
