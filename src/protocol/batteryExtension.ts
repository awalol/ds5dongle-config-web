import {
  CONFIG_BODY_SIZE,
  ConfigBody,
  FEATURE_REPORT_PAYLOAD_SIZE,
  decodeConfigBodyWithOffset,
} from "./config";

const BF_MAGIC_B = 0x42;
const BF_MAGIC_F = 0x46;
const BF_VERSION = 1;
const BF_TAIL_SIZE = 5;

export type BatterySaveStatus = 0 | 1 | 2;

export interface BatteryFeedbackExtension {
  enabled: boolean;
  saveStatus: BatterySaveStatus;
}

export interface ConfigSnapshot {
  config: ConfigBody;
  batteryFeedback: BatteryFeedbackExtension | null;
}

export class BatteryExtensionError extends Error {
  constructor() {
    super("invalidBatteryExtension");
    this.name = "BatteryExtensionError";
  }
}

export function decodeConfigSnapshot(source: ArrayBuffer | DataView | Uint8Array): ConfigSnapshot {
  const bytes = toUint8Array(source);
  const { config, offset } = decodeConfigBodyWithOffset(bytes);
  if (offset === 1 && bytes[0] !== 0xf7) throw new BatteryExtensionError();
  const tailOffset = offset + CONFIG_BODY_SIZE;

  // Older firmware and WebHID descriptor padding have no BF marker at this
  // exact position. A partial or invalid marker is a protocol error.
  if (bytes[tailOffset] !== BF_MAGIC_B) {
    return { config, batteryFeedback: null };
  }
  if (
    bytes.length - tailOffset < BF_TAIL_SIZE ||
    bytes[tailOffset + 1] !== BF_MAGIC_F ||
    bytes[tailOffset + 2] !== BF_VERSION ||
    (bytes[tailOffset + 3] & ~1) !== 0 ||
    bytes[tailOffset + 4] > 2
  ) {
    throw new BatteryExtensionError();
  }

  return {
    config,
    batteryFeedback: {
      enabled: bytes[tailOffset + 3] === 1,
      saveStatus: bytes[tailOffset + 4] as BatterySaveStatus,
    },
  };
}

export function encodeBatteryFeedbackCommand(enabled: boolean): Uint8Array<ArrayBuffer> {
  const payload = new Uint8Array(new ArrayBuffer(FEATURE_REPORT_PAYLOAD_SIZE));
  payload.set([0x05, BF_MAGIC_B, BF_MAGIC_F, BF_VERSION, enabled ? 1 : 0]);
  return payload;
}

function toUint8Array(source: ArrayBuffer | DataView | Uint8Array): Uint8Array {
  if (source instanceof Uint8Array) return source;
  if (source instanceof DataView) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  return new Uint8Array(source);
}
