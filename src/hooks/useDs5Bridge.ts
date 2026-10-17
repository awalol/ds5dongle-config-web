import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ConfigBody,
  ConfigDecodeError,
  DEFAULT_CONFIG,
  ConfigValidationIssue,
  configsEqual,
  normalizeConfig,
  validateConfig,
} from "../protocol/config";
import {
  BUTTON_REMAP_COUNT,
  BUTTON_SOURCE_COUNT,
  DEFAULT_BUTTON_REMAP,
  SHORTCUT_COUNT,
  ShortcutSlot,
  buttonRemapsEqual,
  createDefaultShortcutSlots,
  shortcutSlotsEqual,
  ButtonProtocolError,
} from "../protocol/buttons";
import {
  Ds5BridgeHidClient,
  NO_DEVICE_SELECTED_ERROR,
  WEBHID_UNAVAILABLE_ERROR,
  getControllerModel,
  getDeviceLabel,
  webHidAvailable,
} from "../protocol/ds5BridgeHid";
import type { AudioActivityState, ControllerModel } from "../protocol/ds5BridgeHid";
import { decodePressedButtons, resolvePhysicalButton } from "../protocol/controllerState";

type Operation =
  | "connecting"
  | "reading"
  | "readingFirmware"
  | "readingButtons"
  | "applying"
  | "saving"
  | "savingRemap"
  | "savingShortcuts"
  | "reconnecting"
  | null;
type SaveState = "idle" | "dirty" | "applied" | "saved";
type UsbEffectiveConfig = Pick<
  ConfigBody,
  "pollingRateMode" | "controllerMode" | "enableUsbSn" | "enableKeyboard" | "enableWake"
>;

const SIGNAL_STRENGTH_REFRESH_INTERVAL_MS = 5_000;

/** Receives the physical controls held down, as source ids matching BUTTON_NAMES. */
export type ControllerButtonListener = (pressed: readonly number[]) => void;

export interface UseDs5BridgeResult {
  supported: boolean;
  client: Ds5BridgeHidClient | null;
  controllerModel: ControllerModel | null;
  deviceLabel: string;
  firmwareVersion: string | null;
  signalStrengthRssi: number | null;
  audioActivity: AudioActivityState | null;
  authorizedDevices: HIDDevice[];
  config: ConfigBody | null;
  draft: ConfigBody;
  buttonRemap: number[];
  shortcuts: ShortcutSlot[];
  issues: ConfigValidationIssue[];
  saveState: SaveState;
  operation: Operation;
  error: string | null;
  statusText: string;
  isConnected: boolean;
  isDirty: boolean;
  isButtonRemapDirty: boolean;
  areShortcutsDirty: boolean;
  isDefaultConfig: boolean;
  needsUsbReconnect: boolean;
  setDraftField: <Key extends keyof ConfigBody>(field: Key, value: ConfigBody[Key]) => void;
  refreshAuthorizedDevices: () => Promise<void>;
  connect: () => Promise<void>;
  connectAuthorized: (device: HIDDevice) => Promise<void>;
  readConfig: () => Promise<void>;
  readButtonSettings: () => Promise<void>;
  setButtonRemap: (source: number, target: number) => void;
  resetButtonRemap: () => void;
  saveButtonRemap: () => Promise<void>;
  subscribeControllerButtons: (listener: ControllerButtonListener) => () => void;
  startShortcutLearning: () => Promise<void>;
  setShortcut: (slot: number, shortcut: ShortcutSlot) => void;
  clearShortcut: (slot: number) => void;
  resetShortcuts: () => void;
  saveShortcuts: () => Promise<void>;
  saveToFlash: () => Promise<void>;
  reconnectUsb: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  clearError: () => void;
}

