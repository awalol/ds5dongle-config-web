import {
  ConfigBody,
  FEATURE_REPORT_PAYLOAD_SIZE,
  decodeConfigBody,
  encodeConfigBody,
} from "./config";
import {
  ButtonProtocolError,
  ShortcutSlot,
  buttonRemapsEqual,
  decodeButtonRemap,
  decodeShortcutSlots,
  encodeButtonRemap,
  encodeShortcutSlots,
  REPORT_BUTTON_REMAP,
  REPORT_BUTTON_SHORTCUT,
  shortcutSlotsEqual,
} from "./buttons";

export const SONY_VENDOR_ID = 0x054c;
export const DUALSENSE_PRODUCT_ID = 0x0ce6;
export const DUALSENSE_EDGE_PRODUCT_ID = 0x0df2;
export const SUPPORTED_PRODUCT_IDS = [DUALSENSE_PRODUCT_ID, DUALSENSE_EDGE_PRODUCT_ID] as const;
export const NO_DEVICE_SELECTED_ERROR = "noDeviceSelected";
export const WEBHID_UNAVAILABLE_ERROR = "webHidUnavailable";

export type ControllerModel = "dualsense" | "dualsense-edge";

const GENERIC_DESKTOP_USAGE_PAGE = 0x01;
const GAMEPAD_USAGE = 0x05;
const REPORT_SET_CONFIG = 0xf6;
const REPORT_GET_CONFIG = 0xf7;
const REPORT_GET_FIRMWARE_VERSION = 0xf8;
const REPORT_GET_SIGNAL_STRENGTH = 0xf9;
const CMD_UPDATE_CONFIG = 0x01;
const CMD_SAVE_TO_FLASH = 0x02;
const CMD_RECONNECT_USB = 0x03;
const CMD_SHORTCUT_LEARNING = 0x05;
const HID_SET_REPORT_DELAY_MS = 50;

export interface AudioActivityState {
  speakerActive: boolean;
  micActive: boolean;
}

export interface SignalStrengthReport {
  rssi: number | null;
  audioActivity: AudioActivityState | null;
}

export class Ds5BridgeHidClient {
  constructor(public readonly device: HIDDevice) {}

  static isSupportedDevice(device: HIDDevice): boolean {
    return (
      device.vendorId === SONY_VENDOR_ID &&
      SUPPORTED_PRODUCT_IDS.includes(device.productId as 0x0ce6 | 0x0df2) &&
      device.collections.some(isGamepadCollection)
    );
  }

  static async requestDevice(): Promise<Ds5BridgeHidClient> {
    const hid = getHid();
    const devices = await hid.requestDevice({
      filters: SUPPORTED_PRODUCT_IDS.map((productId) => ({
        vendorId: SONY_VENDOR_ID,
        productId,
        usagePage: GENERIC_DESKTOP_USAGE_PAGE,
        usage: GAMEPAD_USAGE,
      })),
    });

    const device = devices.find(Ds5BridgeHidClient.isSupportedDevice);
    if (!device) {
      throw new Error(NO_DEVICE_SELECTED_ERROR);
    }

    return new Ds5BridgeHidClient(device);
  }

  static async authorizedDevices(): Promise<HIDDevice[]> {
    const devices = await getHid().getDevices();
    return devices.filter(Ds5BridgeHidClient.isSupportedDevice);
  }

  async open(): Promise<void> {
    if (!this.device.opened) {
      await this.device.open();
    }
  }

  async close(): Promise<void> {
    if (this.device.opened) {
      await this.device.close();
    }
  }

  async readConfig(): Promise<ConfigBody> {
    await this.open();
    const report = await this.device.receiveFeatureReport(REPORT_GET_CONFIG);
    return decodeConfigBody(report);
  }

  async readFirmwareVersion(): Promise<string> {
    await this.open();
    const report = await this.device.receiveFeatureReport(REPORT_GET_FIRMWARE_VERSION);
    return decodeFirmwareVersion(report);
  }

  async readSignalStrength(): Promise<SignalStrengthReport> {
    await this.open();
    const report = await this.device.receiveFeatureReport(REPORT_GET_SIGNAL_STRENGTH);
    return decodeSignalStrength(report);
  }

  async readButtonRemap(): Promise<number[]> {
    await this.open();
    return decodeButtonRemap(await this.device.receiveFeatureReport(REPORT_BUTTON_REMAP));
  }

  async readShortcuts(): Promise<ShortcutSlot[]> {
    await this.open();
    return decodeShortcutSlots(await this.device.receiveFeatureReport(REPORT_BUTTON_SHORTCUT));
  }

  async applyConfig(config: ConfigBody): Promise<ConfigBody> {
    await this.open();
    const body = encodeConfigBody(config);
    const report = commandReport(CMD_UPDATE_CONFIG);
    report.set(body, 1);
    await this.device.sendFeatureReport(REPORT_SET_CONFIG, report);
    await settleFeatureReport();
    return this.readConfig();
  }

  async applyButtonRemap(remap: readonly number[]): Promise<number[]> {
    await this.open();
    // The HID descriptor declares report 0xFA as a 63-byte feature report.
    // Pad the 28-byte remap table because some host HID stacks reject short writes.
    const report = new Uint8Array(new ArrayBuffer(FEATURE_REPORT_PAYLOAD_SIZE));
    report.set(encodeButtonRemap(remap));
    await this.device.sendFeatureReport(REPORT_BUTTON_REMAP, report);
    await settleFeatureReport();

    const applied = await this.readButtonRemap();
    if (!buttonRemapsEqual(applied, remap)) {
      throw new ButtonProtocolError("remapVerificationFailed", {});
    }

    await this.saveToFlash();
    return this.readButtonRemap();
  }

