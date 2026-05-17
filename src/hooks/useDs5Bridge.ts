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
  Ds5BridgeHidClient,
  NO_DEVICE_SELECTED_ERROR,
  WEBHID_UNAVAILABLE_ERROR,
  getDeviceLabel,
  webHidAvailable,
} from "../protocol/ds5BridgeHid";

type Operation = "connecting" | "reading" | "readingFirmware" | "applying" | "saving" | "reconnecting" | null;
type SaveState = "idle" | "dirty" | "applied" | "saved";
type UsbEffectiveConfig = Pick<ConfigBody, "pollingRateMode" | "controllerMode">;

const SIGNAL_STRENGTH_REFRESH_INTERVAL_MS = 5_000;

export interface UseDs5BridgeResult {
  supported: boolean;
  client: Ds5BridgeHidClient | null;
  deviceLabel: string;
  firmwareVersion: string | null;
  signalStrengthRssi: number | null;
  authorizedDevices: HIDDevice[];
  config: ConfigBody | null;
  draft: ConfigBody;
  issues: ConfigValidationIssue[];
  saveState: SaveState;
  operation: Operation;
  error: string | null;
  statusText: string;
  isConnected: boolean;
  isDirty: boolean;
  isDefaultConfig: boolean;
  needsUsbReconnect: boolean;
  setDraftField: <Key extends keyof ConfigBody>(field: Key, value: ConfigBody[Key]) => void;
  refreshAuthorizedDevices: () => Promise<void>;
  connect: () => Promise<void>;
  connectAuthorized: (device: HIDDevice) => Promise<void>;
  readConfig: () => Promise<void>;
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
  const [config, setConfig] = useState<ConfigBody | null>(null);
  const [draft, setDraft] = useState<ConfigBody>(DEFAULT_CONFIG);
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
  const isDefaultConfig = configsEqual(draft, DEFAULT_CONFIG);
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
    if (isDirty) {
      return t("status.unsaved");
    }
    if (saveState === "applied") {
      return t("status.applied");
    }
    if (saveState === "saved") {
      return t("status.saved");
    }
    return t("status.connected");
  }, [client, isDirty, operation, saveState, supported, t]);

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

  const readSignalStrengthWithClient = useCallback(async (nextClient: Ds5BridgeHidClient) => {
    try {
      const nextSignalStrength = await nextClient.readSignalStrength();
      if (clientRef.current === nextClient) {
        setSignalStrengthRssi(nextSignalStrength);
      }
    } catch {
      if (clientRef.current === nextClient) {
        setSignalStrengthRssi(null);
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
      void readSignalStrengthWithClient(nextClient);
    },
    [readConfigWithClient, readFirmwareVersionWithClient, readSignalStrengthWithClient, t],
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

        await nextClient.applyConfig(nextDraft);
        configRef.current = nextDraft;
        setConfig(nextDraft);
        setNeedsUsbReconnect(usbEffectiveConfigChanged(usbEffectiveConfigRef.current, nextDraft));
        setSaveState("applied");
        setError(null);

        if (configsEqual(draftRef.current, nextDraft)) {
          draftRef.current = nextDraft;
          setDraft(nextDraft);
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
      const nextDraft = { ...draftRef.current, [field]: value };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setSaveState("dirty");
      void applyLatestDraft();
    },
    [applyLatestDraft],
  );

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
        setConfig(null);
        setDraft(DEFAULT_CONFIG);
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
    deviceLabel,
    firmwareVersion,
    signalStrengthRssi,
    authorizedDevices,
    config,
    draft,
    issues,
    saveState,
    operation,
    error,
    statusText,
    isConnected,
    isDirty,
    isDefaultConfig,
    needsUsbReconnect,
    setDraftField,
    refreshAuthorizedDevices,
    connect,
    connectAuthorized,
    readConfig,
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
    case "applying":
      return t("status.applying");
    case "saving":
      return t("status.saving");
    case "reconnecting":
      return t("status.reconnecting");
  }
}

function pickUsbEffectiveConfig(config: ConfigBody): UsbEffectiveConfig {
  return {
    pollingRateMode: config.pollingRateMode,
    controllerMode: config.controllerMode,
  };
}

function usbEffectiveConfigChanged(current: UsbEffectiveConfig | null, next: ConfigBody): boolean {
  if (!current) {
    return false;
  }

  return current.pollingRateMode !== next.pollingRateMode || current.controllerMode !== next.controllerMode;
}

function errorMessage(cause: unknown, t: (key: string, values?: Record<string, unknown>) => string): string {
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
