import { Gauge, Gamepad2, SlidersHorizontal, Volume2, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UseDs5BridgeResult } from "../hooks/useDs5Bridge";
import { fieldIssue } from "../protocol/config";
import { ControllerModeControl } from "./config/ControllerModeControl";
import { FloatControl } from "./config/FloatControl";
import { IntegerControl } from "./config/IntegerControl";
import { PollingRateControl } from "./config/PollingRateControl";
import { ToggleControl } from "./config/ToggleControl";
import { VolumeByteControl } from "./config/VolumeByteControl";

interface ConfigPanelProps {
  bridge: UseDs5BridgeResult;
}

export function ConfigPanel({ bridge }: ConfigPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className="panel config-panel">
      <CardHeader className="p-0">
        <CardTitle className="panel-title">
          <SlidersHorizontal size={18} />
          <h2>{t("config.title")}</h2>
        </CardTitle>
      </CardHeader>

      <CardContent className="config-sections p-0">
        <section className="config-section config-section-featured">
          <div className="config-section-heading">
            <span className="config-section-icon">
              <Volume2 size={17} />
            </span>
            <div>
              <h3>{t("config.sections.feedback")}</h3>
              <p>{t("config.sections.feedbackDescription")}</p>
            </div>
          </div>
          <div className="control-stack feedback-controls">
            <FloatControl
              label={t("config.hapticsGain")}
              value={bridge.draft.hapticsGain}
              min={1}
              max={2}
              step={0.05}
              issue={fieldIssue(bridge.issues, "hapticsGain")}
              onChange={(value) => bridge.setDraftField("hapticsGain", value)}
            />
            <IntegerControl
              label={t("config.speakerGain")}
              value={bridge.draft.speakerGain}
              min={0}
              max={7}
              issue={fieldIssue(bridge.issues, "speakerGain")}
              onChange={(value) => bridge.setDraftField("speakerGain", value)}
            />
            <VolumeByteControl
              label={t("config.headsetVolume")}
              value={bridge.draft.headsetVolume}
              sliderMax={100}
              valueToSlider={volumeParameterToPercent}
              sliderToValue={percentToVolumeParameter}
              inputMax={127}
              valueToInput={volumeParameterToInput}
              inputToValue={volumeInputToParameter}
              issue={fieldIssue(bridge.issues, "headsetVolume")}
              onChange={(value) => bridge.setDraftField("headsetVolume", value)}
            />
            <VolumeByteControl
              label={t("config.speakerVolume")}
              value={bridge.draft.speakerVolume}
              sliderMax={100}
              valueToSlider={volumeParameterToPercent}
              sliderToValue={percentToVolumeParameter}
              inputMax={127}
              valueToInput={volumeParameterToInput}
              inputToValue={volumeInputToParameter}
              issue={fieldIssue(bridge.issues, "speakerVolume")}
              onChange={(value) => bridge.setDraftField("speakerVolume", value)}
            />
            <ToggleControl
              label={t("config.syncSpeakerHeadsetVolume")}
              value={bridge.draft.syncSpeakerHeadsetVolume}
              onChange={(value) => bridge.setDraftField("syncSpeakerHeadsetVolume", value)}
            />
            <ToggleControl
              label={t("config.lockVolume")}
              value={bridge.draft.lockVolume}
              onChange={(value) => bridge.setDraftField("lockVolume", value)}
            />
            <IntegerControl
              label={t("config.audioBufferLength")}
              value={bridge.draft.audioBufferLength}
              min={16}
              max={128}
              issue={fieldIssue(bridge.issues, "audioBufferLength")}
              onChange={(value) => bridge.setDraftField("audioBufferLength", value)}
            />
          </div>
        </section>

        <div className="config-section-grid">
          <div className="config-section-column">
            <section className="config-section">
              <div className="config-section-heading">
                <span className="config-section-icon">
                  <Zap size={17} />
                </span>
                <div>
                  <h3>{t("config.sections.power")}</h3>
                  <p>{t("config.sections.powerDescription")}</p>
                </div>
              </div>
              <div className="control-stack compact-stack">
                <IntegerControl
                  label={`${t("config.inactiveTime")} (${t("config.inactiveTimeUnit")})`}
                  value={bridge.draft.inactiveTime}
                  min={5}
                  max={60}
                  issue={fieldIssue(bridge.issues, "inactiveTime")}
                  onChange={(value) => bridge.setDraftField("inactiveTime", value)}
                />
                <ToggleControl
                  label={t("config.disableInactiveDisconnect")}
                  value={bridge.draft.disableInactiveDisconnect}
                  onChange={(value) => bridge.setDraftField("disableInactiveDisconnect", value)}
                />
                <ToggleControl
                  label={t("config.disablePicoLed")}
                  value={bridge.draft.disablePicoLed}
                  onChange={(value) => bridge.setDraftField("disablePicoLed", value)}
                />
                <ToggleControl
                  label={t("config.disableMic")}
                  value={bridge.draft.disableMic}
                  onChange={(value) => bridge.setDraftField("disableMic", value)}
                />
                <ToggleControl
                  label={t("config.disableSpeaker")}
                  value={bridge.draft.disableSpeaker}
                  onChange={(value) => bridge.setDraftField("disableSpeaker", value)}
                />
              </div>
            </section>
          </div>

          <div className="config-section-column">
            <section className="config-section">
              <div className="config-section-heading">
                <span className="config-section-icon">
                  <Gauge size={17} />
                </span>
                <div>
                  <h3>{t("config.sections.performance")}</h3>
                  <p>{t("config.sections.performanceDescription")}</p>
                </div>
              </div>
              <div className="control-stack compact-stack">
                <PollingRateControl
                  value={bridge.draft.pollingRateMode}
                  onChange={(value) => bridge.setDraftField("pollingRateMode", value)}
                />
              </div>
            </section>

            <section className="config-section">
              <div className="config-section-heading">
                <span className="config-section-icon">
                  <Gamepad2 size={17} />
                </span>
                <div>
                  <h3>{t("config.sections.compatibility")}</h3>
                  <p>{t("config.sections.compatibilityDescription")}</p>
                </div>
              </div>
              <div className="control-stack compact-stack">
                <ControllerModeControl
                  value={bridge.draft.controllerMode}
                  onChange={(value) => bridge.setDraftField("controllerMode", value)}
                />
                <ToggleControl
                  label={t("config.disableUsbSn")}
                  value={bridge.draft.disableUsbSn}
                  onChange={(value) => bridge.setDraftField("disableUsbSn", value)}
                />
                <ToggleControl
                  label={t("config.psShortcutEnabled")}
                  value={bridge.draft.psShortcutEnabled}
                  onChange={(value) => bridge.setDraftField("psShortcutEnabled", value)}
                />
              </div>
            </section>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function volumeParameterToPercent(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 100) {
    return 100;
  }

  return Math.min(100, Math.max(0, 100 * 10 ** ((value - 100) / 35)));
}

function percentToVolumeParameter(value: number): number {
  if (value <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, 100 + 35 * Math.log10(value / 100)));
}

function volumeParameterToInput(value: number): number {
  if (value > 100) {
    return value;
  }

  return volumeParameterToPercent(value);
}

function volumeInputToParameter(value: number): number {
  if (value > 100) {
    return value;
  }

  return percentToVolumeParameter(value);
}

