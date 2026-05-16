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
          <div className="control-stack">
            <FloatControl
              label={t("config.hapticsGain")}
              value={bridge.draft.hapticsGain}
              min={1}
              max={2}
              step={0.05}
              issue={fieldIssue(bridge.issues, "hapticsGain")}
              onChange={(value) => bridge.setDraftField("hapticsGain", value)}
            />
            <FloatControl
              label={`${t("config.speakerVolume")} (%)`}
              value={bridge.draft.speakerVolume}
              min={-100}
              max={0}
              step={0.01}
              displayMin={0}
              displayMax={100}
              displayStep={1}
              valueToDisplay={speakerVolumeToPercent}
              displayToValue={percentToSpeakerVolume}
              fractionDigits={0}
              issue={fieldIssue(bridge.issues, "speakerVolume")}
              onChange={(value) => bridge.setDraftField("speakerVolume", value)}
            />
            <IntegerControl
              label={t("config.hapticsBufferLength")}
              value={bridge.draft.hapticsBufferLength}
              min={16}
              max={128}
              issue={fieldIssue(bridge.issues, "hapticsBufferLength")}
              onChange={(value) => bridge.setDraftField("hapticsBufferLength", value)}
            />
          </div>
        </section>

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
              min={10}
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
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function speakerVolumeToPercent(value: number): number {
  if (value <= -100) {
    return 0;
  }

  return Math.min(100, Math.max(0, 100 * 10 ** (value / 20)));
}

function percentToSpeakerVolume(value: number): number {
  if (value <= 0) {
    return -100;
  }

  return Math.min(0, Math.max(-100, 20 * Math.log10(value / 100)));
}
