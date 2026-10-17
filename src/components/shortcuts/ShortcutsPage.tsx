import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BluetoothOff,
  CircleHelp,
  Gamepad2,
  Keyboard,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Volume2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { UseDs5BridgeResult } from "@/hooks/useDs5Bridge";
import {
  BUTTON_SOURCE_COUNT,
  BUTTON_TRANSLATION_KEYS,
  DPAD_MAX_ID,
  SHORTCUT_ACTION_BT_DISCONNECT,
  SHORTCUT_ACTION_CONSUMER,
  SHORTCUT_ACTION_KEYBOARD,
  SHORTCUT_COUNT,
  SHORTCUT_FLAG_DOUBLE_TAP,
  SHORTCUT_FLAG_HOLD,
  SHORTCUT_TRIGGER_DOUBLE_TAP,
  SHORTCUT_TRIGGER_TAP,
  ShortcutSlot,
  createDisabledShortcut,
  isShortcutDisabled,
  isShortcutSlotValid,
} from "@/protocol/buttons";
import {
  CONSUMER_OPTIONS,
  KEY_OPTIONS,
  MODIFIER_OPTIONS,
  consumerLabel,
  keyLabel,
} from "@/protocol/shortcutCatalog";

import {
  type TriggerGesture, getGesture, isChordGesture, isHoldGesture,
  setGesture, captureTrigger, validSecondTrigger,
} from "@/protocol/shortcutGestures";

interface ShortcutsPageProps {
  bridge: UseDs5BridgeResult;
}

/** A trigger is one button, or a chord of two. */
const MAX_TRIGGER_BUTTONS = 2;
/** Must match the firmware's SHORTCUT_LEARNING_WINDOW_MS. */
const LEARNING_WINDOW_MS = 5_000;

