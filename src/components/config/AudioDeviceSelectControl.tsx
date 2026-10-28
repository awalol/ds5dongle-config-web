import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AUDIO_DEVICE_SELECT_OPTIONS, AudioDeviceSelect } from "../../protocol/config";
import { ConfigHelpButton } from "./ConfigHelpButton";

interface AudioDeviceSelectControlProps {
  label: string;
  value: AudioDeviceSelect;
  helpContent?: string;
  disabled?: boolean;
  onChange: (value: AudioDeviceSelect) => void;
}

export function AudioDeviceSelectControl({
  label,
  value,
  helpContent,
  disabled = false,
  onChange,
}: AudioDeviceSelectControlProps) {
  const { t } = useTranslation();
  const optionLabels: Record<AudioDeviceSelect, string> = {
    0: t("config.audioDeviceSelectOptions.auto"),
    1: t("config.audioDeviceSelectOptions.builtin"),
    2: t("config.audioDeviceSelectOptions.headphone"),
    3: t("config.audioDeviceSelectOptions.disabled"),
  };

  return (
    <div className="control-row toggle-row audio-device-select-row" aria-disabled={disabled}>
      <span className="control-label">
        <strong>{label}</strong>
        {helpContent && <ConfigHelpButton title={label} content={helpContent} />}
      </span>
      <span className="audio-device-select-wrapper">
        <select
          className="audio-device-select"
          value={String(value)}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value) as AudioDeviceSelect)}
        >
          {AUDIO_DEVICE_SELECT_OPTIONS.map((option) => (
            <option key={option.value} value={String(option.value)}>
              {optionLabels[option.value]}
            </option>
          ))}
        </select>
        <ChevronDown className="audio-device-select-chevron" size={14} aria-hidden="true" />
      </span>
    </div>
  );
}
