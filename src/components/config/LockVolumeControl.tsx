import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LockVolumeMode } from "../../protocol/config";
import { ConfigHelpButton } from "./ConfigHelpButton";

interface LockVolumeControlProps {
  label: string;
  value: LockVolumeMode;
  helpContent?: string;
  disabled?: boolean;
  onChange: (value: LockVolumeMode) => void;
}

export function LockVolumeControl({
  label,
  value,
  helpContent,
  disabled = false,
  onChange,
}: LockVolumeControlProps) {
  const { t } = useTranslation();

  return (
    <div className="control-row toggle-row audio-device-select-row" aria-disabled={disabled}>
      <span className="control-label">
        <strong>{label}</strong>
        {helpContent && <ConfigHelpButton title={label} content={helpContent} />}
      </span>
      <span className="audio-device-select-wrapper lock-volume-select-wrapper">
        <select
          className="audio-device-select lock-volume-select"
          value={String(value)}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value) as LockVolumeMode)}
        >
          <option value="0">{t("config.lockVolumeOptions.off")}</option>
          <option value="1">{t("config.lockVolumeOptions.gameSoftware")}</option>
          <option value="2">{t("config.lockVolumeOptions.uac")}</option>
        </select>
        <ChevronDown className="audio-device-select-chevron" size={14} aria-hidden="true" />
      </span>
    </div>
  );
}
