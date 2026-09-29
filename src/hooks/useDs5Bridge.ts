import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ConfigBody,
  ConfigDecodeError,
  DEFAULT_CONFIG,
  ConfigValidationIssue,
  configsEqual,
  encodeConfigBody,
  normalizeConfig,
  validateConfig,
} from "../protocol/config";
import { BatteryExtensionError } from "../protocol/batteryExtension";
import type { ConfigSnapshot } from "../protocol/batteryExtension";
import {
  Ds5BridgeHidClient,
  NO_DEVICE_SELECTED_ERROR,
  WEBHID_UNAVAILABLE_ERROR,
  getDeviceLabel,
  webHidAvailable,
} from "../protocol/ds5BridgeHid";
import type { AudioActivityState } from "../protocol/ds5BridgeHid";

type Operation = "connecting" | "reading" | "readingFirmware" | "applying" | "saving" | "reconnecting" | null;
type SaveState = "idle" | "dirty" | "applied" | "saved" | "saveSent" | "saveFailed";
type UsbEffectiveConfig = Pick<ConfigBody, "pollingRateMode" | "controllerMode" | "enableUsbSn">;

const SIGNAL_STRENGTH_REFRESH_INTERVAL_MS = 5_000;
const MUTATION_READBACK_MAX_ATTEMPTS = 12;
const MUTATION_READBACK_RETRY_MS = 50;

