import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { ConfigHelpButton } from "./ConfigHelpButton";

interface ToggleControlProps {
  label: string;
  value: boolean;
  helpContent?: string;
  disabledReason?: string;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleControl({ label, value, helpContent, disabledReason, disabled = false, onChange }: ToggleControlProps) {
  const { t } = useTranslation();

  return (
    <div className="control-row toggle-row" aria-disabled={disabled}>
      <span className="control-label">
        <strong>{label}</strong>
        {helpContent && <ConfigHelpButton title={label} content={helpContent} />}
        {disabled && disabledReason && <small>{disabledReason}</small>}
      </span>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        disabled={disabled}
        className="justify-self-end"
        title={value ? t("toggle.enabled") : t("toggle.disabled")}
      />
    </div>
  );
}
