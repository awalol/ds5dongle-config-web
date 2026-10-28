import type { ReactNode } from "react";
import { Power, Usb } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AudioActivityState } from "../protocol/ds5BridgeHid";

interface DeviceStripProps {
  children?: ReactNode;
  authorizedDevices: HIDDevice[];
  client: unknown | null;
  deviceLabel: string;
  firmwareVersion: string | null;
  signalStrengthRssi: number | null;
  audioActivity: AudioActivityState | null;
  isBusy: boolean;
  supported: boolean;
  onConnect: () => void;
  onConnectAuthorized: (device: HIDDevice) => void;
}

export function DeviceStrip({
  children,
  authorizedDevices,
  client,
  deviceLabel,
  firmwareVersion,
  signalStrengthRssi,
  audioActivity,
  isBusy,
  supported,
  onConnect,
  onConnectAuthorized,
}: DeviceStripProps) {
  const { t } = useTranslation();
  const connected = Boolean(client);

  return (
    <Card className="device-strip-card">
      <CardContent className="device-strip">
        <div className="device-main">
          <div className="device-icon">
            <Usb size={22} />
          </div>
          <div>
            <div className="label">{t("device.label")}</div>
            <strong>{deviceLabel}</strong>
            {connected && (
              <div className="device-metadata">
                <span className="device-metadata-item">
                  <span>{t("device.firmwareVersion")}</span>
                  <code>{firmwareVersion || t("device.firmwareUnknown")}</code>
                </span>
                <span className="device-metadata-item" title={t("device.signalStrengthTitle")}>
                  <span>{t("device.signalStrength")}</span>
                  <code>{formatSignalStrength(signalStrengthRssi, t)}</code>
                </span>
                {audioActivity && (
                  <span className="device-metadata-item device-audio-activity">
                    <span>{t("device.audioSpeaker")}</span>
                    <code>{audioActivity.speakerActive ? t("device.audioActive") : t("device.audioInactive")}</code>
                    <span>{t("device.audioMicrophone")}</span>
                    <code>{audioActivity.micActive ? t("device.audioActive") : t("device.audioInactive")}</code>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {children}
        <div className="device-actions">
          {authorizedDevices.length > 0 && !connected && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onConnectAuthorized(authorizedDevices[0])}
              disabled={isBusy}
              title={t("device.openTitle")}
            >
              <Power size={17} />
              {t("device.open")}
            </Button>
          )}
          <Button
            type="button"
            onClick={onConnect}
            disabled={!supported || isBusy}
            title={t("device.connectTitle")}
          >
            <Usb size={17} />
            {t("device.connect")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatSignalStrength(
  signalStrengthRssi: number | null,
  t: (key: string) => string,
): string {
  return signalStrengthRssi === null ? t("device.signalStrengthUnknown") : `${signalStrengthRssi} dBm`;
}
