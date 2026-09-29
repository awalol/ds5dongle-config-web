import { describe, expect, it } from "vitest";
import { decodeConfigSnapshot, encodeBatteryFeedbackCommand } from "./batteryExtension";

const body = new Uint8Array([
  5, 0, 0, 128, 63, 0, 0, 2, 30, 0, 1, 64, 2, 0, 0, 0, 0, 0, 0, 1, 27, 1,
]);

function framed(tail: number[], withReportId = false, padding = 0): Uint8Array {
  const bytes = new Uint8Array((withReportId ? 1 : 0) + body.length + tail.length + padding);
  const offset = withReportId ? 1 : 0;
  if (withReportId) bytes[0] = 0xf7;
  bytes.set(body, offset);
  bytes.set(tail, offset + body.length);
  return bytes;
}

describe("battery feedback F7 extension", () => {
  it("finds the tail after the validated v5 body in padded WebHID views", () => {
    for (const prefix of [false, true]) {
      const report = framed([0x42, 0x46, 1, 1, 2], prefix, 36);
      const backing = new Uint8Array(report.length + 8);
      backing.set(report, 5);
      const snapshot = decodeConfigSnapshot(new DataView(backing.buffer, 5, report.length));
      expect(snapshot.config.statusGpioPin).toBe(27);
      expect(snapshot.batteryFeedback).toEqual({ enabled: true, saveStatus: 2 });
    }
  });

  it("treats a missing marker, including descriptor padding, as old firmware", () => {
    expect(decodeConfigSnapshot(framed([], false, 41)).batteryFeedback).toBeNull();
    expect(decodeConfigSnapshot(framed([], true, 40)).batteryFeedback).toBeNull();
  });

  it("rejects an offset-one body with a prefix other than F7", () => {
    const report = framed([0x42, 0x46, 1, 1, 1], true);
    report[0] = 0xa5;
    expect(() => decodeConfigSnapshot(report)).toThrow();
  });

  it.each([
    { tail: [0x42] },
    { tail: [0x42, 0x46] },
    { tail: [0x42, 0x46, 2, 0, 0] },
    { tail: [0x42, 0x46, 1, 2, 0] },
    { tail: [0x42, 0x46, 1, 0, 3] },
    { tail: [0x42, 0x41, 1, 0, 0] },
  ])("rejects a malformed present marker $tail", ({ tail }) => {
    expect(() => decodeConfigSnapshot(framed(tail))).toThrow();
  });

  it("encodes the exact 63-byte F6/05 command with only the single flag bit", () => {
    for (const [enabled, flag] of [[false, 0], [true, 1]] as const) {
      const command = encodeBatteryFeedbackCommand(enabled);
      expect(command).toHaveLength(63);
      expect(Array.from(command.slice(0, 5))).toEqual([5, 0x42, 0x46, 1, flag]);
      expect(command.slice(5).every((byte) => byte === 0)).toBe(true);
    }
  });
});
