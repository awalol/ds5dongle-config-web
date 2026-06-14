export const CONFIG_BODY_VERSION = 3;
export const CONFIG_BODY_SIZE = 20;
export const FEATURE_REPORT_PAYLOAD_SIZE = 63;

export type PollingRateMode = 0 | 1 | 2;
export type ControllerMode = 0 | 1 | 2;

export interface ConfigBody {
  hapticsGain: number;
  speakerVolume: number;
  headsetVolume: number;
  syncSpeakerHeadsetVolume: boolean;
  speakerGain: number;
  inactiveTime: number;
  disableInactiveDisconnect: boolean;
  disablePicoLed: boolean;
  pollingRateMode: PollingRateMode;
  audioBufferLength: number;
  controllerMode: ControllerMode;
  lockVolume: boolean;
  disableUsbSn: boolean;
  psShortcutEnabled: boolean;
  disableMic: boolean;
  disableSpeaker: boolean;
}

export interface ConfigValidationIssue {
  field: keyof ConfigBody;
}

export const DEFAULT_CONFIG: ConfigBody = {
  hapticsGain: 1,
  speakerVolume: 0,
  headsetVolume: 0,
  syncSpeakerHeadsetVolume: false,
  speakerGain: 2,
  inactiveTime: 10,
  disableInactiveDisconnect: false,
  disablePicoLed: false,
  pollingRateMode: 0,
  audioBufferLength: 64,
  controllerMode: 2,
  lockVolume: false,
  disableUsbSn: false,
  psShortcutEnabled: false,
  disableMic: false,
  disableSpeaker: false,
};

export const POLLING_RATE_OPTIONS: Array<{
  value: PollingRateMode;
  label: string;
}> = [
  { value: 0, label: "250 Hz" },
  { value: 1, label: "500 Hz" },
  { value: 2, label: "Real-Time" },
];

export const CONTROLLER_MODE_OPTIONS: Array<{
  value: ControllerMode;
}> = [
  { value: 0 },
  { value: 1 },
  { value: 2 },
];

export function decodeConfigBody(source: ArrayBuffer | DataView | Uint8Array): ConfigBody {
  const bytes = toUint8Array(source);
  const candidates = bytes.byteLength >= CONFIG_BODY_SIZE + 1 ? [0, 1] : [0];
  const parsed = candidates
    .map((offset) => decodeAt(bytes, offset))
    .filter((candidate): candidate is DecodedConfigCandidate => Boolean(candidate));
  const versionMatched = parsed.filter(({ version }) => version === CONFIG_BODY_VERSION);
  const valid = versionMatched.find(({ config }) => validateConfig(config).length === 0);

  if (valid) {
    return valid.config;
  }

  if (versionMatched[0]) {
    throw new ConfigDecodeError("invalidConfig", {
      issues: validateConfig(versionMatched[0].config).map((issue) => issue.field),
    });
  }

  if (parsed[0]) {
    throw new ConfigDecodeError("versionMismatch", {
      actual: uniqueVersions(parsed.map(({ version }) => version)).join(", "),
      expected: CONFIG_BODY_VERSION,
    });
  }

  throw new ConfigDecodeError("invalidBytes", {
    count: bytes.byteLength,
    expected: CONFIG_BODY_SIZE,
  });
}

export function encodeConfigBody(config: ConfigBody): Uint8Array<ArrayBuffer> {
  const issues = validateConfig(config);
  if (issues.length > 0) {
    throw new ConfigDecodeError("invalidConfig", {
      issues: issues.map((issue) => issue.field),
    });
  }

  const bytes = new Uint8Array(new ArrayBuffer(CONFIG_BODY_SIZE));
  const view = new DataView(bytes.buffer);
  view.setUint8(0, CONFIG_BODY_VERSION);
  view.setFloat32(1, config.hapticsGain, true);
  view.setUint8(5, config.speakerVolume);
  view.setUint8(6, config.headsetVolume);
  view.setUint8(7, config.syncSpeakerHeadsetVolume ? 1 : 0);
  view.setUint8(8, config.speakerGain);
  view.setUint8(9, config.inactiveTime);
  view.setUint8(10, config.disableInactiveDisconnect ? 1 : 0);
  view.setUint8(11, config.disablePicoLed ? 1 : 0);
  view.setUint8(12, config.pollingRateMode);
  view.setUint8(13, config.audioBufferLength);
  view.setUint8(14, config.controllerMode);
  view.setUint8(15, config.lockVolume ? 1 : 0);
  view.setUint8(16, config.disableUsbSn ? 1 : 0);
  view.setUint8(17, config.psShortcutEnabled ? 1 : 0);
  view.setUint8(18, config.disableMic ? 1 : 0);
  view.setUint8(19, config.disableSpeaker ? 1 : 0);
  return bytes;
}