export function useDs5Bridge(): UseDs5BridgeResult {
  const { t } = useTranslation();
  const supported = webHidAvailable();
  const [client, setClient] = useState<Ds5BridgeHidClient | null>(null);
  const [authorizedDevices, setAuthorizedDevices] = useState<HIDDevice[]>([]);
  const [firmwareVersion, setFirmwareVersion] = useState<string | null>(null);
  const [signalStrengthRssi, setSignalStrengthRssi] = useState<number | null>(null);
  const [audioActivity, setAudioActivity] = useState<AudioActivityState | null>(null);
  const [config, setConfig] = useState<ConfigBody | null>(null);
  const [draft, setDraft] = useState<ConfigBody>(DEFAULT_CONFIG);
  const [buttonRemap, setButtonRemapState] = useState<number[]>([...DEFAULT_BUTTON_REMAP]);
  const [savedButtonRemap, setSavedButtonRemap] = useState<number[]>([...DEFAULT_BUTTON_REMAP]);
  const [shortcuts, setShortcuts] = useState<ShortcutSlot[]>(createDefaultShortcutSlots);
  const [buttonListeners, setButtonListeners] = useState<readonly ControllerButtonListener[]>([]);
  const [savedShortcuts, setSavedShortcuts] = useState<ShortcutSlot[]>(createDefaultShortcutSlots);
  const [operation, setOperation] = useState<Operation>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsUsbReconnect, setNeedsUsbReconnect] = useState(false);
  const clientRef = useRef<Ds5BridgeHidClient | null>(null);
  const configRef = useRef<ConfigBody | null>(null);
  const draftRef = useRef<ConfigBody>(DEFAULT_CONFIG);
  const usbEffectiveConfigRef = useRef<UsbEffectiveConfig | null>(null);
  const applyingRef = useRef(false);
  const applyQueuedRef = useRef(false);

  const issues = useMemo(() => validateConfig(draft), [draft]);
  const isConnected = Boolean(client?.device.opened);
  const isDirty = !configsEqual(config, draft);
  const isButtonRemapDirty = !buttonRemapsEqual(buttonRemap, savedButtonRemap);
  const areShortcutsDirty = !shortcutSlotsEqual(shortcuts, savedShortcuts);
  const isDefaultConfig = configsEqual(draft, DEFAULT_CONFIG);
  const controllerModel = getControllerModel(client?.device ?? null);
  const deviceLabel = getDeviceLabel(client?.device ?? null);

  const statusText = useMemo(() => {
    if (!supported) {
      return t("status.webHidUnavailable");
    }
    if (operation) {
      return operationLabel(operation, t);
    }
    if (!client) {
      return t("status.ready");
    }
    if (isDirty || isButtonRemapDirty || areShortcutsDirty) {
      return t("status.unsaved");
    }
    if (saveState === "applied") {
      return t("status.applied");
    }
    if (saveState === "saved") {
      return t("status.saved");
    }
    return t("status.connected");
  }, [areShortcutsDirty, client, isButtonRemapDirty, isDirty, operation, saveState, supported, t]);

  const refreshAuthorizedDevices = useCallback(async () => {
    if (!supported) {
      setAuthorizedDevices([]);
      return;
    }

    setAuthorizedDevices(await Ds5BridgeHidClient.authorizedDevices());
  }, [supported]);

  const readConfigWithClient = useCallback(async (nextClient: Ds5BridgeHidClient, syncUsbEffectiveConfig = false) => {
    setOperation("reading");
    try {
      const nextConfig = normalizeConfig(await nextClient.readConfig());
      configRef.current = nextConfig;
      draftRef.current = nextConfig;
      if (syncUsbEffectiveConfig) {
        usbEffectiveConfigRef.current = pickUsbEffectiveConfig(nextConfig);
        setNeedsUsbReconnect(false);
      }
      setConfig(nextConfig);
      setDraft(nextConfig);
      setSaveState("idle");
      setError(null);
    } finally {
      setOperation(null);
    }
  }, []);

  const readFirmwareVersionWithClient = useCallback(async (nextClient: Ds5BridgeHidClient) => {
    setOperation("readingFirmware");
    try {
      setFirmwareVersion(await nextClient.readFirmwareVersion());
      setError(null);
    } finally {
      setOperation(null);
    }
  }, []);

  const readButtonSettingsWithClient = useCallback(async (nextClient: Ds5BridgeHidClient) => {
    setOperation("readingButtons");
    try {
      const nextRemap = await nextClient.readButtonRemap();
      const nextShortcuts = await nextClient.readShortcuts();
      setSavedButtonRemap(nextRemap);
      setButtonRemapState([...nextRemap]);
      setSavedShortcuts(nextShortcuts);
      setShortcuts(nextShortcuts.map(cloneShortcut));
      setError(null);
    } finally {
      setOperation(null);
    }
  }, []);

  const readSignalStrengthWithClient = useCallback(async (nextClient: Ds5BridgeHidClient) => {
    try {
      const nextSignalStrength = await nextClient.readSignalStrength();
      if (clientRef.current === nextClient) {
        setSignalStrengthRssi(nextSignalStrength.rssi);
        setAudioActivity(nextSignalStrength.audioActivity);
      }
    } catch {
      if (clientRef.current === nextClient) {
        setSignalStrengthRssi(null);
        setAudioActivity(null);
      }
    }
  }, []);

  const attachClient = useCallback(
    async (nextClient: Ds5BridgeHidClient) => {
      setOperation("connecting");
      try {
        await nextClient.open();
        clientRef.current = nextClient;
        setClient(nextClient);
        setFirmwareVersion(null);
        setSignalStrengthRssi(null);
        setAudioActivity(null);
        setError(null);
      } finally {
        setOperation(null);
      }
      await readConfigWithClient(nextClient, true);
      try {
        await readFirmwareVersionWithClient(nextClient);
      } catch (cause) {
        setFirmwareVersion(null);
        setError(errorMessage(cause, t));
        setOperation(null);
      }
      try {
        await readButtonSettingsWithClient(nextClient);
      } catch (cause) {
        setError(errorMessage(cause, t));
        setOperation(null);
      }
      void readSignalStrengthWithClient(nextClient);
    },
    [readButtonSettingsWithClient, readConfigWithClient, readFirmwareVersionWithClient, readSignalStrengthWithClient, t],
  );

  const connect = useCallback(async () => {
    try {
      await attachClient(await Ds5BridgeHidClient.requestDevice());
      await refreshAuthorizedDevices();
    } catch (cause) {
      setError(errorMessage(cause, t));
      setOperation(null);
    }
  }, [attachClient, refreshAuthorizedDevices, t]);

  const connectAuthorized = useCallback(
    async (device: HIDDevice) => {
      try {
        await attachClient(new Ds5BridgeHidClient(device));
      } catch (cause) {
        setError(errorMessage(cause, t));
        setOperation(null);
      }
    },
    [attachClient, t],
  );

  const readConfig = useCallback(async () => {
    if (!client) {
      return;
    }

    try {
      await readConfigWithClient(client);
    } catch (cause) {
      setError(errorMessage(cause, t));
      setOperation(null);
    }
  }, [client, readConfigWithClient, t]);

  const readButtonSettings = useCallback(async () => {
    if (!client) {
      return;
    }

    try {
      await readButtonSettingsWithClient(client);
    } catch (cause) {
      setError(errorMessage(cause, t));
      setOperation(null);
    }
  }, [client, readButtonSettingsWithClient, t]);

  const applyLatestDraft = useCallback(async (): Promise<boolean> => {
    if (applyingRef.current) {
      applyQueuedRef.current = true;
      return false;
    }

    applyingRef.current = true;
    setOperation("applying");
    try {
      while (true) {
        applyQueuedRef.current = false;

        const nextClient = clientRef.current;
        if (!nextClient) {
          break;
        }

        const nextDraft = normalizeConfig(draftRef.current);
        if (validateConfig(nextDraft).length > 0 || configsEqual(configRef.current, nextDraft)) {
          break;
        }

        const appliedConfig = normalizeConfig(await nextClient.applyConfig(nextDraft));
        configRef.current = appliedConfig;
        setConfig(appliedConfig);
        setNeedsUsbReconnect(usbEffectiveConfigChanged(usbEffectiveConfigRef.current, appliedConfig));
        setSaveState("applied");
        setError(null);

        if (configsEqual(draftRef.current, nextDraft)) {
          draftRef.current = appliedConfig;
          setDraft(appliedConfig);
        }

        if (!applyQueuedRef.current && configsEqual(configRef.current, draftRef.current)) {
          break;
        }
      }
    } catch (cause) {
      setError(errorMessage(cause, t));
      return false;
    } finally {
      applyingRef.current = false;
      setOperation(null);
    }

    return true;
  }, [t]);

  const saveToFlash = useCallback(async () => {
    if (!client || isDirty) {
      return;
    }

    setOperation("saving");
    try {
      await client.saveToFlash();
      setSaveState("saved");
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setOperation(null);
    }
  }, [client, isDirty, t]);

  const reconnectUsb = useCallback(async () => {
    if (!client) {
      return;
    }

    setOperation("reconnecting");
    try {
      await client.reconnectUsb();
      usbEffectiveConfigRef.current = pickUsbEffectiveConfig(configRef.current ?? draftRef.current);
      setNeedsUsbReconnect(false);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setOperation(null);
    }
  }, [client, t]);

  const setDraftField = useCallback(
    <Key extends keyof ConfigBody>(field: Key, value: ConfigBody[Key]) => {
      if (!clientRef.current?.device.opened) {
        return;
      }

      const nextDraft = { ...draftRef.current, [field]: value };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setSaveState("dirty");
      void applyLatestDraft();
    },
    [applyLatestDraft],
  );

  const setButtonRemap = useCallback((source: number, target: number) => {
    if (
      !clientRef.current?.device.opened ||
      !Number.isInteger(source) ||
      source < 0 ||
      source >= BUTTON_SOURCE_COUNT ||
      !Number.isInteger(target) ||
      target < 0 ||
      target >= BUTTON_REMAP_COUNT
    ) {
      return;
    }

    setButtonRemapState((current) => {
      const next = [...current];
      next[source] = target;
      return next;
    });
    setSaveState("dirty");
  }, []);

  const resetButtonRemap = useCallback(() => {
    if (!clientRef.current?.device.opened) {
      return;
    }
    setButtonRemapState([...DEFAULT_BUTTON_REMAP]);
    setSaveState("dirty");
  }, []);

  const saveButtonRemap = useCallback(async () => {
    if (!client || !isButtonRemapDirty) {
      return;
    }

    setOperation("savingRemap");
    try {
      const applied = await client.applyButtonRemap(buttonRemap);
      setSavedButtonRemap(applied);
      setButtonRemapState([...applied]);
      setSaveState("saved");
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setOperation(null);
    }
  }, [buttonRemap, client, isButtonRemapDirty, t]);

  const subscribeControllerButtons = useCallback((listener: ControllerButtonListener) => {
    setButtonListeners((current) => [...current, listener]);
    return () => setButtonListeners((current) => current.filter((entry) => entry !== listener));
  }, []);

  // Starts the firmware's capture window. Listeners suppress the resulting
  // button press themselves; the window covers the shortcut state machine.
  const startShortcutLearning = useCallback(async () => {
    const nextClient = clientRef.current;
    if (!nextClient) {
      return;
    }
    try {
      await nextClient.startShortcutLearning();
    } catch (cause) {
      setError(errorMessage(cause, t));
    }
  }, [t]);

  // Input reports arrive at the controller's polling rate, so the listener is
  // only attached while something is actually watching for button presses.
  useEffect(() => {
    const device = client?.device;
    if (!device || buttonListeners.length === 0) {
      return;
    }

    const onInputReport = (event: HIDInputReportEvent) => {
      const reported = decodePressedButtons(event.reportId, event.data);
      if (!reported) {
        return;
      }

      const pressed = reported.map((button) => resolvePhysicalButton(button, savedButtonRemap));
      buttonListeners.forEach((listener) => listener(pressed));
    };

    device.addEventListener("inputreport", onInputReport);
    return () => device.removeEventListener("inputreport", onInputReport);
  }, [buttonListeners, client, savedButtonRemap]);

  const setShortcut = useCallback((slot: number, shortcut: ShortcutSlot) => {
    if (!clientRef.current?.device.opened || !Number.isInteger(slot) || slot < 0 || slot >= SHORTCUT_COUNT) {
      return;
    }

    setShortcuts((current) => {
      const next = current.map(cloneShortcut);
      next[slot] = cloneShortcut(shortcut);
      return next;
    });
    setSaveState("dirty");
  }, []);

  const clearShortcut = useCallback((slot: number) => {
    setShortcut(slot, createDefaultShortcutSlots()[0]);
  }, [setShortcut]);

  const resetShortcuts = useCallback(() => {
    if (!clientRef.current?.device.opened) {
      return;
    }
    setShortcuts(createDefaultShortcutSlots());
    setSaveState("dirty");
  }, []);

  const saveShortcuts = useCallback(async () => {
    if (!client || !areShortcutsDirty) {
      return;
    }

    setOperation("savingShortcuts");
    try {
      const applied = await client.applyShortcuts(shortcuts);
      setSavedShortcuts(applied);
      setShortcuts(applied.map(cloneShortcut));
      setSaveState("saved");
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setOperation(null);
    }
  }, [areShortcutsDirty, client, shortcuts, t]);

  const resetToDefaults = useCallback(async () => {
    const nextClient = clientRef.current;
    if (!nextClient) {
      return;
    }

    draftRef.current = DEFAULT_CONFIG;
    setDraft(DEFAULT_CONFIG);
    setSaveState("dirty");

    const applied = await applyLatestDraft();
    if (!applied || !configsEqual(configRef.current, DEFAULT_CONFIG)) {
      return;
    }

    setOperation("saving");
    try {
      await nextClient.saveToFlash();
      setSaveState("saved");
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setOperation(null);
    }
  }, [applyLatestDraft, t]);

  useEffect(() => {
    void refreshAuthorizedDevices();
  }, [refreshAuthorizedDevices]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void readSignalStrengthWithClient(client);
    }, SIGNAL_STRENGTH_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [client, readSignalStrengthWithClient]);

  useEffect(() => {
    if (!navigator.hid) {
      return;
    }

    const handleDisconnect = (event: HIDConnectionEvent) => {
      if (client?.device === event.device) {
        clientRef.current = null;
        configRef.current = null;
        draftRef.current = DEFAULT_CONFIG;
        usbEffectiveConfigRef.current = null;
        setClient(null);
        setFirmwareVersion(null);
        setSignalStrengthRssi(null);
        setAudioActivity(null);
        setConfig(null);
        setDraft(DEFAULT_CONFIG);
        setSavedButtonRemap([...DEFAULT_BUTTON_REMAP]);
        setButtonRemapState([...DEFAULT_BUTTON_REMAP]);
        setSavedShortcuts(createDefaultShortcutSlots());
        setShortcuts(createDefaultShortcutSlots());
        setNeedsUsbReconnect(false);
        setSaveState("idle");
        setError(t("errors.disconnected"));
      }
      void refreshAuthorizedDevices();
    };

    const handleConnect = () => {
      void refreshAuthorizedDevices();
    };

    navigator.hid.addEventListener("disconnect", handleDisconnect);
    navigator.hid.addEventListener("connect", handleConnect);

    return () => {
      navigator.hid?.removeEventListener("disconnect", handleDisconnect);
      navigator.hid?.removeEventListener("connect", handleConnect);
    };
  }, [client, refreshAuthorizedDevices, t]);

  return {
    supported,
    client,
    controllerModel,
    deviceLabel,
    firmwareVersion,
    signalStrengthRssi,
    audioActivity,
    authorizedDevices,
    config,
    draft,
    buttonRemap,
    shortcuts,
    issues,
    saveState,
    operation,
    error,
    statusText,
    isConnected,
    isDirty,
    isButtonRemapDirty,
    areShortcutsDirty,
    isDefaultConfig,
    needsUsbReconnect,
    setDraftField,
    refreshAuthorizedDevices,
    connect,
    connectAuthorized,
    readConfig,
    readButtonSettings,
    setButtonRemap,
    resetButtonRemap,
    saveButtonRemap,
    subscribeControllerButtons,
    startShortcutLearning,
    setShortcut,
    clearShortcut,
    resetShortcuts,
    saveShortcuts,
    saveToFlash,
    reconnectUsb,
    resetToDefaults,
    clearError: () => setError(null),
  };
}

