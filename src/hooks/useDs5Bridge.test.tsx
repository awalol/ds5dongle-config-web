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
  firstBatteryUpdateGate: Promise<void> | null = null;
  firstReadGate: Promise<void> | null = null;
  failNextRead = false;
  batteryExtension = false;
  batteryEnabled = false;
  batterySaveStatus = 0;
  nextSaveStatus = 1;
  alterSavedConfig = false;
  rejectBatteryWrite = false;
  throwBatterySendAfterApply = false;
  changeBaseOnBatteryWrite = false;
  malformedBatteryTail = false;
  staleBatteryReads = 0;
  staleBaseReads = 0;
  staleSaveReads = 0;
  rejectBaseWrite = false;
  private staleSnapshot: Uint8Array | null = null;
  private staleReadsRemaining = 0;
  private body = initialConfigBody();

  private snapshotBytes(): Uint8Array {
    return this.batteryExtension
      ? new Uint8Array([...this.body, 0x42, 0x46, this.malformedBatteryTail ? 2 : 1,
        this.batteryEnabled ? 1 : 0, this.batterySaveStatus])
      : this.body.slice();
  }

  private staleForNextReads(count: number): void {
    if (count > 0) {
      this.staleSnapshot = this.snapshotBytes();
      this.staleReadsRemaining = count;
    }
  }

  setAudioBufferLength(length: number): void {
    this.body[11] = length;
  }

  setHapticsGain(gain: number): void {
    new DataView(this.body.buffer).setFloat32(1, gain, true);
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
      if (this.f7Reads === 1 && this.firstReadGate) await this.firstReadGate;
      if (this.failNextRead) {
        this.failNextRead = false;
        throw new Error("F7 read failed");
      }
      const data = this.staleReadsRemaining > 0 && this.staleSnapshot
        ? this.staleSnapshot.slice() : this.snapshotBytes();
      if (this.staleReadsRemaining > 0) this.staleReadsRemaining -= 1;
      return new DataView(data.buffer);
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

    if (reportId !== 0xf6) {
      return;
    }

    if (bytes[0] === 2) {
      this.staleForNextReads(this.staleSaveReads);
      this.batterySaveStatus = this.nextSaveStatus;
      if (this.alterSavedConfig) this.body[5] = 99;
      return;
    }

    if (bytes[0] === 5) {
      if (this.firstBatteryUpdateGate && this.batteryReports().length === 1) {
        await this.firstBatteryUpdateGate;
      }
      this.staleForNextReads(this.staleBatteryReads);
      if (this.rejectBatteryWrite) return;
      this.batteryEnabled = bytes[4] === 1;
      if (this.changeBaseOnBatteryWrite) this.body[5] = 99;
      this.batterySaveStatus = 0;
      if (this.throwBatterySendAfterApply) throw new Error("F6/05 transport failed");
      return;
    }

    if (bytes[0] !== 1) return;

    if (this.updateReports().length === 1 && this.firstUpdateGate) {
      await this.firstUpdateGate;
    }

    this.staleForNextReads(this.staleBaseReads);
    if (this.rejectBaseWrite) return;
    this.body = bytes.slice(1, CONFIG_BODY_SIZE + 1);
    this.batterySaveStatus = 0;
    if (this.clampMode3 && this.body[10] === 3) {
      this.body[10] = 1;
    }
  }

  updateReports(): Uint8Array[] {
    return this.sent.filter(({ reportId, bytes }) => reportId === 0xf6 && bytes[0] === 1).map(({ bytes }) => bytes);
  }

  batteryReports(): Uint8Array[] {
    return this.sent.filter(({ reportId, bytes }) => reportId === 0xf6 && bytes[0] === 5).map(({ bytes }) => bytes);
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
    expect(device.f7Reads).toBeGreaterThan(2);
    expect(device.f7Reads).toBeLessThan(20);
    expect(hook.result.current.config?.pollingRateMode).toBe(1);
    expect(hook.result.current.draft.pollingRateMode).toBe(1);
    expect(hook.result.current.draft.speakerVolume).toBe(49);
    expect(hook.result.current.needsUsbReconnect).toBe(false);
    expect(hook.result.current.error).toBe("The device did not accept 1000 Hz mode. New firmware is required.");
    expect(device.updateReports().map((report) => report[11])).toEqual([3, 1]);
    expect(device.sent.some(({ bytes }) => bytes[0] === 2 || bytes[0] === 3)).toBe(false);
  });
});

