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

interface ConfigPanelProps {
  bridge: UseDs5BridgeResult;
}

export function ConfigPanel({ bridge }: ConfigPanelProps) {
  const { t } = useTranslation();
  const controlsDisabled = !bridge.isConnected;

  return (
    <Card className="panel config-panel">
      <CardHeader className="p-0">
        <CardTitle className="panel-title">
          <SlidersHorizontal size={18} />
          <h2>{t("config.title")}</h2>
        </CardTitle>
      </CardHeader>

      <CardContent className="config-sections p-0">
        <div className="config-column">
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
            <div className="control-stack">
              <FloatControl
                label={t("config.hapticsGain")}
                value={bridge.draft.hapticsGain}
                min={1}
                max={2}
                step={0.05}
                helpContent={t("config.help.hapticsGain")}
                issue={fieldIssue(bridge.issues, "hapticsGain")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("hapticsGain", value)}
              />
              {/*
              <IntegerControl
                label={t("config.speakerVolume")}
                value={bridge.draft.speakerVolume}
                min={0}
                max={127}
                helpContent={t("config.help.speakerVolume")}
                issue={fieldIssue(bridge.issues, "speakerVolume")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("speakerVolume", value)}
              />
              <IntegerControl
                label={t("config.headsetVolume")}
                value={bridge.draft.headsetVolume}
                min={0}
                max={127}
                helpContent={t("config.help.headsetVolume")}
                issue={fieldIssue(bridge.issues, "headsetVolume")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("headsetVolume", value)}
              />
              */}
              <IntegerControl
                label={t("config.speakerGain")}
                value={bridge.draft.speakerGain}
                min={0}
                max={7}
                helpContent={t("config.help.speakerGain")}
                issue={fieldIssue(bridge.issues, "speakerGain")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("speakerGain", value)}
              />
              <IntegerControl
                label={t("config.triggerReduce")}
                value={bridge.draft.triggerReduce}
                min={0}
                max={10}
                helpContent={t("config.help.triggerReduce")}
                issue={fieldIssue(bridge.issues, "triggerReduce")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("triggerReduce", value)}
              />
              <IntegerControl
                label={t("config.audioBufferLength")}
                value={bridge.draft.audioBufferLength}
                min={16}
                max={127}
                helpContent={t("config.help.audioBufferLength")}
                issue={fieldIssue(bridge.issues, "audioBufferLength")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("audioBufferLength", value)}
              />
              <ToggleControl
                label={t("config.lockVolume")}
                value={bridge.draft.lockVolume}
                helpContent={t("config.help.lockVolume")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("lockVolume", value)}
              />
            </div>
          </section>

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
                helpContent={t("config.help.pollingRateMode")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("pollingRateMode", value)}
              />
            </div>
          </section>
        </div>

        <div className="config-column">
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
                min={0}
                max={60}
                helpContent={t("config.help.inactiveTime")}
                issue={fieldIssue(bridge.issues, "inactiveTime")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("inactiveTime", value)}
              />
              <ToggleControl
                label={t("config.disablePicoLed")}
                value={bridge.draft.disablePicoLed}
                helpContent={t("config.help.disablePicoLed")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("disablePicoLed", value)}
              />
              <ToggleControl
                label={t("config.disableMic")}
                value={bridge.draft.disableMic}
                helpContent={t("config.help.disableMic")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("disableMic", value)}
              />
              <ToggleControl
                label={t("config.disableSpeaker")}
                value={bridge.draft.disableSpeaker}
                helpContent={t("config.help.disableSpeaker")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("disableSpeaker", value)}
              />
              <ToggleControl
                label={t("config.enableWake")}
                value={bridge.draft.enableWake}
                helpContent={t("config.help.enableWake")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("enableWake", value)}
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
                helpContent={t("config.help.controllerMode")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("controllerMode", value)}
              />
              <ToggleControl
                label={t("config.enableUsbSn")}
                value={bridge.draft.enableUsbSn}
                helpContent={t("config.help.enableUsbSn")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("enableUsbSn", value)}
              />
              <ToggleControl
                label={t("config.psShortcutEnabled")}
                value={bridge.draft.psShortcutEnabled}
                helpContent={t("config.help.psShortcutEnabled")}
                disabled={controlsDisabled}
                onChange={(value) => bridge.setDraftField("psShortcutEnabled", value)}
              />
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