export function validateConfig(config: ConfigBody): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];

  if (!Number.isFinite(config.hapticsGain) || config.hapticsGain < 1 || config.hapticsGain > 2) {
    issues.push({ field: "hapticsGain" });
  }

  if (!Number.isInteger(config.speakerVolume) || config.speakerVolume < 0 || config.speakerVolume > 127) {
    issues.push({ field: "speakerVolume" });
  }

  if (!Number.isInteger(config.headsetVolume) || config.headsetVolume < 0 || config.headsetVolume > 127) {
    issues.push({ field: "headsetVolume" });
  }

  if (!Number.isInteger(config.speakerGain) || config.speakerGain < 0 || config.speakerGain > 7) {
    issues.push({ field: "speakerGain" });
  }

  if (!Number.isInteger(config.inactiveTime) || config.inactiveTime < 5 || config.inactiveTime > 60) {
    issues.push({ field: "inactiveTime" });
  }

  if (!Number.isInteger(config.pollingRateMode) || config.pollingRateMode < 0 || config.pollingRateMode > 2) {
    issues.push({ field: "pollingRateMode" });
  }

  if (
    !Number.isInteger(config.audioBufferLength) ||
    config.audioBufferLength < 16 ||
    config.audioBufferLength > 128
  ) {
    issues.push({ field: "audioBufferLength" });
  }

  if (!Number.isInteger(config.controllerMode) || config.controllerMode < 0 || config.controllerMode > 2) {
    issues.push({ field: "controllerMode" });
  }

  return issues;
}

export function normalizeConfig(config: ConfigBody): ConfigBody {
  const speakerVolume = clampInteger(config.speakerVolume, 0, 127);

  return {
    hapticsGain: roundToStep(config.hapticsGain, 0.01),
    speakerVolume,
    headsetVolume: config.syncSpeakerHeadsetVolume ? speakerVolume : clampInteger(config.headsetVolume, 0, 127),
    syncSpeakerHeadsetVolume: Boolean(config.syncSpeakerHeadsetVolume),
    speakerGain: clampInteger(config.speakerGain, 0, 7),
    inactiveTime: clampInteger(config.inactiveTime, 5, 60),
    disableInactiveDisconnect: Boolean(config.disableInactiveDisconnect),
    disablePicoLed: Boolean(config.disablePicoLed),
    pollingRateMode: clampInteger(config.pollingRateMode, 0, 2) as PollingRateMode,
    audioBufferLength: clampInteger(config.audioBufferLength, 16, 128),
    controllerMode: clampInteger(config.controllerMode, 0, 2) as ControllerMode,
    lockVolume: Boolean(config.lockVolume),
    disableUsbSn: Boolean(config.disableUsbSn),
    psShortcutEnabled: Boolean(config.psShortcutEnabled),
    disableMic: Boolean(config.disableMic),
    disableSpeaker: Boolean(config.disableSpeaker),
  };
}

export function configsEqual(left: ConfigBody | null, right: ConfigBody | null): boolean {
  if (!left || !right) {
    return left === right;
  }

  return (
    Math.abs(left.hapticsGain - right.hapticsGain) < 0.001 &&
    left.speakerVolume === right.speakerVolume &&
    left.headsetVolume === right.headsetVolume &&
    left.syncSpeakerHeadsetVolume === right.syncSpeakerHeadsetVolume &&
    left.speakerGain === right.speakerGain &&
    left.inactiveTime === right.inactiveTime &&
    left.disableInactiveDisconnect === right.disableInactiveDisconnect &&
    left.disablePicoLed === right.disablePicoLed &&
    left.pollingRateMode === right.pollingRateMode &&
    left.audioBufferLength === right.audioBufferLength &&
    left.controllerMode === right.controllerMode &&
    left.lockVolume === right.lockVolume &&
    left.disableUsbSn === right.disableUsbSn &&
    left.psShortcutEnabled === right.psShortcutEnabled &&
    left.disableMic === right.disableMic &&
    left.disableSpeaker === right.disableSpeaker
  );
}

export function fieldIssue(
  issues: ConfigValidationIssue[],
  field: keyof ConfigBody,
): ConfigValidationIssue | undefined {
  return issues.find((issue) => issue.field === field);
}

export class ConfigDecodeError extends Error {
  constructor(
    public readonly code: "invalidConfig" | "invalidBytes" | "versionMismatch",
    public readonly values: Record<string, unknown>,
  ) {
    super(code);
    this.name = "ConfigDecodeError";
  }
}

interface DecodedConfigCandidate {
  version: number;
  config: ConfigBody;
}

function decodeAt(bytes: Uint8Array, offset: number): DecodedConfigCandidate | null {
  if (bytes.byteLength - offset < CONFIG_BODY_SIZE) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, CONFIG_BODY_SIZE);
  return {
    version: view.getUint8(0),
    config: {
      hapticsGain: view.getFloat32(1, true),
      speakerVolume: view.getUint8(5),
      headsetVolume: view.getUint8(6),
      syncSpeakerHeadsetVolume: view.getUint8(7) === 1,
      speakerGain: view.getUint8(8),
      inactiveTime: view.getUint8(9),
      disableInactiveDisconnect: view.getUint8(10) === 1,
      disablePicoLed: view.getUint8(11) === 1,
      pollingRateMode: view.getUint8(12) as PollingRateMode,
      audioBufferLength: view.getUint8(13),
      controllerMode: view.getUint8(14) as ControllerMode,
      lockVolume: view.getUint8(15) === 1,
      disableUsbSn: view.getUint8(16) === 1,
      psShortcutEnabled: view.getUint8(17) === 1,
      disableMic: view.getUint8(18) === 1,
      disableSpeaker: view.getUint8(19) === 1,
    },
  };
}

function uniqueVersions(versions: number[]): number[] {
  return [...new Set(versions)];
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

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
