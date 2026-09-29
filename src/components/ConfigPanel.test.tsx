// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseDs5BridgeResult } from "../hooks/useDs5Bridge";
import i18n from "../i18n";
import { DEFAULT_CONFIG } from "../protocol/config";
import type { ConfigBody } from "../protocol/config";
import { ConfigPanel } from "./ConfigPanel";

type FieldWrite = (field: keyof ConfigBody, value: ConfigBody[keyof ConfigBody]) => void;

function bridgeWithAudioSelection(writes: FieldWrite): UseDs5BridgeResult {
  const draft: ConfigBody = { ...DEFAULT_CONFIG, micSelect: 1, speakerSelect: 2 };
  return {
    supported: true,
    client: null,
    deviceLabel: "DS5 Bridge test device",
    firmwareVersion: "test-firmware",
    signalStrengthRssi: null,
    audioActivity: null,
    authorizedDevices: [],
    config: draft,
    draft,
    issues: [],
    saveState: "idle",
    operation: null,
    error: null,
    statusText: "Connected",
    isConnected: true,
    isDirty: false,
    isDefaultConfig: false,
    needsUsbReconnect: false,
    setDraftField: (field, value) => writes(field, value),
    refreshAuthorizedDevices: async () => {},
    connect: async () => {},
    connectAuthorized: async () => {},
    readConfig: async () => {},
    saveToFlash: async () => {},
    reconnectUsb: async () => {},
    resetToDefaults: async () => {},
    clearError: () => {},
  };
}

function controlSwitch(label: string): HTMLElement {
  const row = screen.getByText(label).closest(".control-row");
  if (!row) {
    throw new Error(`Missing control row: ${label}`);
  }
  return within(row as HTMLElement).getByRole("switch");
}

beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ConfigPanel", () => {
  it("treats mic selection 1 and speaker selection 2 as enabled, then maps disable and re-enable to 3 and 0", () => {
    const writes = vi.fn((_field: keyof ConfigBody, _value: ConfigBody[keyof ConfigBody]) => {});
    const bridge = bridgeWithAudioSelection(writes);
    const view = render(<ConfigPanel bridge={bridge} />);
    const mic = controlSwitch("Disable microphone");
    const speaker = controlSwitch("Disable speaker / headset");

    expect(mic.getAttribute("aria-checked")).toBe("false");
    expect(speaker.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(mic);
    fireEvent.click(speaker);
    expect(writes.mock.calls).toEqual([["micSelect", 3], ["speakerSelect", 3]]);

    view.rerender(
      <ConfigPanel
        bridge={{ ...bridge, draft: { ...bridge.draft, micSelect: 3, speakerSelect: 3 } }}
      />,
    );
    const disabledMic = controlSwitch("Disable microphone");
    const disabledSpeaker = controlSwitch("Disable speaker / headset");
    expect(disabledMic.getAttribute("aria-checked")).toBe("true");
    expect(disabledSpeaker.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(disabledMic);
    fireEvent.click(disabledSpeaker);
    expect(writes.mock.calls).toEqual([
      ["micSelect", 3],
      ["speakerSelect", 3],
      ["micSelect", 0],
      ["speakerSelect", 0],
    ]);
  });

  it("shows all four polling modes in two columns", () => {
    const writes = vi.fn((_field: keyof ConfigBody, _value: ConfigBody[keyof ConfigBody]) => {});
    render(<ConfigPanel bridge={bridgeWithAudioSelection(writes)} />);
    const row = screen.getByText("Polling rate mode").closest(".control-row");
    if (!row) {
      throw new Error("Missing polling rate control row");
    }
    const tabList = within(row as HTMLElement).getByRole("tablist");
    expect(within(tabList).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "250 Hz", "500 Hz", "Real-time", "1000 Hz",
    ]);
    expect(tabList.classList.contains("grid-cols-2")).toBe(true);
  });
});
