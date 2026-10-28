import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StatusGpioMode } from "../../protocol/config";
import { ConfigHelpButton } from "./ConfigHelpButton";

interface StatusGpioModeControlProps {
  label: string;
  value: StatusGpioMode;
  helpContent?: string;
  disabled?: boolean;
  onChange: (value: StatusGpioMode) => void;
}

export function StatusGpioModeControl({
  label,
  value,
  helpContent,
  disabled = false,
  onChange,
}: StatusGpioModeControlProps) {
  const { t } = useTranslation();

  return (
    <div className="control-row toggle-row audio-device-select-row" aria-disabled={disabled}>
      <span className="control-label">
        <strong>{label}</strong>
        {helpContent && <ConfigHelpButton title={label} content={helpContent} />}
      </span>
      <span className="audio-device-select-wrapper status-gpio-mode-select-wrapper">
        <select
          className="audio-device-select status-gpio-mode-select"
          value={String(value)}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value) as StatusGpioMode)}
        >
          <option value="0">{t("config.statusGpioModeOptions.connected")}</option>
          <option value="1">{t("config.statusGpioModeOptions.pulse")}</option>
        </select>
        <ChevronDown className="audio-device-select-chevron" size={14} aria-hidden="true" />
      </span>
    </div>
  );
}
