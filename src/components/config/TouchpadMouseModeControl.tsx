import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TouchpadMouseMode } from "../../protocol/config";
import { ConfigHelpButton } from "./ConfigHelpButton";

interface TouchpadMouseModeControlProps {
  label: string;
  value: TouchpadMouseMode;
  helpContent?: string;
  disabled?: boolean;
  onChange: (value: TouchpadMouseMode) => void;
}

export function TouchpadMouseModeControl({
  label,
  value,
  helpContent,
  disabled = false,
  onChange,
}: TouchpadMouseModeControlProps) {
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
          onChange={(event) => onChange(Number(event.target.value) as TouchpadMouseMode)}
        >
          <option value="0">{t("config.touchpadMouseOptions.off")}</option>
          <option value="1">{t("config.touchpadMouseOptions.shared")}</option>
          <option value="2">{t("config.touchpadMouseOptions.exclusive")}</option>
        </select>
        <ChevronDown className="audio-device-select-chevron" size={14} aria-hidden="true" />
      </span>
    </div>
  );
}
