import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { ConfigHelpButton } from "./ConfigHelpButton";

interface ToggleControlProps {
  label: string;
  value: boolean;
  helpContent?: string;
  onChange: (value: boolean) => void;
}

export function ToggleControl({ label, value, helpContent, onChange }: ToggleControlProps) {
  const { t } = useTranslation();

  return (
    <div className="control-row toggle-row">
      <span className="control-label">
        <strong>{label}</strong>
        {helpContent && <ConfigHelpButton title={label} content={helpContent} />}
      </span>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        className="justify-self-end"
        title={value ? t("toggle.enabled") : t("toggle.disabled")}
      />
    </div>
  );
}