export function ShortcutsPage({ bridge }: ShortcutsPageProps) {
  const { t } = useTranslation();
  const gestureHintId = useId();
  const { setShortcut, startShortcutLearning, subscribeControllerButtons } = bridge;
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [capturedButtons, setCapturedButtons] = useState<number[]>([]);
  const captureRef = useRef<number[]>([]);
  const commitCaptureRef = useRef<(buttons: readonly number[]) => void>(() => {});
  const learningTimerRef = useRef<number | undefined>(undefined);
  const selectedSlot = bridge.shortcuts[selectedSlotIndex] ?? createDisabledShortcut();
  const isBusy = bridge.operation !== null;
  const allDisabled = bridge.shortcuts.every(isShortcutDisabled);
  const allSlotsValid = bridge.shortcuts.every(
    (shortcut) => isShortcutDisabled(shortcut) || isShortcutSlotValid(shortcut),
  );
  const gesture = isShortcutDisabled(selectedSlot) ? "tap" : getGesture(selectedSlot);
  const keyboardInterfaceEnabled = bridge.draft.enableKeyboard || bridge.draft.enableWake;
  const selectedKey = selectedSlot.payload[1];
  const keyOptions = useMemo(
    () =>
      KEY_OPTIONS.some((option) => option.value === selectedKey)
        ? KEY_OPTIONS
        : [...KEY_OPTIONS, { value: selectedKey, label: keyLabel(selectedKey) }],
    [selectedKey],
  );
  const selectedConsumerUsage = selectedSlot.payload[0] | (selectedSlot.payload[1] << 8);
  const consumerOptions = useMemo(
    () =>
      CONSUMER_OPTIONS.some((option) => option.value === selectedConsumerUsage)
        ? CONSUMER_OPTIONS
        : [...CONSUMER_OPTIONS, { value: selectedConsumerUsage, label: consumerLabel(selectedConsumerUsage) }],
    [selectedConsumerUsage],
  );

  const buttonLabel = (button: number) =>
    t(`buttons.${BUTTON_TRANSLATION_KEYS[button] ?? BUTTON_TRANSLATION_KEYS[0]}`);

  const triggerSummary = (shortcut: ShortcutSlot) => {
    if (isShortcutDisabled(shortcut)) {
      return t("shortcuts.empty");
    }
    const holdLabel = shortcut.flags & SHORTCUT_FLAG_HOLD ? ` · ${t("shortcuts.gestures.hold")}` : "";
    const first = buttonLabel(shortcut.triggerA);
    if (shortcut.triggerB === SHORTCUT_TRIGGER_TAP) {
      return first + holdLabel;
    }
    if (shortcut.triggerB === SHORTCUT_TRIGGER_DOUBLE_TAP) {
      return `${first} ×2`;
    }
    return `${first} + ${buttonLabel(shortcut.triggerB)}${shortcut.flags & SHORTCUT_FLAG_DOUBLE_TAP ? " ×2" : ""}${holdLabel}`;
  };

  const actionSummary = (shortcut: ShortcutSlot) => {
    if (isShortcutDisabled(shortcut)) {
      return t("shortcuts.addHint");
    }
    if (shortcut.action === SHORTCUT_ACTION_BT_DISCONNECT) {
      return t("shortcuts.actions.disconnect");
    }
    if (shortcut.action === SHORTCUT_ACTION_CONSUMER) {
      return consumerLabel(shortcut.payload[0] | (shortcut.payload[1] << 8));
    }

    const modifiers = MODIFIER_OPTIONS.filter(({ value }) => shortcut.payload[0] & value).map(
      ({ label }) => label,
    );
    if (shortcut.payload[1]) {
      modifiers.push(keyLabel(shortcut.payload[1]));
    }
    return modifiers.join(" + ") || t("shortcuts.invalid");
  };

  const updateSelectedSlot = (next: ShortcutSlot) => {
    bridge.setShortcut(selectedSlotIndex, next);
  };

  const updateGesture = (nextGesture: TriggerGesture) => {
    updateSelectedSlot(setGesture(selectedSlot, nextGesture));
  };

  const updateTriggerA = (triggerA: number) => {
    const next = { ...selectedSlot, triggerA };
    if (isChordGesture(gesture)) {
      next.triggerB = validSecondTrigger(triggerA, selectedSlot.triggerB);
    }
    updateSelectedSlot(next);
  };

  const updateAction = (action: number) => {
    if (action === SHORTCUT_ACTION_CONSUMER) {
      const usage = CONSUMER_OPTIONS[1].value;
      updateSelectedSlot({
        ...selectedSlot,
        action,
        payload: [usage & 0xff, usage >> 8, 0],
      });
      return;
    }
    if (action === SHORTCUT_ACTION_BT_DISCONNECT) {
      updateSelectedSlot({ ...selectedSlot, action, payload: [0, 0, 0] });
      return;
    }
    updateSelectedSlot({
      ...selectedSlot,
      action: SHORTCUT_ACTION_KEYBOARD,
      payload: selectedSlot.action === SHORTCUT_ACTION_KEYBOARD ? selectedSlot.payload : [0x08, 0x0a, 0],
    });
  };

  // The slot the capture writes into changes between renders, so the effect
  // below reaches the current version through a ref instead of resubscribing
  // (and losing the buttons captured so far) on every keystroke.
  const commitCapture = useCallback(
    (buttons: readonly number[]) => {
      if (buttons.length === 0) return;
      setShortcut(selectedSlotIndex, captureTrigger(selectedSlot, buttons));
    },
    [selectedSlot, selectedSlotIndex, setShortcut],
  );

  useEffect(() => {
    commitCaptureRef.current = commitCapture;
  }, [commitCapture]);

  useEffect(() => {
    if (!bridge.isConnected || isBusy) {
      setIsListening(false);
    }
  }, [bridge.isConnected, isBusy]);

  // The firmware pauses shortcut output for a fixed five-second window, so a
  // capture that outlives it would let the next press fire its own action.
  // The UI stops listening on the same schedule.
  useEffect(() => {
    if (!isListening) {
      return;
    }

    learningTimerRef.current = window.setTimeout(() => setIsListening(false), LEARNING_WINDOW_MS);
    return () => {
      window.clearTimeout(learningTimerRef.current);
      learningTimerRef.current = undefined;
    };
  }, [isListening]);

  useEffect(() => {
    if (!isListening) {
      captureRef.current = [];
      setCapturedButtons((current) => (current.length === 0 ? current : []));
      return;
    }

    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsListening(false);
      }
    };
    window.addEventListener("keydown", cancelOnEscape);

    const unsubscribe = subscribeControllerButtons((pressed) => {
      const captured = captureRef.current;
      const added = pressed.filter((button) => canExtendCapture(captured, button));
      if (added.length > 0) {
        captured.push(...added.slice(0, MAX_TRIGGER_BUTTONS - captured.length));
        setCapturedButtons([...captured]);
      }

      // The chord is only complete once every button is back up, so holding a
      // second button still extends the capture.
      if (captured.length > 0 && pressed.length === 0) {
        commitCaptureRef.current(captured);
        setIsListening(false);
      }
    });

    return () => {
      window.removeEventListener("keydown", cancelOnEscape);
      unsubscribe();
    };
  }, [isListening, subscribeControllerButtons]);

  const addShortcut = () => {
    updateSelectedSlot({
      triggerA: 20,
      triggerB: SHORTCUT_TRIGGER_TAP,
      action: SHORTCUT_ACTION_KEYBOARD,
      payload: [0x08, 0x0a, 0],
      flags: 0,
    });
  };

  return (
    <Card className="panel feature-page shortcuts-page">
      <div className="feature-page-header">
        <div className="feature-page-title">
          <span className="feature-page-icon" aria-hidden="true">
            <Keyboard size={20} />
          </span>
          <div>
            <h2>{t("shortcuts.title")}</h2>
            <p>{t("shortcuts.description")}</p>
          </div>
        </div>
        <div className="feature-page-actions">
          <Button
            type="button"
            variant="outline"
            onClick={bridge.readButtonSettings}
            disabled={!bridge.client || isBusy}
          >
            <RefreshCw size={16} />
            {t("common.read")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={bridge.resetShortcuts}
            disabled={!bridge.isConnected || isBusy || allDisabled}
          >
            <RotateCcw size={16} />
            {t("shortcuts.clearAll")}
          </Button>
          <Button
            type="button"
            onClick={bridge.saveShortcuts}
            disabled={!bridge.isConnected || isBusy || !bridge.areShortcutsDirty || !allSlotsValid}
          >
            <Save size={16} />
            {t("common.save")}
          </Button>
        </div>
      </div>

      {!keyboardInterfaceEnabled && (
        <div className="feature-warning" role="status">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{t("shortcuts.keyboardWarning")}</span>
        </div>
      )}

      <CardContent className="feature-page-content p-0">
        <div className="shortcut-workspace">
          <section className="shortcut-slots" aria-labelledby="shortcut-slots-title">
            <div className="shortcut-section-heading">
              <div>
                <h3 id="shortcut-slots-title">{t("shortcuts.slotsTitle")}</h3>
                <p>{t("shortcuts.slotsHint")}</p>
              </div>
              <span>{SHORTCUT_COUNT}</span>
            </div>
            <div className="shortcut-slot-list">
              {bridge.shortcuts.map((shortcut, index) => {
                const enabled = !isShortcutDisabled(shortcut);
                return (
                  <button
                    key={index}
                    type="button"
                    className={enabled ? "configured" : undefined}
                    aria-pressed={selectedSlotIndex === index}
                    onClick={() => {
                      setIsListening(false);
                      setSelectedSlotIndex(index);
                    }}
                  >
                    <span className="shortcut-slot-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="shortcut-slot-copy">
                      <strong>{triggerSummary(shortcut)}</strong>
                      <small>{actionSummary(shortcut)}</small>
                    </span>
                    <span className={`shortcut-slot-state ${enabled ? "enabled" : ""}`}>
                      {enabled ? t("shortcuts.on") : t("shortcuts.off")}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="shortcut-editor" aria-labelledby="shortcut-editor-title">
            <div className="shortcut-editor-heading">
              <div>
                <span>{t("shortcuts.slotLabel", { slot: selectedSlotIndex + 1 })}</span>
                <h3 id="shortcut-editor-title">{triggerSummary(selectedSlot)}</h3>
              </div>
              {!isShortcutDisabled(selectedSlot) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => bridge.clearShortcut(selectedSlotIndex)}
                  disabled={!bridge.isConnected || isBusy}
                >
                  <Trash2 size={15} />
                  {t("shortcuts.remove")}
                </Button>
              )}
            </div>

            {isShortcutDisabled(selectedSlot) ? (
              <div className="shortcut-empty-state">
                <span aria-hidden="true">
                  <Plus size={22} />
                </span>
                <h4>{t("shortcuts.emptyTitle")}</h4>
                <p>{t("shortcuts.emptyDescription")}</p>
                <Button type="button" onClick={addShortcut} disabled={!bridge.isConnected || isBusy}>
                  <Plus size={16} />
                  {t("shortcuts.add")}
                </Button>
              </div>
            ) : (
              <div className="shortcut-form">
                <fieldset disabled={!bridge.isConnected || isBusy}>
                  <legend>{t("shortcuts.triggerType")}</legend>
                  <div className="choice-grid gesture-choice-grid">
                    {(["tap", "doubleTap", "chord", "doubleChord", "hold", "holdChord"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={isHoldGesture(option) && selectedSlot.action !== SHORTCUT_ACTION_KEYBOARD}
                        aria-describedby={gesture === option ? gestureHintId : undefined}
                        aria-pressed={gesture === option}
                        onClick={() => updateGesture(option)}
                      >
                        {t(`shortcuts.gestures.${option}`)}
                      </button>
                    ))}
                  </div>
                  <div className="shortcut-gesture-help">
                    <p id={gestureHintId} className="shortcut-gesture-hint">
                      {t(`shortcuts.gestureHints.${gesture}`)}
                    </p>
                    <details className="shortcut-help-details">
                      <summary>
                        <CircleHelp size={15} aria-hidden="true" />
                        {t("shortcuts.usageHelp")}
                      </summary>
                      <ul>
                        <li>{t("shortcuts.holdGamepadHelp")}</li>
                      </ul>
                    </details>
                  </div>
                  <div className={`shortcut-listen${isListening ? " listening" : ""}`}>
                    <Button
                      type="button"
                      variant={isListening ? "default" : "outline"}
                      size="sm"
                      aria-pressed={isListening}
                      onClick={() => {
                        if (isListening) {
                          setIsListening(false);
                          return;
                        }
                        setIsListening(true);
                        // Each capture pass opens a fresh firmware window.
                        void startShortcutLearning();
                      }}
                    >
                      <Gamepad2 size={15} />
                      {t(isListening ? "shortcuts.listenCancel" : "shortcuts.listen")}
                    </Button>
                    <span className="shortcut-listen-status" role="status">
                      {!isListening
                        ? t("shortcuts.listenHint")
                        : capturedButtons.length === 0
                          ? t("shortcuts.listenWaiting")
                          : t("shortcuts.listenCaptured", {
                              buttons: capturedButtons.map(buttonLabel).join(" + "),
                            })}
                    </span>
                  </div>
                </fieldset>

                <div className="shortcut-field-grid">
                  <label>
                    <span>{t("shortcuts.triggerA")}</span>
                    <span className="select-shell">
                      <select
                        value={selectedSlot.triggerA}
                        disabled={!bridge.isConnected || isBusy}
                        onChange={(event) => updateTriggerA(Number(event.target.value))}
                      >
                        {Array.from({ length: BUTTON_SOURCE_COUNT }, (_, button) => (
                          <option key={button} value={button}>
                            {buttonLabel(button)}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>

                  {isChordGesture(gesture) && (
                    <label>
                      <span>{t("shortcuts.triggerB")}</span>
                      <span className="select-shell">
                        <select
                          value={selectedSlot.triggerB}
                          disabled={!bridge.isConnected || isBusy}
                          onChange={(event) =>
                            updateSelectedSlot({ ...selectedSlot, triggerB: Number(event.target.value) })
                          }
                        >
                          {Array.from({ length: BUTTON_SOURCE_COUNT }, (_, button) => button)
                            .filter(
                              (button) =>
                                button !== selectedSlot.triggerA &&
                                !(button <= DPAD_MAX_ID && selectedSlot.triggerA <= DPAD_MAX_ID),
                            )
                            .map((button) => (
                              <option key={button} value={button}>
                                {buttonLabel(button)}
                              </option>
                            ))}
                        </select>
                      </span>
                    </label>
                  )}
                </div>

                <fieldset disabled={!bridge.isConnected || isBusy}>
                  <legend>{t("shortcuts.outputType")}</legend>
                  <div className="choice-grid action-choice-grid">
                    <button
                      type="button"
                      aria-pressed={selectedSlot.action === SHORTCUT_ACTION_KEYBOARD}
                      onClick={() => updateAction(SHORTCUT_ACTION_KEYBOARD)}
                    >
                      <Keyboard size={16} aria-hidden="true" />
                      {t("shortcuts.actions.keyboard")}
                    </button>
                    <button
                      type="button"
                      disabled={isHoldGesture(gesture)}
                      aria-pressed={selectedSlot.action === SHORTCUT_ACTION_CONSUMER}
                      onClick={() => updateAction(SHORTCUT_ACTION_CONSUMER)}
                    >
                      <Volume2 size={16} aria-hidden="true" />
                      {t("shortcuts.actions.consumer")}
                    </button>
                    <button
                      type="button"
                      disabled={isHoldGesture(gesture)}
                      aria-pressed={selectedSlot.action === SHORTCUT_ACTION_BT_DISCONNECT}
                      onClick={() => updateAction(SHORTCUT_ACTION_BT_DISCONNECT)}
                    >
                      <BluetoothOff size={16} aria-hidden="true" />
                      {t("shortcuts.actions.disconnect")}
                    </button>
                  </div>
                </fieldset>

                {selectedSlot.action === SHORTCUT_ACTION_KEYBOARD && (
                  <div className="shortcut-output-editor">
                    <div>
                      <span className="field-label">{t("shortcuts.modifiers")}</span>
                      <div className="modifier-grid">
                        {MODIFIER_OPTIONS.map(({ value, label }) => {
                          const active = Boolean(selectedSlot.payload[0] & value);
                          return (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={active}
                              disabled={!bridge.isConnected || isBusy}
                              onClick={() =>
                                updateSelectedSlot({
                                  ...selectedSlot,
                                  payload: [selectedSlot.payload[0] ^ value, selectedSlot.payload[1], 0],
                                })
                              }
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label>
                      <span>{t("shortcuts.key")}</span>
                      <span className="select-shell">
                        <select
                          value={selectedSlot.payload[1]}
                          disabled={!bridge.isConnected || isBusy}
                          onChange={(event) =>
                            updateSelectedSlot({
                              ...selectedSlot,
                              payload: [selectedSlot.payload[0], Number(event.target.value), 0],
                            })
                          }
                        >
                          {keyOptions.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </span>
                    </label>
                  </div>
                )}

                {selectedSlot.action === SHORTCUT_ACTION_CONSUMER && (
                  <label className="shortcut-consumer-field">
                    <span>{t("shortcuts.consumerKey")}</span>
                    <span className="select-shell">
                      <select
                        value={selectedConsumerUsage}
                        disabled={!bridge.isConnected || isBusy}
                        onChange={(event) => {
                          const usage = Number(event.target.value);
                          updateSelectedSlot({
                            ...selectedSlot,
                            payload: [usage & 0xff, usage >> 8, 0],
                          });
                        }}
                      >
                        {consumerOptions.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                )}

                {!isShortcutSlotValid(selectedSlot) && (
                  <p className="shortcut-validation" role="alert">
                    <AlertTriangle size={15} aria-hidden="true" />
                    {t("shortcuts.invalidDescription")}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The firmware rejects a repeated button and a chord of two d-pad directions
 * (`isShortcutSlotValid`), so neither can ever enter a capture.
 */
function canExtendCapture(captured: readonly number[], button: number): boolean {
  return (
    captured.length < MAX_TRIGGER_BUTTONS &&
    !captured.includes(button) &&
    !(captured.length > 0 && captured[0] <= DPAD_MAX_ID && button <= DPAD_MAX_ID)
  );
}
