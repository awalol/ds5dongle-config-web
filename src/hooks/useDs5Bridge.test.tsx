// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { useDs5Bridge } from "./useDs5Bridge";

const CONFIG_BODY_SIZE = 22;

// A v5 F7 body with a 500 Hz baseline and non-default, hidden GPIO settings.
// These bytes are deliberately independent of encodeConfigBody.
function initialConfigBody(): Uint8Array {
  return new Uint8Array([
    5, 0, 0, 128, 63, 0, 0, 2, 30, 0, 1, 64, 2, 0, 0, 0, 0, 0, 0, 1, 27, 1,
  ]);
}

function bytesOf(source: BufferSource): Uint8Array {
  return ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength).slice()
    : new Uint8Array(source).slice();
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

class FakeBridgeDevice extends EventTarget implements HIDDevice {
  opened = false;
  readonly vendorId = 0x054c;
  readonly productId = 0x0ce6;
  readonly productName = "DS5 Bridge test device";
  readonly collections = [{ usagePage: 0x01, usage: 0x05 }];
  readonly sent: Array<{ reportId: number; bytes: Uint8Array }> = [];
  f7Reads = 0;
  clampMode3 = false;
  firstUpdateGate: Promise<void> | null = null;
  private body = initialConfigBody();

  setAudioBufferLength(length: number): void {
    this.body[11] = length;
  }

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
  }

  async receiveFeatureReport(reportId: number): Promise<DataView> {
    if (reportId === 0xf7) {
      this.f7Reads += 1;
      return new DataView(this.body.slice().buffer);
    }

    if (reportId === 0xf8) {
      return new DataView(new TextEncoder().encode("test-firmware").buffer);
    }

    if (reportId === 0xf9) {
      return new DataView(new Uint8Array([0xd8, 0x80]).buffer);
    }

    throw new Error(`Unexpected feature report 0x${reportId.toString(16)}`);
  }

  async sendFeatureReport(reportId: number, data: BufferSource): Promise<void> {
    const bytes = bytesOf(data);
    this.sent.push({ reportId, bytes });

    if (reportId !== 0xf6 || bytes[0] !== 1) {
      return;
    }

    if (this.updateReports().length === 1 && this.firstUpdateGate) {
      await this.firstUpdateGate;
    }

    this.body = bytes.slice(1, CONFIG_BODY_SIZE + 1);
    if (this.clampMode3 && this.body[10] === 3) {
      this.body[10] = 1;
    }
  }

  updateReports(): Uint8Array[] {
    return this.sent.filter(({ reportId, bytes }) => reportId === 0xf6 && bytes[0] === 1).map(({ bytes }) => bytes);
  }
}

const originalHidDescriptor = Object.getOwnPropertyDescriptor(navigator, "hid");

async function connectedHook(device: FakeBridgeDevice) {
  const hid = Object.assign(new EventTarget(), {
    getDevices: async () => [device],
    requestDevice: async () => [device],
  }) as HID;
  Object.defineProperty(navigator, "hid", { configurable: true, value: hid });

  const hook = renderHook(() => useDs5Bridge());
  await act(async () => {
    await hook.result.current.connectAuthorized(device);
  });
  await waitFor(() => expect(hook.result.current.config?.pollingRateMode).toBe(1));
  expect(device.f7Reads).toBe(1);
  return hook;
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
  if (originalHidDescriptor) {
    Object.defineProperty(navigator, "hid", originalHidDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "hid");
  }
});

describe("useDs5Bridge 1000 Hz apply flow", () => {
  it("preserves a firmware-accepted 128-byte audio buffer when applying mode 3", async () => {
    const device = new FakeBridgeDevice();
    device.setAudioBufferLength(128);
    const hook = await connectedHook(device);

    expect(hook.result.current.config?.audioBufferLength).toBe(128);
    act(() => hook.result.current.setDraftField("pollingRateMode", 3));
    await waitFor(() => expect(hook.result.current.config?.pollingRateMode).toBe(3));
    expect(device.updateReports()[0][12]).toBe(128);
    expect(hook.result.current.draft.audioBufferLength).toBe(128);
  });

  it("sends a complete F6 update and reads F7 back only for mode 3", async () => {
    const device = new FakeBridgeDevice();
    const hook = await connectedHook(device);

    act(() => hook.result.current.setDraftField("speakerVolume", 48));
    await waitFor(() => expect(hook.result.current.config?.speakerVolume).toBe(48));
    await waitFor(() => expect(hook.result.current.operation).toBeNull());
    expect(device.f7Reads).toBe(1);

    act(() => hook.result.current.setDraftField("pollingRateMode", 2));
    await waitFor(() => expect(hook.result.current.config?.pollingRateMode).toBe(2));
    await waitFor(() => expect(hook.result.current.operation).toBeNull());
    expect(device.f7Reads).toBe(1);

    act(() => hook.result.current.setDraftField("pollingRateMode", 3));
    await waitFor(() => expect(device.f7Reads).toBe(2));
    await waitFor(() => expect(hook.result.current.config?.pollingRateMode).toBe(3));

    const reports = device.updateReports();
    expect(reports).toHaveLength(3);
    expect(reports[2]).toHaveLength(63);
    expect(reports[2][0]).toBe(1);
    expect(reports[2][11]).toBe(3); // Config_body polling_rate_mode at offset 10.
    expect(reports[2][6]).toBe(48);
    expect(Array.from(reports[2].slice(20, 23))).toEqual([1, 27, 1]);
  });

  it("keeps the reconnect prompt until the user sends the explicit reconnect command", async () => {
    const device = new FakeBridgeDevice();
    const hook = await connectedHook(device);

    act(() => hook.result.current.setDraftField("pollingRateMode", 3));
    await waitFor(() => expect(hook.result.current.config?.pollingRateMode).toBe(3));
    expect(hook.result.current.needsUsbReconnect).toBe(true);
    expect(device.sent.some(({ bytes }) => bytes[0] === 3)).toBe(false);

    await act(async () => hook.result.current.reconnectUsb());
    const lastReport = device.sent[device.sent.length - 1];
    expect(lastReport.reportId).toBe(0xf6);
    expect(lastReport.bytes).toHaveLength(63);
    expect(lastReport.bytes[0]).toBe(3);
    expect(hook.result.current.needsUsbReconnect).toBe(false);
  });

  it("uses the legacy firmware's actual mode and preserves a queued unrelated edit", async () => {
    const device = new FakeBridgeDevice();
    device.clampMode3 = true;
    const gate = deferred();
    device.firstUpdateGate = gate.promise;
    const hook = await connectedHook(device);

    act(() => hook.result.current.setDraftField("pollingRateMode", 3));
    await waitFor(() => expect(device.updateReports()).toHaveLength(1));
    act(() => hook.result.current.setDraftField("speakerVolume", 49));
    gate.resolve();

    await waitFor(() => expect(hook.result.current.config?.speakerVolume).toBe(49));
    await waitFor(() => expect(hook.result.current.operation).toBeNull());
    expect(device.f7Reads).toBe(2);
    expect(hook.result.current.config?.pollingRateMode).toBe(1);
    expect(hook.result.current.draft.pollingRateMode).toBe(1);
    expect(hook.result.current.draft.speakerVolume).toBe(49);
    expect(hook.result.current.needsUsbReconnect).toBe(false);
    expect(hook.result.current.error).toBe("The device did not accept 1000 Hz mode. New firmware is required.");
    expect(device.updateReports().map((report) => report[11])).toEqual([3, 1]);
    expect(device.sent.some(({ bytes }) => bytes[0] === 2 || bytes[0] === 3)).toBe(false);
  });
});
