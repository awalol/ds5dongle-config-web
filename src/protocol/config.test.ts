import { describe, expect, it } from "vitest";

import {
  CONFIG_BODY_SIZE,
  DEFAULT_CONFIG,
  POLLING_RATE_OPTIONS,
  configsEqual,
  decodeConfigBody,
  encodeConfigBody,
  normalizeConfig,
  validateConfig,
} from "./config";

// A v5 Config_body from the firmware layout. The last three bytes are hidden
// from this UI, but must survive a read/change/write cycle.
const configWithHiddenFields = new Uint8Array([
  5, 0, 0, 128, 63, 0, 0, 2, 30, 0, 1, 64, 2, 0, 0, 0, 0, 0, 0, 1, 22, 1,
]);

describe("v5 firmware configuration", () => {
  it("accepts mode 3 as a fourth polling option and keeps it during normalization", () => {
    const config = { ...DEFAULT_CONFIG, pollingRateMode: 3 as const };

    expect(POLLING_RATE_OPTIONS.map(({ value }) => value)).toEqual([0, 1, 2, 3]);
    expect(validateConfig(config)).toEqual([]);
    expect(normalizeConfig(config).pollingRateMode).toBe(3);
    expect(encodeConfigBody(config)[10]).toBe(3);
  });

  it("preserves hidden v5 tail bytes when reading and writing the same configuration", () => {
    const decoded = decodeConfigBody(configWithHiddenFields);

    expect(CONFIG_BODY_SIZE).toBe(22);
    expect(decoded.lockVolume).toBe(true);
    expect(decoded.statusGpioPin).toBe(22);
    expect(decoded.statusGpioMode).toBe(1);
    expect(encodeConfigBody(decoded)).toEqual(configWithHiddenFields);
  });

  it("keeps hidden fields through normalization and considers them in equality", () => {
    const decoded = decodeConfigBody(configWithHiddenFields);
    const normalized = normalizeConfig(decoded);

    expect(normalized.lockVolume).toBe(true);
    expect(normalized.statusGpioPin).toBe(22);
    expect(normalized.statusGpioMode).toBe(1);
    expect(configsEqual(decoded, normalized)).toBe(true);
    expect(configsEqual(decoded, { ...decoded, statusGpioPin: 23 })).toBe(false);
    expect(configsEqual(decoded, { ...decoded, lockVolume: false })).toBe(false);
    expect(configsEqual(decoded, { ...decoded, statusGpioMode: 0 })).toBe(false);
  });

  it("decodes a WebHID feature report with a report ID prefix and a full v5 body", () => {
    const report = new Uint8Array(63);
    report[0] = 0xf7;
    report.set(configWithHiddenFields, 1);

    expect(decodeConfigBody(report).statusGpioPin).toBe(22);
  });

  it("preserves the firmware's four mic and speaker selections instead of collapsing them to booleans", () => {
    const report = new Uint8Array(configWithHiddenFields);
    report[15] = 1; // Built-in microphone
    report[16] = 2; // Headphone speaker

    const decoded = decodeConfigBody(report);
    expect(decoded.micSelect).toBe(1);
    expect(decoded.speakerSelect).toBe(2);
    expect(normalizeConfig(decoded).speakerSelect).toBe(2);
    expect(encodeConfigBody(decoded)).toEqual(report);

    const disabled = { ...decoded, micSelect: 3 as const, speakerSelect: 3 as const };
    expect(encodeConfigBody(disabled).slice(15, 17)).toEqual(new Uint8Array([3, 3]));
  });

  it("accepts firmware's valid 128-byte audio buffer setting without changing it", () => {
    const report = new Uint8Array(configWithHiddenFields);
    report[11] = 128;

    const decoded = decodeConfigBody(report);
    expect(decoded.audioBufferLength).toBe(128);
    expect(normalizeConfig(decoded).audioBufferLength).toBe(128);
    expect(encodeConfigBody(decoded)).toEqual(report);
  });

  it("rejects polling modes beyond 3 and out-of-range hidden values before encoding", () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, pollingRateMode: 4 as 3 })).toContainEqual({
      field: "pollingRateMode",
    });
    expect(validateConfig({ ...DEFAULT_CONFIG, statusGpioPin: 256 })).toContainEqual({
      field: "statusGpioPin",
    });
    expect(validateConfig({ ...DEFAULT_CONFIG, statusGpioMode: 2 })).toContainEqual({
      field: "statusGpioMode",
    });
    expect(validateConfig({ ...DEFAULT_CONFIG, micSelect: 4 as 3 })).toContainEqual({
      field: "micSelect",
    });
    expect(validateConfig({ ...DEFAULT_CONFIG, speakerSelect: 4 as 3 })).toContainEqual({
      field: "speakerSelect",
    });
  });
});