function operationLabel(operation: Exclude<Operation, null>, t: (key: string) => string): string {
  switch (operation) {
    case "connecting":
      return t("status.connecting");
    case "reading":
      return t("status.reading");
    case "readingFirmware":
      return t("status.readingFirmware");
    case "readingButtons":
      return t("status.readingButtons");
    case "applying":
      return t("status.applying");
    case "saving":
      return t("status.saving");
    case "savingRemap":
      return t("status.savingRemap");
    case "savingShortcuts":
      return t("status.savingShortcuts");
    case "reconnecting":
      return t("status.reconnecting");
  }
}

function pickUsbEffectiveConfig(config: ConfigBody): UsbEffectiveConfig {
  return {
    pollingRateMode: config.pollingRateMode,
    controllerMode: config.controllerMode,
    enableUsbSn: config.enableUsbSn,
    enableKeyboard: config.enableKeyboard,
    enableWake: config.enableWake,
  };
}

function usbEffectiveConfigChanged(current: UsbEffectiveConfig | null, next: ConfigBody): boolean {
  if (!current) {
    return false;
  }

  return (
    current.pollingRateMode !== next.pollingRateMode ||
    current.controllerMode !== next.controllerMode ||
    current.enableUsbSn !== next.enableUsbSn ||
    current.enableKeyboard !== next.enableKeyboard ||
    current.enableWake !== next.enableWake
  );
}

function errorMessage(cause: unknown, t: (key: string, values?: Record<string, unknown>) => string): string {
  if (cause instanceof ButtonProtocolError) {
    return t(`errors.${cause.code}`, cause.values);
  }

  if (cause instanceof ConfigDecodeError) {
    if (cause.code === "invalidConfig") {
      const fields = Array.isArray(cause.values.issues) ? cause.values.issues : [];
      const issues = fields.map((field) => t(`validation.${String(field)}`)).join("; ");

      return t("errors.invalidConfig", { issues });
    }

    if (cause.code === "versionMismatch") {
      return t("errors.configVersionMismatch", cause.values);
    }

    return t("errors.invalidBytes", cause.values);
  }

  if (cause instanceof Error) {
    if (cause.message === NO_DEVICE_SELECTED_ERROR) {
      return t("errors.noDeviceSelected");
    }

    if (cause.message === WEBHID_UNAVAILABLE_ERROR) {
      return t("errors.webHidUnavailable");
    }

    return cause.message;
  }

  return t("errors.unexpectedWebHid");
}

function cloneShortcut(shortcut: ShortcutSlot): ShortcutSlot {
  return {
    ...shortcut,
    payload: [...shortcut.payload] as [number, number, number],
  };
}
