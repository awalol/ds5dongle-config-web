import { Power, Usb } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DeviceStripProps {
  authorizedDevices: HIDDevice[];
  client: unknown | null;
  deviceLabel: string;
  firmwareVersion: string | null;
  isBusy: boolean;
  supported: boolean;
  onConnect: () => void;
  onConnectAuthorized: (device: HIDDevice) => void;
}

export function DeviceStrip({
  authorizedDevices,
  client,
  deviceLabel,
  firmwareVersion,
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
              <div className="device-firmware">
                <span>{t("device.firmwareVersion")}</span>
                <code>{firmwareVersion || t("device.firmwareUnknown")}</code>
              </div>
            )}
          </div>
        </div>
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