export interface UseDs5BridgeResult {
  supported: boolean;
  client: Ds5BridgeHidClient | null;
  deviceLabel: string;
  firmwareVersion: string | null;
  signalStrengthRssi: number | null;
  audioActivity: AudioActivityState | null;
  authorizedDevices: HIDDevice[];
  config: ConfigBody | null;
  draft: ConfigBody;
  hasValidSnapshot: boolean;
  batteryFeedbackSupported: boolean;
  batteryFeedbackApplied: boolean | null;
  batteryFeedbackDraft: boolean;
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
  setBatteryFeedbackDraft: (value: boolean) => void;
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
  const [audioActivity, setAudioActivity] = useState<AudioActivityState | null>(null);
  const [config, setConfig] = useState<ConfigBody | null>(null);
  const [draft, setDraft] = useState<ConfigBody>(DEFAULT_CONFIG);
  const [hasValidSnapshot, setHasValidSnapshot] = useState(false);
  const [batteryFeedbackSupported, setBatteryFeedbackSupported] = useState(false);
  const [batteryFeedbackApplied, setBatteryFeedbackApplied] = useState<boolean | null>(null);
  const [batteryFeedbackDraft, setBatteryFeedbackDraftState] = useState(false);
  const [operation, setOperation] = useState<Operation>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsUsbReconnect, setNeedsUsbReconnect] = useState(false);
  const clientRef = useRef<Ds5BridgeHidClient | null>(null);
  const configRef = useRef<ConfigBody | null>(null);
  const deviceConfigRef = useRef<ConfigBody | null>(null);
  const draftRef = useRef<ConfigBody>(DEFAULT_CONFIG);
  const snapshotReadyRef = useRef(false);
  const batterySupportedRef = useRef(false);
  const batteryAppliedRef = useRef<boolean | null>(null);
  const batteryDraftRef = useRef(false);
  const generationRef = useRef(0);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const applyPromiseRef = useRef<Promise<boolean> | null>(null);
  const usbEffectiveConfigRef = useRef<UsbEffectiveConfig | null>(null);
  const applyingRef = useRef(false);

  const issues = useMemo(() => validateConfig(draft), [draft]);
  const isConnected = Boolean(client?.device.opened);
  const isDirty = hasValidSnapshot &&
    (!configsEqual(config, draft) || (batteryFeedbackSupported && batteryFeedbackApplied !== batteryFeedbackDraft));
  const isDefaultConfig = hasValidSnapshot && configsEqual(draft, DEFAULT_CONFIG) &&
    configsEqual(config, DEFAULT_CONFIG) &&
    (!batteryFeedbackSupported || (!batteryFeedbackDraft && batteryFeedbackApplied === false));
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
    if (!hasValidSnapshot) {
      return t("status.readRequired");
    }
    if (saveState === "saveFailed") {
      return t("status.saveFailed");
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
    if (saveState === "saveSent") {
      return t("status.saveSent");
    }
    return t("status.connected");
  }, [client, hasValidSnapshot, isDirty, operation, saveState, supported, t]);

  const refreshAuthorizedDevices = useCallback(async () => {
    if (!supported) {
      setAuthorizedDevices([]);
      return;
    }

    setAuthorizedDevices(await Ds5BridgeHidClient.authorizedDevices());
  }, [supported]);

  const isCurrent = useCallback(
    (nextClient: Ds5BridgeHidClient, generation: number) =>
      generationRef.current === generation && clientRef.current === nextClient,
    [],
  );

  const enqueueMutation = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const result = mutationQueueRef.current.then(task, task);
    mutationQueueRef.current = result.then(() => {}, () => {});
    return result;
  }, []);

  const invalidateSnapshot = useCallback((nextClient: Ds5BridgeHidClient, generation: number) => {
    if (isCurrent(nextClient, generation)) {
      snapshotReadyRef.current = false;
      setHasValidSnapshot(false);
    }
  }, [isCurrent]);

  const readSnapshotForMutation = useCallback(async (nextClient: Ds5BridgeHidClient, generation: number) => {
    try {
      const snapshot = await nextClient.readConfigSnapshot();
      if (!isCurrent(nextClient, generation)) return null;
      if (batterySupportedRef.current && !snapshot.batteryFeedback) throw new BatteryExtensionError();
      return snapshot;
    } catch (cause) {
      invalidateSnapshot(nextClient, generation);
      throw cause;
    }
  }, [invalidateSnapshot, isCurrent]);

  const readUntilMutationVisible = useCallback(async (
    nextClient: Ds5BridgeHidClient,
    generation: number,
    matches: (snapshot: ConfigSnapshot) => boolean,
  ): Promise<ConfigSnapshot | null> => {
    let latest: ConfigSnapshot | null = null;
    for (let attempt = 0; attempt < MUTATION_READBACK_MAX_ATTEMPTS; attempt += 1) {
      if (!isCurrent(nextClient, generation)) return null;
      if (attempt > 0) {
        // WebHID can finish SetFeature before the firmware's F6 callback runs.
        await new Promise<void>((resolve) => setTimeout(resolve, MUTATION_READBACK_RETRY_MS));
        if (!isCurrent(nextClient, generation)) return null;
      }
      latest = await readSnapshotForMutation(nextClient, generation);
      if (!latest) return null;
      if (matches(latest)) return latest;
    }
    return latest;
  }, [isCurrent, readSnapshotForMutation]);

  const readConfigWithClient = useCallback(async (
    nextClient: Ds5BridgeHidClient,
    generation: number,
    syncUsbEffectiveConfig = false,
  ) => {
    if (!isCurrent(nextClient, generation)) return;
    invalidateSnapshot(nextClient, generation);
    setOperation("reading");
    try {
      const snapshot = await nextClient.readConfigSnapshot();
      if (!isCurrent(nextClient, generation)) return;
      if (batterySupportedRef.current && !snapshot.batteryFeedback) throw new BatteryExtensionError();
      const nextConfig = normalizeConfig(snapshot.config);
      configRef.current = nextConfig;
      deviceConfigRef.current = snapshot.config;
      draftRef.current = nextConfig;
      batterySupportedRef.current = Boolean(snapshot.batteryFeedback);
      batteryAppliedRef.current = snapshot.batteryFeedback?.enabled ?? null;
      batteryDraftRef.current = snapshot.batteryFeedback?.enabled ?? false;
      if (syncUsbEffectiveConfig) {
        usbEffectiveConfigRef.current = pickUsbEffectiveConfig(nextConfig);
        setNeedsUsbReconnect(false);
      }
      setConfig(nextConfig);
      setDraft(nextConfig);
      setBatteryFeedbackSupported(batterySupportedRef.current);
      setBatteryFeedbackApplied(batteryAppliedRef.current);
      setBatteryFeedbackDraftState(batteryDraftRef.current);
      snapshotReadyRef.current = true;
      setHasValidSnapshot(true);
      setSaveState("idle");
      setError(null);
    } finally {
      if (isCurrent(nextClient, generation)) setOperation(null);
    }
  }, [invalidateSnapshot, isCurrent]);

  const readFirmwareVersionWithClient = useCallback(async (nextClient: Ds5BridgeHidClient, generation: number) => {
    if (!isCurrent(nextClient, generation)) return;
    setOperation("readingFirmware");
    try {
      const version = await nextClient.readFirmwareVersion();
      if (!isCurrent(nextClient, generation)) return;
      setFirmwareVersion(version);
      setError(null);
    } finally {
      if (isCurrent(nextClient, generation)) setOperation(null);
    }
  }, [isCurrent]);

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
      const generation = ++generationRef.current;
      mutationQueueRef.current = Promise.resolve();
      applyingRef.current = false;
      applyPromiseRef.current = null;
      clientRef.current = null;
      snapshotReadyRef.current = false;
      configRef.current = null;
      deviceConfigRef.current = null;
      draftRef.current = DEFAULT_CONFIG;
      batterySupportedRef.current = false;
      batteryAppliedRef.current = null;
      batteryDraftRef.current = false;
      usbEffectiveConfigRef.current = null;
      setClient(null);
      setFirmwareVersion(null);
      setSignalStrengthRssi(null);
      setAudioActivity(null);
      setConfig(null);
      setDraft(DEFAULT_CONFIG);
      setHasValidSnapshot(false);
      setBatteryFeedbackSupported(false);
      setBatteryFeedbackApplied(null);
      setBatteryFeedbackDraftState(false);
      setSaveState("idle");
      setNeedsUsbReconnect(false);
      setOperation("connecting");
      try {
        await nextClient.open();
        if (generationRef.current !== generation) return;
        clientRef.current = nextClient;
        setClient(nextClient);
        setFirmwareVersion(null);
        setSignalStrengthRssi(null);
        setAudioActivity(null);
        setError(null);
      } finally {
        if (generationRef.current === generation) setOperation(null);
      }
      await readConfigWithClient(nextClient, generation, true);
      if (!isCurrent(nextClient, generation)) return;
      try {
        await readFirmwareVersionWithClient(nextClient, generation);
      } catch (cause) {
        if (isCurrent(nextClient, generation)) {
          setFirmwareVersion(null);
          setError(errorMessage(cause, t));
          setOperation(null);
        }
      }
      if (isCurrent(nextClient, generation)) void readSignalStrengthWithClient(nextClient);
    },
    [isCurrent, readConfigWithClient, readFirmwareVersionWithClient, readSignalStrengthWithClient, t],
  );

  const connect = useCallback(async () => {
    const beforeRequest = generationRef.current;
    let expectedGeneration = beforeRequest;
    try {
      const requested = await Ds5BridgeHidClient.requestDevice();
      if (generationRef.current !== beforeRequest) return;
      const attached = attachClient(requested);
      const generation = generationRef.current;
      expectedGeneration = generation;
      await attached;
      if (generationRef.current !== generation) return;
      await refreshAuthorizedDevices();
    } catch (cause) {
      if (generationRef.current === expectedGeneration) {
        setError(errorMessage(cause, t));
        setOperation(null);
      }
    }
  }, [attachClient, refreshAuthorizedDevices, t]);

  const connectAuthorized = useCallback(
    async (device: HIDDevice) => {
      const attached = attachClient(new Ds5BridgeHidClient(device));
      const generation = generationRef.current;
      try {
        await attached;
      } catch (cause) {
        if (generationRef.current === generation) {
          setError(errorMessage(cause, t));
          setOperation(null);
        }
      }
    },
    [attachClient, t],
  );

  const readConfig = useCallback(async () => {
    const nextClient = clientRef.current;
    const generation = generationRef.current;
    if (!nextClient) return;
    await enqueueMutation(async () => {
      if (!isCurrent(nextClient, generation)) return;
      try {
        await readConfigWithClient(nextClient, generation);
      } catch (cause) {
        if (isCurrent(nextClient, generation)) setError(errorMessage(cause, t));
      }
    });
  }, [enqueueMutation, isCurrent, readConfigWithClient, t]);

  const applyLatestDraft = useCallback(async (): Promise<boolean> => {
    const nextClient = clientRef.current;
    const generation = generationRef.current;
    if (!nextClient || !snapshotReadyRef.current) return false;
    if (applyingRef.current) {
      return applyPromiseRef.current ?? false;
    }

    applyingRef.current = true;
    const task = enqueueMutation(async (): Promise<boolean> => {
      if (!isCurrent(nextClient, generation) || !snapshotReadyRef.current) return false;
      setOperation("applying");
      let mode3Rejected = false;
    try {
      while (true) {
        if (!isCurrent(nextClient, generation) || !snapshotReadyRef.current) return false;
        const nextDraft = normalizeConfig(draftRef.current);
        if (validateConfig(nextDraft).length > 0) return false;

        if (!configsEqual(configRef.current, nextDraft)) {
          await nextClient.applyConfig(nextDraft);
          if (!isCurrent(nextClient, generation)) return false;
          let appliedConfig = nextDraft;
          if (batterySupportedRef.current || nextDraft.pollingRateMode === 3) {
            const snapshot = await readUntilMutationVisible(nextClient, generation, (readback) =>
              batterySupportedRef.current
                ? sameWireConfig(readback.config, nextDraft)
                : readback.config.pollingRateMode === 3);
            if (!snapshot) return false;
            appliedConfig = normalizeConfig(snapshot.config);
            deviceConfigRef.current = snapshot.config;
            if (batterySupportedRef.current && !sameWireConfig(snapshot.config, nextDraft)) {
              configRef.current = appliedConfig;
              setConfig(appliedConfig);
              setSaveState("dirty");
              setError(t("errors.baseReadbackMismatch"));
              return false;
            }
          } else {
            deviceConfigRef.current = nextDraft;
          }
          configRef.current = appliedConfig;
          setConfig(appliedConfig);
          setNeedsUsbReconnect(usbEffectiveConfigChanged(usbEffectiveConfigRef.current, appliedConfig));
          setSaveState("applied");

          if (nextDraft.pollingRateMode === 3) {
            // Keep edits made while the HID request was in flight; use F7 for
            // fields the user did not change during that request.
            const queuedDraft = draftRef.current;
            const nextVisibleDraft = { ...appliedConfig };
            for (const field of Object.keys(nextDraft) as (keyof ConfigBody)[]) {
              if (queuedDraft[field] !== nextDraft[field]) {
                Object.assign(nextVisibleDraft, { [field]: queuedDraft[field] });
              }
            }
            if (appliedConfig.pollingRateMode !== 3) {
              mode3Rejected = true;
              if (nextVisibleDraft.pollingRateMode === 3) {
                nextVisibleDraft.pollingRateMode = appliedConfig.pollingRateMode;
              }
              setError(t("errors.mode3RequiresNewFirmware"));
            } else if (!mode3Rejected) {
              setError(null);
            }
            draftRef.current = nextVisibleDraft;
            setDraft(nextVisibleDraft);
          } else {
            if (!mode3Rejected) setError(null);
            if (configsEqual(draftRef.current, nextDraft)) {
              draftRef.current = nextDraft;
              setDraft(nextDraft);
            }
          }
          continue;
        }

        if (batterySupportedRef.current && batteryAppliedRef.current !== batteryDraftRef.current) {
          const requested = batteryDraftRef.current;
          await nextClient.applyBatteryFeedback(requested);
          if (!isCurrent(nextClient, generation)) return false;
          const snapshot = await readUntilMutationVisible(nextClient, generation, (readback) =>
            readback.batteryFeedback?.enabled === requested &&
            sameWireConfig(readback.config, deviceConfigRef.current));
          if (!snapshot?.batteryFeedback) return false;
          batteryAppliedRef.current = snapshot.batteryFeedback.enabled;
          setBatteryFeedbackApplied(snapshot.batteryFeedback.enabled);
          if (!sameWireConfig(snapshot.config, deviceConfigRef.current)) {
            deviceConfigRef.current = snapshot.config;
            configRef.current = normalizeConfig(snapshot.config);
            setConfig(configRef.current);
            invalidateSnapshot(nextClient, generation);
            setSaveState("dirty");
            setError(t("errors.baseChangedDuringBatteryWrite"));
            return false;
          }
          if (snapshot.batteryFeedback.enabled !== requested) {
            setSaveState("dirty");
            setError(t("errors.batteryReadbackMismatch"));
            return false;
          }
          setSaveState("applied");
          setError(null);
          continue;
        }
        break;
      }
    } catch (cause) {
      invalidateSnapshot(nextClient, generation);
      if (isCurrent(nextClient, generation)) setError(errorMessage(cause, t));
      return false;
    } finally {
      if (isCurrent(nextClient, generation)) setOperation(null);
    }
    return true;
    });
    applyPromiseRef.current = task;
    try {
      return await task;
    } finally {
      if (isCurrent(nextClient, generation)) {
        applyingRef.current = false;
        applyPromiseRef.current = null;
      }
    }
  }, [enqueueMutation, invalidateSnapshot, isCurrent, readUntilMutationVisible, t]);

  const saveToFlash = useCallback(async () => {
    const nextClient = clientRef.current;
    const generation = generationRef.current;
    if (!nextClient || !snapshotReadyRef.current) return;
    await enqueueMutation(async () => {
      if (!isCurrent(nextClient, generation) || !snapshotReadyRef.current ||
        !configsEqual(configRef.current, draftRef.current) ||
        (batterySupportedRef.current && batteryAppliedRef.current !== batteryDraftRef.current)) return;
      setOperation("saving");
      try {
        if (batterySupportedRef.current) {
          // A previous save may have left status 1 in F7. Reset that latch
          // with an idempotent flag write before accepting a new status 1.
          await nextClient.applyBatteryFeedback(batteryDraftRef.current);
          if (!isCurrent(nextClient, generation)) return;
          const pending = await readUntilMutationVisible(nextClient, generation, (readback) =>
            sameWireConfig(readback.config, deviceConfigRef.current) &&
            readback.batteryFeedback?.enabled === batteryDraftRef.current &&
            readback.batteryFeedback?.saveStatus === 0);
          if (!pending) return;
          if (!sameWireConfig(pending.config, deviceConfigRef.current) ||
            pending.batteryFeedback?.enabled !== batteryDraftRef.current ||
            pending.batteryFeedback?.saveStatus !== 0) {
            setSaveState("saveFailed");
            setError(t("errors.saveNotVerified"));
            return;
          }
        }
        await nextClient.saveToFlash();
        if (!isCurrent(nextClient, generation)) return;
        const snapshot = batterySupportedRef.current
          ? await readUntilMutationVisible(nextClient, generation, (readback) =>
              sameWireConfig(readback.config, deviceConfigRef.current) &&
              configsEqual(configRef.current, draftRef.current) &&
              readback.batteryFeedback?.enabled === batteryDraftRef.current &&
              readback.batteryFeedback?.saveStatus === 1)
          : await readSnapshotForMutation(nextClient, generation);
        if (!snapshot) return;
        const savedConfig = normalizeConfig(snapshot.config);
        const matches = sameWireConfig(snapshot.config, deviceConfigRef.current) &&
          configsEqual(configRef.current, draftRef.current) &&
          (!batterySupportedRef.current || snapshot.batteryFeedback?.enabled === batteryDraftRef.current);
        if (!matches || (batterySupportedRef.current && snapshot.batteryFeedback?.saveStatus !== 1)) {
          deviceConfigRef.current = snapshot.config;
          configRef.current = savedConfig;
          setConfig(savedConfig);
          batteryAppliedRef.current = snapshot.batteryFeedback?.enabled ?? null;
          setBatteryFeedbackApplied(batteryAppliedRef.current);
          setSaveState("saveFailed");
          setError(t("errors.saveNotVerified"));
          return;
        }
        deviceConfigRef.current = snapshot.config;
        setSaveState(batterySupportedRef.current ? "saved" : "saveSent");
        setError(null);
      } catch (cause) {
        invalidateSnapshot(nextClient, generation);
        if (isCurrent(nextClient, generation)) {
          setSaveState("saveFailed");
          setError(errorMessage(cause, t));
        }
      } finally {
        if (isCurrent(nextClient, generation)) setOperation(null);
      }
    });
  }, [enqueueMutation, invalidateSnapshot, isCurrent, readSnapshotForMutation, readUntilMutationVisible, t]);

  const reconnectUsb = useCallback(async () => {
    const nextClient = clientRef.current;
    const generation = generationRef.current;
    if (!nextClient || !snapshotReadyRef.current) return;
    await enqueueMutation(async () => {
      if (!isCurrent(nextClient, generation) || !snapshotReadyRef.current) return;
      setOperation("reconnecting");
      try {
        await nextClient.reconnectUsb();
        if (!isCurrent(nextClient, generation)) return;
        usbEffectiveConfigRef.current = pickUsbEffectiveConfig(configRef.current ?? draftRef.current);
        setNeedsUsbReconnect(false);
        setError(null);
      } catch (cause) {
        if (isCurrent(nextClient, generation)) setError(errorMessage(cause, t));
      } finally {
        if (isCurrent(nextClient, generation)) setOperation(null);
      }
    });
  }, [enqueueMutation, isCurrent, t]);

  const setDraftField = useCallback(
    <Key extends keyof ConfigBody>(field: Key, value: ConfigBody[Key]) => {
      if (!clientRef.current?.device.opened || !snapshotReadyRef.current) {
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

  const setBatteryFeedbackDraft = useCallback((value: boolean) => {
    if (!clientRef.current?.device.opened || !snapshotReadyRef.current || !batterySupportedRef.current) return;
    batteryDraftRef.current = value;
    setBatteryFeedbackDraftState(value);
    setSaveState("dirty");
    void applyLatestDraft();
  }, [applyLatestDraft]);

  const resetToDefaults = useCallback(async () => {
    const nextClient = clientRef.current;
    const generation = generationRef.current;
    if (!nextClient || !snapshotReadyRef.current) return;

    draftRef.current = DEFAULT_CONFIG;
    setDraft(DEFAULT_CONFIG);
    if (batterySupportedRef.current) {
      batteryDraftRef.current = false;
      setBatteryFeedbackDraftState(false);
    }
    setSaveState("dirty");

    const applied = await applyLatestDraft();
    if (!applied || !isCurrent(nextClient, generation) || !snapshotReadyRef.current ||
      !configsEqual(configRef.current, DEFAULT_CONFIG) ||
      (batterySupportedRef.current && batteryAppliedRef.current !== false)) return;
    await saveToFlash();
  }, [applyLatestDraft, isCurrent, saveToFlash]);

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
      if (clientRef.current?.device === event.device) {
        generationRef.current += 1;
        mutationQueueRef.current = Promise.resolve();
        applyingRef.current = false;
        applyPromiseRef.current = null;
        clientRef.current = null;
        configRef.current = null;
        deviceConfigRef.current = null;
        draftRef.current = DEFAULT_CONFIG;
        snapshotReadyRef.current = false;
        batterySupportedRef.current = false;
        batteryAppliedRef.current = null;
        batteryDraftRef.current = false;
        usbEffectiveConfigRef.current = null;
        setClient(null);
        setFirmwareVersion(null);
        setSignalStrengthRssi(null);
        setAudioActivity(null);
        setConfig(null);
        setDraft(DEFAULT_CONFIG);
        setHasValidSnapshot(false);
        setBatteryFeedbackSupported(false);
        setBatteryFeedbackApplied(null);
        setBatteryFeedbackDraftState(false);
        setNeedsUsbReconnect(false);
        setSaveState("idle");
        setOperation(null);
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
  }, [refreshAuthorizedDevices, t]);

  return {
    supported,
    client,
    deviceLabel,
    firmwareVersion,
    signalStrengthRssi,
    audioActivity,
    authorizedDevices,
    config,
    draft,
    hasValidSnapshot,
    batteryFeedbackSupported,
    batteryFeedbackApplied,
    batteryFeedbackDraft,
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
    setBatteryFeedbackDraft,
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
    enableUsbSn: config.enableUsbSn,
  };
}

function sameWireConfig(left: ConfigBody, right: ConfigBody | null): boolean {
  if (!right) return false;
  const actual = encodeConfigBody(left);
  const expected = encodeConfigBody(right);
  return actual.every((byte, index) => byte === expected[index]);
}

function usbEffectiveConfigChanged(current: UsbEffectiveConfig | null, next: ConfigBody): boolean {
  if (!current) {
    return false;
  }

  return (
    current.pollingRateMode !== next.pollingRateMode ||
    current.controllerMode !== next.controllerMode ||
    current.enableUsbSn !== next.enableUsbSn
  );
}

function errorMessage(cause: unknown, t: (key: string, values?: Record<string, unknown>) => string): string {
  if (cause instanceof BatteryExtensionError) return t("errors.invalidBatteryExtension");
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