describe("useDs5Bridge battery feedback", () => {
  it("waits for a later real F7 after F6/05 initially reads the old flag", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.staleBatteryReads = 1;
    const hook = await connectedHook(device);

    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    await waitFor(() => expect(hook.result.current.batteryFeedbackApplied).toBe(true));
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.saveState).toBe("applied");
    expect(device.batteryReports()).toHaveLength(1);
    expect(device.f7Reads).toBe(3);
  });

  it("waits for base config readback when the first F7 after F6/01 is stale", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.staleBaseReads = 1;
    const hook = await connectedHook(device);

    act(() => hook.result.current.setDraftField("speakerVolume", 48));
    await waitFor(() => expect(hook.result.current.config?.speakerVolume).toBe(48));
    expect(hook.result.current.error).toBeNull();
    expect(device.f7Reads).toBe(3);
  });

  it("does not report an ignored base write as applied on BF firmware", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.rejectBaseWrite = true;
    const hook = await connectedHook(device);

    act(() => hook.result.current.setDraftField("speakerVolume", 48));
    await waitFor(() => expect(hook.result.current.operation).toBeNull());
    await waitFor(() => expect(hook.result.current.error).toBeTruthy());
    expect(hook.result.current.config?.speakerVolume).toBe(0);
    expect(hook.result.current.saveState).toBe("dirty");
    expect(device.f7Reads).toBeGreaterThan(2);
  });

  it("waits for the new F7 save status after an initially stale flash read", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.staleSaveReads = 1;
    const hook = await connectedHook(device);

    await act(async () => hook.result.current.saveToFlash());
    expect(hook.result.current.saveState).toBe("saved");
    expect(hook.result.current.error).toBeNull();
    expect(device.f7Reads).toBe(4);
  });

  it("clears an earlier verified save before checking the new save result", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.batterySaveStatus = 1;
    device.staleBatteryReads = 1;
    device.staleSaveReads = 1;
    const hook = await connectedHook(device);

    await act(async () => hook.result.current.saveToFlash());
    expect(device.sent.map(({ bytes }) => bytes[0])).toEqual([5, 2]);
    expect(device.f7Reads).toBe(5);
    expect(hook.result.current.saveState).toBe("saved");
  });

  it("does not save when the pre-save status reset is ignored", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.batterySaveStatus = 1;
    device.rejectBatteryWrite = true;
    const hook = await connectedHook(device);

    await act(async () => hook.result.current.saveToFlash());
    expect(device.sent.map(({ bytes }) => bytes[0])).toEqual([5]);
    expect(hook.result.current.saveState).toBe("saveFailed");
    expect(hook.result.current.error).toBeTruthy();
    expect(device.f7Reads).toBeGreaterThan(2);
    expect(device.f7Reads).toBeLessThan(20);
  });

  it("applies one extension flag through F6/05 and F7 without requesting USB reconnect", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    const hook = await connectedHook(device);

    expect(hook.result.current.batteryFeedbackSupported).toBe(true);
    expect(hook.result.current.batteryFeedbackApplied).toBe(false);
    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    await waitFor(() => expect(hook.result.current.batteryFeedbackApplied).toBe(true));
    expect(device.batteryReports()).toHaveLength(1);
    expect(Array.from(device.batteryReports()[0].slice(0, 5))).toEqual([5, 0x42, 0x46, 1, 1]);
    expect(device.batteryReports()[0]).toHaveLength(63);
    expect(device.f7Reads).toBe(2);
    expect(hook.result.current.needsUsbReconnect).toBe(false);
  });

  it("serializes rapid battery toggles and a base edit without losing the latest state", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    const gate = deferred();
    device.firstBatteryUpdateGate = gate.promise;
    const hook = await connectedHook(device);

    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    await waitFor(() => expect(device.batteryReports()).toHaveLength(1));
    act(() => {
      hook.result.current.setBatteryFeedbackDraft(false);
      hook.result.current.setDraftField("speakerVolume", 40);
    });
    expect(device.updateReports()).toHaveLength(0);
    gate.resolve();

    await waitFor(() => expect(hook.result.current.config?.speakerVolume).toBe(40));
    await waitFor(() => expect(hook.result.current.batteryFeedbackApplied).toBe(false));
    await waitFor(() => expect(hook.result.current.operation).toBeNull());
    expect(device.sent.filter(({ bytes }) => bytes[0] === 1 || bytes[0] === 5).map(({ bytes }) => bytes[0]))
      .toEqual([5, 1, 5]);
    expect(hook.result.current.isDirty).toBe(false);
  });

  it("requires F7 status 1 and matching values before reporting a verified save", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    const hook = await connectedHook(device);

    device.nextSaveStatus = 2;
    await act(async () => hook.result.current.saveToFlash());
    expect(hook.result.current.saveState).not.toBe("saved");
    expect(hook.result.current.error).toBeTruthy();

    device.nextSaveStatus = 1;
    await act(async () => hook.result.current.saveToFlash());
    expect(hook.result.current.saveState).toBe("saved");
    expect(device.f7Reads).toBeGreaterThan(3);
    expect(device.f7Reads).toBeLessThan(20);
  });

  it.each([0, 2])("keeps a visible save failure for F7 status %i after the toast clears", async (status) => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.nextSaveStatus = status;
    const hook = await connectedHook(device);
    await act(async () => hook.result.current.saveToFlash());
    act(() => hook.result.current.clearError());
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.saveState).toBe("saveFailed");
    expect(hook.result.current.statusText).toBe("Flash save not verified");
  });

  it("rejects a status-1 save when F7 values differ and keeps legacy save unverified", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.alterSavedConfig = true;
    const hook = await connectedHook(device);
    await act(async () => hook.result.current.saveToFlash());
    expect(hook.result.current.saveState).not.toBe("saved");
    expect(hook.result.current.isDirty).toBe(true);
    expect(hook.result.current.error).toBeTruthy();

    const old = new FakeBridgeDevice();
    await act(async () => hook.result.current.connectAuthorized(old));
    await act(async () => hook.result.current.saveToFlash());
    expect(hook.result.current.saveState).toBe("saveSent");
    expect(old.batteryReports()).toHaveLength(0);
  });

  it("verifies an unchanged raw gain that the UI rounds for display", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.setHapticsGain(1.2345);
    const hook = await connectedHook(device);
    expect(hook.result.current.config?.hapticsGain).toBe(1.23);
    await act(async () => hook.result.current.saveToFlash());
    expect(hook.result.current.saveState).toBe("saved");
    expect(hook.result.current.error).toBeNull();
  });

  it("does not treat a rejected extension readback as applied or allow writes after F7 failure", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.rejectBatteryWrite = true;
    const hook = await connectedHook(device);

    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    await waitFor(() => expect(device.batteryReports()).toHaveLength(1));
    await waitFor(() => expect(hook.result.current.error).toBeTruthy());
    await waitFor(() => expect(hook.result.current.operation).toBeNull());
    expect(hook.result.current.batteryFeedbackApplied).toBe(false);
    expect(hook.result.current.isDirty).toBe(true);
    expect(hook.result.current.error).toBeTruthy();

    device.failNextRead = true;
    await act(async () => hook.result.current.readConfig());
    expect(hook.result.current.hasValidSnapshot).toBe(false);
    const writesBefore = device.sent.length;
    act(() => hook.result.current.setDraftField("speakerVolume", 55));
    await act(async () => hook.result.current.saveToFlash());
    await act(async () => hook.result.current.resetToDefaults());
    expect(device.sent).toHaveLength(writesBefore);
  });

  it("uses the full BF F7 snapshot to block saving unexpected base changes", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.changeBaseOnBatteryWrite = true;
    const hook = await connectedHook(device);
    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    await waitFor(() => expect(hook.result.current.batteryFeedbackApplied).toBe(true));
    expect(hook.result.current.config?.speakerVolume).toBe(99);
    expect(hook.result.current.draft.speakerVolume).toBe(0);
    expect(hook.result.current.hasValidSnapshot).toBe(false);
    const writesBefore = device.sent.length;
    await act(async () => hook.result.current.saveToFlash());
    expect(device.sent).toHaveLength(writesBefore);
  });

  it("invalidates the snapshot when F6/05 may have applied but WebHID rejects", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.throwBatterySendAfterApply = true;
    const hook = await connectedHook(device);

    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    await waitFor(() => expect(device.batteryReports()).toHaveLength(1));
    await waitFor(() => expect(hook.result.current.hasValidSnapshot).toBe(false));
    await waitFor(() => expect(hook.result.current.operation).toBeNull());
    expect(device.batteryEnabled).toBe(true);
    expect(hook.result.current.hasValidSnapshot).toBe(false);
    expect(hook.result.current.batteryFeedbackApplied).toBe(false);
    const writesBefore = device.sent.length;
    act(() => hook.result.current.setDraftField("speakerVolume", 44));
    await act(async () => hook.result.current.saveToFlash());
    await act(async () => hook.result.current.resetToDefaults());
    expect(device.sent).toHaveLength(writesBefore);
  });

  it("blocks all mutation after the initial F7 failure while keeping old firmware base controls available", async () => {
    const failed = new FakeBridgeDevice();
    failed.failNextRead = true;
    const hid = Object.assign(new EventTarget(), {
      getDevices: async () => [failed], requestDevice: async () => [failed],
    }) as HID;
    Object.defineProperty(navigator, "hid", { configurable: true, value: hid });
    const hook = renderHook(() => useDs5Bridge());
    await act(async () => hook.result.current.connectAuthorized(failed));
    expect(hook.result.current.hasValidSnapshot).toBe(false);
    expect(hook.result.current.isDirty).toBe(false);
    expect(hook.result.current.statusText).toBe("Read config before editing");
    act(() => hook.result.current.setDraftField("speakerVolume", 32));
    await act(async () => hook.result.current.saveToFlash());
    await act(async () => hook.result.current.resetToDefaults());
    expect(failed.sent).toHaveLength(0);

    await act(async () => hook.result.current.readConfig());
    expect(hook.result.current.hasValidSnapshot).toBe(true);
    expect(hook.result.current.batteryFeedbackSupported).toBe(false);
    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    act(() => hook.result.current.setDraftField("speakerVolume", 32));
    await waitFor(() => expect(hook.result.current.config?.speakerVolume).toBe(32));
    expect(failed.batteryReports()).toHaveLength(0);
  });

  it("ignores an old device's late F7 response after switching devices", async () => {
    const old = new FakeBridgeDevice();
    old.batteryExtension = true;
    old.batteryEnabled = true;
    const gate = deferred();
    old.firstReadGate = gate.promise;
    const replacement = new FakeBridgeDevice();
    const hid = Object.assign(new EventTarget(), {
      getDevices: async () => [old, replacement], requestDevice: async () => [old],
    }) as HID;
    Object.defineProperty(navigator, "hid", { configurable: true, value: hid });
    const hook = renderHook(() => useDs5Bridge());
    let oldConnect!: Promise<void>;
    act(() => { oldConnect = hook.result.current.connectAuthorized(old); });
    await waitFor(() => expect(old.f7Reads).toBe(1));
    await act(async () => hook.result.current.connectAuthorized(replacement));
    gate.resolve();
    await act(async () => oldConnect);
    expect(hook.result.current.batteryFeedbackSupported).toBe(false);
    expect(hook.result.current.batteryFeedbackApplied).toBeNull();
    expect(hook.result.current.hasValidSnapshot).toBe(true);
    expect(hook.result.current.client?.device).toBe(replacement);
  });

  it("does not write after a malformed BF marker and lets a later valid F7 recover", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.malformedBatteryTail = true;
    const hid = Object.assign(new EventTarget(), {
      getDevices: async () => [device], requestDevice: async () => [device],
    }) as HID;
    Object.defineProperty(navigator, "hid", { configurable: true, value: hid });
    const hook = renderHook(() => useDs5Bridge());
    await act(async () => hook.result.current.connectAuthorized(device));
    expect(hook.result.current.hasValidSnapshot).toBe(false);
    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    act(() => hook.result.current.setDraftField("speakerVolume", 40));
    expect(device.sent).toHaveLength(0);

    device.malformedBatteryTail = false;
    await act(async () => hook.result.current.readConfig());
    expect(hook.result.current.hasValidSnapshot).toBe(true);
    expect(hook.result.current.batteryFeedbackSupported).toBe(true);
  });

  it("does not downgrade known BF capability when a later F7 loses its tail", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    const hook = await connectedHook(device);
    expect(hook.result.current.batteryFeedbackSupported).toBe(true);

    device.batteryExtension = false;
    await act(async () => hook.result.current.readConfig());
    expect(hook.result.current.hasValidSnapshot).toBe(false);
    expect(hook.result.current.batteryFeedbackSupported).toBe(true);
    const writesBefore = device.sent.length;
    act(() => hook.result.current.setDraftField("speakerVolume", 48));
    await act(async () => hook.result.current.saveToFlash());
    await act(async () => hook.result.current.resetToDefaults());
    expect(device.sent).toHaveLength(writesBefore);

    device.batteryExtension = true;
    await act(async () => hook.result.current.readConfig());
    expect(hook.result.current.hasValidSnapshot).toBe(true);
  });

  it("keeps Reset available after an ignored BF off write and lets it retry", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.batteryEnabled = true;
    device.rejectBatteryWrite = true;
    const hook = await connectedHook(device);

    await act(async () => hook.result.current.resetToDefaults());
    expect(hook.result.current.hasValidSnapshot).toBe(true);
    expect(hook.result.current.batteryFeedbackApplied).toBe(true);
    expect(hook.result.current.batteryFeedbackDraft).toBe(false);
    expect(hook.result.current.isDefaultConfig).toBe(false);

    device.rejectBatteryWrite = false;
    await act(async () => hook.result.current.resetToDefaults());
    expect(device.batteryEnabled).toBe(false);
    expect(hook.result.current.batteryFeedbackApplied).toBe(false);
    expect(hook.result.current.isDefaultConfig).toBe(true);
    expect(hook.result.current.saveState).toBe("saved");
  });

  it("queues Save behind both types of edit, then verifies the final snapshot", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    const gate = deferred();
    device.firstUpdateGate = gate.promise;
    const hook = await connectedHook(device);

    act(() => hook.result.current.setDraftField("speakerVolume", 44));
    await waitFor(() => expect(device.updateReports()).toHaveLength(1));
    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    let save!: Promise<void>;
    act(() => { save = hook.result.current.saveToFlash(); });
    expect(device.sent.map(({ bytes }) => bytes[0])).toEqual([1]);
    gate.resolve();
    await act(async () => save);
    await waitFor(() => expect(hook.result.current.saveState).toBe("saved"));
    expect(device.sent.map(({ bytes }) => bytes[0])).toEqual([1, 5, 5, 2]);
    expect(hook.result.current.isDirty).toBe(false);
  });

  it("resets base settings and battery feedback off, then saves verified values", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    device.batteryEnabled = true;
    const hook = await connectedHook(device);
    expect(hook.result.current.isDefaultConfig).toBe(false);

    await act(async () => hook.result.current.resetToDefaults());
    expect(device.sent.map(({ bytes }) => bytes[0])).toEqual([1, 5, 5, 2]);
    expect(device.batteryEnabled).toBe(false);
    expect(hook.result.current.batteryFeedbackApplied).toBe(false);
    expect(hook.result.current.isDefaultConfig).toBe(true);
    expect(hook.result.current.saveState).toBe("saved");
  });

  it("does not commit a late F6/05 readback from the previous device", async () => {
    const old = new FakeBridgeDevice();
    old.batteryExtension = true;
    const gate = deferred();
    old.firstBatteryUpdateGate = gate.promise;
    const hook = await connectedHook(old);
    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    await waitFor(() => expect(old.batteryReports()).toHaveLength(1));

    const replacement = new FakeBridgeDevice();
    await act(async () => hook.result.current.connectAuthorized(replacement));
    gate.resolve();
    await waitFor(() => expect(hook.result.current.operation).toBeNull());
    expect(hook.result.current.client?.device).toBe(replacement);
    expect(hook.result.current.batteryFeedbackSupported).toBe(false);
    expect(hook.result.current.batteryFeedbackApplied).toBeNull();
    expect(replacement.sent).toHaveLength(0);
  });

  it("drops a pending write on disconnect and clears the busy state", async () => {
    const device = new FakeBridgeDevice();
    device.batteryExtension = true;
    const gate = deferred();
    device.firstBatteryUpdateGate = gate.promise;
    const hook = await connectedHook(device);
    act(() => hook.result.current.setBatteryFeedbackDraft(true));
    await waitFor(() => expect(device.batteryReports()).toHaveLength(1));

    const event = new Event("disconnect") as HIDConnectionEvent;
    Object.defineProperty(event, "device", { value: device });
    act(() => navigator.hid?.dispatchEvent(event));
    expect(hook.result.current.hasValidSnapshot).toBe(false);
    expect(hook.result.current.operation).toBeNull();
    gate.resolve();
    await waitFor(() => expect(hook.result.current.client).toBeNull());
    expect(hook.result.current.batteryFeedbackApplied).toBeNull();
    expect(device.sent.map(({ bytes }) => bytes[0])).toEqual([5]);
  });
});
