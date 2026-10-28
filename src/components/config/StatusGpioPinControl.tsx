import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  PICO2_W_STATUS_GPIO_PINS,
  STATUS_GPIO_DISABLED,
  type ConfigValidationIssue,
} from "../../protocol/config";
import { ConfigHelpButton } from "./ConfigHelpButton";

interface StatusGpioPinControlProps {
  label: string;
  value: number;
  helpContent?: string;
  issue?: ConfigValidationIssue;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function StatusGpioPinControl({
  label,
  value,
  helpContent,
  issue,
  disabled = false,
  onChange,
}: StatusGpioPinControlProps) {
  const { t } = useTranslation();
  const selectId = useId();
  const issueId = `${selectId}-issue`;

  return (
    <div
      className={`control-row toggle-row audio-device-select-row ${issue ? "invalid" : ""}`}
      aria-disabled={disabled}
    >
      <div>
        <span className="control-label">
          <label htmlFor={selectId}>
            <strong>{label}</strong>
          </label>
          {helpContent && <ConfigHelpButton title={label} content={helpContent} />}
        </span>
        {issue && <small id={issueId}>{t(`validation.${issue.field}`)}</small>}
      </div>
      <span className="audio-device-select-wrapper status-gpio-pin-select-wrapper">
        <select
          id={selectId}
          className="audio-device-select status-gpio-pin-select"
          value={String(value)}
          disabled={disabled}
          aria-invalid={Boolean(issue)}
          aria-describedby={issue ? issueId : undefined}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          <option value={String(STATUS_GPIO_DISABLED)}>
            {t("config.statusGpioPinOptions.disabled")}
          </option>
          <optgroup label="Pico 2 W">
            {PICO2_W_STATUS_GPIO_PINS.map((pin) => (
              <option key={pin} value={String(pin)}>
                GPIO {pin}
              </option>
            ))}
          </optgroup>
        </select>
        <ChevronDown className="audio-device-select-chevron" size={14} aria-hidden="true" />
      </span>
    </div>
  );
}