  async applyShortcuts(shortcuts: readonly ShortcutSlot[]): Promise<ShortcutSlot[]> {
    await this.open();
    await this.device.sendFeatureReport(REPORT_BUTTON_SHORTCUT, encodeShortcutSlots(shortcuts));
    await settleFeatureReport();

    const applied = await this.readShortcuts();
    if (!shortcutSlotsEqual(applied, shortcuts)) {
      throw new ButtonProtocolError("shortcutVerificationFailed", {});
    }

    await this.saveToFlash();
    return this.readShortcuts();
  }

  async saveToFlash(): Promise<void> {
    await this.open();
    await this.device.sendFeatureReport(REPORT_SET_CONFIG, commandReport(CMD_SAVE_TO_FLASH));
    await settleFeatureReport();
  }

  async reconnectUsb(): Promise<void> {
    await this.open();
    await this.device.sendFeatureReport(REPORT_SET_CONFIG, commandReport(CMD_RECONNECT_USB));
  }

  /**
   * Tells the firmware that the UI is capturing a controller trigger, so it
   * pauses shortcut output and the captured press does not fire its own action.
   * The firmware window is fixed at five seconds and cannot be cancelled.
   */
  async startShortcutLearning(): Promise<void> {
    await this.open();
    await this.device.sendFeatureReport(
      REPORT_SET_CONFIG,
      commandReport(CMD_SHORTCUT_LEARNING, 0x01),
    );
  }
}

export function webHidAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.hid);
}

export function getDeviceLabel(device: HIDDevice | null): string {
  if (!device) {
    return "No device";
  }

  const productId = device.productId.toString(16).padStart(4, "0").toUpperCase();
  return `${device.productName || "DS5 Bridge"} · 054C:${productId}`;
}

export function getControllerModel(device: HIDDevice | null): ControllerModel | null {
  if (!device) {
    return null;
  }

  return device.productId === DUALSENSE_EDGE_PRODUCT_ID ? "dualsense-edge" : "dualsense";
}

function getHid(): HID {
  if (!navigator.hid) {
    throw new Error(WEBHID_UNAVAILABLE_ERROR);
  }

  return navigator.hid;
}

function isGamepadCollection(collection: HIDCollectionInfo): boolean {
  return collection.usagePage === GENERIC_DESKTOP_USAGE_PAGE && collection.usage === GAMEPAD_USAGE;
}

function commandReport(command: number, payload = 0x00): Uint8Array<ArrayBuffer> {
  const report = new Uint8Array(new ArrayBuffer(FEATURE_REPORT_PAYLOAD_SIZE));
  report[0] = command;
  report[1] = payload;
  return report;
}

function settleFeatureReport(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, HID_SET_REPORT_DELAY_MS));
}

function decodeFirmwareVersion(source: ArrayBuffer | DataView | Uint8Array): string {
  const bytes = trimTrailingZeros(toUint8Array(source));
  const candidates = [bytes];

  if (bytes[0] === REPORT_GET_FIRMWARE_VERSION) {
    candidates.push(bytes.slice(1));
  }

  for (const candidate of candidates) {
    const version = decodePrintableString(candidate);
    if (version) {
      return version;
    }
  }

  return bytes.length > 0 ? Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ") : "";
}

function decodePrintableString(bytes: Uint8Array): string {
  const text = new TextDecoder().decode(bytes).replace(/\0/g, "").trim();
  return /^[\x20-\x7e]+$/.test(text) ? text : "";
}

function decodeSignalStrength(source: ArrayBuffer | DataView | Uint8Array): SignalStrengthReport {
  const bytes = toUint8Array(source);
  const offsets = bytes[0] === REPORT_GET_SIGNAL_STRENGTH ? [1, 0] : [0];
  const candidates = offsets
    .filter((offset) => offset < bytes.length)
    .map((offset) => decodeSignalStrengthAtOffset(bytes, offset))
    .filter((candidate) => candidate.rssi !== null);

  const candidateWithAudioActivity = candidates.find((candidate) => candidate.audioActivity);
  if (candidateWithAudioActivity) {
    return candidateWithAudioActivity;
  }

  const preferredCandidate = candidates[0];
  if (preferredCandidate) {
    return preferredCandidate;
  }

  return {
    rssi: null,
    audioActivity: null,
  };
}

function decodeSignalStrengthAtOffset(bytes: Uint8Array, offset: number): SignalStrengthReport {
  const rssi = toInt8(bytes[offset]);
  const flags = bytes[offset + 1];

  return {
    rssi: rssi >= -128 && rssi <= 0 ? rssi : null,
    audioActivity:
      flags === undefined || !isAudioActivityFlags(flags)
        ? null
        : {
            speakerActive: Boolean(flags & 0x02),
            micActive: Boolean(flags & 0x01),
          },
  };
}

function isAudioActivityFlags(flags: number): boolean {
  return (flags & 0x80) !== 0 && (flags & 0x7c) === 0;
}

function toInt8(byte: number): number {
  return byte > 0x7f ? byte - 0x100 : byte;
}

function trimTrailingZeros(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) {
    end -= 1;
  }

  return bytes.slice(0, end);
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
