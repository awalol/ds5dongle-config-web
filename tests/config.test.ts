import { describe, expect, test } from "bun:test";
import {
  CONFIG_BODY_SIZE,
  CONFIG_BODY_VERSION,
  DEFAULT_CONFIG,
  SINGLE_PACKET_BUFFER_THRESHOLD,
  configsEqual,
  decodeConfigBody,
  encodeConfigBody,
  normalizeConfig,
  shouldSuggestSinglePacket,
  validateConfig,
  type ConfigBody,
} from "../src/protocol/config";

const customized: ConfigBody = {
  ...DEFAULT_CONFIG,
  audioBufferLength: 20,
  pollingRateMode: 3,
  packetMode: 1,
  disconnectOnDock: true,
};

describe("config body wire layout", () => {
  test("keeps version 5 and extends the body to 24 bytes", () => {
    const bytes = encodeConfigBody(customized);

    expect(CONFIG_BODY_VERSION).toBe(5);
    expect(CONFIG_BODY_SIZE).toBe(24);
    expect(bytes.length).toBe(24);
    expect(bytes[0]).toBe(5);
    expect(bytes[22]).toBe(1); // packet_mode
    expect(bytes[23]).toBe(1); // disconnect_on_dock
  });

  test("round-trips the new packet fields, with and without a report id prefix", () => {
    expect(decodeConfigBody(encodeConfigBody(customized))).toEqual(customized);
    expect(decodeConfigBody(new Uint8Array([0xf7, ...encodeConfigBody(customized)]))).toEqual(customized);
  });

  test("accepts both the 1000 Hz and the real-time polling modes", () => {
    for (const pollingRateMode of [2, 3] as const) {
      const config: ConfigBody = { ...DEFAULT_CONFIG, pollingRateMode };

      expect(validateConfig(config)).toEqual([]);
      expect(decodeConfigBody(encodeConfigBody(config)).pollingRateMode).toBe(pollingRateMode);
    }
  });

  test("rejects polling and packet modes the firmware cannot store", () => {
    expect(
      validateConfig({ ...DEFAULT_CONFIG, pollingRateMode: 4 as ConfigBody["pollingRateMode"] }).map(
        (issue) => issue.field,
      ),
    ).toEqual(["pollingRateMode"]);
    expect(
      validateConfig({ ...DEFAULT_CONFIG, packetMode: 2 as ConfigBody["packetMode"] }).map((issue) => issue.field),
    ).toEqual(["packetMode"]);
  });

  test("normalizes stray values back into range", () => {
    const normalized = normalizeConfig({
      ...DEFAULT_CONFIG,
      pollingRateMode: 9 as ConfigBody["pollingRateMode"],
      packetMode: 7 as ConfigBody["packetMode"],
      disconnectOnDock: 1 as unknown as boolean,
    });

    expect(normalized.pollingRateMode).toBe(3);
    expect(normalized.packetMode).toBe(1);
    expect(normalized.disconnectOnDock).toBe(true);
  });

  test("compares the new fields when detecting unsaved edits", () => {
    expect(configsEqual(DEFAULT_CONFIG, { ...DEFAULT_CONFIG })).toBe(true);
    expect(configsEqual(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, packetMode: 1 })).toBe(false);
    expect(configsEqual(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, disconnectOnDock: true })).toBe(false);
  });
});

describe("single packet suggestion", () => {
  test("uses 32 as the threshold", () => {
    expect(SINGLE_PACKET_BUFFER_THRESHOLD).toBe(32);
  });

  test("suggests single packet only for small buffers in double packet mode", () => {
    const suggest = (audioBufferLength: number, packetMode: 0 | 1) =>
      shouldSuggestSinglePacket({ audioBufferLength, packetMode });

    expect(suggest(16, 0)).toBe(true);
    expect(suggest(31, 0)).toBe(true);
    expect(suggest(32, 0)).toBe(false);
    expect(suggest(31, 1)).toBe(false);
    expect(suggest(48, 0)).toBe(false);
  });
});
